import { createClient } from '@/lib/supabase/client'
import type { 
  Article, 
  UserArticle, 
  ArticleWithSource,
  ArticleWithUserData 
} from '@/types/database'

export class ArticleService {
  private getClient() {
    return createClient()
  }

  /**
   * Obtiene artículos con sus fuentes y datos de usuario
   */
  async getArticlesWithUserData(options?: {
    limit?: number
    offset?: number
    onlyUnread?: boolean
    onlyFavorites?: boolean
    sourceId?: string
  }): Promise<ArticleWithUserData[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    // Obtener las fuentes activas del usuario
    const { data: userSources } = await supabase
      .from('sources')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!userSources || userSources.length === 0) return []

    const sourceIds = userSources.map(s => s.id)

    let query = supabase
      .from('articles')
      .select(`
        *,
        source:sources(*),
        user_article:user_articles(*)
      `)
      .in('source_id', sourceIds)
      .order('published_at', { ascending: false })

    if (options?.sourceId) {
      query = query.eq('source_id', options.sourceId)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching articles:', error)
      return []
    }

    // Filtrar en el cliente si es necesario
    let articles = data || []

    if (options?.onlyUnread) {
      articles = articles.filter(a => !a.user_article?.is_read)
    }

    if (options?.onlyFavorites) {
      articles = articles.filter(a => a.user_article?.is_favorite)
    }

    return articles as ArticleWithUserData[]
  }

  /**
   * Obtiene artículos de las últimas 24 horas del feed del usuario
   */
  async getRecentFeedArticles(options?: {
    limit?: number
    offset?: number
  }): Promise<ArticleWithUserData[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    // Obtener las fuentes activas del usuario
    const { data: userSources } = await supabase
      .from('sources')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!userSources || userSources.length === 0) return []

    const sourceIds = userSources.map(s => s.id)

    // Calcular la fecha de hace 24 horas
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    let query = supabase
      .from('articles')
      .select(`
        *,
        source:sources(*),
        user_article:user_articles(*)
      `)
      .in('source_id', sourceIds)
      .gte('published_at', twentyFourHoursAgo.toISOString())
      .order('published_at', { ascending: false })

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching recent feed articles:', error)
      return []
    }

    return data as ArticleWithUserData[]
  }

    /**
   * Marca un artículo como leído
   */
  async markAsRead(articleId: string): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('user_articles')
      .upsert({
        user_id: user.id,
        article_id: articleId,
        is_read: true,
        read_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error marking article as read:', error)
      throw error
    }
  }

  /**
   * Marca un artículo como favorito
   */
  async toggleFavorite(articleId: string, isFavorite: boolean): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('user_articles')
      .upsert({
        user_id: user.id,
        article_id: articleId,
        is_favorite: isFavorite,
        favorited_at: isFavorite ? new Date().toISOString() : null
      })

    if (error) {
      console.error('Error toggling favorite:', error)
      throw error
    }
  }

  /**
   * Archiva o desarchivar un artículo
   */
  async toggleArchive(articleId: string, isArchived: boolean): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('user_articles')
      .upsert({
        user_id: user.id,
        article_id: articleId,
        is_archived: isArchived,
        archived_at: isArchived ? new Date().toISOString() : null
      })

    if (error) {
      console.error('Error toggling archive:', error)
      throw error
    }
  }

  /**
   * Actualiza el progreso de lectura
   */
  async updateReadingProgress(
    articleId: string, 
    progress: number, 
    timeSpent?: number
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const updates: any = {
      user_id: user.id,
      article_id: articleId,
      reading_progress: progress
    }

    if (timeSpent !== undefined) {
      updates.reading_time_spent = timeSpent
    }

    // Si completó la lectura, marcarlo como leído
    if (progress >= 100) {
      updates.is_read = true
      updates.read_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('user_articles')
      .upsert(updates)

    if (error) {
      console.error('Error updating reading progress:', error)
      throw error
    }
  }

  /**
   * Obtiene artículos archivados
   */
  async getArchivedArticles(): Promise<ArticleWithUserData[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        source:sources(*),
        user_article:user_articles!inner(*)
      `)
      .eq('user_article.user_id', user.id)
      .eq('user_article.is_archived', true)
      .order('user_article.archived_at', { ascending: false })

    if (error) {
      console.error('Error fetching archived articles:', error)
      return []
    }

    return data as ArticleWithUserData[]
  }

  /**
   * Busca artículos por título, contenido o autor
   */
  async searchArticles(searchQuery: string): Promise<ArticleWithUserData[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    // Obtener todas las fuentes del usuario
    const { data: userSources } = await supabase
      .from('sources')
      .select('id')
      .eq('user_id', user.id)

    if (!userSources || userSources.length === 0) return []

    const sourceIds = userSources.map(s => s.id)

    // Buscar en artículos de las fuentes del usuario
    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        source:sources(*),
        user_article:user_articles(*)
      `)
      .in('source_id', sourceIds)
      .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`)
      .order('published_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error searching articles:', error)
      return []
    }

    return data as ArticleWithUserData[]
  }
}

export const articleService = new ArticleService()
