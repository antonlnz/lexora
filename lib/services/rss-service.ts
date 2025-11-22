import Parser from 'rss-parser'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { contentExtractor } from './content-extractor'
import type { RSSContent, ContentSource, UserSource } from '@/types/database'

// Tipo para compatibilidad temporal
type Source = ContentSource & { user_source?: UserSource }

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
  private supabaseClient?: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient
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
    mediaType: 'none' | 'image' | 'video'
    mediaUrl: string | null
    thumbnailUrl: string | null
    duration: number | null
  } {
    let mediaUrl: string | null = null
    let thumbnailUrl: string | null = null
    let mediaType: 'none' | 'image' | 'video' = 'none'
    let duration: number | null = null

    // 1. Verificar media:content primero (prioridad alta para videos)
    if (item.mediaContent) {
      const mediaContent = Array.isArray(item.mediaContent) ? item.mediaContent[0] : item.mediaContent
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
          
          // Buscar thumbnail en media:thumbnail dentro de media:content
          if (item.mediaThumbnail) {
            const thumbnail = Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0] : item.mediaThumbnail
            if (thumbnail?.$ && thumbnail.$.url) {
              thumbnailUrl = thumbnail.$.url
            }
          }
        } else if (type.startsWith('image/') || medium === 'image') {
          mediaUrl = url
          mediaType = 'image'
          thumbnailUrl = null // Para imágenes no necesitamos thumbnail separado
        }
      }
    }

    // 2. Verificar enclosure para videos/audio/imágenes (si no se encontró en media:content)
    if (mediaType === 'none' && item.enclosure?.url) {
      const mimeType = item.enclosure.type?.toLowerCase() || ''
      if (mimeType.startsWith('video/')) {
        mediaUrl = item.enclosure.url
        mediaType = 'video'
        if (item.enclosure.length) {
          duration = Math.floor(Number(item.enclosure.length) / 1000)
        }
        
        // Buscar thumbnail
        if (item.mediaThumbnail) {
          const thumbnail = Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0] : item.mediaThumbnail
          if (thumbnail?.$ && thumbnail.$.url) {
            thumbnailUrl = thumbnail.$.url
          }
        }
      } else if (mimeType.startsWith('image/')) {
        mediaUrl = item.enclosure.url
        mediaType = 'image'
        thumbnailUrl = null
      } else if (mimeType.startsWith('audio/')) {
        // Para audio/podcasts, buscar imagen de iTunes
        if (item.itunesImage) {
          if (typeof item.itunesImage === 'object' && item.itunesImage.$?.href) {
            mediaUrl = item.itunesImage.$.href
          } else if (typeof item.itunesImage === 'string') {
            mediaUrl = item.itunesImage
          }
          mediaType = 'image'
          thumbnailUrl = null
        }
      }
    }

    // 3. Verificar itunes:image (podcasts) si no hay media aún
    if (mediaType === 'none' && item.itunesImage) {
      if (typeof item.itunesImage === 'object' && item.itunesImage.$?.href) {
        mediaUrl = item.itunesImage.$.href
      } else if (typeof item.itunesImage === 'string') {
        mediaUrl = item.itunesImage
      }
      mediaType = 'image'
      thumbnailUrl = null
    }

    // 4. Verificar media:thumbnail standalone si no hay media aún
    if (mediaType === 'none' && item.mediaThumbnail) {
      const thumbnail = Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0] : item.mediaThumbnail
      if (thumbnail?.$ && thumbnail.$.url) {
        mediaUrl = thumbnail.$.url
        mediaType = 'image'
        thumbnailUrl = null
      }
    }

    // 5. Verificar elemento <image> estándar de RSS
    if (mediaType === 'none' && item.imageElement) {
      if (typeof item.imageElement === 'object' && item.imageElement.url) {
        mediaUrl = item.imageElement.url
      } else if (typeof item.imageElement === 'string') {
        mediaUrl = item.imageElement
      }
      mediaType = 'image'
      thumbnailUrl = null
    }

    // 6. Buscar videos embebidos en el contenido HTML
    if (mediaType === 'none') {
      const content = item.contentEncoded || item.content || item.description || ''
      
      // Detectar iframes de video (YouTube, Vimeo, etc.)
      const iframeMatch = content.match(/<iframe[^>]+src="([^"]+)"/)
      if (iframeMatch) {
        const iframeSrc = iframeMatch[1]
        if (iframeSrc.includes('youtube.com') || iframeSrc.includes('youtu.be') || 
            iframeSrc.includes('vimeo.com') || iframeSrc.includes('dailymotion.com')) {
          mediaUrl = iframeSrc
          mediaType = 'video'
          
          // Intentar extraer thumbnail de YouTube
          if (iframeSrc.includes('youtube.com') || iframeSrc.includes('youtu.be')) {
            const videoIdMatch = iframeSrc.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([^?&]+)/)
            if (videoIdMatch) {
              thumbnailUrl = `https://img.youtube.com/vi/${videoIdMatch[1]}/maxresdefault.jpg`
            }
          }
        }
      }

      // Detectar tags de video HTML5
      if (mediaType === 'none') {
        const videoMatch = content.match(/<video[^>]+src="([^"]+)"/)
        if (videoMatch) {
          mediaUrl = videoMatch[1]
          mediaType = 'video'
        }
      }

      // 7. Buscar imágenes en el contenido HTML si no hay media
      if (mediaType === 'none') {
        const imgMatch = content.match(/<img[^>]+src="([^">]+)"/)
        if (imgMatch) {
          mediaUrl = imgMatch[1]
          mediaType = 'image'
          thumbnailUrl = null
        }
      }
    }

    return {
      mediaType,
      mediaUrl,
      thumbnailUrl,
      duration,
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
  async syncFeedArticles(
    source: Source,
    onArticleProcessed?: () => void | Promise<void>
  ): Promise<{
    success: boolean
    articlesAdded: number
    articlesUpdated: number
    error?: string
  }> {
    try {
      const supabase = await this.getClient()
      const feed = await this.fetchFeed(source.url)

      if (!feed) {
        // Actualizar el source con el error
        await supabase
          .from('content_sources')
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
            featuredImageUrl: mediaInfo.mediaType === 'image' ? mediaInfo.mediaUrl : mediaInfo.thumbnailUrl
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
          // Nueva estructura de media
          featured_media_type: mediaInfo.mediaType,
          featured_media_url: mediaInfo.mediaUrl,
          featured_thumbnail_url: mediaInfo.thumbnailUrl,
          featured_media_duration: mediaInfo.duration,
          reading_time: readingTime,
          word_count: wordCount,
        }

        // Intentar insertar o actualizar el artículo en rss_content
        const { data: existingArticle } = await supabase
          .from('rss_content')
          .select('id')
          .eq('source_id', source.id)
          .eq('url', item.link)
          .single()

        if (existingArticle) {
          // Actualizar artículo existente
          await supabase
            .from('rss_content')
            .update(articleData)
            .eq('id', existingArticle.id)
          articlesUpdated++
        } else {
          // Insertar nuevo artículo
          await supabase.from('rss_content').insert(articleData)
          articlesAdded++
        }

        // Notificar que se procesó un artículo
        if (onArticleProcessed) {
          await onArticleProcessed()
        }
      }

      // Actualizar el source con el resultado exitoso
      await supabase
        .from('content_sources')
        .update({
          fetch_error: null,
          last_fetched_at: new Date().toISOString(),
          fetch_count: source.fetch_count ? source.fetch_count + 1 : 1
        })
        .eq('id', source.id)

      return {
        success: true,
        articlesAdded,
        articlesUpdated,
      }
    } catch (error) {
      console.error(`Error syncing feed for source ${source.id}:`, error)
      
      const supabase = await this.getClient()
      await supabase
        .from('content_sources')
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
  async syncFeedArticlesOlder(
    source: Source,
    onArticleProcessed?: () => void | Promise<void>
  ): Promise<{
    success: boolean
    articlesAdded: number
    articlesUpdated: number
    error?: string
  }> {
    try {
      const supabase = await this.getClient()
      const feed = await this.fetchFeed(source.url)

      if (!feed) {
        // Actualizar el source con el error
        await supabase
          .from('content_sources')
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

      // console.log(`📥 Processing ${items.length} items from feed (syncOlder)`)

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
            featuredImageUrl: mediaInfo.mediaType === 'image' ? mediaInfo.mediaUrl : mediaInfo.thumbnailUrl
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
          // Nueva estructura de media
          featured_media_type: mediaInfo.mediaType,
          featured_media_url: mediaInfo.mediaUrl,
          featured_thumbnail_url: mediaInfo.thumbnailUrl,
          featured_media_duration: mediaInfo.duration,
          reading_time: readingTime,
          word_count: wordCount,
        }

        // Intentar insertar o actualizar el artículo en rss_content
        const { data: existingArticle } = await supabase
          .from('rss_content')
          .select('id')
          .eq('source_id', source.id)
          .eq('url', item.link)
          .single()

        if (existingArticle) {
          // Actualizar artículo existente
          const { error: updateError } = await supabase
            .from('rss_content')
            .update(articleData)
            .eq('id', existingArticle.id)
          
          if (updateError) {
            console.error('❌ Error updating article (syncOlder):', {
              title: item.title,
              url: item.link,
              error: updateError
            })
          } else {
            articlesUpdated++
            // console.log(`✅ Article updated (syncOlder): ${item.title}`)
          }
        } else {
          // Insertar nuevo artículo
          const { error: insertError } = await supabase.from('rss_content').insert(articleData)
          
          if (insertError) {
            console.error('❌ Error inserting article (syncOlder):', {
              title: item.title,
              url: item.link,
              sourceId: source.id,
              error: insertError
            })
          } else {
            articlesAdded++
            // console.log(`✅ Article inserted (syncOlder): ${item.title}`)
          }
        }

        // Notificar que se procesó un artículo
        if (onArticleProcessed) {
          await onArticleProcessed()
        }
      }

      // Actualizar el source con el resultado exitoso
      await supabase
        .from('content_sources')
        .update({
          fetch_error: null,
          last_fetched_at: new Date().toISOString(),
          fetch_count: source.fetch_count ? source.fetch_count + 1 : 1
        })
        .eq('id', source.id)

      return {
        success: true,
        articlesAdded,
        articlesUpdated,
      }
    } catch (error) {
      console.error(`Error syncing older feed for source ${source.id}:`, error)
      
      const supabase = await this.getClient()
      await supabase
        .from('content_sources')
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
    const supabase = await this.getClient()

    // Obtener todas las fuentes RSS activas del usuario usando el nuevo esquema
    const { data: userSources, error } = await supabase
      .from('user_sources')
      .select(`
        *,
        source:content_sources(*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('source.source_type', 'rss')

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

    let successfulSyncs = 0
    let failedSyncs = 0
    let totalArticlesAdded = 0
    let totalArticlesUpdated = 0

    // Sincronizar cada fuente
    for (const userSource of userSources) {
      if (!userSource.source) continue
      
      // Combinar datos para compatibilidad con la función existente
      const source: Source = {
        ...userSource.source,
        user_source: userSource
      }
      
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
      totalSources: userSources.length,
      successfulSyncs,
      failedSyncs,
      totalArticlesAdded,
      totalArticlesUpdated,
    }
  }
}

export const rssService = new RSSService()
