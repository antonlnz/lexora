/**
 * Podcast Source Handler
 * 
 * Maneja fuentes de podcasts (feeds RSS con audio).
 * Detecta automáticamente podcasts y extrae información específica de iTunes/podcast.
 */

import Parser from 'rss-parser'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { 
  SourceHandler, 
  HandlerOptions, 
  HandlerContext,
  FeedInfo, 
  ProcessedContentItem, 
  MediaInfo,
  SyncResult,
  DetectionResult 
} from './types'
import type { SourceType, ContentSource, UserSource } from '@/types/database'

// Límite de episodios a procesar por sincronización
const MAX_EPISODES_PER_SYNC = 25
// Máximo de operaciones concurrentes a la base de datos
const MAX_CONCURRENT_DB_OPS = 5

// ============================================================================
// TIPOS INTERNOS
// ============================================================================

interface PodcastFeedItem {
  title: string
  link: string
  guid?: string
  content?: string
  contentSnippet?: string
  creator?: string
  pubDate?: string
  isoDate?: string
  enclosure?: {
    url: string
    type: string
    length?: string
  }
  // Campos específicos de iTunes/podcasts
  'itunes:title'?: string
  'itunes:author'?: string
  'itunes:subtitle'?: string
  'itunes:summary'?: string
  'itunes:duration'?: string
  'itunes:explicit'?: string
  'itunes:image'?: { $?: { href?: string } } | string
  'itunes:episode'?: string
  'itunes:season'?: string
  'itunes:episodeType'?: string
}

interface PodcastFeed {
  items: PodcastFeedItem[]
  title?: string
  description?: string
  link?: string
  image?: {
    url: string
  }
  // Campos específicos de iTunes
  'itunes:author'?: string
  'itunes:image'?: { $?: { href?: string } } | string
  'itunes:category'?: any
  'itunes:explicit'?: string
  'itunes:owner'?: {
    'itunes:name'?: string
    'itunes:email'?: string
  }
}

// ============================================================================
// HANDLER PODCAST
// ============================================================================

export class PodcastHandler implements SourceHandler {
  readonly type: SourceType = 'podcast'
  readonly displayName = 'Podcast'
  readonly description = 'Podcasts and audio feeds'
  readonly iconName = 'Headphones'
  readonly colorClasses = 'bg-purple-500/10 text-purple-600 border-purple-500/20'
  
  readonly urlPatterns = [
    /podcast/i,
    /feeds\.feedburner\.com/,
    /feeds\.transistor\.fm/,
    /anchor\.fm/,
    /omnycontent\.com/,
    /rss\.art19\.com/,
    /feeds\.simplecast\.com/,
    /feeds\.megaphone\.fm/,
    /feeds\.buzzsprout\.com/,
    /pinecast\.com/,
    /feeds\.podcastmirror\.com/,
  ]

  private parser: Parser<PodcastFeed, PodcastFeedItem>
  private defaultTimeout = 10000
  private defaultUserAgent = 'Lexora Podcast Reader/1.0'

  constructor() {
    this.parser = new Parser({
      timeout: this.defaultTimeout,
      headers: {
        'User-Agent': this.defaultUserAgent,
      },
      customFields: {
        feed: [
          ['itunes:author', 'itunes:author'],
          ['itunes:image', 'itunes:image'],
          ['itunes:category', 'itunes:category'],
          ['itunes:explicit', 'itunes:explicit'],
          ['itunes:owner', 'itunes:owner'],
        ] as any,
        item: [
          ['itunes:title', 'itunes:title'],
          ['itunes:author', 'itunes:author'],
          ['itunes:subtitle', 'itunes:subtitle'],
          ['itunes:summary', 'itunes:summary'],
          ['itunes:duration', 'itunes:duration'],
          ['itunes:explicit', 'itunes:explicit'],
          ['itunes:image', 'itunes:image'],
          ['itunes:episode', 'itunes:episode'],
          ['itunes:season', 'itunes:season'],
          ['itunes:episodeType', 'itunes:episodeType'],
        ],
      },
    })
  }

  // ==========================================================================
  // MÉTODOS DE DETECCIÓN
  // ==========================================================================

  async detectUrl(url: string): Promise<DetectionResult> {
    // Verificar patrones conocidos de podcasts
    for (const pattern of this.urlPatterns) {
      if (pattern.test(url)) {
        return {
          detected: true,
          sourceType: 'podcast',
          suggestedTitle: this.extractPodcastName(url),
        }
      }
    }

    // Intentar fetch del feed para detectar si es un podcast
    try {
      const feed = await this.fetchFeed(url)
      if (feed && this.isPodcastFeed(feed)) {
        return {
          detected: true,
          sourceType: 'podcast',
          suggestedTitle: feed.title,
        }
      }
    } catch {
      // No se pudo verificar
    }

    return { detected: false }
  }

  async transformUrl(url: string): Promise<string | null> {
    // Los podcasts generalmente ya usan URLs de feed RSS directas
    return url
  }

  isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // ==========================================================================
  // MÉTODOS DE FETCH
  // ==========================================================================

  async fetchFeed(url: string, options?: HandlerOptions): Promise<FeedInfo | null> {
    try {
      const feed = await this.parser.parseURL(url)
      
      const items: ProcessedContentItem[] = feed.items.map(item => ({
        url: item.link || item.enclosure?.url || '',
        title: item['itunes:title'] || item.title || 'Sin título',
        content: item['itunes:summary'] || item.content || item.contentSnippet || null,
        excerpt: this.extractExcerpt(item),
        author: item['itunes:author'] || item.creator || null,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        media: this.extractMediaInfo(item),
        readingTime: null,
        wordCount: null,
        metadata: {
          episodeNumber: item['itunes:episode'] ? parseInt(item['itunes:episode'], 10) : null,
          seasonNumber: item['itunes:season'] ? parseInt(item['itunes:season'], 10) : null,
          episodeType: item['itunes:episodeType'] || 'full',
          explicit: item['itunes:explicit'] === 'yes',
          guid: item.guid,
        },
      }))

      return {
        title: feed.title || 'Podcast',
        description: feed.description || null,
        imageUrl: this.extractFeedImage(feed),
        items,
      }
    } catch (error) {
      console.error(`Error fetching podcast feed ${url}:`, error)
      return null
    }
  }

  // ==========================================================================
  // MÉTODOS DE SINCRONIZACIÓN
  // ==========================================================================

  async syncContent(context: HandlerContext): Promise<SyncResult> {
    return this.syncContentInternal(context, true)
  }

  async syncAllContent(context: HandlerContext): Promise<SyncResult> {
    return this.syncContentInternal(context, false)
  }

  private async syncContentInternal(
    context: HandlerContext, 
    filterRecent: boolean
  ): Promise<SyncResult> {
    const { supabase, source, onArticleProcessed } = context

    try {
      const feed = await this.fetchFeed(source.url)

      if (!feed) {
        await this.updateSourceError(supabase, source.id, 'Failed to fetch podcast feed')
        return {
          success: false,
          articlesAdded: 0,
          articlesUpdated: 0,
          error: 'Failed to fetch podcast feed',
        }
      }

      // Filtrar items con URL y título válidos
      let items = feed.items.filter(item => item.url && item.title && item.media.mediaUrl)

      if (filterRecent) {
        const twentyFourHoursAgo = new Date()
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

        items = items.filter(item => {
          const itemDate = new Date(item.publishedAt)
          return itemDate >= twentyFourHoursAgo
        })
      }

      // Limitar número de episodios
      items = items.slice(0, MAX_EPISODES_PER_SYNC)

      if (items.length === 0) {
        await this.updateSourceSuccess(supabase, source)
        return {
          success: true,
          articlesAdded: 0,
          articlesUpdated: 0,
        }
      }

      // Obtener URLs de audio existentes de una sola vez
      const audioUrls = items.map(i => i.media.mediaUrl!).filter(Boolean)
      const existingAudioUrls = await this.getExistingEpisodeUrls(supabase, source.id, audioUrls)

      let articlesAdded = 0
      let articlesUpdated = 0

      // Procesar en lotes
      const batches = this.chunkArray(items, MAX_CONCURRENT_DB_OPS)

      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            const audioUrl = item.media.mediaUrl
            if (!audioUrl) return null

            const episodeData = {
              source_id: source.id,
              title: item.title,
              url: item.url || audioUrl,
              author: item.author,
              published_at: item.publishedAt,
              description: item.excerpt,
              show_notes: item.content,
              audio_url: audioUrl,
              image_url: item.media.thumbnailUrl,
              duration: item.media.duration,
              episode_number: (item.metadata?.episodeNumber as number) || null,
              season_number: (item.metadata?.seasonNumber as number) || null,
            }

            const exists = existingAudioUrls.has(audioUrl)

            if (exists) {
              const { error } = await supabase
                .from('podcast_content')
                .update(episodeData)
                .eq('source_id', source.id)
                .eq('audio_url', audioUrl)
              
              if (!error) return { type: 'updated' as const }
            } else {
              const { error } = await supabase
                .from('podcast_content')
                .insert(episodeData)
              
              if (!error) return { type: 'added' as const }
            }
            return null
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            if (result.value.type === 'added') articlesAdded++
            if (result.value.type === 'updated') articlesUpdated++
          }
        }

        if (onArticleProcessed) {
          for (let i = 0; i < batch.length; i++) {
            await onArticleProcessed()
          }
        }
      }

      await this.updateSourceSuccess(supabase, source)

      return {
        success: true,
        articlesAdded,
        articlesUpdated,
      }
    } catch (error) {
      console.error(`Error syncing podcast feed for source ${source.id}:`, error)
      
      await this.updateSourceError(
        supabase, 
        source.id, 
        error instanceof Error ? error.message : 'Unknown error'
      )

      return {
        success: false,
        articlesAdded: 0,
        articlesUpdated: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Obtiene las URLs de audio existentes para esta fuente
   */
  private async getExistingEpisodeUrls(
    supabase: SupabaseClient,
    sourceId: string,
    audioUrls: string[]
  ): Promise<Set<string>> {
    const { data } = await supabase
      .from('podcast_content')
      .select('audio_url')
      .eq('source_id', sourceId)
      .in('audio_url', audioUrls)

    return new Set((data || []).map(item => item.audio_url))
  }

  /**
   * Divide un array en chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  // ==========================================================================
  // MÉTODOS AUXILIARES
  // ==========================================================================

  async getFaviconUrl(url: string): Promise<string | null> {
    try {
      const feed = await this.fetchFeed(url)
      return feed?.imageUrl || null
    } catch {
      return null
    }
  }

  /**
   * Verifica si un feed es un podcast basándose en su contenido
   */
  private isPodcastFeed(feed: FeedInfo): boolean {
    // Verificar si tiene elementos de audio
    const hasAudio = feed.items.some(item => 
      item.media.mediaType === 'audio' || 
      (item.media.mediaUrl?.includes('.mp3') || 
       item.media.mediaUrl?.includes('.m4a') ||
       item.media.mediaUrl?.includes('.ogg'))
    )

    // Verificar si tiene metadatos de iTunes
    const hasItunesData = feed.items.some(item => 
      item.metadata?.episodeNumber !== undefined ||
      item.metadata?.seasonNumber !== undefined
    )

    return hasAudio || hasItunesData
  }

  /**
   * Extrae información de media de un item del feed
   */
  private extractMediaInfo(item: PodcastFeedItem): MediaInfo {
    let audioUrl: string | null = null
    let thumbnailUrl: string | null = null
    let duration: number | null = null

    // Obtener URL del audio del enclosure
    if (item.enclosure?.url && item.enclosure.type?.startsWith('audio/')) {
      audioUrl = item.enclosure.url
    }

    // Parsear duración de iTunes (puede ser en segundos o HH:MM:SS)
    if (item['itunes:duration']) {
      duration = this.parseDuration(item['itunes:duration'])
    }

    // Obtener imagen del episodio
    if (item['itunes:image']) {
      if (typeof item['itunes:image'] === 'string') {
        thumbnailUrl = item['itunes:image']
      } else if (item['itunes:image'].$?.href) {
        thumbnailUrl = item['itunes:image'].$.href
      }
    }

    return {
      mediaType: 'audio',
      mediaUrl: audioUrl,
      thumbnailUrl,
      duration,
    }
  }

  /**
   * Extrae la imagen del feed
   */
  private extractFeedImage(feed: PodcastFeed): string | null {
    // Primero intentar iTunes image
    if (feed['itunes:image']) {
      if (typeof feed['itunes:image'] === 'string') {
        return feed['itunes:image']
      } else if (feed['itunes:image'].$?.href) {
        return feed['itunes:image'].$.href
      }
    }

    // Fallback a imagen estándar
    return feed.image?.url || null
  }

  /**
   * Extrae un excerpt del episodio
   */
  private extractExcerpt(item: PodcastFeedItem): string | null {
    const content = item['itunes:subtitle'] || 
                    item['itunes:summary'] || 
                    item.contentSnippet || 
                    item.content || ''
    
    // Limpiar HTML
    const cleanContent = content.replace(/<[^>]*>/g, '').trim()
    
    if (!cleanContent) return null
    return cleanContent.length > 300 
      ? cleanContent.substring(0, 297) + '...' 
      : cleanContent
  }

  /**
   * Extrae el nombre del podcast de la URL
   */
  private extractPodcastName(url: string): string | undefined {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace('www.', '').replace('feeds.', '')
    } catch {
      return undefined
    }
  }

  /**
   * Parsea la duración de iTunes a segundos
   */
  private parseDuration(duration: string): number | null {
    if (!duration) return null

    // Si ya es un número, asumimos que son segundos
    if (/^\d+$/.test(duration)) {
      return parseInt(duration, 10)
    }

    // Formato HH:MM:SS o MM:SS
    const parts = duration.split(':').map(p => parseInt(p, 10))
    
    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    } else if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1]
    }

    return null
  }

  /**
   * Actualiza la fuente con un error
   */
  private async updateSourceError(
    supabase: SupabaseClient, 
    sourceId: string, 
    error: string
  ): Promise<void> {
    await supabase
      .from('content_sources')
      .update({
        fetch_error: error,
        last_fetched_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
  }

  /**
   * Actualiza la fuente con éxito
   */
  private async updateSourceSuccess(
    supabase: SupabaseClient, 
    source: ContentSource & { user_source?: UserSource }
  ): Promise<void> {
    await supabase
      .from('content_sources')
      .update({
        fetch_error: null,
        last_fetched_at: new Date().toISOString(),
        fetch_count: (source.fetch_count || 0) + 1,
      })
      .eq('id', source.id)
  }
}

// Exportar instancia singleton
export const podcastHandler = new PodcastHandler()
