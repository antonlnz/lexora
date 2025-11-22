import { createClient } from '@/lib/supabase/client'
import { contentService, type ContentWithMetadata } from './content-service'
import type { 
  Article, 
  UserArticle, 
  ArticleWithSource,
  ArticleWithUserData,
  RSSContent,
  ContentType
} from '@/types/database'

/**
 * ArticleService - Wrapper de compatibilidad
 * 
 * Este servicio mantiene la interfaz original pero delega al nuevo ContentService.
 * Está marcado como deprecated - usar ContentService directamente para nuevo código.
 * 
 * @deprecated Use ContentService instead
 */
export class ArticleService {
  private getClient() {
    return createClient()
  }

  /**
   * Convierte ContentWithMetadata a ArticleWithUserData para compatibilidad
   */
  private contentToArticle(content: ContentWithMetadata): ArticleWithUserData {
    const rssContent = content as RSSContent & { content_type: 'rss', source: any, user_content: any }
    
    return {
      ...rssContent,
      source: content.source,
      user_article: content.user_content ? {
        ...content.user_content,
        article_id: content.user_content.content_id,
        reading_time_spent: content.user_content.time_spent
      } : null
    } as ArticleWithUserData
  }

  /**
   * Obtiene artículos con sus fuentes y datos de usuario
   * @deprecated Use contentService.getContentWithUserData() instead
   */
  async getArticlesWithUserData(options?: {
    limit?: number
    offset?: number
    onlyUnread?: boolean
    onlyFavorites?: boolean
    sourceId?: string
  }): Promise<ArticleWithUserData[]> {
    const content = await contentService.getContentWithUserData({
      contentType: 'rss',
      ...options
    })
    
    return content.map(c => this.contentToArticle(c))
  }

  /**
   * Obtiene artículos de las últimas 24 horas del feed del usuario
   * @deprecated Use contentService.getRecentFeedContent() instead
   */
  async getRecentFeedArticles(options?: {
    limit?: number
    offset?: number
  }): Promise<ArticleWithUserData[]> {
    const content = await contentService.getRecentFeedContent({
      contentType: 'rss',
      ...options
    })
    
    return content.map(c => this.contentToArticle(c))
  }

  /**
   * Marca un artículo como leído
   * @deprecated Use contentService.markAsRead() instead
   */
  async markAsRead(articleId: string): Promise<void> {
    await contentService.markAsRead('rss', articleId)
  }

  /**
   * Marca un artículo como favorito
   * @deprecated Use contentService.toggleFavorite() instead
   */
  async toggleFavorite(articleId: string, isFavorite: boolean): Promise<void> {
    await contentService.toggleFavorite('rss', articleId, isFavorite)
  }

  /**
   * Archiva o desarchivar un artículo
   * @deprecated Use contentService.toggleArchive() instead
   */
  async toggleArchive(articleId: string, isArchived: boolean): Promise<void> {
    await contentService.toggleArchive('rss', articleId, isArchived)
  }

  /**
   * Actualiza el progreso de lectura
   * @deprecated Use contentService.updateProgress() instead
   */
  async updateReadingProgress(
    articleId: string, 
    progress: number, 
    timeSpent?: number
  ): Promise<void> {
    await contentService.updateProgress('rss', articleId, progress, timeSpent)
  }

  /**
   * Obtiene artículos archivados
   * @deprecated Use contentService.getArchivedContent() instead
   */
  async getArchivedArticles(): Promise<ArticleWithUserData[]> {
    const content = await contentService.getArchivedContent('rss')
    return content.map(c => this.contentToArticle(c))
  }

  /**
   * Busca artículos por título, contenido o autor
   * @deprecated Use contentService.searchContent() instead
   */
  async searchArticles(searchQuery: string): Promise<ArticleWithUserData[]> {
    const content = await contentService.searchContent(searchQuery, 'rss')
    return content.map(c => this.contentToArticle(c))
  }
}

export const articleService = new ArticleService()

