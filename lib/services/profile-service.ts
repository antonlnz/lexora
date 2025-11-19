import { createClient } from '@/lib/supabase/client'
import type { Profile, ProfileUpdate } from '@/types/database'

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
   */
  async updateReadingPreferences(preferences: {
    reading_speed?: number
    font_size?: string
    theme_preference?: string
  }): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update(preferences)
      .eq('id', user.id)

    if (error) {
      console.error('Error updating reading preferences:', error)
      throw error
    }
  }
}

export const profileService = new ProfileService()
