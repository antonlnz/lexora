"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook para mantener sincronizada la sesión entre tabs/ventanas
 * y manejar la expiración automática de sesiones
 */
export function useSessionSync() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Escuchar eventos de storage para sincronizar entre tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supabase.auth.token') {
        // Si el token cambió en otra tab, refrescar
        router.refresh()
      }
    }

    // Escuchar cambios de visibilidad para refrescar sesión
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Verificar si la sesión sigue válida
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          // Si no hay sesión válida, refrescar para que el middleware redirija
          router.refresh()
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router])
}
