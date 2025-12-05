import { createClient } from '@/lib/supabase/client'
import type { 
  ContentType,
  RSSContent,
  YouTubeContent,
  PodcastContent,
  UserContent,
  UserContentInsert,
  UserContentUpdate,
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
