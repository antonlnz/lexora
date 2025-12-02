/**
 * RSS Service
 * 
 * Servicio de alto nivel para sincronizar feeds de usuarios.
 * Utiliza el sistema de handlers para procesar diferentes tipos de fuentes.
 * 
 * @deprecated Para nuevas funcionalidades, usar directamente sourceSyncService de lib/source-handlers
 */

import { createClient as createServerClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentSource, UserSource } from '@/types/database'
import { sourceSyncService, getHandler } from '@/lib/source-handlers'
import { rssHandler } from '@/lib/source-handlers/rss'

// Tipo para compatibilidad temporal
type Source = ContentSource & { user_source?: UserSource }

export class RSSService {
  private supabaseClient?: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient
  }

  /**
   * Obtiene el cliente de Supabase (proporcionado o crea uno nuevo)
   */
  private async getClient() {
    if (this.supabaseClient) {
      return this.supabaseClient
    }
    return await createServerClient()
  }

  /**
   * Fetch y parsea un feed RSS
   * @deprecated Usar rssHandler.fetchFeed() directamente
   */
  async fetchFeed(url: string) {
    const feed = await rssHandler.fetchFeed(url)
    if (!feed) return null
    
    // Transformar al formato legacy esperado
    return {
      items: feed.items.map(item => ({
        title: item.title,
        link: item.url,
        content: item.content,
        contentSnippet: item.excerpt,
        author: item.author,
        pubDate: item.publishedAt,
        isoDate: item.publishedAt,
        enclosure: item.media.mediaUrl ? {
          url: item.media.mediaUrl,
          type: item.media.mediaType === 'video' ? 'video/mp4' : 
                item.media.mediaType === 'audio' ? 'audio/mpeg' : 'image/jpeg'
        } : undefined,
      })),
      title: feed.title,
      description: feed.description,
      image: feed.imageUrl ? { url: feed.imageUrl } : undefined,
    }
  }

  /**
   * Sincroniza artículos de un feed RSS con la base de datos
   */
  async syncFeedArticles(
    source: Source,
    onArticleProcessed?: () => void | Promise<void>
  ): Promise<{
    success: boolean
    articlesAdded: number
    articlesUpdated: number
    error?: string
  }> {
    const supabase = await this.getClient()
    
    // Usar el servicio unificado de sincronización
    return sourceSyncService.syncSource(source, supabase, onArticleProcessed)
  }

  /**
   * Sincroniza artículos de un feed RSS sin filtro de tiempo (para entradas anteriores)
   */
  async syncFeedArticlesOlder(
    source: Source,
    onArticleProcessed?: () => void | Promise<void>
  ): Promise<{
    success: boolean
    articlesAdded: number
    articlesUpdated: number
    error?: string
  }> {
    const supabase = await this.getClient()
    
    // Usar el servicio unificado de sincronización con fullSync
    return sourceSyncService.syncSourceFull(source, supabase, onArticleProcessed)
  }

  /**
   * Sincroniza todos los feeds del usuario
   */
  async syncUserFeeds(userId: string): Promise<{
    totalSources: number
    successfulSyncs: number
    failedSyncs: number
    totalArticlesAdded: number
    totalArticlesUpdated: number
  }> {
    const supabase = await this.getClient()

    // Obtener todas las fuentes activas del usuario
    const { data: userSources, error } = await supabase
      .from('user_sources')
      .select(`
        *,
        source:content_sources(*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error || !userSources) {
      console.error('Error fetching user sources:', error)
      return {
        totalSources: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        totalArticlesAdded: 0,
        totalArticlesUpdated: 0,
      }
    }

    // Transformar y filtrar fuentes soportadas
    const sources: Source[] = userSources
      .filter(us => us.source && getHandler(us.source.source_type))
      .map(userSource => ({
        ...userSource.source,
        user_source: userSource
      }))

    // Sincronizar todas las fuentes
    return sourceSyncService.syncSources(sources, supabase)
  }
}

export const rssService = new RSSService()
