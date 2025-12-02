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

  // Helper para asegurar que el perfil existe (ya no es necesario llamarlo por separado)
  // Se mantiene por compatibilidad pero la lógica principal está en loadUserProfile
  const ensureProfileExists = useCallback(async (authUser: SupabaseUser) => {
    // La creación del perfil ahora se maneja en loadUserProfile
    // Este helper se mantiene vacío por compatibilidad
  }, [])

  // Helper para cargar el perfil desde la base de datos
  const loadUserProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      // Verificar que hay sesión activa antes de hacer la consulta
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return null
      }

      // Intentar obtener el perfil - usar maybeSingle() en lugar de single() para evitar error si no existe
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      if (error) {
        console.warn('Error loading profile:', error)
        return null
      }
      
      // Si el perfil no existe, intentar crearlo
      if (!profile) {
        const user = session.user
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: user.email,
            full_name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()
        
        if (createError) {
          console.warn('Could not create profile:', createError)
          return null
        }
        
        return newProfile
      }
      
      return profile
    } catch (error) {
      console.warn('Error in loadUserProfile:', error)
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
      } else if (event === 'SIGNED_IN') {
        // Solo actualizar en SIGNED_IN (login real)
        if (session?.user) {
          await updateUserState(session.user)
        }
      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Para refresh de tokens, solo actualizar si hay cambios significativos
        if (session?.user && (!supabaseUser || supabaseUser.id !== session.user.id)) {
          await updateUserState(session.user)
        }
      }
      // No manejar INITIAL_SESSION aquí - ya se maneja en initializeAuth
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
    
    // Navegar
    router.push("/login")
  }

  const completeOnboarding = async () => {
    if (supabaseUser) {
      // Verificar que hay sesión activa antes de hacer la consulta
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.warn('No active session for completing onboarding')
        return
      }

      // Actualizar en la base de datos
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('id', supabaseUser.id)
      
      if (error) {
        console.error('Error completing onboarding:', error)
        return
      }
      
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
