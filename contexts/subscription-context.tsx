"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { 
  subscriptionService, 
  type SubscriptionPlan as DBSubscriptionPlan,
  type UserSubscriptionInfo,
  type PlanFeatures
} from "@/lib/services/subscription-service"

// Tipos exportados para el contexto
export type SubscriptionTier = "free" | "pro"

// Tipo para la UI - incluye info adicional para mostrar
export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  interval: "month" | "year"
  maxSources: number
  features: string[]
  popular?: boolean
  dbPlan?: DBSubscriptionPlan
}

// Convertir plan de DB a plan de UI
function dbPlanToUIPlan(dbPlan: DBSubscriptionPlan): SubscriptionPlan {
  const isPro = dbPlan.name.toLowerCase() === 'pro'
  const maxSources = dbPlan.max_sources || 10

  // Generar lista de features para mostrar en UI
  const featureList: string[] = []
  
  // Límite de fuentes
  if (maxSources >= 10000) {
    featureList.push("Fuentes de contenido ilimitadas")
  } else {
    featureList.push(`Hasta ${maxSources} fuentes de contenido`)
  }

  // Features basadas en el plan
  if (dbPlan.features.archive_search) {
    featureList.push("Búsqueda avanzada en archivo")
  }
  if (dbPlan.features.archive_download) {
    featureList.push("Descarga de entradas")
  }
  if (dbPlan.features.advanced_filters) {
    featureList.push("Filtros avanzados")
  }
  if (dbPlan.features.export_data) {
    featureList.push("Exportar datos")
  }
  if (dbPlan.features.priority_updates) {
    featureList.push("Actualizaciones prioritarias")
  }

  // Features básicas para todos
  featureList.push("Acceso desde móvil y escritorio")
  featureList.push("Experiencia de lectura personalizable")

  return {
    id: dbPlan.id,
    name: dbPlan.name,
    price: dbPlan.price_monthly || 0,
    interval: "month",
    maxSources: maxSources,
    features: featureList,
    popular: isPro,
    dbPlan
  }
}

interface SubscriptionContextType {
  // Estado
  currentPlan: SubscriptionTier
  currentPlanInfo: SubscriptionPlan | null
  subscriptionInfo: UserSubscriptionInfo | null
  plans: SubscriptionPlan[]
  isLoading: boolean
  
  // Límites y verificaciones
  canAddSource: (currentSourceCount?: number) => boolean
  canAddMultipleSources: (count: number, currentSourceCount?: number) => { allowed: boolean; maxAllowed: number }
  getSourceLimit: () => number
  getSourcesUsed: () => number
  getRemainingSources: () => number
  hasFeature: (feature: keyof PlanFeatures) => boolean
  
  // Acciones
  upgradePlan: (planId: string) => Promise<void>
  cancelSubscription: () => Promise<void>
  refreshSubscription: () => Promise<void>
  
  // Info de facturación
  autoRenew: boolean
  setAutoRenew: (value: boolean) => void
  nextBillingDate: string | null
  cancelAtPeriodEnd: boolean
  paymentMethod: string | null
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscriptionInfo, setSubscriptionInfo] = useState<UserSubscriptionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Cargar planes y suscripción del usuario
  const loadSubscriptionData = useCallback(async () => {
    try {
      // Cargar planes de la base de datos
      const dbPlans = await subscriptionService.getPlans()
      const uiPlans = dbPlans.map(dbPlanToUIPlan)
      setPlans(uiPlans)

      // Cargar info de suscripción del usuario
      const info = await subscriptionService.getUserSubscriptionInfo()
      setSubscriptionInfo(info)
    } catch (error) {
      console.error("Error loading subscription data:", error)
      // Fallback a plan free por defecto
      setPlans([{
        id: 'free',
        name: 'Free',
        price: 0,
        interval: 'month',
        maxSources: 10,
        features: [
          'Hasta 10 fuentes de contenido',
          'Acceso desde móvil y escritorio',
          'Experiencia de lectura personalizable'
        ]
      }])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSubscriptionData()
  }, [loadSubscriptionData])

  // Obtener el tier actual
  const currentPlan: SubscriptionTier = subscriptionInfo?.plan?.name?.toLowerCase() === 'pro' ? 'pro' : 'free'

  // Obtener info del plan actual para UI
  const currentPlanInfo = plans.find(p => 
    p.id === subscriptionInfo?.plan?.id || 
    p.name.toLowerCase() === currentPlan
  ) || null

  // Verificar si puede añadir una fuente
  const canAddSource = useCallback((currentSourceCount?: number): boolean => {
    if (!subscriptionInfo) return false
    
    // Si se proporciona un count específico, usarlo
    if (currentSourceCount !== undefined) {
      return currentSourceCount < subscriptionInfo.sourcesLimit
    }
    
    // Usar el count del subscriptionInfo
    return subscriptionInfo.canAddSource
  }, [subscriptionInfo])

  // Verificar si puede añadir múltiples fuentes
  const canAddMultipleSources = useCallback((count: number, currentSourceCount?: number): { allowed: boolean; maxAllowed: number } => {
    if (!subscriptionInfo) return { allowed: false, maxAllowed: 0 }
    
    const used = currentSourceCount !== undefined ? currentSourceCount : subscriptionInfo.sourcesUsed
    const remaining = Math.max(0, subscriptionInfo.sourcesLimit - used)
    const maxAllowed = Math.min(count, remaining)
    
    return {
      allowed: remaining > 0,
      maxAllowed
    }
  }, [subscriptionInfo])

  // Obtener límite de fuentes
  const getSourceLimit = useCallback((): number => {
    return subscriptionInfo?.sourcesLimit || 10
  }, [subscriptionInfo])

  // Obtener fuentes usadas
  const getSourcesUsed = useCallback((): number => {
    return subscriptionInfo?.sourcesUsed || 0
  }, [subscriptionInfo])

  // Obtener fuentes restantes
  const getRemainingSources = useCallback((): number => {
    return subscriptionInfo?.remainingSources || 0
  }, [subscriptionInfo])

  // Verificar si tiene una feature
  const hasFeature = useCallback((feature: keyof PlanFeatures): boolean => {
    return !!subscriptionInfo?.plan?.features?.[feature]
  }, [subscriptionInfo])

  // Actualizar plan (upgrade/downgrade)
  const upgradePlan = useCallback(async (planId: string) => {
    setIsLoading(true)
    try {
      // Para el plan free, usar downgrade
      const planToSet = plans.find(p => p.id === planId || p.name.toLowerCase() === planId.toLowerCase())
      
      if (!planToSet) {
        throw new Error('Plan not found')
      }

      if (planToSet.price === 0) {
        await subscriptionService.downgradeToFree()
      } else {
        // Para planes de pago, crear/actualizar suscripción
        // En producción, aquí iría la integración con Stripe
        const periodEnd = new Date()
        periodEnd.setDate(periodEnd.getDate() + 30)
        
        await subscriptionService.createOrUpdateSubscription(
          planToSet.id,
          undefined, // stripe_customer_id - se setearía con Stripe real
          undefined, // stripe_subscription_id - se setearía con Stripe real
          periodEnd
        )
      }

      // Recargar datos de suscripción
      await loadSubscriptionData()
    } catch (error) {
      console.error("Error upgrading plan:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [plans, loadSubscriptionData])

  // Cancelar suscripción
  const cancelSubscription = useCallback(async () => {
    setIsLoading(true)
    try {
      await subscriptionService.cancelSubscription()
      await loadSubscriptionData()
    } catch (error) {
      console.error("Error canceling subscription:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [loadSubscriptionData])

  // Refrescar suscripción
  const refreshSubscription = useCallback(async () => {
    await loadSubscriptionData()
  }, [loadSubscriptionData])

  // Auto-renew (basado en cancel_at_period_end)
  const autoRenew = !subscriptionInfo?.subscription?.cancel_at_period_end
  const setAutoRenew = useCallback(async (value: boolean) => {
    try {
      if (value) {
        await subscriptionService.reactivateSubscription()
      } else {
        await subscriptionService.cancelSubscription()
      }
      await loadSubscriptionData()
    } catch (error) {
      console.error("Error setting auto-renew:", error)
    }
  }, [loadSubscriptionData])

  // Próxima fecha de facturación
  const nextBillingDate = subscriptionInfo?.subscription?.current_period_end || null

  // Si se cancelará al final del período
  const cancelAtPeriodEnd = subscriptionInfo?.subscription?.cancel_at_period_end || false

  // Método de pago (placeholder - se implementaría con Stripe)
  const paymentMethod: string | null = null

  return (
    <SubscriptionContext.Provider
      value={{
        currentPlan,
        currentPlanInfo,
        subscriptionInfo,
        plans,
        isLoading,
        canAddSource,
        canAddMultipleSources,
        getSourceLimit,
        getSourcesUsed,
        getRemainingSources,
        hasFeature,
        upgradePlan,
        cancelSubscription,
        refreshSubscription,
        autoRenew,
        setAutoRenew,
        nextBillingDate,
        cancelAtPeriodEnd,
        paymentMethod,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider")
  }
  return context
}
