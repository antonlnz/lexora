import Parser from 'rss-parser'
import { createClient as createServerClient } from '@/lib/supabase/server'
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
   * Extrae la imagen de un item del feed
   */
  private extractImageUrl(item: any): string | null {
    // Intentar obtener la imagen de diferentes campos
    if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url
    }

    if (item.mediaContent?.$ && item.mediaContent.$.url) {
      return item.mediaContent.$.url
    }

    if (item.mediaThumbnail?.$ && item.mediaThumbnail.$.url) {
      return item.mediaThumbnail.$.url
    }

    // Buscar imágenes en el contenido HTML
    const content = item.contentEncoded || item.content || item.description || ''
    const imgMatch = content.match(/<img[^>]+src="([^">]+)"/)
    if (imgMatch) {
      return imgMatch[1]
    }

    return null
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

        const content = this.extractContent(item)
        const excerpt = this.extractExcerpt(item)
        const imageUrl = this.extractImageUrl(item)
        const readingTime = this.calculateReadingTime(content)
        const wordCount = content.trim().split(/\s+/).length

        const articleData = {
          source_id: source.id,
          title: item.title,
          url: item.link,
          content: content || null,
          excerpt: excerpt || null,
          author: item.author || null,
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          image_url: imageUrl,
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
