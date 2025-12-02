import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

// Tipos de plan (identificadores de plan en la base de datos)
export type PlanId = 'free' | 'pro'

// Estado de suscripción
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing'

// Estructura de features de un plan
export interface PlanFeatures {
  // Funcionalidades habilitadas/deshabilitadas
  archive_search: boolean      // Búsqueda en el archivo
  archive_download: boolean    // Descargar entradas del archivo
  advanced_filters: boolean    // Filtros avanzados
  export_data: boolean         // Exportar datos
  priority_updates: boolean    // Actualizaciones prioritarias de contenido
  custom_themes: boolean       // Temas personalizados
  api_access: boolean          // Acceso a API
  // Límites numéricos adicionales
  max_collections?: number     // Máximo de colecciones
  max_folders?: number         // Máximo de carpetas en archivo
}

// Plan de suscripción de la base de datos
export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  price_monthly: number | null
  price_yearly: number | null
  features: PlanFeatures
  max_sources: number | null
  max_archived_items: number | null
  created_at: string
  updated_at: string
}

// Suscripción del usuario
export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
  // Join con el plan
  plan?: SubscriptionPlan
}

// Información completa de suscripción del usuario
export interface UserSubscriptionInfo {
  subscription: UserSubscription | null
  plan: SubscriptionPlan
  isActive: boolean
  daysRemaining: number | null
  sourcesUsed: number
  sourcesLimit: number
  canAddSource: boolean
  remainingSources: number
}

// Valores por defecto para plan free (fallback si no hay datos en DB)
const DEFAULT_FREE_PLAN: SubscriptionPlan = {
  id: 'free',
  name: 'Free',
  description: 'Plan gratuito con funcionalidades básicas',
  price_monthly: 0,
  price_yearly: 0,
  features: {
    archive_search: false,
    archive_download: false,
    advanced_filters: false,
    export_data: false,
    priority_updates: false,
    custom_themes: false,
    api_access: false,
    max_collections: 3,
    max_folders: 5,
  },
  max_sources: 10,
  max_archived_items: 100,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export class SubscriptionService {
  private supabaseClient?: SupabaseClient
  private plansCache: SubscriptionPlan[] | null = null
  private plansCacheTimestamp: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutos

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient
  }

  private getClient() {
    return this.supabaseClient || createBrowserClient()
  }

  /**
   * Obtiene todos los planes de suscripción disponibles
   * Utiliza caché para evitar llamadas excesivas a la DB
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    // Verificar caché
    const now = Date.now()
    if (this.plansCache && (now - this.plansCacheTimestamp) < this.CACHE_TTL) {
      return this.plansCache
    }

    const supabase = this.getClient()

    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price_monthly', { ascending: true })

    if (error) {
      console.error('Error fetching subscription plans:', error)
      // Devolver plan free por defecto si hay error
      return [DEFAULT_FREE_PLAN]
    }

    // Transformar features de JSON a objeto tipado
    const plans = (data || []).map(plan => ({
      ...plan,
      features: plan.features as PlanFeatures
    }))

    // Actualizar caché
    this.plansCache = plans
    this.plansCacheTimestamp = now

    return plans.length > 0 ? plans : [DEFAULT_FREE_PLAN]
  }

  /**
   * Obtiene un plan por su ID
   */
  async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    const plans = await this.getPlans()
    return plans.find(p => p.id === planId || p.name.toLowerCase() === planId.toLowerCase()) || null
  }

  /**
   * Obtiene el plan Free
   */
  async getFreePlan(): Promise<SubscriptionPlan> {
    const plans = await this.getPlans()
    return plans.find(p => p.name.toLowerCase() === 'free' || p.price_monthly === 0) || DEFAULT_FREE_PLAN
  }

  /**
   * Obtiene la suscripción actual del usuario
   */
  async getUserSubscription(): Promise<UserSubscription | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .single()

    if (error) {
      // No tiene suscripción -> usará plan free por defecto
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching user subscription:', error)
      return null
    }

    return {
      ...data,
      plan: data.plan as SubscriptionPlan
    }
  }

  /**
   * Obtiene información completa de suscripción del usuario
   * Incluye plan, límites, uso actual, etc.
   */
  async getUserSubscriptionInfo(): Promise<UserSubscriptionInfo> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Obtener suscripción y planes en paralelo
    const [subscription, plans] = await Promise.all([
      this.getUserSubscription(),
      this.getPlans()
    ])

    // Determinar el plan actual
    let plan: SubscriptionPlan
    if (subscription?.plan) {
      plan = subscription.plan
    } else if (subscription?.plan_id) {
      plan = plans.find(p => p.id === subscription.plan_id) || await this.getFreePlan()
    } else {
      plan = await this.getFreePlan()
    }

    // Contar fuentes del usuario
    let sourcesUsed = 0
    if (user) {
      const { count } = await supabase
        .from('user_sources')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      
      sourcesUsed = count || 0
    }

    // Calcular límites y estado
    const sourcesLimit = plan.max_sources || 10
    const canAddSource = sourcesUsed < sourcesLimit
    const remainingSources = Math.max(0, sourcesLimit - sourcesUsed)

    // Calcular si la suscripción está activa
    const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'

    // Calcular días restantes
    let daysRemaining: number | null = null
    if (subscription?.current_period_end) {
      const endDate = new Date(subscription.current_period_end)
      const now = new Date()
      daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }

    return {
      subscription,
      plan,
      isActive: subscription ? isActive : true, // Free siempre activo
      daysRemaining,
      sourcesUsed,
      sourcesLimit,
      canAddSource,
      remainingSources
    }
  }

  /**
   * Verifica si el usuario puede añadir una fuente (verificación server-side)
   * Esta es la verificación principal que debe usarse antes de añadir fuentes
   */
  async canAddSource(): Promise<{ allowed: boolean; reason?: string; limit: number; used: number }> {
    const info = await this.getUserSubscriptionInfo()

    if (!info.canAddSource) {
      return {
        allowed: false,
        reason: `Has alcanzado el límite de ${info.sourcesLimit} fuentes para tu plan ${info.plan.name}. Actualiza a Pro para fuentes ilimitadas.`,
        limit: info.sourcesLimit,
        used: info.sourcesUsed
      }
    }

    return {
      allowed: true,
      limit: info.sourcesLimit,
      used: info.sourcesUsed
    }
  }

  /**
   * Verifica si el usuario puede añadir múltiples fuentes (para OPML import)
   * Devuelve cuántas puede añadir realmente
   */
  async canAddMultipleSources(requestedCount: number): Promise<{
    allowed: boolean
    maxAllowed: number
    reason?: string
    limit: number
    used: number
  }> {
    const info = await this.getUserSubscriptionInfo()
    const maxAllowed = Math.min(requestedCount, info.remainingSources)

    if (info.remainingSources <= 0) {
      return {
        allowed: false,
        maxAllowed: 0,
        reason: `Has alcanzado el límite de ${info.sourcesLimit} fuentes para tu plan ${info.plan.name}.`,
        limit: info.sourcesLimit,
        used: info.sourcesUsed
      }
    }

    if (requestedCount > info.remainingSources) {
      return {
        allowed: true,
        maxAllowed,
        reason: `Solo puedes añadir ${maxAllowed} fuentes más (${info.sourcesUsed}/${info.sourcesLimit} usadas).`,
        limit: info.sourcesLimit,
        used: info.sourcesUsed
      }
    }

    return {
      allowed: true,
      maxAllowed,
      limit: info.sourcesLimit,
      used: info.sourcesUsed
    }
  }

  /**
   * Verifica si el usuario tiene acceso a una funcionalidad
   */
  async hasFeature(feature: keyof PlanFeatures): Promise<boolean> {
    const info = await this.getUserSubscriptionInfo()
    return !!info.plan.features[feature]
  }

  /**
   * Crea o actualiza la suscripción del usuario
   */
  async createOrUpdateSubscription(
    planId: string,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string,
    periodEnd?: Date
  ): Promise<UserSubscription | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // Verificar que el plan existe
    const plan = await this.getPlanById(planId)
    if (!plan) {
      throw new Error('Plan not found')
    }

    const subscriptionData = {
      user_id: user.id,
      plan_id: plan.id,
      status: 'active' as SubscriptionStatus,
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd?.toISOString() || null,
      stripe_customer_id: stripeCustomerId || null,
      stripe_subscription_id: stripeSubscriptionId || null,
    }

    // Intentar actualizar si existe, o crear si no
    const { data: existing } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let result
    if (existing) {
      result = await supabase
        .from('user_subscriptions')
        .update({
          ...subscriptionData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select(`*, plan:subscription_plans(*)`)
        .single()
    } else {
      result = await supabase
        .from('user_subscriptions')
        .insert(subscriptionData)
        .select(`*, plan:subscription_plans(*)`)
        .single()
    }

    if (result.error) {
      console.error('Error creating/updating subscription:', result.error)
      throw result.error
    }

    return {
      ...result.data,
      plan: result.data.plan as SubscriptionPlan
    }
  }

  /**
   * Cancela la suscripción del usuario (al final del período)
   */
  async cancelSubscription(): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (error) {
      console.error('Error canceling subscription:', error)
      throw error
    }
  }

  /**
   * Reactiva una suscripción cancelada
   */
  async reactivateSubscription(): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (error) {
      console.error('Error reactivating subscription:', error)
      throw error
    }
  }

  /**
   * Cambia el plan del usuario a Free (downgrade)
   */
  async downgradeToFree(): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const freePlan = await this.getFreePlan()

    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        plan_id: freePlan.id,
        status: 'active',
        stripe_customer_id: null,
        stripe_subscription_id: null,
        current_period_end: null,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (error) {
      console.error('Error downgrading to free:', error)
      throw error
    }
  }

  /**
   * Invalida la caché de planes (útil cuando el admin actualiza los planes)
   */
  invalidateCache(): void {
    this.plansCache = null
    this.plansCacheTimestamp = 0
  }
}

export const subscriptionService = new SubscriptionService()
