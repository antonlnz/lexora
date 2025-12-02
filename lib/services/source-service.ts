import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { 
  ContentSource, 
  ContentSourceInsert, 
  ContentSourceUpdate,
  UserSource,
  UserSourceInsert,
  UserSourceUpdate,
  SourceType,
  ContentType
} from '@/types/database'
import { subscriptionService } from './subscription-service'

// Tipo combinado para facilitar el trabajo con fuentes
export type SourceWithUserData = ContentSource & {
  user_source: UserSource
}

// Información de eliminación de una fuente
export interface SourceDeletionInfo {
  sourceId: string
  isOnlySubscriber: boolean
  hasSavedContent: boolean
  savedContentCount: number
  totalContentCount: number
  contentType: ContentType
}

// Mapeo de source_type a content_type y tabla de contenido
const SOURCE_TO_CONTENT_MAP: Record<SourceType, { contentType: ContentType; table: string }> = {
  'rss': { contentType: 'rss', table: 'rss_content' },
  'youtube_channel': { contentType: 'youtube', table: 'youtube_content' },
  'youtube_video': { contentType: 'youtube', table: 'youtube_content' },
  'twitter': { contentType: 'twitter', table: 'twitter_content' },
  'instagram': { contentType: 'instagram', table: 'instagram_content' },
  'tiktok': { contentType: 'tiktok', table: 'tiktok_content' },
  'podcast': { contentType: 'podcast', table: 'podcast_content' },
  'newsletter': { contentType: 'rss', table: 'rss_content' },
  'website': { contentType: 'rss', table: 'rss_content' },
}

export class SourceService {
  private supabaseClient?: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient
  }

  private getClient() {
    return this.supabaseClient || createBrowserClient()
  }

  /**
   * Obtiene todas las fuentes del usuario actual con sus datos de suscripción
   */
  async getUserSources(activeOnly = false): Promise<SourceWithUserData[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    let query = supabase
      .from('user_sources')
      .select(`
        *,
        source:content_sources(*)
      `)
      .eq('user_id', user.id)
      .order('subscribed_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching user sources:', error)
      return []
    }

    // Transformar la respuesta para que coincida con el tipo esperado
    return (data || []).map(item => ({
      ...item.source,
      user_source: {
        id: item.id,
        user_id: item.user_id,
        source_id: item.source_id,
        custom_title: item.custom_title,
        is_active: item.is_active,
        notification_enabled: item.notification_enabled,
        folder: item.folder,
        tags: item.tags,
        subscribed_at: item.subscribed_at,
        updated_at: item.updated_at
      }
    })) as SourceWithUserData[]
  }

  /**
   * Obtiene fuentes agrupadas por tipo
   */
  async getSourcesByType(): Promise<Record<string, SourceWithUserData[]>> {
    const sources = await this.getUserSources(true)
    
    return sources.reduce((acc, source) => {
      const type = source.source_type
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(source)
      return acc
    }, {} as Record<string, SourceWithUserData[]>)
  }

  /**
   * Obtiene una fuente por ID con datos del usuario
   */
  async getSourceById(sourceId: string): Promise<SourceWithUserData | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data, error } = await supabase
      .from('user_sources')
      .select(`
        *,
        source:content_sources(*)
      `)
      .eq('user_id', user.id)
      .eq('source_id', sourceId)
      .single()

    if (error || !data) {
      console.error('Error fetching source:', error)
      return null
    }

    return {
      ...data.source,
      user_source: {
        id: data.id,
        user_id: data.user_id,
        source_id: data.source_id,
        custom_title: data.custom_title,
        is_active: data.is_active,
        notification_enabled: data.notification_enabled,
        folder: data.folder,
        tags: data.tags,
        subscribed_at: data.subscribed_at,
        updated_at: data.updated_at
      }
    } as SourceWithUserData
  }

  /**
   * Crea o suscribe a una fuente
   * Si la fuente ya existe (misma URL), solo crea la suscripción del usuario
   * IMPORTANTE: Verifica el límite del plan antes de añadir
   */
  async createOrSubscribeToSource(
    sourceData: Omit<ContentSourceInsert, 'id'>,
    userSourceData?: Partial<Omit<UserSourceInsert, 'user_id' | 'source_id'>>
  ): Promise<SourceWithUserData | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    try {
      // VERIFICACIÓN DE LÍMITE SERVER-SIDE
      // Esta verificación es crítica para evitar que se bypasee el límite
      const { allowed, reason } = await subscriptionService.canAddSource()
      if (!allowed) {
        throw new Error(reason || 'Has alcanzado el límite de fuentes de tu plan')
      }

      // 1. Verificar si la fuente ya existe por URL
      const { data: existingSource } = await supabase
        .from('content_sources')
        .select('*')
        .eq('url', sourceData.url)
        .single()

      let source: ContentSource

      if (existingSource) {
        // La fuente ya existe, usar esa
        source = existingSource
        
        // Actualizar favicon_url si el nuevo es mejor (no nulo y diferente)
        if (sourceData.favicon_url && sourceData.favicon_url !== existingSource.favicon_url) {
          const { data: updatedSource } = await supabase
            .from('content_sources')
            .update({ favicon_url: sourceData.favicon_url })
            .eq('id', existingSource.id)
            .select()
            .single()
          
          if (updatedSource) {
            source = updatedSource
          }
        }
      } else {
        // Crear nueva fuente
        const { data: newSource, error: sourceError } = await supabase
          .from('content_sources')
          .insert(sourceData)
          .select()
          .single()

        if (sourceError) {
          console.error('Error creating source:', sourceError)
          throw sourceError
        }

        source = newSource
      }

      // 2. Verificar si el usuario ya está suscrito
      const { data: existingSubscription } = await supabase
        .from('user_sources')
        .select('*')
        .eq('user_id', user.id)
        .eq('source_id', source.id)
        .single()

      if (existingSubscription) {
        // Ya está suscrito, solo actualizar si hay cambios
        if (userSourceData) {
          const { data: updated, error: updateError } = await supabase
            .from('user_sources')
            .update(userSourceData)
            .eq('id', existingSubscription.id)
            .select()
            .single()

          if (updateError) throw updateError

          return {
            ...source,
            user_source: updated
          } as SourceWithUserData
        }

        return {
          ...source,
          user_source: existingSubscription
        } as SourceWithUserData
      }

      // 3. Crear suscripción del usuario a la fuente
      const { data: userSource, error: userSourceError } = await supabase
        .from('user_sources')
        .insert({
          user_id: user.id,
          source_id: source.id,
          ...userSourceData
        })
        .select()
        .single()

      if (userSourceError) {
        console.error('Error creating user source:', userSourceError)
        throw userSourceError
      }

      return {
        ...source,
        user_source: userSource
      } as SourceWithUserData
    } catch (error) {
      console.error('Error in createOrSubscribeToSource:', error)
      throw error
    }
  }

  /**
   * Actualiza los datos de una fuente (solo si el usuario es el único suscrito)
   * o actualiza la configuración personal del usuario para esa fuente
   */
  async updateSource(
    sourceId: string, 
    sourceUpdates?: ContentSourceUpdate,
    userSourceUpdates?: UserSourceUpdate
  ): Promise<SourceWithUserData | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    try {
      // Actualizar datos de la fuente si se proporcionan
      if (sourceUpdates && Object.keys(sourceUpdates).length > 0) {
        // Verificar cuántos usuarios usan esta fuente
        const { count } = await supabase
          .from('user_sources')
          .select('*', { count: 'exact', head: true })
          .eq('source_id', sourceId)

        if (count === 1) {
          // Solo este usuario usa la fuente, puede actualizarla
          const { error } = await supabase
            .from('content_sources')
            .update(sourceUpdates)
            .eq('id', sourceId)

          if (error) throw error
        } else {
          console.warn('Cannot update shared source metadata')
        }
      }

      // Actualizar configuración personal del usuario
      if (userSourceUpdates && Object.keys(userSourceUpdates).length > 0) {
        const { error } = await supabase
          .from('user_sources')
          .update(userSourceUpdates)
          .eq('user_id', user.id)
          .eq('source_id', sourceId)

        if (error) throw error
      }

      // Obtener y devolver la fuente actualizada
      return await this.getSourceById(sourceId)
    } catch (error) {
      console.error('Error updating source:', error)
      throw error
    }
  }

  /**
   * Obtiene información sobre la eliminación de una fuente
   * Verifica si el usuario es el único suscriptor, si tiene contenido guardado, etc.
   */
  async getSourceDeletionInfo(sourceId: string): Promise<SourceDeletionInfo | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    try {
      // Obtener la fuente
      const { data: source } = await supabase
        .from('content_sources')
        .select('*')
        .eq('id', sourceId)
        .single()

      if (!source) return null

      // Contar cuántos usuarios están suscritos a esta fuente
      const { count: subscriberCount } = await supabase
        .from('user_sources')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', sourceId)

      const contentInfo = SOURCE_TO_CONTENT_MAP[source.source_type as SourceType]
      
      // Obtener todos los IDs de contenido de esta fuente
      const { data: contentItems } = await supabase
        .from(contentInfo.table)
        .select('id')
        .eq('source_id', sourceId)

      const contentIds = contentItems?.map(item => item.id) || []
      
      // Contar contenido guardado (archivado) del usuario para esta fuente
      let savedContentCount = 0
      if (contentIds.length > 0) {
        const { count } = await supabase
          .from('user_content')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('content_type', contentInfo.contentType)
          .eq('is_archived', true)
          .in('content_id', contentIds)
        
        savedContentCount = count || 0
      }

      return {
        sourceId,
        isOnlySubscriber: (subscriberCount || 0) <= 1,
        hasSavedContent: savedContentCount > 0,
        savedContentCount,
        totalContentCount: contentIds.length,
        contentType: contentInfo.contentType,
      }
    } catch (error) {
      console.error('Error getting source deletion info:', error)
      return null
    }
  }

  /**
   * Elimina una fuente completamente con todas sus opciones
   * @param sourceId - ID de la fuente a eliminar
   * @param deleteSavedContent - Si también se debe eliminar el contenido guardado del usuario
   */
  async deleteSourceCompletely(
    sourceId: string, 
    deleteSavedContent: boolean = false
  ): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.log('[deleteSourceCompletely] No user found')
      return
    }

    console.log(`[deleteSourceCompletely] Starting deletion for source ${sourceId}, deleteSavedContent: ${deleteSavedContent}`)

    try {
      // Obtener información de la fuente
      const { data: source, error: sourceError } = await supabase
        .from('content_sources')
        .select('*')
        .eq('id', sourceId)
        .single()

      if (sourceError) {
        console.error('[deleteSourceCompletely] Error fetching source:', sourceError)
        throw new Error('Source not found')
      }

      if (!source) {
        console.log('[deleteSourceCompletely] Source not found')
        throw new Error('Source not found')
      }

      console.log(`[deleteSourceCompletely] Found source: ${source.title} (type: ${source.source_type})`)

      const contentInfo = SOURCE_TO_CONTENT_MAP[source.source_type as SourceType]
      console.log(`[deleteSourceCompletely] Content table: ${contentInfo.table}, content type: ${contentInfo.contentType}`)

      // Obtener todos los IDs de contenido de esta fuente
      const { data: contentItems, error: contentItemsError } = await supabase
        .from(contentInfo.table)
        .select('id')
        .eq('source_id', sourceId)

      if (contentItemsError) {
        console.error('[deleteSourceCompletely] Error fetching content items:', contentItemsError)
      }

      const contentIds = contentItems?.map(item => item.id) || []
      console.log(`[deleteSourceCompletely] Found ${contentIds.length} content items`)

      // Contar suscriptores ANTES de eliminar
      const { count: subscriberCount, error: countError } = await supabase
        .from('user_sources')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', sourceId)

      if (countError) {
        console.error('[deleteSourceCompletely] Error counting subscribers:', countError)
      }

      console.log(`[deleteSourceCompletely] Subscriber count: ${subscriberCount}`)
      const isOnlySubscriber = (subscriberCount || 0) <= 1
      console.log(`[deleteSourceCompletely] Is only subscriber: ${isOnlySubscriber}`)

      // 1. Eliminar user_content del usuario para esta fuente
      if (contentIds.length > 0) {
        if (deleteSavedContent) {
          // Eliminar todo el user_content (incluyendo archivados)
          console.log('[deleteSourceCompletely] Deleting all user_content (including archived)')
          const { error: userContentError } = await supabase
            .from('user_content')
            .delete()
            .eq('user_id', user.id)
            .eq('content_type', contentInfo.contentType)
            .in('content_id', contentIds)

          if (userContentError) {
            console.error('[deleteSourceCompletely] Error deleting user content:', userContentError)
          }
        } else {
          // Eliminar solo el user_content que NO está archivado
          console.log('[deleteSourceCompletely] Deleting non-archived user_content only')
          const { error: userContentError } = await supabase
            .from('user_content')
            .delete()
            .eq('user_id', user.id)
            .eq('content_type', contentInfo.contentType)
            .eq('is_archived', false)
            .in('content_id', contentIds)

          if (userContentError) {
            console.error('[deleteSourceCompletely] Error deleting non-archived user content:', userContentError)
          }
        }
      }

      // 2. Si es el único suscriptor, eliminar contenido y fuente ANTES de eliminar user_sources
      // (Las políticas RLS requieren que exista el registro en user_sources para verificar permisos)
      if (isOnlySubscriber) {
        console.log('[deleteSourceCompletely] User is only subscriber, proceeding with full deletion')
        
        // Eliminar contenido de la tabla correspondiente
        if (contentIds.length > 0) {
          // Primero eliminar cualquier user_content restante de otros usuarios
          console.log(`[deleteSourceCompletely] Cleaning up all user_content for ${contentIds.length} content items`)
          const { error: userContentCleanupError } = await supabase
            .from('user_content')
            .delete()
            .eq('content_type', contentInfo.contentType)
            .in('content_id', contentIds)

          if (userContentCleanupError) {
            console.error('[deleteSourceCompletely] Error cleaning up user_content:', userContentCleanupError)
          } else {
            console.log('[deleteSourceCompletely] Successfully cleaned up user_content')
          }

          // Eliminar el contenido de la tabla específica
          console.log(`[deleteSourceCompletely] Deleting content from ${contentInfo.table}`)
          const { error: contentError } = await supabase
            .from(contentInfo.table)
            .delete()
            .eq('source_id', sourceId)

          if (contentError) {
            console.error('[deleteSourceCompletely] Error deleting content:', contentError)
          } else {
            console.log(`[deleteSourceCompletely] Successfully deleted content`)
          }
        } else {
          console.log('[deleteSourceCompletely] No content items to delete')
        }

        // Eliminar la fuente de content_sources
        console.log(`[deleteSourceCompletely] Deleting source from content_sources`)
        const { error: sourceDeleteError } = await supabase
          .from('content_sources')
          .delete()
          .eq('id', sourceId)

        if (sourceDeleteError) {
          console.error('[deleteSourceCompletely] Error deleting source:', sourceDeleteError)
        } else {
          console.log('[deleteSourceCompletely] Successfully deleted source from content_sources')
        }
      } else {
        console.log('[deleteSourceCompletely] Other subscribers exist, only removing user subscription')
      }

      // 3. Eliminar suscripción del usuario (al final para que las políticas RLS funcionen arriba)
      console.log(`[deleteSourceCompletely] Deleting user_sources for user ${user.id}`)
      const { error: unsubError } = await supabase
        .from('user_sources')
        .delete()
        .eq('user_id', user.id)
        .eq('source_id', sourceId)

      if (unsubError) {
        console.error('[deleteSourceCompletely] Error deleting user_sources:', unsubError)
        throw unsubError
      }
      console.log('[deleteSourceCompletely] Successfully deleted user_sources')
      
      console.log('[deleteSourceCompletely] Deletion complete')
    } catch (error) {
      console.error('[deleteSourceCompletely] Error:', error)
      throw error
    }
  }

  /**
   * Desuscribe al usuario de una fuente (método legacy simplificado)
   * @deprecated Use deleteSourceCompletely for full control
   */
  async unsubscribeFromSource(sourceId: string): Promise<void> {
    // Usar el nuevo método sin eliminar contenido guardado
    await this.deleteSourceCompletely(sourceId, false)
  }

  /**
   * Activa/desactiva una fuente para el usuario
   */
  async toggleSourceActive(sourceId: string, isActive: boolean): Promise<void> {
    await this.updateSource(sourceId, undefined, { is_active: isActive })
  }

  /**
   * Actualiza el título personalizado de una fuente para el usuario
   */
  async setCustomTitle(sourceId: string, customTitle: string | null): Promise<void> {
    await this.updateSource(sourceId, undefined, { custom_title: customTitle })
  }

  /**
   * Organiza una fuente en una carpeta
   */
  async setFolder(sourceId: string, folder: string | null): Promise<void> {
    await this.updateSource(sourceId, undefined, { folder })
  }

  /**
   * Actualiza las etiquetas de una fuente
   */
  async setTags(sourceId: string, tags: string[]): Promise<void> {
    await this.updateSource(sourceId, undefined, { tags })
  }

  /**
   * Limpia fuentes huérfanas (sin suscriptores)
   * Nota: Esta función debería ejecutarse periódicamente como tarea programada
   */
  async cleanupOrphanedSources(): Promise<number> {
    const supabase = this.getClient()
    
    // Encontrar fuentes sin suscriptores
    const { data: orphanedSources } = await supabase
      .from('content_sources')
      .select('id')
      .not('id', 'in', supabase.from('user_sources').select('source_id'))

    if (!orphanedSources || orphanedSources.length === 0) {
      return 0
    }

    const sourceIds = orphanedSources.map(s => s.id)

    // Eliminar las fuentes huérfanas
    const { error } = await supabase
      .from('content_sources')
      .delete()
      .in('id', sourceIds)

    if (error) {
      console.error('Error cleaning up orphaned sources:', error)
      return 0
    }

    return sourceIds.length
  }
}

export const sourceService = new SourceService()

