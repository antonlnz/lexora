/**
 * Tipos base para el sistema de Source Handlers
 * 
 * Este módulo define las interfaces y tipos que todos los handlers de fuentes
 * deben implementar para integrar nuevos tipos de contenido en la aplicación.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { 
  SourceType, 
  ContentSource, 
  UserSource,
  RSSContentInsert,
  YouTubeContentInsert,
  TwitterContentInsert,
  InstagramContentInsert,
  TikTokContentInsert,
  PodcastContentInsert,
} from '@/types/database'

// ============================================================================
// TIPOS DE CONTENIDO
// ============================================================================

/**
 * Información de media extraída de un item del feed
 */
export interface MediaInfo {
  mediaType: 'none' | 'image' | 'video' | 'audio'
  mediaUrl: string | null
  thumbnailUrl: string | null
  duration: number | null
}

/**
 * Item genérico de contenido procesado
 */
export interface ProcessedContentItem {
  /** URL única del contenido */
  url: string
  /** Título del contenido */
  title: string
  /** Contenido HTML completo (opcional) */
  content: string | null
  /** Resumen o extracto */
  excerpt: string | null
  /** Autor del contenido */
  author: string | null
  /** Fecha de publicación */
  publishedAt: string
  /** Información de media */
  media: MediaInfo
  /** Tiempo de lectura estimado en minutos */
  readingTime: number | null
  /** Número de palabras */
  wordCount: number | null
  /** Metadatos adicionales específicos del tipo de fuente */
  metadata?: Record<string, unknown>
}

/**
 * Resultado de la sincronización de contenido
 */
export interface SyncResult {
  success: boolean
  articlesAdded: number
  articlesUpdated: number
  error?: string
}

/**
 * Resultado de la detección de una URL
 */
export interface DetectionResult {
  /** Si la URL fue reconocida por el handler */
  detected: boolean
  /** URL transformada (ej: URL de YouTube a feed RSS) */
  transformedUrl?: string
  /** Tipo de fuente detectado */
  sourceType?: SourceType
  /** Título sugerido para la fuente */
  suggestedTitle?: string
  /** Metadatos adicionales extraídos de la URL */
  metadata?: Record<string, unknown>
}

/**
 * Información del feed obtenida
 */
export interface FeedInfo {
  title: string
  description: string | null
  imageUrl: string | null
  items: ProcessedContentItem[]
}

/**
 * Opciones de configuración para un handler
 */
export interface HandlerOptions {
  /** Cliente de Supabase a utilizar */
  supabaseClient?: SupabaseClient
  /** Timeout para peticiones HTTP en ms */
  timeout?: number
  /** User-Agent a usar en las peticiones */
  userAgent?: string
}

// ============================================================================
// CONTEXTO DEL HANDLER
// ============================================================================

/**
 * Contexto pasado a los métodos del handler
 */
export interface HandlerContext {
  /** Cliente de Supabase para operaciones de BD */
  supabase: SupabaseClient
  /** Fuente que se está procesando */
  source: ContentSource & { user_source?: UserSource }
  /** Callback opcional para notificar progreso */
  onProgress?: (processed: number, total: number) => void | Promise<void>
  /** Callback opcional cuando se procesa un artículo */
  onArticleProcessed?: () => void | Promise<void>
}

// ============================================================================
// INTERFAZ PRINCIPAL DEL HANDLER
// ============================================================================

/**
 * Interfaz base que todos los handlers de fuentes deben implementar.
 * 
 * Para añadir un nuevo tipo de fuente:
 * 1. Crea un nuevo archivo en lib/source-handlers/ (ej: twitter.ts)
 * 2. Implementa esta interfaz
 * 3. Registra el handler en lib/source-handlers/index.ts
 * 
 * @example
 * ```typescript
 * export class TwitterHandler implements SourceHandler {
 *   readonly type = 'twitter'
 *   readonly displayName = 'Twitter'
 *   // ... implementar métodos
 * }
 * ```
 */
export interface SourceHandler {
  /**
   * Tipo de fuente que maneja este handler
   * Debe coincidir con SourceType del schema
   */
  readonly type: SourceType | SourceType[]
  
  /**
   * Nombre para mostrar en la UI
   */
  readonly displayName: string
  
  /**
   * Descripción breve del tipo de fuente
   */
  readonly description: string
  
  /**
   * Nombre del icono a usar (de lucide-react)
   */
  readonly iconName: string
  
  /**
   * Clases CSS para el estilo del badge/icono
   */
  readonly colorClasses: string

  /**
   * Patrones de URL que este handler puede manejar
   */
  readonly urlPatterns: RegExp[]

  // ==========================================================================
  // MÉTODOS DE DETECCIÓN
  // ==========================================================================

  /**
   * Detecta si una URL puede ser manejada por este handler
   * y extrae información inicial si es posible.
   * 
   * @param url - URL a analizar
   * @returns Resultado de la detección
   */
  detectUrl(url: string): Promise<DetectionResult>

  /**
   * Transforma una URL de usuario a una URL procesable (ej: RSS feed)
   * 
   * @param url - URL original del usuario
   * @returns URL transformada o null si no se puede transformar
   */
  transformUrl?(url: string): Promise<string | null>

  // ==========================================================================
  // MÉTODOS DE FETCH
  // ==========================================================================

  /**
   * Obtiene el feed/contenido de la fuente
   * 
   * @param url - URL del feed
   * @param options - Opciones de configuración
   * @returns Información del feed o null si falla
   */
  fetchFeed(url: string, options?: HandlerOptions): Promise<FeedInfo | null>

  // ==========================================================================
  // MÉTODOS DE SINCRONIZACIÓN
  // ==========================================================================

  /**
   * Sincroniza el contenido de una fuente con la base de datos.
   * Solo sincroniza contenido reciente (últimas 24h por defecto).
   * 
   * @param context - Contexto con supabase client y fuente
   * @returns Resultado de la sincronización
   */
  syncContent(context: HandlerContext): Promise<SyncResult>

  /**
   * Sincroniza TODO el contenido disponible de una fuente (sin filtro de tiempo)
   * Útil para la primera sincronización o backfill.
   * 
   * @param context - Contexto con supabase client y fuente
   * @returns Resultado de la sincronización
   */
  syncAllContent?(context: HandlerContext): Promise<SyncResult>

  // ==========================================================================
  // MÉTODOS AUXILIARES
  // ==========================================================================

  /**
   * Valida si una URL es válida para este handler
   * 
   * @param url - URL a validar
   * @returns true si es válida
   */
  isValidUrl(url: string): boolean

  /**
   * Obtiene el favicon o imagen de la fuente
   * 
   * @param url - URL de la fuente
   * @returns URL del favicon o null
   */
  getFaviconUrl?(url: string): Promise<string | null>
}

// ============================================================================
// TIPOS AUXILIARES PARA IMPLEMENTACIONES
// ============================================================================

/**
 * Tipo para el registro de handlers
 */
export type SourceHandlerRegistry = Map<SourceType, SourceHandler>

/**
 * Tipo union para todos los tipos de contenido insertable
 */
export type ContentInsert = 
  | RSSContentInsert 
  | YouTubeContentInsert 
  | TwitterContentInsert 
  | InstagramContentInsert 
  | TikTokContentInsert 
  | PodcastContentInsert

/**
 * Tabla de contenido por tipo de fuente
 */
export const CONTENT_TABLES: Record<SourceType, string> = {
  rss: 'rss_content',
  youtube_channel: 'youtube_content',
  youtube_video: 'youtube_content',
  twitter: 'twitter_content',
  instagram: 'instagram_content',
  tiktok: 'tiktok_content',
  newsletter: 'rss_content', // Los newsletters usan la misma tabla que RSS
  website: 'rss_content',    // Los websites usan la misma tabla que RSS
  podcast: 'podcast_content',
}

/**
 * Tipo de contenido por tipo de fuente (para user_content)
 */
export const CONTENT_TYPES: Record<SourceType, string> = {
  rss: 'rss',
  youtube_channel: 'youtube',
  youtube_video: 'youtube',
  twitter: 'twitter',
  instagram: 'instagram',
  tiktok: 'tiktok',
  newsletter: 'rss',
  website: 'rss',
  podcast: 'podcast',
}
