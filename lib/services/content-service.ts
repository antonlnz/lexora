import { createClient } from '@/lib/supabase/client'
import type { 
  ContentType,
  RSSContent,
  YouTubeContent,
  PodcastContent,
  UserContent,
  UserContentInsert,
  ContentSource,
  UserSource
} from '@/types/database'
import { CONTENT_TYPE_TO_TABLE, ACTIVE_CONTENT_TYPES, ALL_CONTENT_TYPES, type NormalizedContentWithUserData } from '@/types/content'

// Tipo unificado para contenido con metadatos
export type ContentWithMetadata = (RSSContent | YouTubeContent | PodcastContent) & {
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
   * Obtiene un contenido específico por ID, buscando en todas las tablas de contenido
   */
  async getContentById(contentId: string): Promise<ContentWithMetadata | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    // Buscar en cada tipo de contenido
    for (const contentType of ALL_CONTENT_TYPES) {
      const table = CONTENT_TYPE_TO_TABLE[contentType]
      
      const { data: content, error } = await supabase
        .from(table)
        .select(`
          *,
          source:content_sources!inner(*),
          user_source:content_sources!inner(user_sources(*))
        `)
        .eq('id', contentId)
        .single()

      if (error || !content) continue

      // Verificar que el usuario tiene acceso a esta fuente
      const { data: userSource } = await supabase
        .from('user_sources')
        .select('*')
        .eq('user_id', user.id)
        .eq('source_id', content.source_id)
        .single()

      if (!userSource) continue

      // Obtener user_content si existe
      const { data: userContent } = await supabase
        .from('user_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .single()

      return {
        ...content,
        content_type: contentType,
        user_content: userContent || null,
        user_source: userSource
      } as ContentWithMetadata
    }

    return null
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
   * Alterna el estado de leído de un contenido
   * Si se desmarca y no tiene otros datos relevantes, elimina el registro
   */
  async toggleRead(
    contentType: ContentType,
    contentId: string,
    isRead: boolean
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    if (isRead) {
      // Marcar como leído
      await this.markAsRead(contentType, contentId)
    } else {
      // Desmarcar como leído
      const { data: existing } = await supabase
        .from('user_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .single()

      if (existing) {
        // Verificar si tiene otros datos relevantes
        const hasOtherData = existing.is_archived || 
                            existing.is_favorite ||
                            existing.notes ||
                            (existing.reading_progress && existing.reading_progress > 0) ||
                            existing.folder_id

        if (hasOtherData) {
          // Solo actualizar is_read a false
          const { error } = await supabase
            .from('user_content')
            .update({
              is_read: false,
              read_at: null,
              last_accessed_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('content_type', contentType)
            .eq('content_id', contentId)

          if (error) {
            console.error('Error unmarking as read:', error)
            throw error
          }
        } else {
          // No tiene otros datos, eliminar el registro completamente
          const { error } = await supabase
            .from('user_content')
            .delete()
            .eq('user_id', user.id)
            .eq('content_type', contentType)
            .eq('content_id', contentId)

          if (error) {
            console.error('Error deleting user_content:', error)
            throw error
          }
        }
      }
    }
  }

  /**
   * Obtiene el estado de user_content para un contenido específico
   */
  async getUserContentState(
    contentType: ContentType,
    contentId: string
  ): Promise<UserContent | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data, error } = await supabase
      .from('user_content')
      .select('*')
      .eq('user_id', user.id)
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .single()

    if (error) {
      // No es un error si no existe el registro
      if (error.code === 'PGRST116') return null
      console.error('Error getting user content state:', error)
      return null
    }

    return data
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
   * Si se desarchiva y no hay otros datos relevantes (is_read, notes, etc.), se elimina el registro
   */
  async toggleArchive(
    contentType: ContentType,
    contentId: string,
    isArchived: boolean,
    folderId?: string | null
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    if (isArchived) {
      // Archivar: hacer upsert
      const updateData: Partial<UserContentInsert> = {
        user_id: user.id,
        content_type: contentType,
        content_id: contentId,
        is_archived: true,
        archived_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        folder_id: folderId ?? null
      }

      const { error } = await supabase
        .from('user_content')
        .upsert(updateData, {
          onConflict: 'user_id,content_type,content_id'
        })

      if (error) {
        console.error('Error archiving content:', error)
        throw error
      }
    } else {
      // Desarchivar: verificar si hay otros datos importantes antes de eliminar
      const { data: existing } = await supabase
        .from('user_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .single()

      if (existing) {
        // Si tiene otros datos relevantes (is_read, notes, reading_progress, etc.), solo actualizar
        const hasOtherData = existing.is_read || 
                            existing.notes || 
                            (existing.reading_progress && existing.reading_progress > 0) ||
                            (existing.time_spent && existing.time_spent > 0)

        if (hasOtherData) {
          // Solo desmarcar is_archived, mantener el registro
          const { error } = await supabase
            .from('user_content')
            .update({
              is_archived: false,
              archived_at: null,
              folder_id: null,
              last_accessed_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('content_type', contentType)
            .eq('content_id', contentId)

          if (error) {
            console.error('Error unarchiving content:', error)
            throw error
          }
        } else {
          // No tiene otros datos, eliminar el registro completamente
          const { error } = await supabase
            .from('user_content')
            .delete()
            .eq('user_id', user.id)
            .eq('content_type', contentType)
            .eq('content_id', contentId)

          if (error) {
            console.error('Error deleting user_content:', error)
            throw error
          }
        }
      }
    }
  }

  /**
   * Archiva contenido en una carpeta específica
   * @param episodeData - Datos del episodio para crear el contenido si no existe (para YouTube/podcast sueltos)
   */
  async archiveToFolder(
    contentType: ContentType,
    contentId: string,
    folderId: string | null,
    episodeData?: {
      title: string
      url: string
      source_id: string
      description?: string | null
      image_url?: string | null
      thumbnail_url?: string | null
      duration?: number | null
      published_at?: string | null
      channel_name?: string | null
      author?: string | null
      audio_url?: string | null
    }
  ): Promise<void> {
    // Si tenemos datos del episodio, asegurar que el contenido existe
    if (episodeData) {
      await this.ensureContentExists(contentType, contentId, episodeData)
    }
    return this.toggleArchive(contentType, contentId, true, folderId)
  }

  /**
   * Asegura que el contenido existe en la tabla correspondiente
   * Crea el registro si no existe
   */
  private async ensureContentExists(
    contentType: ContentType,
    contentId: string,
    episodeData: {
      title: string
      url: string
      source_id: string
      description?: string | null
      image_url?: string | null
      thumbnail_url?: string | null
      duration?: number | null
      published_at?: string | null
      channel_name?: string | null
      author?: string | null
      audio_url?: string | null
    }
  ): Promise<void> {
    const supabase = this.getClient()

    if (contentType === 'youtube') {
      const { data: existingContent } = await supabase
        .from('youtube_content')
        .select('id')
        .eq('id', contentId)
        .maybeSingle()

      if (!existingContent) {
        const videoIdMatch = episodeData.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/)
        const videoId = videoIdMatch ? videoIdMatch[1] : contentId

        const { error: insertError } = await supabase
          .from('youtube_content')
          .insert({
            id: contentId,
            source_id: episodeData.source_id,
            video_id: videoId,
            title: episodeData.title,
            url: episodeData.url,
            channel_name: episodeData.channel_name || episodeData.author || null,
            published_at: episodeData.published_at || null,
            description: episodeData.description || null,
            thumbnail_url: episodeData.thumbnail_url || episodeData.image_url || null,
            duration: episodeData.duration || null,
          })

        if (insertError) {
          console.error('Error creating youtube_content:', insertError)
        }
      }
    }

    if (contentType === 'podcast') {
      const { data: existingContent } = await supabase
        .from('podcast_content')
        .select('id')
        .eq('id', contentId)
        .maybeSingle()

      if (!existingContent) {
        const { error: insertError } = await supabase
          .from('podcast_content')
          .insert({
            id: contentId,
            source_id: episodeData.source_id,
            title: episodeData.title,
            url: episodeData.url,
            author: episodeData.author || null,
            published_at: episodeData.published_at || null,
            description: episodeData.description || null,
            audio_url: episodeData.audio_url || episodeData.url,
            image_url: episodeData.image_url || null,
            duration: episodeData.duration || null,
          })

        if (insertError) {
          console.error('Error creating podcast_content:', insertError)
        }
      }
    }
  }

  /**
   * Guarda un clip de contenido multimedia (podcast o YouTube)
   * @param contentType - Tipo de contenido ('podcast' o 'youtube')
   * @param contentId - ID del contenido
   * @param clipStart - Segundo de inicio del clip (null = desde el principio)
   * @param clipEnd - Segundo de fin del clip (null = hasta el final)
   * @param folderId - ID de la carpeta donde guardar (opcional)
   * @param episodeData - Datos del episodio para crear el contenido si no existe
   */
  async saveClip(
    contentType: ContentType,
    contentId: string,
    clipStart: number | null,
    clipEnd: number | null,
    folderId?: string | null,
    episodeData?: {
      title: string
      url: string
      source_id: string
      description?: string | null
      image_url?: string | null
      thumbnail_url?: string | null
      duration?: number | null
      published_at?: string | null
      channel_name?: string | null
      author?: string | null
      audio_url?: string | null
    }
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Asegurar que el contenido existe en la tabla correspondiente
    if (episodeData) {
      await this.ensureContentExists(contentType, contentId, episodeData)
    }

    // Redondear a enteros (la BD espera INTEGER)
    const clipStartInt = clipStart !== null ? Math.round(clipStart) : null
    const clipEndInt = clipEnd !== null ? Math.round(clipEnd) : null

    const updateData: Partial<UserContentInsert> = {
      user_id: user.id,
      content_type: contentType,
      content_id: contentId,
      is_archived: true,
      archived_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
      folder_id: folderId ?? null,
      clip_start_seconds: clipStartInt,
      clip_end_seconds: clipEndInt
    }

    const { error } = await supabase
      .from('user_content')
      .upsert(updateData, {
        onConflict: 'user_id,content_type,content_id'
      })

    if (error) {
      console.error('Error saving clip:', error)
      throw error
    }
  }

  /**
   * Actualiza los tiempos de clip de un contenido guardado
   */
  async updateClipTimes(
    contentType: ContentType,
    contentId: string,
    clipStart: number | null,
    clipEnd: number | null
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('user_content')
      .update({
        clip_start_seconds: clipStart,
        clip_end_seconds: clipEnd,
        last_accessed_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('content_type', contentType)
      .eq('content_id', contentId)

    if (error) {
      console.error('Error updating clip times:', error)
      throw error
    }
  }

  /**
   * Mueve contenido archivado a otra carpeta
   */
  async moveToFolder(
    contentType: ContentType,
    contentId: string,
    folderId: string | null
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('user_content')
      .update({
        folder_id: folderId,
        last_accessed_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('content_type', contentType)
      .eq('content_id', contentId)

    if (error) {
      console.error('Error moving content to folder:', error)
      throw error
    }
  }

  /**
   * Obtiene contenido archivado por carpeta
   * IMPORTANTE: No usa !inner para user_sources para incluir contenido de fuentes
   * a las que el usuario no está suscrito
   */
  async getArchivedByFolder(folderId: string | null): Promise<ContentWithMetadata[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    // Primero obtener los IDs de contenido archivado en esta carpeta
    let query = supabase
      .from('user_content')
      .select('content_id, content_type')
      .eq('user_id', user.id)
      .eq('is_archived', true)
    
    if (folderId === null) {
      query = query.is('folder_id', null)
    } else {
      query = query.eq('folder_id', folderId)
    }

    const { data: userContentItems, error } = await query

    if (error || !userContentItems || userContentItems.length === 0) {
      return []
    }

    // Agrupar por tipo de contenido
    const contentByType = userContentItems.reduce((acc, item) => {
      const contentType = item.content_type as ContentType
      if (!acc[contentType]) {
        acc[contentType] = []
      }
      acc[contentType].push(item.content_id)
      return acc
    }, {} as Record<ContentType, string[]>)

    // Obtener el contenido completo para cada tipo
    const allContent: ContentWithMetadata[] = []

    for (const [type, ids] of Object.entries(contentByType) as [ContentType, string[]][]) {
      const table = CONTENT_TYPE_TO_TABLE[type]
      if (!table) continue

      // No usar !inner para permitir contenido de fuentes no suscritas
      const { data: content } = await supabase
        .from(table)
        .select(`
          *,
          source:content_sources(*)
        `)
        .in('id', ids)

      if (content) {
        // Obtener user_content para estos items
        const { data: userContentData } = await supabase
          .from('user_content')
          .select('*')
          .eq('user_id', user.id)
          .eq('content_type', type)
          .in('content_id', ids)

        const userContentMap = new Map(
          (userContentData || []).map(uc => [uc.content_id, uc])
        )

        // Obtener user_source si existe (puede ser null si no está suscrito)
        for (const item of content) {
          const { data: userSourceData } = await supabase
            .from('user_sources')
            .select('*')
            .eq('user_id', user.id)
            .eq('source_id', item.source_id)
            .maybeSingle()

          // Si no hay source (puede pasar con contenido guardado de fuentes no suscritas),
          // crear una fuente sintética basada en el tipo de contenido
          const itemSource = item.source || {
            id: item.source_id,
            source_type: type === 'youtube' ? 'youtube_video' : type === 'podcast' ? 'podcast' : 'rss',
            url: item.url,
            title: (item as any).channel_name || (item as any).author || item.title,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          allContent.push({
            ...item,
            source: itemSource,
            content_type: type as ContentType,
            user_source: userSourceData || null,
            user_content: userContentMap.get(item.id) || null
          } as ContentWithMetadata)
        }
      }
    }

    // Ordenar por fecha de archivo
    return allContent.sort((a, b) => {
      const dateA = a.user_content?.archived_at || ''
      const dateB = b.user_content?.archived_at || ''
      return dateB.localeCompare(dateA)
    })
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
   * IMPORTANTE: Busca desde user_content primero para incluir contenido de fuentes
   * a las que el usuario no está suscrito (por ejemplo, clips guardados de videos sueltos)
   */
  async getArchivedContent(contentType?: ContentType): Promise<ContentWithMetadata[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    // Obtener todos los registros de user_content archivados
    let userContentQuery = supabase
      .from('user_content')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', true)
      .order('archived_at', { ascending: false })

    if (contentType) {
      userContentQuery = userContentQuery.eq('content_type', contentType)
    }

    const { data: archivedUserContent, error: ucError } = await userContentQuery

    if (ucError) {
      console.error('Error fetching archived user_content:', ucError)
      return []
    }

    if (!archivedUserContent || archivedUserContent.length === 0) {
      return []
    }

    // Agrupar por tipo de contenido
    const contentByType = new Map<ContentType, string[]>()
    for (const uc of archivedUserContent) {
      const type = uc.content_type as ContentType
      if (!contentByType.has(type)) {
        contentByType.set(type, [])
      }
      contentByType.get(type)!.push(uc.content_id)
    }

    // Crear un mapa de user_content para acceso rápido
    const userContentMap = new Map(
      archivedUserContent.map(uc => [`${uc.content_type}:${uc.content_id}`, uc])
    )

    // Obtener el contenido para cada tipo
    const allContent: ContentWithMetadata[] = []

    for (const [type, contentIds] of contentByType) {
      const table = CONTENT_TYPE_TO_TABLE[type]
      if (!table) continue

      const { data: content, error } = await supabase
        .from(table)
        .select(`
          *,
          source:content_sources(*)
        `)
        .in('id', contentIds)

      if (error) {
        console.error(`Error fetching ${type} content:`, error)
        continue
      }

      if (content) {
        for (const item of content) {
          // Obtener user_source si existe
          const { data: userSourceData } = await supabase
            .from('user_sources')
            .select('*')
            .eq('user_id', user.id)
            .eq('source_id', item.source_id)
            .maybeSingle()

          allContent.push({
            ...item,
            content_type: type,
            user_source: userSourceData || null,
            user_content: userContentMap.get(`${type}:${item.id}`) || null
          } as ContentWithMetadata)
        }
      }
    }

    // Ordenar por fecha de archivo
    return allContent.sort((a, b) => {
      const dateA = a.user_content?.archived_at || ''
      const dateB = b.user_content?.archived_at || ''
      return dateB.localeCompare(dateA)
    })
  }

  /**
   * Normaliza un texto para búsqueda (elimina acentos, convierte a minúsculas)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/[^a-z0-9\s]/g, '') // Solo letras, números y espacios
      .trim()
  }

  /**
   * Calcula la distancia de Levenshtein entre dos strings
   * Usado para búsqueda fuzzy
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length
    const n = str2.length
    
    // Crear matriz
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
    
    // Inicializar primera fila y columna
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    
    // Llenar la matriz
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // eliminación
            dp[i][j - 1],     // inserción
            dp[i - 1][j - 1]  // sustitución
          )
        }
      }
    }
    
    return dp[m][n]
  }

  /**
   * Calcula un score de similitud entre 0 y 1
   */
  private similarityScore(str1: string, str2: string): number {
    const normalized1 = this.normalizeText(str1)
    const normalized2 = this.normalizeText(str2)
    
    if (normalized1 === normalized2) return 1
    if (normalized1.length === 0 || normalized2.length === 0) return 0
    
    // Coincidencia exacta parcial
    if (normalized2.includes(normalized1)) return 0.95
    if (normalized1.includes(normalized2)) return 0.9
    
    // Buscar coincidencia de palabras
    const words1 = normalized1.split(/\s+/)
    const words2 = normalized2.split(/\s+/)
    
    let matchingWords = 0
    for (const word1 of words1) {
      if (word1.length < 2) continue
      for (const word2 of words2) {
        if (word2.includes(word1) || word1.includes(word2)) {
          matchingWords++
          break
        }
        // Coincidencia fuzzy por palabra
        if (word1.length > 3 && word2.length > 3) {
          const distance = this.levenshteinDistance(word1, word2)
          const maxLen = Math.max(word1.length, word2.length)
          if (distance / maxLen <= 0.3) { // 30% de diferencia máxima
            matchingWords += 0.8
            break
          }
        }
      }
    }
    
    if (matchingWords > 0) {
      return Math.min(0.85, matchingWords / words1.length)
    }
    
    // Distancia de Levenshtein para strings cortos
    const maxLen = Math.max(normalized1.length, normalized2.length)
    const distance = this.levenshteinDistance(normalized1, normalized2)
    return Math.max(0, 1 - distance / maxLen)
  }

  /**
   * Genera variantes de búsqueda para fuzzy matching
   */
  private generateSearchVariants(query: string): string[] {
    const normalized = this.normalizeText(query)
    const variants = new Set<string>([query, normalized])
    
    // Agregar versión sin espacios extras
    variants.add(query.trim())
    
    // Agregar cada palabra individualmente si hay múltiples
    const words = normalized.split(/\s+/).filter(w => w.length > 2)
    words.forEach(word => variants.add(word))
    
    return Array.from(variants)
  }

  /**
   * Busca contenido por título, descripción o autor con búsqueda fuzzy
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

    // Generar variantes de búsqueda para fuzzy matching
    const searchVariants = this.generateSearchVariants(searchQuery)
    const normalizedQuery = this.normalizeText(searchQuery)

    const allResults: ContentWithMetadata[] = []
    const seenIds = new Set<string>()

    for (const type of types) {
      const table = CONTENT_TYPE_TO_TABLE[type]
      
      // Buscar con cada variante
      for (const variant of searchVariants) {
        // Construir query de búsqueda dependiendo del tipo
        let searchCondition = ''
        if (type === 'rss') {
          searchCondition = `title.ilike.%${variant}%,content.ilike.%${variant}%,author.ilike.%${variant}%`
        } else if (type === 'youtube') {
          searchCondition = `title.ilike.%${variant}%,description.ilike.%${variant}%,channel_name.ilike.%${variant}%`
        } else if (type === 'twitter') {
          searchCondition = `text_content.ilike.%${variant}%,author_name.ilike.%${variant}%`
        } else if (type === 'instagram') {
          searchCondition = `caption.ilike.%${variant}%,author_username.ilike.%${variant}%`
        } else if (type === 'tiktok') {
          searchCondition = `description.ilike.%${variant}%,author_username.ilike.%${variant}%`
        } else if (type === 'podcast') {
          searchCondition = `title.ilike.%${variant}%,description.ilike.%${variant}%,author.ilike.%${variant}%`
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
          .limit(30)

        if (content) {
          // Filtrar duplicados
          const newContent = content.filter(c => !seenIds.has(c.id))
          newContent.forEach(c => seenIds.add(c.id))

          if (newContent.length > 0) {
            // Obtener user_content para estos resultados
            const contentIds = newContent.map(c => c.id)
            const { data: userContentData } = await supabase
              .from('user_content')
              .select('*')
              .eq('user_id', user.id)
              .eq('content_type', type)
              .in('content_id', contentIds)

            const userContentMap = new Map(
              (userContentData || []).map(uc => [uc.content_id, uc])
            )

            const results = newContent.map(item => ({
              ...item,
              content_type: type,
              user_content: userContentMap.get(item.id) || null
            })) as ContentWithMetadata[]

            allResults.push(...results)
          }
        }
      }
    }

    // Ordenar por relevancia usando similaridad fuzzy
    const scoredResults = allResults.map(item => {
      const title = 'title' in item ? (item.title || '') : ''
      const description = 'description' in item ? ((item as any).description || '') : ''
      const author = 'author' in item ? ((item as any).author || '') : 
                     'channel_name' in item ? ((item as any).channel_name || '') : ''
      
      // Calcular scores de similitud
      const titleScore = this.similarityScore(normalizedQuery, title) * 1.5 // Peso extra para título
      const descScore = this.similarityScore(normalizedQuery, description) * 0.8
      const authorScore = this.similarityScore(normalizedQuery, author) * 0.7
      
      // Tomar el mejor score
      const maxScore = Math.max(titleScore, descScore, authorScore)
      
      return { item, score: maxScore }
    })

    // Filtrar resultados con score muy bajo y ordenar por score
    return scoredResults
      .filter(r => r.score > 0.2) // Umbral mínimo de relevancia
      .sort((a, b) => {
        // Primero por score
        if (Math.abs(a.score - b.score) > 0.1) {
          return b.score - a.score
        }
        // Si scores similares, por fecha
        const aDate = a.item.published_at || ''
        const bDate = b.item.published_at || ''
        return bDate.localeCompare(aDate)
      })
      .map(r => r.item)
      .slice(0, 50) // Limitar resultados
  }
}

export const contentService = new ContentService()
