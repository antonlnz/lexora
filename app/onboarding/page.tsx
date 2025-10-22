"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useSubscription, type SubscriptionTier } from "@/contexts/subscription-context"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ArrowRight, ArrowLeft, Sparkles, Zap, Shield, Globe, CreditCard } from "lucide-react"
import { SubscriptionPlans } from "@/components/subscription-plans"

const onboardingSteps = [
  {
    title: "Welcome to Lexora",
    description: "Your personal content universe where all your digital content comes together in one elegant space.",
    icon: Sparkles,
    image: "/welcome-dashboard.png",
  },
  {
    title: "Centralize Your Content",
    description:
      "Connect all your favorite sources - news, newsletters, YouTube, Twitter, Instagram, and more - in one place.",
    icon: Globe,
    image: "/content-sources.jpg",
  },
  {
    title: "Choose Your Plan",
    description: "Select the subscription plan that best fits your needs. You can always upgrade or downgrade later.",
    icon: CreditCard,
    isSubscription: true,
  },
  {
    title: "Personalized Experience",
    description:
      "Customize your reading experience with themes, fonts, and layouts that match your style and preferences.",
    icon: Zap,
    image: "/personalization.jpg",
  },
  {
    title: "Stay Organized",
    description:
      "Save, archive, and organize your content with powerful filters and search to find exactly what you need.",
    icon: Shield,
    image: "/interconnected-network.png",
  },
]

export default function OnboardingPage() {
  const { completeOnboarding } = useAuth()
  const { upgradePlan } = useSubscription()
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>("free")

  const handleNext = async () => {
    if (onboardingSteps[currentStep].isSubscription) {
      await upgradePlan(selectedPlan)
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

  const handleSkip = () => {
    completeOnboarding()
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

                  <SubscriptionPlans onSelect={setSelectedPlan} />
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
            <Button variant="ghost" onClick={handlePrevious} disabled={currentStep === 0} className="hover-lift-subtle">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground hover-lift-subtle">
              Skip
            </Button>

            <Button onClick={handleNext} className="hover-lift-subtle">
              {currentStep === onboardingSteps.length - 1 ? (
                <>
                  Get Started
                  <Check className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Next
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
