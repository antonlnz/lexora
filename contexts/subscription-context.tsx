"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type SubscriptionTier = "free" | "basic" | "pro"

export interface SubscriptionPlan {
  id: SubscriptionTier
  name: string
  price: number
  interval: "month" | "year"
  maxSources: number
  features: string[]
  popular?: boolean
}

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    interval: "month",
    maxSources: 15,
    features: [
      "Up to 15 content sources",
      "Basic content filtering",
      "Standard reading experience",
      "Mobile & desktop access",
      "Community support",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: 3.99,
    interval: "month",
    maxSources: 100,
    features: [
      "Up to 100 content sources",
      "Advanced filtering & search",
      "Customizable reading experience",
      "Priority content updates",
      "Email support",
      "Export your data",
    ],
    popular: true,
  },
  {
    id: "pro",
    name: "Professional",
    price: 5.99,
    interval: "month",
    maxSources: 1000,
    features: [
      "Up to 1000 content sources",
      "AI-powered recommendations",
      "Team collaboration features",
      "Advanced analytics",
      "Priority support",
      "Custom integrations",
      "Early access to new features",
    ],
  },
]

interface SubscriptionContextType {
  currentPlan: SubscriptionTier
  isLoading: boolean
  canAddSource: (currentSourceCount: number) => boolean
  getSourceLimit: () => number
  upgradePlan: (plan: SubscriptionTier) => Promise<void>
  cancelSubscription: () => Promise<void>
  autoRenew: boolean
  setAutoRenew: (value: boolean) => void
  nextBillingDate: string | null
  paymentMethod: string | null
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [currentPlan, setCurrentPlan] = useState<SubscriptionTier>("free")
  const [isLoading, setIsLoading] = useState(true)
  const [autoRenew, setAutoRenew] = useState(true)
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)

  useEffect(() => {
    // Load subscription from localStorage
    const storedPlan = localStorage.getItem("lexora_subscription_plan") as SubscriptionTier
    const storedAutoRenew = localStorage.getItem("lexora_auto_renew")
    const storedBillingDate = localStorage.getItem("lexora_next_billing_date")
    const storedPaymentMethod = localStorage.getItem("lexora_payment_method")

    if (storedPlan) {
      setCurrentPlan(storedPlan)
    }
    if (storedAutoRenew !== null) {
      setAutoRenew(storedAutoRenew === "true")
    }
    if (storedBillingDate) {
      setNextBillingDate(storedBillingDate)
    }
    if (storedPaymentMethod) {
      setPaymentMethod(storedPaymentMethod)
    }

    setIsLoading(false)
  }, [])

  const canAddSource = (currentSourceCount: number): boolean => {
    const plan = subscriptionPlans.find((p) => p.id === currentPlan)
    return plan ? currentSourceCount < plan.maxSources : false
  }

  const getSourceLimit = (): number => {
    const plan = subscriptionPlans.find((p) => p.id === currentPlan)
    return plan?.maxSources || 15
  }

  const upgradePlan = async (plan: SubscriptionTier) => {
    setIsLoading(true)

    // Simulate API call for payment processing
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setCurrentPlan(plan)
    localStorage.setItem("lexora_subscription_plan", plan)

    // Set billing date to 30 days from now if not free
    if (plan !== "free") {
      const billingDate = new Date()
      billingDate.setDate(billingDate.getDate() + 30)
      const formattedDate = billingDate.toISOString().split("T")[0]
      setNextBillingDate(formattedDate)
      localStorage.setItem("lexora_next_billing_date", formattedDate)

      // Mock payment method
      setPaymentMethod("•••• 4242")
      localStorage.setItem("lexora_payment_method", "•••• 4242")
    } else {
      setNextBillingDate(null)
      setPaymentMethod(null)
      localStorage.removeItem("lexora_next_billing_date")
      localStorage.removeItem("lexora_payment_method")
    }

    setIsLoading(false)
  }

  const cancelSubscription = async () => {
    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setCurrentPlan("free")
    setNextBillingDate(null)
    setPaymentMethod(null)
    localStorage.setItem("lexora_subscription_plan", "free")
    localStorage.removeItem("lexora_next_billing_date")
    localStorage.removeItem("lexora_payment_method")

    setIsLoading(false)
  }

  const handleSetAutoRenew = (value: boolean) => {
    setAutoRenew(value)
    localStorage.setItem("lexora_auto_renew", value.toString())
  }

  return (
    <SubscriptionContext.Provider
      value={{
        currentPlan,
        isLoading,
        canAddSource,
        getSourceLimit,
        upgradePlan,
        cancelSubscription,
        autoRenew,
        setAutoRenew: handleSetAutoRenew,
        nextBillingDate,
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
