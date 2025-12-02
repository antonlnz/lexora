/**
 * Source Handlers Registry
 * 
 * Punto de entrada centralizado para todos los handlers de fuentes.
 * Este módulo facilita la extensibilidad del sistema permitiendo:
 * 
 * 1. Registrar nuevos handlers de manera simple
 * 2. Detectar automáticamente el tipo de fuente a partir de una URL
 * 3. Obtener el handler apropiado para cada tipo de fuente
 * 
 * Para añadir un nuevo tipo de fuente:
 * 1. Crea un nuevo archivo en lib/source-handlers/ (ej: twitter.ts)
 * 2. Implementa la interfaz SourceHandler
 * 3. Importa e instancia el handler aquí
 * 4. Regístralo en la función registerBuiltInHandlers()
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { 
  SourceHandler, 
  SourceHandlerRegistry, 
  DetectionResult, 
  SyncResult,
  HandlerContext,
  FeedInfo 
} from './types'
import type { SourceType, ContentSource, UserSource } from '@/types/database'

// Importar handlers
import { rssHandler, RSSHandler } from './rss'
import { youtubeHandler, YouTubeHandler } from './youtube'
import { podcastHandler, PodcastHandler } from './podcast'

// ============================================================================
// REGISTRO DE HANDLERS
// ============================================================================

/**
 * Mapa de tipos de fuente a sus handlers
 */
const handlerRegistry: SourceHandlerRegistry = new Map()

/**
 * Lista ordenada de handlers para detección (el orden importa)
 */
const handlersList: SourceHandler[] = []

/**
 * Registra un handler en el sistema
 */
export function registerHandler(handler: SourceHandler): void {
  const types = Array.isArray(handler.type) ? handler.type : [handler.type]
  
  for (const type of types) {
    handlerRegistry.set(type, handler)
  }
  
  // Añadir a la lista si no está ya
  if (!handlersList.includes(handler)) {
    handlersList.push(handler)
  }
}

/**
 * Desregistra un handler del sistema
 */
export function unregisterHandler(handler: SourceHandler): void {
  const types = Array.isArray(handler.type) ? handler.type : [handler.type]
  
  for (const type of types) {
    handlerRegistry.delete(type)
  }
  
  const index = handlersList.indexOf(handler)
  if (index > -1) {
    handlersList.splice(index, 1)
  }
}

/**
 * Registra todos los handlers incluidos por defecto
 */
function registerBuiltInHandlers(): void {
  // Orden de prioridad para detección (más específicos primero)
  registerHandler(youtubeHandler)
  registerHandler(podcastHandler)
  registerHandler(rssHandler) // RSS al final como fallback
}

// Registrar handlers al importar el módulo
registerBuiltInHandlers()

// ============================================================================
// FUNCIONES DE ACCESO A HANDLERS
// ============================================================================

/**
 * Obtiene el handler para un tipo de fuente específico
 */
export function getHandler(sourceType: SourceType): SourceHandler | undefined {
  return handlerRegistry.get(sourceType)
}

/**
 * Obtiene todos los handlers registrados
 */
export function getAllHandlers(): SourceHandler[] {
  return [...handlersList]
}

/**
 * Obtiene los tipos de fuente soportados
 */
export function getSupportedTypes(): SourceType[] {
  return Array.from(handlerRegistry.keys())
}

/**
 * Verifica si un tipo de fuente está soportado
 */
export function isTypeSupported(sourceType: SourceType): boolean {
  return handlerRegistry.has(sourceType)
}

// ============================================================================
// FUNCIONES DE DETECCIÓN
// ============================================================================

/**
 * Detecta el tipo de fuente a partir de una URL
 * Prueba todos los handlers registrados en orden de prioridad
 * 
 * @param url - URL a analizar
 * @returns Resultado de la detección con el handler apropiado
 */
export async function detectSourceType(url: string): Promise<DetectionResult & { handler?: SourceHandler }> {
  // Probar cada handler en orden
  for (const handler of handlersList) {
    try {
      const result = await handler.detectUrl(url)
      if (result.detected) {
        return {
          ...result,
          handler,
        }
      }
    } catch (error) {
      console.error(`Error in ${handler.displayName} detection:`, error)
      // Continuar con el siguiente handler
    }
  }

  return { detected: false }
}

/**
 * Obtiene el handler apropiado para una URL
 * 
 * @param url - URL de la fuente
 * @returns Handler si se detectó, undefined si no
 */
export async function getHandlerForUrl(url: string): Promise<SourceHandler | undefined> {
  const detection = await detectSourceType(url)
  return detection.handler
}

// ============================================================================
// SERVICIO UNIFICADO DE SINCRONIZACIÓN
// ============================================================================

/**
 * Servicio central para sincronizar contenido de cualquier tipo de fuente.
 * Utiliza el handler apropiado basándose en el tipo de fuente.
 */
export class SourceSyncService {
  private supabaseClient?: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient
  }

  /**
   * Sincroniza el contenido de una fuente (últimas 24h)
   */
  async syncSource(
    source: ContentSource & { user_source?: UserSource },
    supabase: SupabaseClient,
    onArticleProcessed?: () => void | Promise<void>
  ): Promise<SyncResult> {
    const handler = getHandler(source.source_type)
    
    if (!handler) {
      console.warn(`No handler found for source type: ${source.source_type}`)
      return {
        success: false,
        articlesAdded: 0,
        articlesUpdated: 0,
        error: `Unsupported source type: ${source.source_type}`,
      }
    }

    const context: HandlerContext = {
      supabase,
      source,
      onArticleProcessed,
    }

    return handler.syncContent(context)
  }

  /**
   * Sincroniza todo el contenido de una fuente (sin filtro de tiempo)
   */
  async syncSourceFull(
    source: ContentSource & { user_source?: UserSource },
    supabase: SupabaseClient,
    onArticleProcessed?: () => void | Promise<void>
  ): Promise<SyncResult> {
    const handler = getHandler(source.source_type)
    
    if (!handler) {
      return {
        success: false,
        articlesAdded: 0,
        articlesUpdated: 0,
        error: `Unsupported source type: ${source.source_type}`,
      }
    }

    const context: HandlerContext = {
      supabase,
      source,
      onArticleProcessed,
    }

    // Usar syncAllContent si está disponible, sino syncContent
    if (handler.syncAllContent) {
      return handler.syncAllContent(context)
    }
    return handler.syncContent(context)
  }

  /**
   * Sincroniza múltiples fuentes
   */
  async syncSources(
    sources: Array<ContentSource & { user_source?: UserSource }>,
    supabase: SupabaseClient,
    options?: {
      onSourceComplete?: (source: ContentSource, result: SyncResult) => void | Promise<void>
      fullSync?: boolean
    }
  ): Promise<{
    totalSources: number
    successfulSyncs: number
    failedSyncs: number
    totalArticlesAdded: number
    totalArticlesUpdated: number
  }> {
    let successfulSyncs = 0
    let failedSyncs = 0
    let totalArticlesAdded = 0
    let totalArticlesUpdated = 0

    for (const source of sources) {
      const result = options?.fullSync 
        ? await this.syncSourceFull(source, supabase)
        : await this.syncSource(source, supabase)

      if (result.success) {
        successfulSyncs++
        totalArticlesAdded += result.articlesAdded
        totalArticlesUpdated += result.articlesUpdated
      } else {
        failedSyncs++
      }

      if (options?.onSourceComplete) {
        await options.onSourceComplete(source, result)
      }
    }

    return {
      totalSources: sources.length,
      successfulSyncs,
      failedSyncs,
      totalArticlesAdded,
      totalArticlesUpdated,
    }
  }

  /**
   * Obtiene el feed de una fuente
   */
  async fetchFeed(
    source: ContentSource
  ): Promise<FeedInfo | null> {
    const handler = getHandler(source.source_type)
    
    if (!handler) {
      console.warn(`No handler found for source type: ${source.source_type}`)
      return null
    }

    return handler.fetchFeed(source.url)
  }
}

// Instancia singleton del servicio
export const sourceSyncService = new SourceSyncService()

// ============================================================================
// RE-EXPORTAR TIPOS Y HANDLERS
// ============================================================================

// Re-exportar tipos
export * from './types'

// Re-exportar handlers para uso directo si es necesario
export { rssHandler, RSSHandler } from './rss'
export { youtubeHandler, YouTubeHandler, getYoutubeRssFeedUrl } from './youtube'
export { podcastHandler, PodcastHandler } from './podcast'

// ============================================================================
// INFORMACIÓN DE UI PARA LOS HANDLERS
// ============================================================================

/**
 * Obtiene información de UI para todos los handlers (para formularios, etc.)
 */
export function getHandlersUIInfo(): Array<{
  type: SourceType | SourceType[]
  displayName: string
  description: string
  iconName: string
  colorClasses: string
}> {
  return handlersList.map(handler => ({
    type: handler.type,
    displayName: handler.displayName,
    description: handler.description,
    iconName: handler.iconName,
    colorClasses: handler.colorClasses,
  }))
}

/**
 * Obtiene el icono y colores para un tipo de fuente
 */
export function getSourceTypeUIInfo(sourceType: SourceType): {
  displayName: string
  iconName: string
  colorClasses: string
} | null {
  const handler = getHandler(sourceType)
  if (!handler) return null

  return {
    displayName: handler.displayName,
    iconName: handler.iconName,
    colorClasses: handler.colorClasses,
  }
}
