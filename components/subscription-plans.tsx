"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Sparkles, Zap, Crown } from "lucide-react"
import { subscriptionPlans, type SubscriptionTier, useSubscription } from "@/contexts/subscription-context"
import { motion } from "framer-motion"

interface SubscriptionPlansProps {
  onSelect?: (plan: SubscriptionTier) => void
  showCurrentPlan?: boolean
}

const planIcons = {
  free: Sparkles,
  basic: Zap,
  pro: Crown,
}

export function SubscriptionPlans({ onSelect, showCurrentPlan = false }: SubscriptionPlansProps) {
  const { currentPlan, upgradePlan, isLoading } = useSubscription()
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null)

  const handleSelectPlan = async (planId: SubscriptionTier) => {
    setSelectedPlan(planId)

    if (onSelect) {
      onSelect(planId)
    } else {
      await upgradePlan(planId)
    }

    setSelectedPlan(null)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {subscriptionPlans.map((plan, index) => {
        const Icon = planIcons[plan.id]
        const isCurrentPlan = showCurrentPlan && currentPlan === plan.id
        const isProcessing = selectedPlan === plan.id && isLoading

        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={`glass-card p-6 hover-lift relative overflow-hidden ${
                plan.popular ? "ring-2 ring-primary/50" : ""
              } ${isCurrentPlan ? "ring-2 ring-green-500/50" : ""}`}
            >
              {plan.popular && !isCurrentPlan && (
                <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">Most Popular</Badge>
              )}

              {isCurrentPlan && <Badge className="absolute top-4 right-4 bg-green-500 text-white">Current Plan</Badge>}

              <div className="space-y-6">
                {/* Icon */}
                <div className="flex justify-center">
                  <div
                    className={`p-3 rounded-2xl ${
                      plan.id === "free"
                        ? "bg-blue-500/10"
                        : plan.id === "basic"
                          ? "bg-purple-500/10"
                          : "bg-amber-500/10"
                    }`}
                  >
                    <Icon
                      className={`h-8 w-8 ${
                        plan.id === "free"
                          ? "text-blue-600"
                          : plan.id === "basic"
                            ? "text-purple-600"
                            : "text-amber-600"
                      }`}
                    />
                  </div>
                </div>

                {/* Plan name */}
                <div className="text-center">
                  <h3 className="text-2xl font-serif font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.interval}</span>
                  </div>
                </div>

                {/* Source limit */}
                <div className="text-center py-3 px-4 rounded-lg glass">
                  <p className="text-sm text-muted-foreground">Content Sources</p>
                  <p className="text-2xl font-bold">{plan.maxSources}</p>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrentPlan || isProcessing}
                  className={`w-full hover-lift-subtle ${plan.popular ? "bg-primary text-primary-foreground" : ""}`}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {isProcessing
                    ? "Processing..."
                    : isCurrentPlan
                      ? "Current Plan"
                      : currentPlan === "free" && plan.id !== "free"
                        ? "Upgrade"
                        : plan.id === "free"
                          ? "Downgrade"
                          : "Select Plan"}
                </Button>
              </div>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}
