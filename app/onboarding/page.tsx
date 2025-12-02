"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useSubscription } from "@/contexts/subscription-context"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ArrowRight, ArrowLeft, Sparkles, Zap, Shield, Globe, CreditCard, Loader2 } from "lucide-react"
import { SubscriptionPlans } from "@/components/subscription-plans"
import { toast } from "sonner"

const onboardingSteps = [
  {
    title: "Bienvenido a Lexora",
    description: "Tu universo de contenido personal donde todo tu contenido digital se une en un espacio elegante.",
    icon: Sparkles,
    image: "/welcome-dashboard.png",
  },
  {
    title: "Centraliza Tu Contenido",
    description:
      "Conecta todas tus fuentes favoritas - noticias, newsletters, YouTube, Twitter, Instagram y más - en un solo lugar.",
    icon: Globe,
    image: "/content-sources.jpg",
  },
  {
    title: "Elige Tu Plan",
    description: "Selecciona el plan de suscripción que mejor se adapte a tus necesidades. Siempre puedes cambiar después.",
    icon: CreditCard,
    isSubscription: true,
  },
  {
    title: "Experiencia Personalizada",
    description:
      "Personaliza tu experiencia de lectura con temas, fuentes y diseños que coincidan con tu estilo y preferencias.",
    icon: Zap,
    image: "/personalization.jpg",
  },
  {
    title: "Mantente Organizado",
    description:
      "Guarda, archiva y organiza tu contenido con filtros poderosos y búsqueda para encontrar exactamente lo que necesitas.",
    icon: Shield,
    image: "/interconnected-network.png",
  },
]

export default function OnboardingPage() {
  const { completeOnboarding } = useAuth()
  const { upgradePlan, plans, isLoading: isLoadingSubscription } = useSubscription()
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Obtener el plan Free por defecto
  const freePlan = plans.find(p => p.price === 0)

  const handleNext = async () => {
    // Si estamos en el paso de suscripción, guardar la selección
    if (onboardingSteps[currentStep].isSubscription) {
      const planToUse = selectedPlanId || freePlan?.id
      if (planToUse) {
        setIsProcessing(true)
        try {
          await upgradePlan(planToUse)
          toast.success("Plan activado correctamente")
        } catch (error) {
          console.error("Error setting plan:", error)
          toast.error("Error al activar el plan")
          setIsProcessing(false)
          return
        }
        setIsProcessing(false)
      }
    }

    if (currentStep < onboardingSteps.length - 1) {
      setDirection(1)
      setCurrentStep(currentStep + 1)
    } else {
      completeOnboarding()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = async () => {
    // Si no se ha seleccionado un plan, asignar el Free
    if (!selectedPlanId && freePlan) {
      try {
        await upgradePlan(freePlan.id)
      } catch (error) {
        console.error("Error setting free plan:", error)
      }
    }
    completeOnboarding()
  }

  const handlePlanSelect = (planId: string) => {
    setSelectedPlanId(planId)
  }

  const step = onboardingSteps[currentStep]
  const Icon = step.icon

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-20 right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="w-full max-w-6xl">
        {/* Progress indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {onboardingSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setDirection(index > currentStep ? 1 : -1)
                setCurrentStep(index)
              }}
              className={`h-2 rounded-full transition-all hover-lift-subtle ${
                index === currentStep ? "w-8 bg-primary" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div
          className={`glass-card ${step.isSubscription ? "p-6 md:p-8" : "p-8 md:p-12"} rounded-2xl hover-lift overflow-hidden`}
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 100 : -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -100 : 100 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {step.isSubscription ? (
                <>
                  <div className="flex justify-center">
                    <div className="p-3 rounded-2xl bg-primary/10 glass-card hover-lift-subtle">
                      <Icon className="h-10 w-10 text-primary" />
                    </div>
                  </div>

                  <div className="text-center space-y-3 mb-6">
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-balance">{step.title}</h2>
                    <p className="text-base text-muted-foreground text-balance max-w-2xl mx-auto">{step.description}</p>
                  </div>

                  {isLoadingSubscription ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <SubscriptionPlans 
                      onSelect={handlePlanSelect} 
                      persistSelection={true}
                      defaultSelected={selectedPlanId || undefined}
                    />
                  )}
                </>
              ) : (
                // Regular onboarding step
                <>
                  <div className="flex justify-center">
                    <div className="p-4 rounded-2xl bg-primary/10 glass-card hover-lift-subtle">
                      <Icon className="h-12 w-12 text-primary" />
                    </div>
                  </div>

                  {step.image && (
                    <div className="relative aspect-video rounded-xl overflow-hidden glass-card">
                      <img
                        src={step.image || "/placeholder.svg"}
                        alt={step.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="text-center space-y-4">
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-balance">{step.title}</h2>
                    <p className="text-lg text-muted-foreground text-balance max-w-2xl mx-auto">{step.description}</p>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-12 gap-4">
            <Button variant="ghost" onClick={handlePrevious} disabled={currentStep === 0 || isProcessing} className="hover-lift-subtle">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>

            <Button variant="ghost" onClick={handleSkip} disabled={isProcessing} className="text-muted-foreground hover-lift-subtle">
              Saltar
            </Button>

            <Button onClick={handleNext} disabled={isProcessing} className="hover-lift-subtle">
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : currentStep === onboardingSteps.length - 1 ? (
                <>
                  Comenzar
                  <Check className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Siguiente
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
