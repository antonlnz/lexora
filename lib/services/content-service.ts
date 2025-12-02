import { createClient } from '@/lib/supabase/client'
import type { 
  ContentType,
  RSSContent,
  YouTubeContent,
  UserContent,
  UserContentInsert,
  UserContentUpdate,
  ContentSource,
  UserSource
} from '@/types/database'
import { CONTENT_TYPE_TO_TABLE, ACTIVE_CONTENT_TYPES, ALL_CONTENT_TYPES, type NormalizedContentWithUserData } from '@/types/content'

// Tipo unificado para contenido con metadatos
export type ContentWithMetadata = (RSSContent | YouTubeContent) & {
  content_type: ContentType
  source: ContentSource
  user_source: UserSource | null
  user_content: UserContent | null
}

export class ContentService {
  private getClient() {
    return createClient()
  }

  /**
   * Obtiene contenido con datos de usuario para un tipo específico o todos los tipos
   */
  async getContentWithUserData(options?: {
    contentType?: ContentType
    limit?: number
    offset?: number
    onlyUnread?: boolean
    onlyFavorites?: boolean
    onlyArchived?: boolean
    sourceId?: string
  }): Promise<ContentWithMetadata[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    // Si se especifica un tipo, obtener solo ese tipo
    if (options?.contentType) {
      return this.getContentForType(options.contentType, options)
    }

    // Si no se especifica tipo, obtener todos los tipos de contenido activos
    const allContent: ContentWithMetadata[] = []

    for (const type of ACTIVE_CONTENT_TYPES) {
      const content = await this.getContentForType(type, options)
      allContent.push(...content)
    }

    // Ordenar todo el contenido por fecha de publicación
    allContent.sort((a, b) => {
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0
      return dateB - dateA
    })

    // Aplicar límite si se especificó
    if (options?.limit) {
      return allContent.slice(0, options.limit)
    }

    return allContent
  }

  /**
   * Obtiene contenido para un tipo específico
   */
  private async getContentForType(
    contentType: ContentType,
    options?: {
      limit?: number
      offset?: number
      onlyUnread?: boolean
      onlyFavorites?: boolean
      onlyArchived?: boolean
      sourceId?: string
    }
  ): Promise<ContentWithMetadata[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    const table = CONTENT_TYPE_TO_TABLE[contentType]

    if (!table) {
      console.error(`Unknown content type: ${contentType}`)
      return []
    }

    // Obtener las fuentes activas del usuario
    const { data: userSources } = await supabase
      .from('user_sources')
      .select('source_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!userSources || userSources.length === 0) return []

    const sourceIds = userSources.map(s => s.source_id)

    let query = supabase
      .from(table)
      .select(`
        *,
        source:content_sources!inner(*),
        user_source:content_sources!inner(user_sources!inner(*))
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
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1
      )
    }

    const { data: content, error } = await query

    if (error) {
      console.error('Error fetching content:', error)
      return []
    }

    if (!content) return []

    // Obtener datos de user_content para estos items
    const contentIds = content.map(c => c.id)
    const { data: userContentData } = await supabase
      .from('user_content')
      .select('*')
      .eq('user_id', user.id)
      .eq('content_type', contentType)
      .in('content_id', contentIds)

    // Mapear user_content a cada item
    const userContentMap = new Map(
      (userContentData || []).map(uc => [uc.content_id, uc])
    )

    let results = content.map(item => ({
      ...item,
      content_type: contentType,
      user_content: userContentMap.get(item.id) || null
    })) as ContentWithMetadata[]

    // Aplicar filtros del lado del cliente
    if (options?.onlyUnread) {
      results = results.filter(c => !c.user_content?.is_read)
    }

    if (options?.onlyFavorites) {
      results = results.filter(c => c.user_content?.is_favorite)
    }

    if (options?.onlyArchived) {
      results = results.filter(c => c.user_content?.is_archived)
    }

    return results
  }

  /**
   * Obtiene contenido reciente (últimas 24 horas) del feed del usuario
   */
  async getRecentFeedContent(options?: {
    contentType?: ContentType
    limit?: number
    offset?: number
  }): Promise<ContentWithMetadata[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    const contentType = options?.contentType || 'rss'
    const table = CONTENT_TYPE_TO_TABLE[contentType]

    // Obtener fuentes activas del usuario
    const { data: userSources } = await supabase
      .from('user_sources')
      .select('source_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!userSources || userSources.length === 0) return []

    const sourceIds = userSources.map(s => s.source_id)

    // Calcular fecha de hace 24 horas
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    let query = supabase
      .from(table)
      .select(`
        *,
        source:content_sources!inner(*),
        user_source:content_sources!inner(user_sources!inner(*))
      `)
      .in('source_id', sourceIds)
      .gte('published_at', twentyFourHoursAgo.toISOString())
      .order('published_at', { ascending: false })

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1
      )
    }

    const { data: content, error } = await query

    if (error) {
      console.error('Error fetching recent content:', error)
      return []
    }

    if (!content) return []

    // Obtener datos de user_content
    const contentIds = content.map(c => c.id)
    const { data: userContentData } = await supabase
      .from('user_content')
      .select('*')
      .eq('user_id', user.id)
      .eq('content_type', contentType)
      .in('content_id', contentIds)

    const userContentMap = new Map(
      (userContentData || []).map(uc => [uc.content_id, uc])
    )

    return content.map(item => ({
      ...item,
      content_type: contentType,
      user_content: userContentMap.get(item.id) || null
    })) as ContentWithMetadata[]
  }

  /**
   * Marca contenido como leído
   */
  async markAsRead(
    contentType: ContentType,
    contentId: string
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('user_content')
      .upsert({
        user_id: user.id,
        content_type: contentType,
        content_id: contentId,
        is_read: true,
        read_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,content_type,content_id'
      })

    if (error) {
      console.error('Error marking content as read:', error)
      throw error
    }
  }

  /**
   * Marca/desmarca contenido como favorito
   */
  async toggleFavorite(
    contentType: ContentType,
    contentId: string,
    isFavorite: boolean
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const updateData: Partial<UserContentInsert> = {
      user_id: user.id,
      content_type: contentType,
      content_id: contentId,
      is_favorite: isFavorite,
      last_accessed_at: new Date().toISOString()
    }

    if (isFavorite) {
      updateData.favorited_at = new Date().toISOString()
    } else {
      updateData.favorited_at = null
    }

    const { error } = await supabase
      .from('user_content')
      .upsert(updateData, {
        onConflict: 'user_id,content_type,content_id'
      })

    if (error) {
      console.error('Error toggling favorite:', error)
      throw error
    }
  }

  /**
   * Archiva/desarchivar contenido
   * El contenido archivado se protege de eliminación automática
   */
  async toggleArchive(
    contentType: ContentType,
    contentId: string,
    isArchived: boolean
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const updateData: Partial<UserContentInsert> = {
      user_id: user.id,
      content_type: contentType,
      content_id: contentId,
      is_archived: isArchived,
      last_accessed_at: new Date().toISOString()
    }

    if (isArchived) {
      updateData.archived_at = new Date().toISOString()
    } else {
      updateData.archived_at = null
    }

    const { error } = await supabase
      .from('user_content')
      .upsert(updateData, {
        onConflict: 'user_id,content_type,content_id'
      })

    if (error) {
      console.error('Error toggling archive:', error)
      throw error
    }
  }

  /**
   * Actualiza el progreso de lectura/visualización
   */
  async updateProgress(
    contentType: ContentType,
    contentId: string,
    progress: number,
    timeSpent?: number
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const updates: Partial<UserContentInsert> = {
      user_id: user.id,
      content_type: contentType,
      content_id: contentId,
      reading_progress: Math.min(100, Math.max(0, progress)),
      last_accessed_at: new Date().toISOString()
    }

    if (timeSpent !== undefined) {
      // Incrementar el tiempo acumulado
      const { data: existing } = await supabase
        .from('user_content')
        .select('time_spent')
        .eq('user_id', user.id)
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .single()

      updates.time_spent = (existing?.time_spent || 0) + timeSpent
    }

    // Si completó la lectura, marcarlo como leído
    if (progress >= 100) {
      updates.is_read = true
      updates.read_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('user_content')
      .upsert(updates, {
        onConflict: 'user_id,content_type,content_id'
      })

    if (error) {
      console.error('Error updating progress:', error)
      throw error
    }
  }

  /**
   * Añade notas personales a un contenido
   */
  async updateNotes(
    contentType: ContentType,
    contentId: string,
    notes: string | null
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('user_content')
      .upsert({
        user_id: user.id,
        content_type: contentType,
        content_id: contentId,
        notes,
        last_accessed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,content_type,content_id'
      })

    if (error) {
      console.error('Error updating notes:', error)
      throw error
    }
  }

  /**
   * Obtiene todo el contenido archivado del usuario
   */
  async getArchivedContent(contentType?: ContentType): Promise<ContentWithMetadata[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    // Si se especifica un tipo, buscar solo ese
    if (contentType) {
      return this.getContentWithUserData({
        contentType,
        onlyArchived: true
      })
    }

    // Si no, buscar en todos los tipos
    const allContent: ContentWithMetadata[] = []

    for (const type of ALL_CONTENT_TYPES) {
      const content = await this.getContentWithUserData({
        contentType: type,
        onlyArchived: true
      })
      allContent.push(...content)
    }

    // Ordenar por fecha de archivo
    return allContent.sort((a, b) => {
      const dateA = a.user_content?.archived_at || ''
      const dateB = b.user_content?.archived_at || ''
      return dateB.localeCompare(dateA)
    })
  }

  /**
   * Busca contenido por título, descripción o autor
   */
  async searchContent(
    searchQuery: string,
    contentType?: ContentType
  ): Promise<ContentWithMetadata[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    // Obtener fuentes del usuario
    const { data: userSources } = await supabase
      .from('user_sources')
      .select('source_id')
      .eq('user_id', user.id)

    if (!userSources || userSources.length === 0) return []

    const sourceIds = userSources.map(s => s.source_id)

    const types: ContentType[] = contentType 
      ? [contentType] 
      : ALL_CONTENT_TYPES

    const allResults: ContentWithMetadata[] = []

    for (const type of types) {
      const table = CONTENT_TYPE_TO_TABLE[type]
      
      // Construir query de búsqueda dependiendo del tipo
      let searchCondition = ''
      if (type === 'rss') {
        searchCondition = `title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`
      } else if (type === 'youtube') {
        searchCondition = `title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,channel_name.ilike.%${searchQuery}%`
      } else if (type === 'twitter') {
        searchCondition = `text_content.ilike.%${searchQuery}%,author_name.ilike.%${searchQuery}%`
      } else if (type === 'instagram') {
        searchCondition = `caption.ilike.%${searchQuery}%,author_username.ilike.%${searchQuery}%`
      } else if (type === 'tiktok') {
        searchCondition = `description.ilike.%${searchQuery}%,author_username.ilike.%${searchQuery}%`
      } else if (type === 'podcast') {
        searchCondition = `title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`
      }

      const { data: content } = await supabase
        .from(table)
        .select(`
          *,
          source:content_sources!inner(*),
          user_source:content_sources!inner(user_sources!inner(*))
        `)
        .in('source_id', sourceIds)
        .or(searchCondition)
        .order('published_at', { ascending: false })
        .limit(20)

      if (content) {
        // Obtener user_content para estos resultados
        const contentIds = content.map(c => c.id)
        const { data: userContentData } = await supabase
          .from('user_content')
          .select('*')
          .eq('user_id', user.id)
          .eq('content_type', type)
          .in('content_id', contentIds)

        const userContentMap = new Map(
          (userContentData || []).map(uc => [uc.content_id, uc])
        )

        const results = content.map(item => ({
          ...item,
          content_type: type,
          user_content: userContentMap.get(item.id) || null
        })) as ContentWithMetadata[]

        allResults.push(...results)
      }
    }

    // Ordenar por relevancia (los que tienen el término en el título primero)
    return allResults.sort((a, b) => {
      const aTitle = 'title' in a ? a.title : ''
      const bTitle = 'title' in b ? b.title : ''
      const aMatch = aTitle.toLowerCase().includes(searchQuery.toLowerCase())
      const bMatch = bTitle.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (aMatch && !bMatch) return -1
      if (!aMatch && bMatch) return 1
      
      // Si ambos coinciden o ninguno, ordenar por fecha
      const aDate = a.published_at || ''
      const bDate = b.published_at || ''
      return bDate.localeCompare(aDate)
    })
  }
}

export const contentService = new ContentService()
