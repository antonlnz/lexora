/**
 * YouTube Source Handler
 * 
 * Maneja fuentes de YouTube (canales, usuarios, playlists).
 * Convierte las URLs de YouTube a feeds RSS para su procesamiento.
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

// ============================================================================
// TIPOS INTERNOS
// ============================================================================

interface YouTubeFeedItem {
  title: string
  link: string
  id?: string
  pubDate?: string
  isoDate?: string
  author?: string
  content?: string
  contentSnippet?: string
  // Campos específicos de YouTube
  'yt:videoId'?: string
  'yt:channelId'?: string
  'media:group'?: {
    'media:description': string[]
    'media:thumbnail': Array<{
      $: { url: string; width: string; height: string }
    }>
    'media:content': Array<{
      $: { url: string; type: string; duration: string }
    }>
  }
}

interface YouTubeFeed {
  items: YouTubeFeedItem[]
  title?: string
  description?: string
  link?: string
  image?: {
    url: string
  }
}

// ============================================================================
// HANDLER YOUTUBE
// ============================================================================

export class YouTubeHandler implements SourceHandler {
  readonly type: SourceType[] = ['youtube_channel', 'youtube_video']
  readonly displayName = 'YouTube'
  readonly description = 'YouTube channels and playlists'
  readonly iconName = 'Youtube'
  readonly colorClasses = 'bg-red-500/10 text-red-600 border-red-500/20'
  
  readonly urlPatterns = [
    /youtube\.com\/channel\/(UC[0-9A-Za-z_-]+)/,
    /youtube\.com\/c\/([\w-]+)/,
    /youtube\.com\/user\/([\w-]+)/,
    /youtube\.com\/@([\w-]+)/,
    /youtube\.com\/watch\?v=([\w-]+)/,
    /youtu\.be\/([\w-]+)/,
    /youtube\.com\/playlist\?list=([\w-]+)/,
    /youtube\.com\/feeds\/videos\.xml/,
  ]

  private parser: Parser<YouTubeFeed, YouTubeFeedItem>
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
          ['yt:videoId', 'yt:videoId'],
          ['yt:channelId', 'yt:channelId'],
          ['media:group', 'media:group'],
        ],
      },
    })
  }

  // ==========================================================================
  // MÉTODOS DE DETECCIÓN
  // ==========================================================================

  async detectUrl(url: string): Promise<DetectionResult> {
    try {
      const u = new URL(url)
      const host = u.hostname.replace(/^www\./, '').toLowerCase()

      // Verificar si es dominio de YouTube
      if (!host.includes('youtube.com') && host !== 'youtu.be') {
        return { detected: false }
      }

      // Es una URL de YouTube
      const rssUrl = await this.transformUrl(url)
      
      // Determinar el tipo específico
      const sourceType: SourceType = url.includes('/watch?v=') || url.includes('youtu.be/')
        ? 'youtube_video'
        : 'youtube_channel'

      return {
        detected: true,
        transformedUrl: rssUrl || undefined,
        sourceType,
      }
    } catch {
      return { detected: false }
    }
  }

  async transformUrl(url: string): Promise<string | null> {
    return this.getYoutubeRssFeedUrl(url)
  }

  isValidUrl(url: string): boolean {
    try {
      const u = new URL(url)
      const host = u.hostname.replace(/^www\./, '').toLowerCase()
      return host.includes('youtube.com') || host === 'youtu.be'
    } catch {
      return false
    }
  }

  // ==========================================================================
  // MÉTODOS DE FETCH
  // ==========================================================================

  async fetchFeed(url: string, options?: HandlerOptions): Promise<FeedInfo | null> {
    try {
      // Si no es ya una URL de feed RSS, transformarla
      let feedUrl = url
      if (!url.includes('/feeds/videos.xml')) {
        const transformed = await this.transformUrl(url)
        if (!transformed) {
          console.error(`Could not transform YouTube URL: ${url}`)
          return null
        }
        feedUrl = transformed
      }

      const feed = await this.parser.parseURL(feedUrl)
      
      const items: ProcessedContentItem[] = feed.items.map(item => {
        const videoId = this.extractVideoId(item)
        const media = this.extractMediaInfo(item, videoId)
        
        return {
          url: item.link || `https://www.youtube.com/watch?v=${videoId}`,
          title: item.title || 'Sin título',
          content: this.extractDescription(item),
          excerpt: this.extractExcerpt(item),
          author: item.author || feed.title || null,
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          media,
          readingTime: null,
          wordCount: null,
          metadata: {
            videoId,
            channelId: item['yt:channelId'],
            channelName: item.author || feed.title,
          },
        }
      })

      return {
        title: feed.title || 'Canal de YouTube',
        description: feed.description || null,
        imageUrl: feed.image?.url || null,
        items,
      }
    } catch (error) {
      console.error(`Error fetching YouTube feed ${url}:`, error)
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
        await this.updateSourceError(supabase, source.id, 'Failed to fetch YouTube feed')
        return {
          success: false,
          articlesAdded: 0,
          articlesUpdated: 0,
          error: 'Failed to fetch YouTube feed',
        }
      }

      // Filtrar items si es necesario
      let items = feed.items.filter(item => item.url && item.title)

      if (filterRecent) {
        const twentyFourHoursAgo = new Date()
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

        items = items.filter(item => {
          const itemDate = new Date(item.publishedAt)
          return itemDate >= twentyFourHoursAgo
        })
      }

      // Recopilar todos los video IDs para obtener detalles en lote
      const videoIds: string[] = []
      for (const item of items) {
        const videoId = (item.metadata?.videoId as string) || this.extractVideoIdFromUrl(item.url)
        if (videoId) videoIds.push(videoId)
      }

      // Obtener detalles de video (duration, view_count, like_count)
      const videoDetailsMap = await this.fetchVideoDetails(videoIds)

      let articlesAdded = 0
      let articlesUpdated = 0

      for (const item of items) {
        const videoId = (item.metadata?.videoId as string) || this.extractVideoIdFromUrl(item.url)
        
        if (!videoId) continue

        // Obtener detalles del mapa (si existen)
        const details = videoDetailsMap.get(videoId)

        const videoData = {
          source_id: source.id,
          video_id: videoId,
          title: item.title,
          url: item.url,
          channel_name: (item.metadata?.channelName as string) || item.author,
          published_at: item.publishedAt,
          description: item.content,
          thumbnail_url: item.media.thumbnailUrl || item.media.mediaUrl,
          video_url: `https://www.youtube.com/watch?v=${videoId}`,
          // Usar duración del feed RSS si está disponible, sino de la API
          duration: item.media.duration || details?.duration || null,
          view_count: details?.viewCount || null,
          like_count: details?.likeCount || null,
        }

        // Verificar si ya existe
        const { data: existingVideo } = await supabase
          .from('youtube_content')
          .select('id')
          .eq('source_id', source.id)
          .eq('video_id', videoId)
          .single()

        if (existingVideo) {
          await supabase
            .from('youtube_content')
            .update(videoData)
            .eq('id', existingVideo.id)
          articlesUpdated++
        } else {
          await supabase.from('youtube_content').insert(videoData)
          articlesAdded++
        }

        if (onArticleProcessed) {
          await onArticleProcessed()
        }
      }

      await this.updateSourceSuccess(supabase, source)

      return {
        success: true,
        articlesAdded,
        articlesUpdated,
      }
    } catch (error) {
      console.error(`Error syncing YouTube feed for source ${source.id}:`, error)
      
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

  // ==========================================================================
  // MÉTODOS AUXILIARES
  // ==========================================================================

  /**
   * Obtiene el icono/avatar del canal de YouTube
   * Hace fetch de la página del canal para extraer la URL del avatar
   */
  async getFaviconUrl(url: string): Promise<string | null> {
    try {
      // Si es un feed RSS, extraer el channel_id
      const channelIdMatch = url.match(/[?&]channel_id=(UC[A-Za-z0-9_-]+)/)
      
      let channelPageUrl: string
      
      if (channelIdMatch) {
        channelPageUrl = `https://www.youtube.com/channel/${channelIdMatch[1]}`
      } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        // Si es una URL directa del canal
        channelPageUrl = url
      } else {
        // Fallback al icono genérico de YouTube
        return 'https://www.youtube.com/favicon.ico'
      }

      const response = await fetch(channelPageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        return 'https://www.youtube.com/favicon.ico'
      }

      const html = await response.text()

      // Buscar el avatar del canal en el JSON embebido
      // Formato: "avatar":{"thumbnails":[{"url":"...","width":...,"height":...}]}
      const avatarMatch = html.match(/"avatar":\s*\{\s*"thumbnails":\s*\[\s*\{\s*"url":\s*"([^"]+)"/)
      if (avatarMatch) {
        // Asegurar que la URL tenga protocolo https
        let avatarUrl = avatarMatch[1]
        if (avatarUrl.startsWith('//')) {
          avatarUrl = 'https:' + avatarUrl
        }
        return avatarUrl
      }

      // Alternativa: buscar og:image que suele ser el avatar del canal
      const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/)
      if (ogImageMatch) {
        return ogImageMatch[1]
      }

      // Fallback al icono genérico de YouTube
      return 'https://www.youtube.com/favicon.ico'
    } catch (error) {
      console.error('Error fetching YouTube channel favicon:', error)
      return 'https://www.youtube.com/favicon.ico'
    }
  }

  /**
   * Convierte una URL de YouTube a una URL de feed RSS
   */
  async getYoutubeRssFeedUrl(inputUrl: string): Promise<string | null> {
    const channelFeed = (id: string) => 
      `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`
    const playlistFeed = (id: string) => 
      `https://www.youtube.com/feeds/videos.xml?playlist_id=${id}`

    let u: URL
    try {
      u = new URL(inputUrl)
    } catch {
      return null
    }

    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const path = u.pathname
    const params = u.searchParams

    // Ya es un feed RSS
    if (path.includes('/feeds/videos.xml')) {
      return inputUrl
    }

    // Playlist directo
    const list = params.get('list')
    if (list) return playlistFeed(list)

    // Channel ID en path /channel/UC...
    const channelMatch = path.match(/\/channel\/(UC[0-9A-Za-z_-]+)/)
    if (channelMatch) return channelFeed(channelMatch[1])

    // Si es dominio youtube, intentamos fetch y parsear HTML por channelId
    if (!host.includes('youtube.com') && host !== 'youtu.be') return null

    try {
      const res = await fetch(u.href, { 
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) return null
      const html = await res.text()

      // Método 1: Buscar externalId (ID del canal principal)
      const externalIdMatch = html.match(/"externalId"\s*:\s*"(UC[0-9A-Za-z_-]+)"/)
      if (externalIdMatch) return channelFeed(externalIdMatch[1])

      // Método 2: Buscar en la URL canónica <link rel="canonical">
      const canonMatch = html.match(
        /<link[^>]+rel=["']canonical["'][^>]+href=["']https?:\/\/(?:www\.)?youtube\.com\/channel\/(UC[0-9A-Za-z_-]+)["']/i
      )
      if (canonMatch) return channelFeed(canonMatch[1])

      // Método 3: Buscar browseId junto a canonicalBaseUrl
      const browseIdMatch = html.match(/"browseId"\s*:\s*"(UC[0-9A-Za-z_-]+)"[^}]*"canonicalBaseUrl"/)
      if (browseIdMatch) return channelFeed(browseIdMatch[1])

      // Método 4: Buscar channelId junto con vanityChannelUrl
      const vanityMatch = html.match(/"channelId"\s*:\s*"(UC[0-9A-Za-z_-]+)"[^}]*"vanityChannelUrl"/)
      if (vanityMatch) return channelFeed(vanityMatch[1])

      // Método 5 (fallback): channelId cerca de "header"
      const headerMatch = html.match(/"header"[^}]*"channelId"\s*:\s*"(UC[0-9A-Za-z_-]+)"/)
      if (headerMatch) return channelFeed(headerMatch[1])

      // Último fallback: primera aparición de channelId
      const jsonMatch = html.match(/"channelId"\s*:\s*"(UC[0-9A-Za-z_-]+)"/)
      if (jsonMatch) return channelFeed(jsonMatch[1])
    } catch (err) {
      // CORS o fallo de fetch
      return null
    }

    return null
  }

  /**
   * Obtiene detalles de videos (duration, view_count, like_count) desde la API interna
   */
  private async fetchVideoDetails(videoIds: string[]): Promise<Map<string, { duration: number | null; viewCount: number | null; likeCount: number | null }>> {
    const detailsMap = new Map<string, { duration: number | null; viewCount: number | null; likeCount: number | null }>()
    
    if (videoIds.length === 0) return detailsMap

    try {
      // Determinar la URL base para la API
      // En desarrollo local usar localhost, en producción usar la URL del entorno
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
        'http://localhost:3000'
      
      // Dividir en lotes de 50 (límite de la API de YouTube)
      const batches: string[][] = []
      for (let i = 0; i < videoIds.length; i += 50) {
        batches.push(videoIds.slice(i, i + 50))
      }

      for (const batch of batches) {
        try {
          const response = await fetch(`${baseUrl}/api/youtube/video-details`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoIds: batch }),
          })

          if (response.ok) {
            const data = await response.json()
            for (const video of data.videos || []) {
              detailsMap.set(video.videoId, {
                duration: video.duration,
                viewCount: video.viewCount,
                likeCount: video.likeCount,
              })
            }
          }
        } catch (batchError) {
          console.warn('Error fetching video details batch:', batchError)
          // Continuar con el siguiente lote
        }
      }
    } catch (error) {
      console.warn('Error fetching video details:', error)
      // No es crítico, simplemente retornamos un mapa vacío
    }

    return detailsMap
  }

  /**
   * Extrae el ID del video de un item del feed
   */
  private extractVideoId(item: YouTubeFeedItem): string {
    if (item['yt:videoId']) {
      return item['yt:videoId']
    }
    if (item.id) {
      const match = item.id.match(/video:([A-Za-z0-9_-]+)/)
      if (match) return match[1]
    }
    if (item.link) {
      return this.extractVideoIdFromUrl(item.link)
    }
    return ''
  }

  /**
   * Extrae el ID del video de una URL
   */
  private extractVideoIdFromUrl(url: string): string {
    const patterns = [
      /youtube\.com\/watch\?v=([A-Za-z0-9_-]+)/,
      /youtu\.be\/([A-Za-z0-9_-]+)/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]+)/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return ''
  }

  /**
   * Extrae información de media de un item del feed
   */
  private extractMediaInfo(item: YouTubeFeedItem, videoId: string): MediaInfo {
    let thumbnailUrl: string | null = null
    let duration: number | null = null

    // Extraer de media:group
    if (item['media:group']) {
      const mediaGroup = item['media:group']
      
      // Thumbnail
      if (mediaGroup['media:thumbnail']?.length) {
        // Obtener la de mayor resolución
        const thumbnails = mediaGroup['media:thumbnail'].sort(
          (a, b) => parseInt(b.$.width || '0') - parseInt(a.$.width || '0')
        )
        thumbnailUrl = thumbnails[0]?.$.url || null
      }
      
      // Duration
      if (mediaGroup['media:content']?.length) {
        const durationStr = mediaGroup['media:content'][0]?.$?.duration
        if (durationStr) {
          duration = parseInt(durationStr, 10)
        }
      }
    }

    // Fallback a thumbnail estándar de YouTube
    if (!thumbnailUrl && videoId) {
      thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    }

    return {
      mediaType: 'video',
      mediaUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
      thumbnailUrl,
      duration,
    }
  }

  /**
   * Extrae la descripción del video
   */
  private extractDescription(item: YouTubeFeedItem): string | null {
    if (item['media:group']?.['media:description']?.length) {
      return item['media:group']['media:description'][0]
    }
    return item.content || item.contentSnippet || null
  }

  /**
   * Extrae un excerpt de la descripción
   */
  private extractExcerpt(item: YouTubeFeedItem): string | null {
    const description = this.extractDescription(item)
    if (!description) return null
    return description.length > 300 
      ? description.substring(0, 297) + '...' 
      : description
  }

  /**
   * Intenta extraer el nombre del canal de una URL
   */
  private async extractChannelName(url: string): Promise<string | null> {
    // Extraer de la URL si es posible
    const handleMatch = url.match(/@([A-Za-z0-9_-]+)/)
    if (handleMatch) return handleMatch[1]

    const userMatch = url.match(/\/user\/([A-Za-z0-9_-]+)/)
    if (userMatch) return userMatch[1]

    const cMatch = url.match(/\/c\/([A-Za-z0-9_-]+)/)
    if (cMatch) return cMatch[1]

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
export const youtubeHandler = new YouTubeHandler()

// Exportar función legacy para compatibilidad
export async function getYoutubeRssFeedUrl(inputUrl: string): Promise<string | null> {
  return youtubeHandler.getYoutubeRssFeedUrl(inputUrl)
}