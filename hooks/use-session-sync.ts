"use client"

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook para mantener sincronizada la sesión entre tabs/ventanas
 * y manejar la expiración automática de sesiones
 */
export function useSessionSync() {
  const router = useRouter()
  const lastRefreshTime = useRef<number>(0)
  const REFRESH_COOLDOWN = 5000 // 5 segundos de cooldown entre refreshes

  useEffect(() => {
    const supabase = createClient()

    // Helper para refrescar con cooldown
    const refreshWithCooldown = () => {
      const now = Date.now()
      if (now - lastRefreshTime.current > REFRESH_COOLDOWN) {
        lastRefreshTime.current = now
        router.refresh()
      }
    }

    // Escuchar eventos de storage para sincronizar entre tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supabase.auth.token' && e.newValue !== e.oldValue) {
        // Solo refrescar si el token realmente cambió
        refreshWithCooldown()
      }
    }

    // Escuchar cambios de visibilidad para refrescar sesión
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Verificar si la sesión sigue válida
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          // Si no hay sesión válida, refrescar para que el middleware redirija
          refreshWithCooldown()
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
