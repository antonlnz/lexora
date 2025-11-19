"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import type { Profile } from "@/types/database"

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  profile?: Profile
}

interface AuthContextType {
  user: User | null
  supabaseUser: SupabaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  hasCompletedOnboarding: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  completeOnboarding: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const router = useRouter()
  
  // Crear cliente una sola vez
  const [supabase] = useState(() => createClient())

  // Helper para asegurar que el perfil existe
  const ensureProfileExists = useCallback(async (authUser: SupabaseUser) => {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUser.id)
        .single()
      
      if (!existingProfile) {
        // Crear el perfil si no existe
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            full_name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
            avatar_url: authUser.user_metadata?.avatar_url,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        
        if (insertError) {
          console.warn("Could not create profile:", insertError)
        }
      }
    } catch (error) {
      // Silently fail - profile will be created later
    }
  }, [supabase])

  // Helper para cargar el perfil desde la base de datos
  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      // Timeout de 8 segundos para la carga del perfil (más generoso)
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile load timeout')), 8000)
      )
      
      const { data: profile, error } = await Promise.race([
        profilePromise,
        timeoutPromise
      ]) as any
      
      if (error) {
        // Si el perfil no existe (PGRST116), intentar crearlo
        if (error.code === 'PGRST116') {
          return null
        }
        
        // Si es timeout, no es un error crítico
        if (error.message === 'Profile load timeout') {
          return null
        }
        
        return null
      }
      
      return profile
    } catch (error) {
      return null
    }
  }, [supabase])

  // Helper para actualizar el estado del usuario
  const updateUserState = useCallback(async (authUser: SupabaseUser | null) => {
    if (authUser) {
      setSupabaseUser(authUser)
      
      // PRIMERO: Crear un usuario básico inmediatamente
      const basicUserData: User = {
        id: authUser.id,
        name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "User",
        email: authUser.email || "",
        avatar: authUser.user_metadata?.avatar_url,
      }
      setUser(basicUserData)
      
      // SEGUNDO: Intentar cargar el perfil en background (sin bloquear)
      Promise.race([
        (async () => {
          try {
            const profile = await loadUserProfile(authUser.id)
            
            if (profile) {
              // Actualizar con datos del perfil
              const fullUserData: User = {
                id: authUser.id,
                name: profile.full_name || basicUserData.name,
                email: authUser.email || "",
                avatar: profile.avatar_url || basicUserData.avatar,
                profile: profile,
              }
              setUser(fullUserData)
              
              if (profile.onboarding_completed) {
                setHasCompletedOnboarding(true)
              }
            }
          } catch (error) {
            // Silently fail - using basic user data
          }
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Profile load timeout')), 3000))
      ]).catch(() => {
        // Using basic user data
      })
    } else {
      setSupabaseUser(null)
      setUser(null)
      setHasCompletedOnboarding(false)
    }
  }, [loadUserProfile])

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    // Get initial session
    const initializeAuth = async () => {
      try {
        // Timeout de seguridad reducido a 3 segundos ya que establecemos el usuario inmediatamente
        timeoutId = setTimeout(() => {
          if (mounted) {
            setIsLoading(false)
          }
        }, 3000)

        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        if (error) {
          setUser(null)
          setSupabaseUser(null)
          setIsLoading(false)
          return
        }
        
        if (session?.user) {
          await updateUserState(session.user)
        } else {
          // No hay sesión activa
          setUser(null)
          setSupabaseUser(null)
        }
      } catch (error) {
        if (mounted) {
          setUser(null)
          setSupabaseUser(null)
        }
      } finally {
        if (mounted) {
          clearTimeout(timeoutId)
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      // Manejar diferentes eventos
      if (event === 'SIGNED_OUT') {
        setSupabaseUser(null)
        setUser(null)
        setHasCompletedOnboarding(false)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          await updateUserState(session.user)
        }
      } else if (event === 'INITIAL_SESSION') {
        // Este evento se dispara al inicializar, ya lo manejamos arriba
        if (session?.user) {
          await updateUserState(session.user)
        }
      }
      
      // Refresh router para sincronizar con middleware
      router.refresh()
    })

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [supabase.auth, updateUserState, router]) // Removido isLoading de las dependencias

  const login = async (email: string, password: string, rememberMe: boolean = true) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }

    if (data.user) {
      // Nota: Supabase siempre persiste las sesiones durante recargas de página.
      // El parámetro rememberMe se mantiene por compatibilidad con la UI,
      // pero no afecta el comportamiento técnico actual.
      // En futuras iteraciones, se puede implementar logout automático al cerrar el navegador.
      
      // El auth state change se encargará de actualizar el estado
      // Solo necesitamos navegar
      const profile = await loadUserProfile(data.user.id)
      
      if (!profile?.onboarding_completed) {
        router.push("/onboarding")
      } else {
        router.push("/")
      }
      
      // Refrescar para sincronizar con middleware
      router.refresh()
    }
  }

  const signup = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })

    if (error) {
      throw error
    }

    if (data.user) {
      // Redirect to onboarding after signup
      router.push("/onboarding")
      router.refresh()
    }
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error("Error signing out:", error)
    }
    
    // Limpiar estado local
    setUser(null)
    setSupabaseUser(null)
    setHasCompletedOnboarding(false)
    
    // Navegar y refrescar
    router.push("/login")
    router.refresh()
  }

  const completeOnboarding = async () => {
    if (supabaseUser) {
      // Actualizar en la base de datos
      await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('id', supabaseUser.id)
      
      setHasCompletedOnboarding(true)
      router.push("/")
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        isAuthenticated: !!user,
        isLoading,
        hasCompletedOnboarding,
        login,
        signup,
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
