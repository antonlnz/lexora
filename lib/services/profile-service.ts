import { createClient } from '@/lib/supabase/client'
import { userSettingsService } from './user-settings-service'
import type { Profile, ProfileUpdate } from '@/types/database'

/**
 * ProfileService - Actualizado para usar el nuevo esquema
 * Ahora delega las configuraciones a UserSettingsService
 */
export class ProfileService {
  private getClient() {
    return createClient()
  }

  /**
   * Obtiene el perfil del usuario actual
   */
  async getCurrentProfile(): Promise<Profile | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    return data
  }

  /**
   * Actualiza el perfil del usuario actual
   */
  async updateProfile(updates: ProfileUpdate): Promise<Profile | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      throw error
    }

    return data
  }

  /**
   * Completa el onboarding del usuario
   */
  async completeOnboarding(): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (error) {
      console.error('Error completing onboarding:', error)
      throw error
    }
  }

  /**
   * Actualiza las preferencias de lectura
   * @deprecated Use userSettingsService.updateViewerSettings() and updateInterfaceSettings() instead
   */
  async updateReadingPreferences(preferences: {
    reading_speed?: number
    font_size?: string
    theme_preference?: string
  }): Promise<void> {
    const { data: { user } } = await this.getClient().auth.getUser()
    if (!user) return

    // Separar las preferencias entre viewer settings e interface settings
    const viewerUpdates: any = {}
    const interfaceUpdates: any = {}

    if (preferences.reading_speed !== undefined) {
      viewerUpdates.reading_speed = preferences.reading_speed
    }
    if (preferences.font_size !== undefined) {
      viewerUpdates.font_size = preferences.font_size
    }
    if (preferences.theme_preference !== undefined) {
      interfaceUpdates.theme_preference = preferences.theme_preference
    }

    // Actualizar en las tablas correspondientes
    if (Object.keys(viewerUpdates).length > 0) {
      await userSettingsService.updateViewerSettings(user.id, viewerUpdates)
    }
    if (Object.keys(interfaceUpdates).length > 0) {
      await userSettingsService.updateInterfaceSettings(user.id, interfaceUpdates)
    }
  }
}

export const profileService = new ProfileService()
