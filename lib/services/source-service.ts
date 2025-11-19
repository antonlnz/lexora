import { createClient } from '@/lib/supabase/client'
import type { Source, SourceInsert, SourceUpdate } from '@/types/database'

export class SourceService {
  private getClient() {
    return createClient()
  }

  /**
   * Obtiene todas las fuentes del usuario actual
   */
  async getUserSources(activeOnly = false): Promise<Source[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    let query = supabase
      .from('sources')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching sources:', error)
      return []
    }

    return data || []
  }

  /**
   * Obtiene fuentes agrupadas por tipo
   */
  async getSourcesByType(): Promise<Record<string, Source[]>> {
    const sources = await this.getUserSources(true)
    
    return sources.reduce((acc, source) => {
      const type = source.source_type
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(source)
      return acc
    }, {} as Record<string, Source[]>)
  }

  /**
   * Crea una nueva fuente
   */
  async createSource(source: Omit<SourceInsert, 'user_id'>): Promise<Source | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data, error } = await supabase
      .from('sources')
      .insert({
        ...source,
        user_id: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating source:', error)
      throw error
    }

    return data
  }

  /**
   * Actualiza una fuente
   */
  async updateSource(id: string, updates: SourceUpdate): Promise<Source | null> {
    const supabase = this.getClient()
    const { data, error } = await supabase
      .from('sources')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating source:', error)
      throw error
    }

    return data
  }

  /**
   * Elimina una fuente
   */
  async deleteSource(id: string): Promise<void> {
    const supabase = this.getClient()
    const { error } = await supabase
      .from('sources')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting source:', error)
      throw error
    }
  }

  /**
   * Activa/desactiva una fuente
   */
  async toggleSourceActive(id: string, isActive: boolean): Promise<void> {
    await this.updateSource(id, { is_active: isActive })
  }
}

export const sourceService = new SourceService()
