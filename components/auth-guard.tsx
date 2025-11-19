"use client"

import { useAuth } from "@/contexts/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [showTimeout, setShowTimeout] = useState(false)

  const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth']
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicPath) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router, isPublicPath, pathname])

  // Timeout de seguridad: si después de 10 segundos sigue cargando, mostrar error
  useEffect(() => {
    if (isLoading) {
      const timeoutId = setTimeout(() => {
        console.error("AuthGuard timeout - auth is taking too long")
        setShowTimeout(true)
      }, 10000)
      
      return () => clearTimeout(timeoutId)
    } else {
      setShowTimeout(false)
    }
  }, [isLoading])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">
            {showTimeout ? (
              <>
                Authentication is taking longer than expected...
                <br />
                <button
                  onClick={() => router.push('/login')}
                  className="mt-4 text-primary hover:underline"
                >
                  Go to login
                </button>
              </>
            ) : (
              "Loading your content universe..."
            )}
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && !isPublicPath) {
    return null
  }

  return <>{children}</>
}
