"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Sparkles, Crown, X } from "lucide-react"
import { useSubscription, type SubscriptionTier } from "@/contexts/subscription-context"
import { motion } from "framer-motion"

interface SubscriptionPlansProps {
  onSelect?: (plan: string) => void
  showCurrentPlan?: boolean
  /** Si es true, mantiene la selección visual (útil para onboarding) */
  persistSelection?: boolean
  /** Plan seleccionado por defecto */
  defaultSelected?: string
}

const planIcons = {
  free: Sparkles,
  pro: Crown,
}

// Features para mostrar con estado habilitado/deshabilitado
interface FeatureItem {
  text: string
  includedIn: ('free' | 'pro')[]
}

const allFeatures: FeatureItem[] = [
  { text: "Fuentes de contenido", includedIn: ['free', 'pro'] }, // Cantidad variable
  { text: "Acceso móvil y escritorio", includedIn: ['free', 'pro'] },
  { text: "Experiencia de lectura personalizable", includedIn: ['free', 'pro'] },
  { text: "Carpetas de archivo básicas", includedIn: ['free', 'pro'] },
  { text: "Búsqueda avanzada en archivo", includedIn: ['pro'] },
  { text: "Descarga de entradas", includedIn: ['pro'] },
  { text: "Filtros avanzados", includedIn: ['pro'] },
  { text: "Exportar datos", includedIn: ['pro'] },
  { text: "Actualizaciones prioritarias", includedIn: ['pro'] },
  { text: "Soporte prioritario", includedIn: ['pro'] },
]

export function SubscriptionPlans({ 
  onSelect, 
  showCurrentPlan = false,
  persistSelection = false,
  defaultSelected
}: SubscriptionPlansProps) {
  const { currentPlan, plans, upgradePlan, isLoading, getSourcesUsed, getSourceLimit } = useSubscription()
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(defaultSelected || null)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  // Seleccionar el plan Free por defecto en el onboarding si no hay selección
  useEffect(() => {
    if (persistSelection && !selectedPlanId && plans.length > 0) {
      const freePlan = plans.find(p => p.price === 0)
      if (freePlan) {
        setSelectedPlanId(freePlan.id)
        onSelect?.(freePlan.id)
      }
    }
  }, [plans, persistSelection, selectedPlanId, onSelect])

  const handleSelectPlan = async (planId: string) => {
    if (persistSelection) {
      // En modo persistente (onboarding), solo actualizar la selección visual
      setSelectedPlanId(planId)
      onSelect?.(planId)
    } else {
      // Modo normal: procesar la actualización
      setIsProcessing(planId)
      
      if (onSelect) {
        onSelect(planId)
      } else {
        await upgradePlan(planId)
      }
      
      setIsProcessing(null)
    }
  }

  // Obtener info del plan
  const getPlanDisplayInfo = (plan: typeof plans[0]) => {
    const planName = plan.name.toLowerCase() as 'free' | 'pro'
    const isFreePlan = plan.price === 0
    
    return {
      icon: planIcons[planName] || Sparkles,
      iconColor: isFreePlan ? 'text-blue-600' : 'text-amber-600',
      iconBg: isFreePlan ? 'bg-blue-500/10' : 'bg-amber-500/10',
      sourcesText: isFreePlan 
        ? `Hasta ${plan.maxSources} fuentes` 
        : 'Fuentes ilimitadas',
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {plans.map((plan, index) => {
        const isCurrentPlan = showCurrentPlan && currentPlan === plan.name.toLowerCase()
        const isSelected = persistSelection && selectedPlanId === plan.id
        const isProcessingThis = isProcessing === plan.id && isLoading
        const displayInfo = getPlanDisplayInfo(plan)
        const Icon = displayInfo.icon
        const isFreePlan = plan.price === 0
        const planKey = plan.name.toLowerCase() as 'free' | 'pro'

        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              onClick={() => persistSelection && handleSelectPlan(plan.id)}
              className={`glass-card p-6 hover-lift relative overflow-hidden h-full flex flex-col transition-all duration-200 ${
                persistSelection ? 'cursor-pointer' : ''
              } ${
                plan.popular && !isSelected ? "ring-2 ring-primary/50" : ""
              } ${
                isCurrentPlan ? "ring-2 ring-green-500/50" : ""
              } ${
                isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/20" : ""
              }`}
            >
              {/* Badge de selección */}
              {isSelected && (
                <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
                  <Check className="h-3 w-3 mr-1" />
                  Seleccionado
                </Badge>
              )}

              {plan.popular && !isCurrentPlan && !isSelected && (
                <Badge className="absolute top-4 right-4 bg-primary/80 text-primary-foreground">
                  Recomendado
                </Badge>
              )}

              {isCurrentPlan && !isSelected && (
                <Badge className="absolute top-4 right-4 bg-green-500 text-white">
                  Plan Actual
                </Badge>
              )}

              <div className="space-y-6 flex-1 flex flex-col">
                {/* Icon */}
                <div className="flex justify-center">
                  <div className={`p-3 rounded-2xl ${isSelected ? 'bg-primary/20' : displayInfo.iconBg} transition-colors`}>
                    <Icon className={`h-8 w-8 ${isSelected ? 'text-primary' : displayInfo.iconColor} transition-colors`} />
                  </div>
                </div>

                {/* Plan name */}
                <div className="text-center">
                  <h3 className="text-2xl font-serif font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">
                      {plan.price === 0 ? 'Gratis' : `€${plan.price.toFixed(2)}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground">/{plan.interval === 'month' ? 'mes' : 'año'}</span>
                    )}
                  </div>
                </div>

                {/* Source limit highlight */}
                <div className={`text-center py-3 px-4 rounded-lg transition-colors ${isSelected ? 'bg-primary/10' : 'glass'}`}>
                  <p className="text-sm text-muted-foreground">Fuentes de contenido</p>
                  <p className="text-2xl font-bold">
                    {isFreePlan ? plan.maxSources : '∞'}
                  </p>
                  {isCurrentPlan && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {getSourcesUsed()}/{getSourceLimit()} usadas
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1">
                  {allFeatures.map((feature, idx) => {
                    const isIncluded = feature.includedIn.includes(planKey)
                    // Skip the first feature (sources) as it's shown above
                    if (idx === 0) return null
                    
                    return (
                      <li 
                        key={feature.text} 
                        className={`flex items-start gap-2 ${!isIncluded ? 'opacity-40' : ''}`}
                      >
                        {isIncluded ? (
                          <Check className={`h-4 w-4 shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-green-600'}`} />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${!isIncluded ? 'line-through' : ''}`}>
                          {feature.text}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* CTA Button */}
                {!persistSelection && (
                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrentPlan || isProcessingThis}
                    className={`w-full hover-lift-subtle ${plan.popular ? "bg-primary text-primary-foreground" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {isProcessingThis
                      ? "Procesando..."
                      : isCurrentPlan
                        ? "Plan Actual"
                        : currentPlan === "free" && !isFreePlan
                          ? "Actualizar a Pro"
                          : isFreePlan
                            ? "Cambiar a Free"
                            : "Seleccionar Plan"}
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}
