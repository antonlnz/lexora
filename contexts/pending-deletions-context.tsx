"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Undo2 } from "lucide-react"
import { toast } from "sonner"
import { sourceService, type SourceWithUserData } from "@/lib/services/source-service"

// Tipo para una eliminación pendiente
export interface PendingDeletion {
  id: string
  source: SourceWithUserData
  deleteSavedContent: boolean
  createdAt: number
  timeoutId: NodeJS.Timeout
}

// Tipo para el callback de restauración
type SourceRestoredCallback = (source: SourceWithUserData) => void

interface PendingDeletionsContextType {
  pendingDeletions: PendingDeletion[]
  addPendingDeletion: (source: SourceWithUserData, deleteSavedContent: boolean) => void
  undoDeletion: (id: string) => void
  registerSourceRestoredCallback: (callback: SourceRestoredCallback) => () => void
}

const PendingDeletionsContext = createContext<PendingDeletionsContextType | null>(null)

export function usePendingDeletions() {
  const context = useContext(PendingDeletionsContext)
  if (!context) {
    throw new Error("usePendingDeletions must be used within PendingDeletionsProvider")
  }
  return context
}

const DELETION_TIMEOUT = 10000 // 10 segundos

export function PendingDeletionsProvider({ children }: { children: React.ReactNode }) {
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([])
  // Usar un Set de callbacks para permitir múltiples listeners
  const sourceRestoredCallbacks = useRef<Set<SourceRestoredCallback>>(new Set())

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      pendingDeletions.forEach(pd => clearTimeout(pd.timeoutId))
    }
  }, [])

  // Notificar a todos los callbacks registrados
  const notifySourceRestored = useCallback((source: SourceWithUserData) => {
    sourceRestoredCallbacks.current.forEach(callback => {
      try {
        callback(source)
      } catch (error) {
        console.error('[PendingDeletions] Error in source restored callback:', error)
      }
    })
  }, [])

  const executeDeletion = useCallback(async (deletion: PendingDeletion) => {
    console.log(`[PendingDeletions] Executing deletion for ${deletion.source.id}`)
    try {
      await sourceService.deleteSourceCompletely(deletion.source.id, deletion.deleteSavedContent)
      console.log(`[PendingDeletions] Successfully deleted source ${deletion.source.id}`)
    } catch (error) {
      console.error(`[PendingDeletions] Error deleting source:`, error)
      toast.error("Error al eliminar fuente")
      // Restaurar la fuente si falla
      notifySourceRestored(deletion.source)
    } finally {
      // Remover de la lista de pendientes
      setPendingDeletions(prev => prev.filter(pd => pd.id !== deletion.id))
    }
  }, [notifySourceRestored])

  const addPendingDeletion = useCallback((source: SourceWithUserData, deleteSavedContent: boolean) => {
    const id = `${source.id}-${Date.now()}`
    
    const timeoutId = setTimeout(() => {
      // Buscar la eliminación en el estado actual
      setPendingDeletions(prev => {
        const deletion = prev.find(pd => pd.id === id)
        if (deletion) {
          executeDeletion(deletion)
        }
        return prev
      })
    }, DELETION_TIMEOUT)

    const newDeletion: PendingDeletion = {
      id,
      source,
      deleteSavedContent,
      createdAt: Date.now(),
      timeoutId
    }

    setPendingDeletions(prev => [...prev, newDeletion])
    
    toast.success(
      deleteSavedContent 
        ? "Fuente y contenido guardado eliminados" 
        : "Fuente eliminada"
    )
  }, [executeDeletion])

  const undoDeletion = useCallback((id: string) => {
    // Encontrar la eliminación primero (fuera del setState)
    const deletion = pendingDeletions.find(pd => pd.id === id)
    if (!deletion) return

    // Cancelar el timeout
    clearTimeout(deletion.timeoutId)

    // Remover de pendientes
    setPendingDeletions(prev => prev.filter(pd => pd.id !== id))

    // Diferir la notificación para evitar actualizar estado durante el render
    queueMicrotask(() => {
      notifySourceRestored(deletion.source)
      toast.success("Eliminación cancelada")
    })
  }, [pendingDeletions, notifySourceRestored])

  // Función para registrar un callback y devolver función de limpieza
  const registerSourceRestoredCallback = useCallback((callback: SourceRestoredCallback) => {
    sourceRestoredCallbacks.current.add(callback)
    return () => {
      sourceRestoredCallbacks.current.delete(callback)
    }
  }, [])

  return (
    <PendingDeletionsContext.Provider 
      value={{ 
        pendingDeletions, 
        addPendingDeletion, 
        undoDeletion,
        registerSourceRestoredCallback
      }}
    >
      {children}
      <PendingDeletionsWidget />
    </PendingDeletionsContext.Provider>
  )
}

// Widget flotante que muestra las eliminaciones pendientes
function PendingDeletionsWidget() {
  const { pendingDeletions, undoDeletion } = usePendingDeletions()

  if (pendingDeletions.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {pendingDeletions.map((deletion, index) => (
        <div 
          key={deletion.id}
          className="animate-in slide-in-from-bottom-5 fade-in duration-300"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <Card className="glass-card shadow-lg border-primary/20 p-4">
            <div className="flex items-center gap-4">
              <CircularCountdown 
                key={deletion.id} 
                createdAt={deletion.createdAt} 
                duration={DELETION_TIMEOUT} 
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Fuente eliminada</p>
                <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {deletion.source.title}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => undoDeletion(deletion.id)}
                className="shrink-0 hover:bg-primary/10 transition-colors"
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Deshacer
              </Button>
            </div>
          </Card>
        </div>
      ))}
    </div>
  )
}

// Componente de cuenta atrás circular con animación suave usando requestAnimationFrame
function CircularCountdown({ createdAt, duration }: { createdAt: number; duration: number }) {
  const [progress, setProgress] = useState(() => {
    const elapsed = Date.now() - createdAt
    return Math.min(1, elapsed / duration)
  })
  const [timeLeft, setTimeLeft] = useState(() => {
    const elapsed = Date.now() - createdAt
    return Math.max(0, Math.ceil((duration - elapsed) / 1000))
  })
  
  useEffect(() => {
    let animationFrameId: number
    
    const animate = () => {
      const elapsed = Date.now() - createdAt
      const newProgress = Math.min(1, elapsed / duration)
      const newTimeLeft = Math.max(0, Math.ceil((duration - elapsed) / 1000))
      
      setProgress(newProgress)
      setTimeLeft(newTimeLeft)
      
      if (newProgress < 1) {
        animationFrameId = requestAnimationFrame(animate)
      }
    }
    
    animationFrameId = requestAnimationFrame(animate)
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [createdAt, duration])
  
  // SVG circle parameters
  const size = 40
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * progress
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-primary"
        />
      </svg>
      {/* Número del segundo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tabular-nums">{timeLeft}</span>
      </div>
    </div>
  )
}
