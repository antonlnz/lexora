import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

// Tablas de contenido por tipo de fuente
const CONTENT_TABLES = [
  'rss_content',
  'youtube_content',
  'twitter_content',
  'instagram_content',
  'tiktok_content',
  'podcast_content'
] as const

// Tablas relacionadas con el usuario (con ON DELETE CASCADE desde auth.users)
const USER_TABLES_CASCADE = [
  'profiles',
  'user_subscriptions',
  'user_viewer_settings',
  'user_interface_settings',
  'user_notification_settings',
  'user_privacy_settings',
  'user_sources',
  'user_content',
  'archive_folders',
  'collections_new'
] as const

export interface AccountDeletionInfo {
  sourcesCount: number
  exclusiveSourcesCount: number
  contentToDelete: number
  archivedItems: number
  collections: number
  folders: number
}

export class AccountService {
  private supabaseClient?: SupabaseClient

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient
  }

  private getClient() {
    return this.supabaseClient || createBrowserClient()
  }

  /**
   * Verifica la contraseña del usuario antes de eliminar la cuenta
   */
  async verifyPassword(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const supabase = this.getClient()

    // Intentar iniciar sesión con las credenciales para verificar la contraseña
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return { 
        success: false, 
        error: error.message === 'Invalid login credentials' 
          ? 'Contraseña incorrecta' 
          : error.message 
      }
    }

    return { success: true }
  }

  /**
   * Obtiene información sobre qué se eliminará
   */
  async getAccountDeletionInfo(): Promise<AccountDeletionInfo> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('No authenticated user')
    }

    // Contar fuentes del usuario
    const { count: sourcesCount } = await supabase
      .from('user_sources')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Contar fuentes exclusivas (donde el usuario es el único suscriptor)
    const { data: userSources } = await supabase
      .from('user_sources')
      .select('source_id')
      .eq('user_id', user.id)

    let exclusiveSourcesCount = 0
    if (userSources && userSources.length > 0) {
      for (const us of userSources) {
        const { count } = await supabase
          .from('user_sources')
          .select('*', { count: 'exact', head: true })
          .eq('source_id', us.source_id)
        
        if (count === 1) {
          exclusiveSourcesCount++
        }
      }
    }

    // Contar contenido en user_content
    const { count: contentToDelete } = await supabase
      .from('user_content')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Contar items archivados
    const { count: archivedItems } = await supabase
      .from('user_content')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_archived', true)

    // Contar colecciones
    const { count: collections } = await supabase
      .from('collections_new')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Contar carpetas del archivo
    const { count: folders } = await supabase
      .from('archive_folders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return {
      sourcesCount: sourcesCount || 0,
      exclusiveSourcesCount,
      contentToDelete: contentToDelete || 0,
      archivedItems: archivedItems || 0,
      collections: collections || 0,
      folders: folders || 0
    }
  }

  /**
   * Elimina completamente la cuenta del usuario y todo su contenido
   * 
   * Proceso:
   * 1. Verificar la contraseña del usuario
   * 2. Llamar a la función RPC que hace toda la limpieza
   * 3. Cerrar sesión
   */
  async deleteAccount(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No se encontró usuario autenticado' }
    }

    // 1. Verificar la contraseña
    const verification = await this.verifyPassword(email, password)
    if (!verification.success) {
      return verification
    }

    try {
      // 2. Intentar usar la función RPC que elimina todo incluyendo auth.users
      const { error: rpcError } = await supabase.rpc('delete_user_account')

      if (rpcError) {
        console.warn('delete_user_account RPC failed, trying delete_user_data:', rpcError)
        
        // Si falla delete_user_account, intentar delete_user_data
        // (que solo elimina los datos públicos pero no auth.users)
        const { error: dataError } = await supabase.rpc('delete_user_data')
        
        if (dataError) {
          console.warn('delete_user_data RPC also failed, falling back to manual deletion:', dataError)
          // Fallback: eliminación manual desde el cliente
          await this.manualDeleteUserData(user.id)
        }
      }

      // 3. Cerrar sesión
      await supabase.auth.signOut({ scope: 'global' })

      return { success: true }
    } catch (error) {
      console.error('Error deleting account:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al eliminar la cuenta' 
      }
    }
  }

  /**
   * Eliminación manual de datos del usuario (fallback si las funciones RPC no funcionan)
   */
  private async manualDeleteUserData(userId: string): Promise<void> {
    const supabase = this.getClient()

    // 1. Obtener fuentes del usuario
    const { data: userSources } = await supabase
      .from('user_sources')
      .select('source_id')
      .eq('user_id', userId)

    // 2. Identificar y eliminar fuentes exclusivas
    if (userSources && userSources.length > 0) {
      const exclusiveSourceIds: string[] = []

      for (const us of userSources) {
        const { count } = await supabase
          .from('user_sources')
          .select('*', { count: 'exact', head: true })
          .eq('source_id', us.source_id)
        
        if (count === 1) {
          exclusiveSourceIds.push(us.source_id)
        }
      }

      // Eliminar contenido de fuentes exclusivas
      if (exclusiveSourceIds.length > 0) {
        for (const table of CONTENT_TABLES) {
          await supabase.from(table).delete().in('source_id', exclusiveSourceIds)
        }
        // Eliminar las fuentes exclusivas
        await supabase.from('content_sources').delete().in('id', exclusiveSourceIds)
      }
    }

    // 3. Eliminar datos del usuario
    await supabase.from('archive_folders').delete().eq('user_id', userId)
    await supabase.from('collections_new').delete().eq('user_id', userId)
    await supabase.from('user_content').delete().eq('user_id', userId)
    await supabase.from('user_sources').delete().eq('user_id', userId)
    await supabase.from('user_viewer_settings').delete().eq('user_id', userId)
    await supabase.from('user_interface_settings').delete().eq('user_id', userId)
    await supabase.from('user_notification_settings').delete().eq('user_id', userId)
    await supabase.from('user_privacy_settings').delete().eq('user_id', userId)
    await supabase.from('user_subscriptions').delete().eq('user_id', userId)
    await supabase.from('profiles').delete().eq('id', userId)
  }
}

export const accountService = new AccountService()
