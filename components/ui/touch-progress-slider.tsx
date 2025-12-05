"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TouchProgressSliderProps {
  value: number
  max: number
  onChange: (value: number) => void
  className?: string
  trackClassName?: string
  progressClassName?: string
  /** Callback cuando empieza/termina el arrastre (útil para bloquear scroll) */
  onDraggingChange?: (isDragging: boolean) => void
  /** Callback cuando el estado de presión cambia (para efectos visuales externos) */
  onPressedChange?: (isPressed: boolean) => void
  /** Timestamps opcionales para mostrar debajo del slider con efectos sincronizados */
  timestamps?: {
    current: string
    total: string
  }
  /** Segmento de clip guardado para mostrar visualmente (start y end en segundos) */
  clipSegment?: {
    start: number
    end: number
  } | null
}

/**
 * Slider táctil para progreso - sin thumb visible, diferentes intensidades de gris.
 * Al pulsar NO salta a la posición del dedo. Al arrastrar, la barra se mueve
 * exactamente la misma distancia que el dedo (movimiento en espejo).
 */
export function TouchProgressSlider({
  value,
  max,
  onChange,
  className,
  trackClassName,
  progressClassName,
  onDraggingChange,
  onPressedChange,
  timestamps,
  clipSegment,
}: TouchProgressSliderProps) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isPressed, setIsPressed] = React.useState(false)
  
  // Guardar el último X del puntero para calcular deltas incrementales
  const lastPointerXRef = React.useRef<number | null>(null)
  // Valor interno durante el arrastre (actualización inmediata sin esperar re-render)
  const internalValueRef = React.useRef<number>(value)
  // Estado para forzar re-render durante arrastre
  const [displayValue, setDisplayValue] = React.useState(value)
  
  // Sincronizar con valor externo cuando no estamos arrastrando
  React.useEffect(() => {
    if (!isDragging && !isPressed) {
      internalValueRef.current = value
      setDisplayValue(value)
    }
  }, [value, isDragging, isPressed])

  const progress = max > 0 ? (displayValue / max) * 100 : 0

  // Calcular posiciones del clip si existe
  const clipStart = clipSegment && max > 0 ? (clipSegment.start / max) * 100 : null
  const clipEnd = clipSegment && max > 0 ? (clipSegment.end / max) * 100 : null
  const clipWidth = clipStart !== null && clipEnd !== null ? clipEnd - clipStart : null

  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsPressed(true)
    onPressedChange?.(true)
    
    // Guardar posición del puntero
    lastPointerXRef.current = e.clientX
    // Sincronizar valor interno con el actual
    internalValueRef.current = value
    
    // Capture pointer events para recibir eventos fuera del elemento
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
  }, [value, onPressedChange])

  const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!isPressed || lastPointerXRef.current === null || !trackRef.current || max === 0) return
    
    e.preventDefault()
    e.stopPropagation()
    
    // Marcar que estamos arrastrando
    if (!isDragging) {
      setIsDragging(true)
      onDraggingChange?.(true)
    }
    
    const rect = trackRef.current.getBoundingClientRect()
    const trackWidth = rect.width
    
    // Delta desde la última posición (no desde el inicio)
    const deltaX = e.clientX - lastPointerXRef.current
    
    // Actualizar referencia para el próximo frame
    lastPointerXRef.current = e.clientX
    
    // Convertir pixels a valor: si el track tiene width W y max es M,
    // entonces 1 pixel = M/W unidades de valor
    // Sensibilidad 1.0 = movimiento exactamente igual al dedo
    const pixelsToValue = max / trackWidth
    const deltaValue = deltaX * pixelsToValue
    
    // Calcular nuevo valor
    const newValue = Math.max(0, Math.min(max, internalValueRef.current + deltaValue))
    
    // Actualizar inmediatamente
    internalValueRef.current = newValue
    setDisplayValue(newValue)
    onChange(newValue)
  }, [isPressed, isDragging, max, onChange, onDraggingChange])

  const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    target.releasePointerCapture(e.pointerId)
    
    if (isDragging) {
      onDraggingChange?.(false)
    }
    setIsPressed(false)
    onPressedChange?.(false)
    setIsDragging(false)
    lastPointerXRef.current = null
  }, [isDragging, onDraggingChange, onPressedChange])

  return (
    <div className="w-full">
      {/* Área táctil extendida (añade tolerancia vertical sin cambiar el aspecto visual) */}
      <div
        className="py-2 -my-2 cursor-pointer touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Slider track (visual) */}
        <div
          ref={trackRef}
          className={cn(
            "relative w-full rounded-full",
            isPressed ? "h-2.5" : "h-1.5",
            className
          )}
          style={{
            transition: 'height 0.15s ease-out'
          }}
        >
          {/* Track background */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full",
            isPressed ? "bg-white/30" : "bg-white/20",
            trackClassName
          )}
          style={{
            transition: 'background-color 0.15s ease-out'
          }}
        />
        
        {/* Clip segment indicator (debajo del progress) */}
        {clipStart !== null && clipWidth !== null && (
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: `${clipStart}%`,
              // Asegurar un ancho mínimo visible de 0.5%
              width: `${Math.max(clipWidth, 0.5)}%`,
              backgroundColor: '#F7831B', // naranja vibrante para clip
              transition: 'opacity 0.15s ease-out'
            }}
          />
        )}
        
        {/* Progress fill con glow effect */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            progressClassName
          )}
          style={{ 
            width: `${progress}%`,
            backgroundColor: isPressed ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.7)',
            boxShadow: isPressed ? '0 0 12px rgba(255, 255, 255, 0.6)' : 'none',
            transition: isDragging 
              ? 'background-color 0.15s ease-out, box-shadow 0.15s ease-out' 
              : 'width 0.1s ease-out, background-color 0.15s ease-out, box-shadow 0.15s ease-out'
          }}
        />
        </div>
      </div>
      
      {/* Timestamps con efectos */}
      {timestamps && (
        <div 
          className="flex justify-between mt-2 text-xs"
          style={{
            color: isPressed ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.6)',
            transform: isPressed ? 'scale(1.05)' : 'scale(1)',
            fontWeight: isPressed ? 500 : 400,
            textShadow: isPressed ? '0 0 8px rgba(255, 255, 255, 0.5)' : 'none',
            transformOrigin: 'center top',
            transition: 'color 0.15s ease-out, transform 0.15s ease-out, font-weight 0.15s ease-out, text-shadow 0.15s ease-out'
          }}
        >
          <span>{timestamps.current}</span>
          <span>{timestamps.total}</span>
        </div>
      )}
    </div>
  )
}
