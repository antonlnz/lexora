/**
 * RSS Source Handler
 * 
 * Maneja fuentes de tipo RSS, newsletters y websites genéricos.
 * Este es el handler más común y sirve como referencia para implementar otros.
 * 
 * OPTIMIZACIÓN: La extracción de contenido completo se hace de forma lazy
 * (cuando el usuario abre el artículo) para evitar lentitud en la sincronización.
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

// Límite de artículos a procesar por sincronización para evitar timeouts
const MAX_ARTICLES_PER_SYNC = 25
// Máximo de operaciones concurrentes a la base de datos
const MAX_CONCURRENT_DB_OPS = 5

// ============================================================================
// TIPOS INTERNOS
// ============================================================================

interface RSSFeedItem {
  title: string
  link: string
  content?: string
  contentSnippet?: string
  author?: string
  pubDate?: string
  isoDate?: string
  enclosure?: {
    url: string
    type: string
    length?: number
  }
  // Campos personalizados que extraemos
  mediaContent?: any
  mediaThumbnail?: any
  description?: string
  contentEncoded?: string
  itunesImage?: any
  itunesDuration?: string
  imageElement?: any
}

interface RSSFeed {
  items: RSSFeedItem[]
  title?: string
  description?: string
  image?: {
    url: string
  }
  favicon?: string
}

// ============================================================================
// HANDLER RSS
// ============================================================================

export class RSSHandler implements SourceHandler {
  readonly type: SourceType[] = ['rss', 'newsletter', 'website']
  readonly displayName = 'RSS Feed'
  readonly description = 'RSS feeds from news websites'
  readonly iconName = 'Rss'
  readonly colorClasses = 'bg-orange-500/10 text-orange-600 border-orange-500/20'
  
  readonly urlPatterns = [
    /\.rss$/i,
    /\.xml$/i,
    /\/feed\/?$/i,
    /\/rss\/?$/i,
    /\/atom\/?$/i,
    /feed\.xml/i,
    /rss\.xml/i,
    /atom\.xml/i,
  ]

  private parser: Parser<RSSFeed, RSSFeedItem>
  private defaultTimeout = 10000
  private defaultUserAgent = 'Lexora RSS Reader/1.0'

  constructor() {
    this.parser = new Parser({
      timeout: this.defaultTimeout,
      headers: {
        'User-Agent': this.defaultUserAgent,
      },
      customFields: {
        item: [
          ['media:content', 'mediaContent'],
          ['media:thumbnail', 'mediaThumbnail'],
          ['description', 'description'],
          ['content:encoded', 'contentEncoded'],
          ['itunes:image', 'itunesImage'],
          ['itunes:duration', 'itunesDuration'],
          ['image', 'imageElement'],
        ],
      },
    })
  }

  // ==========================================================================
  // MÉTODOS DE DETECCIÓN
  // ==========================================================================

  async detectUrl(url: string): Promise<DetectionResult> {
    // Verificar si coincide con algún patrón de RSS
    for (const pattern of this.urlPatterns) {
      if (pattern.test(url)) {
        return {
          detected: true,
          sourceType: 'rss',
          suggestedTitle: this.extractDomain(url),
        }
      }
    }

    // Intentar detectar feed RSS en la página
    try {
      const feedUrl = await this.discoverFeedUrl(url)
      if (feedUrl) {
        return {
          detected: true,
          transformedUrl: feedUrl,
          sourceType: 'rss',
          suggestedTitle: this.extractDomain(url),
        }
      }
    } catch {
      // No se pudo descubrir feed
    }

    // Si es una URL válida, podría ser un website
    try {
      new URL(url)
      return {
        detected: true,
        sourceType: 'website',
        suggestedTitle: this.extractDomain(url),
      }
    } catch {
      return { detected: false }
    }
  }

  async transformUrl(url: string): Promise<string | null> {
    // Primero verificar si ya es un feed RSS válido
    if (this.urlPatterns.some(pattern => pattern.test(url))) {
      return url
    }

    // Intentar descubrir feed RSS
    return this.discoverFeedUrl(url)
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
        url: item.link || '',
        title: item.title || 'Sin título',
        content: this.extractContent(item),
        excerpt: this.extractExcerpt(item),
        author: item.author || null,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        media: this.extractMediaInfo(item),
        readingTime: null,
        wordCount: null,
      }))

      return {
        title: feed.title || this.extractDomain(url),
        description: feed.description || null,
        imageUrl: feed.image?.url || null,
        items,
      }
    } catch (error) {
      console.error(`Error fetching RSS feed ${url}:`, error)
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
        await this.updateSourceError(supabase, source.id, 'Failed to fetch feed')
        return {
          success: false,
          articlesAdded: 0,
          articlesUpdated: 0,
          error: 'Failed to fetch feed',
        }
      }

      // Filtrar items con URL y título válidos
      let items = feed.items.filter(item => item.url && item.title)

      if (filterRecent) {
        const twentyFourHoursAgo = new Date()
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

        items = items.filter(item => {
          const itemDate = new Date(item.publishedAt)
          return itemDate >= twentyFourHoursAgo
        })
      }

      // Limitar el número de artículos para evitar timeouts
      items = items.slice(0, MAX_ARTICLES_PER_SYNC)

      if (items.length === 0) {
        // No hay artículos nuevos, actualizar timestamp
        await this.updateSourceSuccess(supabase, source)
        return {
          success: true,
          articlesAdded: 0,
          articlesUpdated: 0,
        }
      }

      // Obtener URLs existentes de una sola vez para evitar múltiples queries
      const existingUrls = await this.getExistingArticleUrls(
        supabase, 
        source.id, 
        items.map(i => i.url)
      )

      let articlesAdded = 0
      let articlesUpdated = 0

      // Procesar en lotes para mejor rendimiento
      const batches = this.chunkArray(items, MAX_CONCURRENT_DB_OPS)
      
      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            if (!item.url || !item.title) return null

            // Usar contenido del RSS directamente (sin extracción adicional)
            // La extracción completa se hace de forma lazy cuando el usuario abre el artículo
            const readingTime = this.calculateReadingTime(item.content || '')
            const wordCount = (item.content || '').trim().split(/\s+/).filter(Boolean).length

            const articleData = {
              source_id: source.id,
              title: item.title,
              url: item.url,
              content: item.content || null,
              excerpt: item.excerpt || null,
              author: item.author || null,
              published_at: item.publishedAt,
              featured_media_type: item.media.mediaType === 'audio' ? 'none' : item.media.mediaType,
              featured_media_url: item.media.mediaUrl,
              featured_thumbnail_url: item.media.thumbnailUrl,
              featured_media_duration: item.media.duration,
              reading_time: readingTime,
              word_count: wordCount,
            }

            const exists = existingUrls.has(item.url)

            if (exists) {
              // Solo actualizar si ya existe
              const { error } = await supabase
                .from('rss_content')
                .update(articleData)
                .eq('source_id', source.id)
                .eq('url', item.url)
              
              if (!error) {
                return { type: 'updated' as const }
              }
            } else {
              // Insertar nuevo
              const { error } = await supabase
                .from('rss_content')
                .insert(articleData)
              
              if (!error) {
                return { type: 'added' as const }
              }
            }
            return null
          })
        )

        // Contar resultados
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            if (result.value.type === 'added') articlesAdded++
            if (result.value.type === 'updated') articlesUpdated++
          }
        }

        // Notificar progreso
        if (onArticleProcessed) {
          for (let i = 0; i < batch.length; i++) {
            await onArticleProcessed()
          }
        }
      }

      // Actualizar source con éxito
      await this.updateSourceSuccess(supabase, source)

      return {
        success: true,
        articlesAdded,
        articlesUpdated,
      }
    } catch (error) {
      console.error(`Error syncing RSS feed for source ${source.id}:`, error)
      
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
   * Obtiene las URLs de artículos existentes para esta fuente
   */
  private async getExistingArticleUrls(
    supabase: SupabaseClient,
    sourceId: string,
    urls: string[]
  ): Promise<Set<string>> {
    const { data } = await supabase
      .from('rss_content')
      .select('url')
      .eq('source_id', sourceId)
      .in('url', urls)

    return new Set((data || []).map(item => item.url))
  }

  /**
   * Divide un array en chunks de tamaño específico
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
      const urlObj = new URL(url)
      return `https://www.google.com/s2/favicons?domain=${urlObj.origin}&sz=128`
    } catch {
      return null
    }
  }

  /**
   * Extrae información de media de un item del feed
   */
  private extractMediaInfo(item: RSSFeedItem): MediaInfo {
    let mediaUrl: string | null = null
    let thumbnailUrl: string | null = null
    let mediaType: 'none' | 'image' | 'video' | 'audio' = 'none'
    let duration: number | null = null

    // 1. Verificar media:content
    if (item.mediaContent) {
      const mediaContent = Array.isArray(item.mediaContent) 
        ? item.mediaContent[0] 
        : item.mediaContent
      if (mediaContent?.$) {
        const url = mediaContent.$.url
        const type = mediaContent.$.type?.toLowerCase() || ''
        const medium = mediaContent.$.medium?.toLowerCase() || ''
        
        if (type.startsWith('video/') || medium === 'video') {
          mediaUrl = url
          mediaType = 'video'
          if (mediaContent.$.duration) {
            duration = Number(mediaContent.$.duration)
          }
          if (item.mediaThumbnail) {
            const thumbnail = Array.isArray(item.mediaThumbnail) 
              ? item.mediaThumbnail[0] 
              : item.mediaThumbnail
            if (thumbnail?.$ && thumbnail.$.url) {
              thumbnailUrl = thumbnail.$.url
            }
          }
        } else if (type.startsWith('image/') || medium === 'image') {
          mediaUrl = url
          mediaType = 'image'
        } else if (type.startsWith('audio/')) {
          mediaUrl = url
          mediaType = 'audio'
        }
      }
    }

    // 2. Verificar enclosure
    if (mediaType === 'none' && item.enclosure?.url) {
      const mimeType = item.enclosure.type?.toLowerCase() || ''
      if (mimeType.startsWith('video/')) {
        mediaUrl = item.enclosure.url
        mediaType = 'video'
        if (item.enclosure.length) {
          duration = Math.floor(Number(item.enclosure.length) / 1000)
        }
        if (item.mediaThumbnail) {
          const thumbnail = Array.isArray(item.mediaThumbnail) 
            ? item.mediaThumbnail[0] 
            : item.mediaThumbnail
          if (thumbnail?.$ && thumbnail.$.url) {
            thumbnailUrl = thumbnail.$.url
          }
        }
      } else if (mimeType.startsWith('image/')) {
        mediaUrl = item.enclosure.url
        mediaType = 'image'
      } else if (mimeType.startsWith('audio/')) {
        mediaUrl = item.enclosure.url
        mediaType = 'audio'
        if (item.itunesImage) {
          if (typeof item.itunesImage === 'object' && item.itunesImage.$?.href) {
            thumbnailUrl = item.itunesImage.$.href
          } else if (typeof item.itunesImage === 'string') {
            thumbnailUrl = item.itunesImage
          }
        }
      }
    }

    // 3. Verificar itunes:image
    if (mediaType === 'none' && item.itunesImage) {
      if (typeof item.itunesImage === 'object' && item.itunesImage.$?.href) {
        mediaUrl = item.itunesImage.$.href
      } else if (typeof item.itunesImage === 'string') {
        mediaUrl = item.itunesImage
      }
      mediaType = 'image'
    }

    // 4. Verificar media:thumbnail standalone
    if (mediaType === 'none' && item.mediaThumbnail) {
      const thumbnail = Array.isArray(item.mediaThumbnail) 
        ? item.mediaThumbnail[0] 
        : item.mediaThumbnail
      if (thumbnail?.$ && thumbnail.$.url) {
        mediaUrl = thumbnail.$.url
        mediaType = 'image'
      }
    }

    // 5. Verificar elemento <image>
    if (mediaType === 'none' && item.imageElement) {
      if (typeof item.imageElement === 'object' && item.imageElement.url) {
        mediaUrl = item.imageElement.url
      } else if (typeof item.imageElement === 'string') {
        mediaUrl = item.imageElement
      }
      mediaType = 'image'
    }

    // 6. Buscar en contenido HTML
    if (mediaType === 'none') {
      const content = item.contentEncoded || item.content || item.description || ''
      
      // Detectar iframes de video
      const iframeMatch = content.match(/<iframe[^>]+src="([^"]+)"/)
      if (iframeMatch) {
        const iframeSrc = iframeMatch[1]
        if (iframeSrc.includes('youtube.com') || iframeSrc.includes('youtu.be') || 
            iframeSrc.includes('vimeo.com') || iframeSrc.includes('dailymotion.com')) {
          mediaUrl = iframeSrc
          mediaType = 'video'
          
          if (iframeSrc.includes('youtube.com') || iframeSrc.includes('youtu.be')) {
            const videoIdMatch = iframeSrc.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([^?&]+)/)
            if (videoIdMatch) {
              thumbnailUrl = `https://img.youtube.com/vi/${videoIdMatch[1]}/maxresdefault.jpg`
            }
          }
        }
      }

      // Tags de video HTML5
      if (mediaType === 'none') {
        const videoMatch = content.match(/<video[^>]+src="([^"]+)"/)
        if (videoMatch) {
          mediaUrl = videoMatch[1]
          mediaType = 'video'
        }
      }

      // Imágenes en contenido
      if (mediaType === 'none') {
        const imgMatch = content.match(/<img[^>]+src="([^">]+)"/)
        if (imgMatch) {
          mediaUrl = imgMatch[1]
          mediaType = 'image'
        }
      }
    }

    return { mediaType, mediaUrl, thumbnailUrl, duration }
  }

  /**
   * Extrae el contenido de texto limpio
   */
  private extractContent(item: RSSFeedItem): string {
    const content = item.contentEncoded || item.content || item.description || ''
    return content.replace(/<[^>]*>/g, '').trim()
  }

  /**
   * Extrae el excerpt/resumen
   */
  private extractExcerpt(item: RSSFeedItem): string {
    const content = this.extractContent(item)
    return content.length > 300 ? content.substring(0, 297) + '...' : content
  }

  /**
   * Calcula el tiempo de lectura estimado
   */
  private calculateReadingTime(content: string): number {
    const wordsPerMinute = 250
    const words = content.trim().split(/\s+/).length
    return Math.ceil(words / wordsPerMinute)
  }

  /**
   * Extrae el dominio de una URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  /**
   * Intenta descubrir la URL del feed RSS de una página
   */
  private async discoverFeedUrl(pageUrl: string): Promise<string | null> {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': this.defaultUserAgent,
        },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) return null

      const html = await response.text()

      // Buscar link rel="alternate" type="application/rss+xml"
      const rssMatch = html.match(
        /<link[^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/i
      ) || html.match(
        /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/rss\+xml["']/i
      )

      if (rssMatch) {
        const feedUrl = rssMatch[1]
        // Resolver URL relativa
        return new URL(feedUrl, pageUrl).href
      }

      // Buscar link rel="alternate" type="application/atom+xml"
      const atomMatch = html.match(
        /<link[^>]+type=["']application\/atom\+xml["'][^>]+href=["']([^"']+)["']/i
      ) || html.match(
        /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/atom\+xml["']/i
      )

      if (atomMatch) {
        const feedUrl = atomMatch[1]
        return new URL(feedUrl, pageUrl).href
      }

      // Intentar rutas comunes
      const commonPaths = ['/feed', '/rss', '/atom.xml', '/feed.xml', '/rss.xml']
      for (const path of commonPaths) {
        const testUrl = new URL(path, pageUrl).href
        try {
          const testResponse = await fetch(testUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(2000),
          })
          if (testResponse.ok) {
            const contentType = testResponse.headers.get('content-type') || ''
            if (contentType.includes('xml') || contentType.includes('rss')) {
              return testUrl
            }
          }
        } catch {
          // Ignorar errores de test
        }
      }

      return null
    } catch {
      return null
    }
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
export const rssHandler = new RSSHandler()
