import Parser from 'rss-parser'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { contentExtractor } from './content-extractor'
import type { Article, Source } from '@/types/database'

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
  }
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

export class RSSService {
  private parser: Parser<RSSFeed, RSSFeedItem>

  constructor() {
    this.parser = new Parser({
      timeout: 10000, // 10 segundos timeout
      headers: {
        'User-Agent': 'Lexora RSS Reader/1.0',
      },
      customFields: {
        item: [
          ['media:content', 'mediaContent'],
          ['media:thumbnail', 'mediaThumbnail'],
          ['description', 'description'],
          ['content:encoded', 'contentEncoded'],
          // Soporte para podcasts y iTunes
          ['itunes:image', 'itunesImage'],
          ['itunes:duration', 'itunesDuration'],
          // Soporte para elementos de imagen estándar
          ['image', 'imageElement'],
        ],
      },
    })
  }

  /**
   * Fetch y parsea un feed RSS
   */
  async fetchFeed(url: string): Promise<RSSFeed | null> {
    try {
      const feed = await this.parser.parseURL(url)
      return feed
    } catch (error) {
      console.error(`Error fetching RSS feed ${url}:`, error)
      return null
    }
  }

  /**
   * Extrae información de media (imagen o video) de un item del feed
   */
  private extractMediaInfo(item: any): {
    imageUrl: string | null
    videoUrl: string | null
    mediaType: 'image' | 'video' | 'audio' | 'none'
    videoDuration: number | null
  } {
    let imageUrl: string | null = null
    let videoUrl: string | null = null
    let mediaType: 'image' | 'video' | 'audio' | 'none' = 'none'
    let videoDuration: number | null = null

    // 1. Verificar itunes:image (podcasts y feeds de iTunes) - ALTA PRIORIDAD
    if (item.itunesImage) {
      // Puede venir como objeto con atributo href o como string
      if (typeof item.itunesImage === 'object' && item.itunesImage.$?.href) {
        imageUrl = item.itunesImage.$.href
        if (mediaType === 'none') mediaType = 'image'
      } else if (typeof item.itunesImage === 'string') {
        imageUrl = item.itunesImage
        if (mediaType === 'none') mediaType = 'image'
      }
    }

    // 2. Verificar enclosure para videos/audio/imágenes
    if (item.enclosure?.url) {
      const mimeType = item.enclosure.type?.toLowerCase() || ''
      if (mimeType.startsWith('video/')) {
        videoUrl = item.enclosure.url
        mediaType = 'video'
        // Intentar obtener duración si está disponible
        if (item.enclosure.length) {
          videoDuration = Math.floor(Number(item.enclosure.length) / 1000) // convertir de ms a segundos
        }
      } else if (mimeType.startsWith('audio/')) {
        // Es audio (podcast), pero podemos usar la imagen de itunes que ya capturamos
        mediaType = 'audio'
        if (item.itunesDuration) {
          // Convertir duración de formato HH:MM:SS o MM:SS a segundos
          const duration = item.itunesDuration
          if (typeof duration === 'string') {
            const parts = duration.split(':').map(Number)
            if (parts.length === 3) {
              videoDuration = parts[0] * 3600 + parts[1] * 60 + parts[2]
            } else if (parts.length === 2) {
              videoDuration = parts[0] * 60 + parts[1]
            } else if (parts.length === 1) {
              videoDuration = parts[0]
            }
          } else if (typeof duration === 'number') {
            videoDuration = duration
          }
        }
        if (item.enclosure.length && !videoDuration) {
          videoDuration = Math.floor(Number(item.enclosure.length) / 1000)
        }
      } else if (mimeType.startsWith('image/')) {
        // Solo usar enclosure para imagen si no tenemos itunes:image
        if (!imageUrl) {
          imageUrl = item.enclosure.url
          mediaType = 'image'
        }
      }
    }

    // 3. Verificar media:content para videos/imágenes
    if (item.mediaContent) {
      const mediaContent = Array.isArray(item.mediaContent) ? item.mediaContent[0] : item.mediaContent
      if (mediaContent?.$) {
        const url = mediaContent.$.url
        const type = mediaContent.$.type?.toLowerCase() || ''
        const medium = mediaContent.$.medium?.toLowerCase() || ''
        
        if (type.startsWith('video/') || medium === 'video') {
          videoUrl = url
          mediaType = 'video'
          if (mediaContent.$.duration) {
            videoDuration = Number(mediaContent.$.duration)
          }
        } else if ((type.startsWith('image/') || medium === 'image') && !imageUrl) {
          // Solo usar media:content para imagen si no tenemos itunes:image
          imageUrl = url
          if (mediaType === 'none') mediaType = 'image'
        }
      }
    }

    // 4. Verificar media:thumbnail para imagen de poster/thumbnail
    if (item.mediaThumbnail && !imageUrl) {
      const thumbnail = Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0] : item.mediaThumbnail
      if (thumbnail?.$ && thumbnail.$.url) {
        imageUrl = thumbnail.$.url
        if (mediaType === 'none') mediaType = 'image'
      }
    }

    // 5. Verificar elemento <image> estándar de RSS
    if (item.imageElement && !imageUrl) {
      if (typeof item.imageElement === 'object' && item.imageElement.url) {
        imageUrl = item.imageElement.url
        if (mediaType === 'none') mediaType = 'image'
      } else if (typeof item.imageElement === 'string') {
        imageUrl = item.imageElement
        if (mediaType === 'none') mediaType = 'image'
      }
    }

    // 6. Buscar videos en el contenido HTML (YouTube, Vimeo, etc.)
    const content = item.contentEncoded || item.content || item.description || ''
    
    // Detectar iframes de video (YouTube, Vimeo, etc.)
    const iframeMatch = content.match(/<iframe[^>]+src="([^"]+)"/)
    if (iframeMatch && !videoUrl) {
      const iframeSrc = iframeMatch[1]
      if (iframeSrc.includes('youtube.com') || iframeSrc.includes('youtu.be') || 
          iframeSrc.includes('vimeo.com') || iframeSrc.includes('dailymotion.com')) {
        videoUrl = iframeSrc
        if (mediaType === 'none' || mediaType === 'image') mediaType = 'video'
      }
    }

    // Detectar tags de video HTML5
    const videoMatch = content.match(/<video[^>]+src="([^"]+)"/)
    if (videoMatch && !videoUrl) {
      videoUrl = videoMatch[1]
      if (mediaType === 'none' || mediaType === 'image') mediaType = 'video'
    }

    // 7. Buscar imágenes en el contenido HTML si no hay imagen todavía
    if (!imageUrl) {
      const imgMatch = content.match(/<img[^>]+src="([^">]+)"/)
      if (imgMatch) {
        imageUrl = imgMatch[1]
        if (mediaType === 'none') mediaType = 'image'
      }
    }

    return {
      imageUrl,
      videoUrl,
      mediaType,
      videoDuration,
    }
  }

  /**
   * Extrae el contenido de texto limpio
   */
  private extractContent(item: any): string {
    const content = item.contentEncoded || item.content || item.description || ''
    // Eliminar tags HTML básico
    return content.replace(/<[^>]*>/g, '').trim()
  }

  /**
   * Extrae el excerpt/resumen
   */
  private extractExcerpt(item: any): string {
    const content = this.extractContent(item)
    // Limitar a 300 caracteres
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
   * Sincroniza artículos de un feed RSS con la base de datos
   */
  async syncFeedArticles(source: Source): Promise<{
    success: boolean
    articlesAdded: number
    articlesUpdated: number
    error?: string
  }> {
    try {
      const supabase = await createServerClient()
      const feed = await this.fetchFeed(source.url)

      if (!feed) {
        // Actualizar el source con el error
        await supabase
          .from('sources')
          .update({
            fetch_error: 'Failed to fetch feed',
            last_fetched_at: new Date().toISOString(),
          })
          .eq('id', source.id)

        return {
          success: false,
          articlesAdded: 0,
          articlesUpdated: 0,
          error: 'Failed to fetch feed',
        }
      }

      // Filtrar items de las últimas 24 horas
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const recentItems = feed.items.filter((item) => {
        const itemDate = item.isoDate || item.pubDate
        if (!itemDate) return false
        return new Date(itemDate) >= twentyFourHoursAgo
      })

      let articlesAdded = 0
      let articlesUpdated = 0

      // Procesar cada artículo
      for (const item of recentItems) {
        if (!item.link || !item.title) continue

        // Primero obtener datos básicos del RSS
        const rssContent = this.extractContent(item)
        const rssExcerpt = this.extractExcerpt(item)
        const mediaInfo = this.extractMediaInfo(item)

        // Intentar extraer contenido completo de la URL original
        let extractedContent = null
        try {
          // Pasar la imagen destacada para evitar duplicados
          extractedContent = await contentExtractor.extractFromUrl(item.link, {
            featuredImageUrl: mediaInfo.imageUrl
          })
        } catch (error) {
          console.error(`Failed to extract content from ${item.link}:`, error)
        }

        // Usar contenido extraído si está disponible, sino usar el del RSS
        const finalContent = extractedContent?.content || rssContent || null
        const finalTextContent = extractedContent?.textContent || rssContent || null
        const finalExcerpt = extractedContent?.excerpt || rssExcerpt || null
        const finalAuthor = extractedContent?.byline || item.author || null

        // Calcular reading time y word count del contenido final
        const readingTime = finalTextContent 
          ? contentExtractor.calculateReadingTime(finalTextContent)
          : this.calculateReadingTime(rssContent)
        const wordCount = finalTextContent
          ? contentExtractor.countWords(finalTextContent)
          : rssContent.trim().split(/\s+/).length

        const articleData = {
          source_id: source.id,
          title: item.title,
          url: item.link,
          content: finalContent,
          excerpt: finalExcerpt,
          author: finalAuthor,
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          image_url: mediaInfo.imageUrl,
          video_url: mediaInfo.videoUrl,
          media_type: mediaInfo.mediaType,
          video_duration: mediaInfo.videoDuration,
          reading_time: readingTime,
          word_count: wordCount,
        }

        // Intentar insertar o actualizar el artículo
        const { data: existingArticle } = await supabase
          .from('articles')
          .select('id')
          .eq('source_id', source.id)
          .eq('url', item.link)
          .single()

        if (existingArticle) {
          // Actualizar artículo existente
          await supabase
            .from('articles')
            .update(articleData)
            .eq('id', existingArticle.id)
          articlesUpdated++
        } else {
          // Insertar nuevo artículo
          await supabase.from('articles').insert(articleData)
          articlesAdded++
        }
      }

      // Actualizar el source con el resultado exitoso
      await supabase
        .from('sources')
        .update({
          fetch_error: null,
          last_fetched_at: new Date().toISOString(),
        })
        .eq('id', source.id)

      return {
        success: true,
        articlesAdded,
        articlesUpdated,
      }
    } catch (error) {
      console.error(`Error syncing feed for source ${source.id}:`, error)
      
      const supabase = await createServerClient()
      await supabase
        .from('sources')
        .update({
          fetch_error: error instanceof Error ? error.message : 'Unknown error',
          last_fetched_at: new Date().toISOString(),
        })
        .eq('id', source.id)

      return {
        success: false,
        articlesAdded: 0,
        articlesUpdated: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Sincroniza artículos de un feed RSS sin filtro de tiempo (para entradas anteriores)
   */
  async syncFeedArticlesOlder(source: Source): Promise<{
    success: boolean
    articlesAdded: number
    articlesUpdated: number
    error?: string
  }> {
    try {
      const supabase = await createServerClient()
      const feed = await this.fetchFeed(source.url)

      if (!feed) {
        // Actualizar el source con el error
        await supabase
          .from('sources')
          .update({
            fetch_error: 'Failed to fetch feed',
            last_fetched_at: new Date().toISOString(),
          })
          .eq('id', source.id)

        return {
          success: false,
          articlesAdded: 0,
          articlesUpdated: 0,
          error: 'Failed to fetch feed',
        }
      }

      // No filtrar por tiempo - tomar todos los items disponibles
      const items = feed.items.filter((item) => item.link && item.title)

      let articlesAdded = 0
      let articlesUpdated = 0

      // Procesar cada artículo
      for (const item of items) {
        if (!item.link || !item.title) continue

        // Primero obtener datos básicos del RSS
        const rssContent = this.extractContent(item)
        const rssExcerpt = this.extractExcerpt(item)
        const mediaInfo = this.extractMediaInfo(item)

        // Intentar extraer contenido completo de la URL original
        let extractedContent = null
        try {
          // Pasar la imagen destacada para evitar duplicados
          extractedContent = await contentExtractor.extractFromUrl(item.link, {
            featuredImageUrl: mediaInfo.imageUrl
          })
        } catch (error) {
          console.error(`Failed to extract content from ${item.link}:`, error)
        }

        // Usar contenido extraído si está disponible, sino usar el del RSS
        const finalContent = extractedContent?.content || rssContent || null
        const finalTextContent = extractedContent?.textContent || rssContent || null
        const finalExcerpt = extractedContent?.excerpt || rssExcerpt || null
        const finalAuthor = extractedContent?.byline || item.author || null

        // Calcular reading time y word count del contenido final
        const readingTime = finalTextContent 
          ? contentExtractor.calculateReadingTime(finalTextContent)
          : this.calculateReadingTime(rssContent)
        const wordCount = finalTextContent
          ? contentExtractor.countWords(finalTextContent)
          : rssContent.trim().split(/\s+/).length

        const articleData = {
          source_id: source.id,
          title: item.title,
          url: item.link,
          content: finalContent,
          excerpt: finalExcerpt,
          author: finalAuthor,
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          image_url: mediaInfo.imageUrl,
          video_url: mediaInfo.videoUrl,
          media_type: mediaInfo.mediaType,
          video_duration: mediaInfo.videoDuration,
          reading_time: readingTime,
          word_count: wordCount,
        }

        // Intentar insertar o actualizar el artículo
        const { data: existingArticle } = await supabase
          .from('articles')
          .select('id')
          .eq('source_id', source.id)
          .eq('url', item.link)
          .single()

        if (existingArticle) {
          // Actualizar artículo existente
          await supabase
            .from('articles')
            .update(articleData)
            .eq('id', existingArticle.id)
          articlesUpdated++
        } else {
          // Insertar nuevo artículo
          await supabase.from('articles').insert(articleData)
          articlesAdded++
        }
      }

      // Actualizar el source con el resultado exitoso
      await supabase
        .from('sources')
        .update({
          fetch_error: null,
          last_fetched_at: new Date().toISOString(),
        })
        .eq('id', source.id)

      return {
        success: true,
        articlesAdded,
        articlesUpdated,
      }
    } catch (error) {
      console.error(`Error syncing older feed for source ${source.id}:`, error)
      
      const supabase = await createServerClient()
      await supabase
        .from('sources')
        .update({
          fetch_error: error instanceof Error ? error.message : 'Unknown error',
          last_fetched_at: new Date().toISOString(),
        })
        .eq('id', source.id)

      return {
        success: false,
        articlesAdded: 0,
        articlesUpdated: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Sincroniza todos los feeds RSS de un usuario
   */
  async syncUserFeeds(userId: string): Promise<{
    totalSources: number
    successfulSyncs: number
    failedSyncs: number
    totalArticlesAdded: number
    totalArticlesUpdated: number
  }> {
    const supabase = await createServerClient()

    // Obtener todas las fuentes RSS activas del usuario
    const { data: sources, error } = await supabase
      .from('sources')
      .select('*')
      .eq('user_id', userId)
      .eq('source_type', 'rss')
      .eq('is_active', true)

    if (error || !sources) {
      console.error('Error fetching user sources:', error)
      return {
        totalSources: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        totalArticlesAdded: 0,
        totalArticlesUpdated: 0,
      }
    }

    let successfulSyncs = 0
    let failedSyncs = 0
    let totalArticlesAdded = 0
    let totalArticlesUpdated = 0

    // Sincronizar cada fuente
    for (const source of sources) {
      const result = await this.syncFeedArticles(source)
      
      if (result.success) {
        successfulSyncs++
        totalArticlesAdded += result.articlesAdded
        totalArticlesUpdated += result.articlesUpdated
      } else {
        failedSyncs++
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
}

export const rssService = new RSSService()
