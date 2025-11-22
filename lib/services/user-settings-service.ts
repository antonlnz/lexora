import { createClient } from '@/lib/supabase/server'
import type {
  UserViewerSettings,
  UserInterfaceSettings,
  UserNotificationSettings,
  UserPrivacySettings,
} from '@/types/database'

export class UserSettingsService {
  /**
   * Obtener configuración del visor de contenido
   */
  async getViewerSettings(userId: string): Promise<UserViewerSettings | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_viewer_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Error fetching viewer settings:', error)
      return null
    }

    return data
  }

  /**
   * Actualizar configuración del visor de contenido
   */
  async updateViewerSettings(
    userId: string,
    settings: Partial<Omit<UserViewerSettings, 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<UserViewerSettings | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_viewer_settings')
      .upsert({
        user_id: userId,
        ...settings,
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating viewer settings:', error)
      return null
    }

    return data
  }

  /**
   * Obtener configuración de la interfaz
   */
  async getInterfaceSettings(userId: string): Promise<UserInterfaceSettings | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_interface_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Error fetching interface settings:', error)
      return null
    }

    return data
  }

  /**
   * Actualizar configuración de la interfaz
   */
  async updateInterfaceSettings(
    userId: string,
    settings: Partial<Omit<UserInterfaceSettings, 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<UserInterfaceSettings | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_interface_settings')
      .upsert({
        user_id: userId,
        ...settings,
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating interface settings:', error)
      return null
    }

    return data
  }

  /**
   * Obtener configuración de notificaciones
   */
  async getNotificationSettings(userId: string): Promise<UserNotificationSettings | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Error fetching notification settings:', error)
      return null
    }

    return data
  }

  /**
   * Actualizar configuración de notificaciones
   */
  async updateNotificationSettings(
    userId: string,
    settings: Partial<Omit<UserNotificationSettings, 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<UserNotificationSettings | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_notification_settings')
      .upsert({
        user_id: userId,
        ...settings,
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating notification settings:', error)
      return null
    }

    return data
  }

  /**
   * Obtener configuración de privacidad
   */
  async getPrivacySettings(userId: string): Promise<UserPrivacySettings | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_privacy_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Error fetching privacy settings:', error)
      return null
    }

    return data
  }

  /**
   * Actualizar configuración de privacidad
   */
  async updatePrivacySettings(
    userId: string,
    settings: Partial<Omit<UserPrivacySettings, 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<UserPrivacySettings | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_privacy_settings')
      .upsert({
        user_id: userId,
        ...settings,
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating privacy settings:', error)
      return null
    }

    return data
  }

  /**
   * Obtener todas las configuraciones del usuario de una vez
   */
  async getAllSettings(userId: string): Promise<{
    viewer: UserViewerSettings | null
    interface: UserInterfaceSettings | null
    notification: UserNotificationSettings | null
    privacy: UserPrivacySettings | null
  }> {
    const [viewer, interface_, notification, privacy] = await Promise.all([
      this.getViewerSettings(userId),
      this.getInterfaceSettings(userId),
      this.getNotificationSettings(userId),
      this.getPrivacySettings(userId),
    ])

    return {
      viewer,
      interface: interface_,
      notification,
      privacy,
    }
  }

  /**
   * Inicializar configuraciones por defecto para un nuevo usuario
   */
  async initializeDefaultSettings(userId: string): Promise<void> {
    const supabase = await createClient()

    // Las tablas tienen valores por defecto definidos en el esquema,
    // así que solo necesitamos crear las filas
    await Promise.all([
      supabase.from('user_viewer_settings').insert({ user_id: userId }),
      supabase.from('user_interface_settings').insert({ user_id: userId }),
      supabase.from('user_notification_settings').insert({ user_id: userId }),
      supabase.from('user_privacy_settings').insert({ user_id: userId }),
    ])
  }
}

// Exportar instancia singleton
export const userSettingsService = new UserSettingsService()
