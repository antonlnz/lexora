"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  hasCompletedOnboarding: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  completeOnboarding: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem("lexora_user")
    const onboardingComplete = localStorage.getItem("lexora_onboarding_complete")

    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    if (onboardingComplete) {
      setHasCompletedOnboarding(true)
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock user data
    const mockUser: User = {
      id: "1",
      name: email.split("@")[0],
      email,
      avatar: "/diverse-user-avatars.png",
    }

    setUser(mockUser)
    localStorage.setItem("lexora_user", JSON.stringify(mockUser))

    // Check if onboarding is complete
    const onboardingComplete = localStorage.getItem("lexora_onboarding_complete")
    if (!onboardingComplete) {
      router.push("/onboarding")
    } else {
      setHasCompletedOnboarding(true)
      router.push("/")
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("lexora_user")
    router.push("/login")
  }

  const completeOnboarding = () => {
    setHasCompletedOnboarding(true)
    localStorage.setItem("lexora_onboarding_complete", "true")
    router.push("/")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        hasCompletedOnboarding,
        login,
        logout,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
