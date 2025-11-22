import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { 
  ContentSource, 
  ContentSourceInsert, 
  ContentSourceUpdate,
  UserSource,
  UserSourceInsert,
  UserSourceUpdate,
  SourceType
} from '@/types/database'

// Tipo combinado para facilitar el trabajo con fuentes
export type SourceWithUserData = ContentSource & {
  user_source: UserSource
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
   */
  async createOrSubscribeToSource(
    sourceData: Omit<ContentSourceInsert, 'id'>,
    userSourceData?: Partial<Omit<UserSourceInsert, 'user_id' | 'source_id'>>
  ): Promise<SourceWithUserData | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    try {
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
   * Desuscribe al usuario de una fuente
   * La fuente se mantiene en la BD para otros usuarios
   */
  async unsubscribeFromSource(sourceId: string): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('user_sources')
      .delete()
      .eq('user_id', user.id)
      .eq('source_id', sourceId)

    if (error) {
      console.error('Error unsubscribing from source:', error)
      throw error
    }

    // Nota: No eliminamos content_sources aquí
    // Se puede crear un job periódico que elimine fuentes sin suscriptores
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

