import { useState, useEffect, useCallback, useRef } from 'react'

interface UsePullToLoadOptions {
  wheelThreshold?: number // Número de intentos de scroll para desktop (default: 1)
  touchThreshold?: number // Distancia en px para móvil (default: 120)
  onTrigger: () => void | Promise<void>
  isLoading?: boolean
}

export function usePullToLoad({ 
  wheelThreshold = 30,
  touchThreshold = 120, // 120px para touch en móvil
  onTrigger,
  isLoading = false 
}: UsePullToLoadOptions) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isTriggered, setIsTriggered] = useState(false)
  const startY = useRef(0)
  const currentY = useRef(0)
  const scrollAttempts = useRef(0)
  const lastScrollTime = useRef(0)

  const progress = Math.min(100, (scrollAttempts.current / wheelThreshold) * 100)

  // Verificar si estamos en el fondo de la página
  const isAtBottom = useCallback(() => {
    const scrollHeight = document.documentElement.scrollHeight
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const clientHeight = document.documentElement.clientHeight
    return scrollHeight - (scrollTop + clientHeight) < 10
  }, [])

  // --- Wheel Event (scroll del ratón en desktop) ---
  const handleWheel = useCallback((e: WheelEvent) => {
    if (isLoading || isTriggered || !isAtBottom()) {
      scrollAttempts.current = 0
      setPullDistance(0)
      setIsPulling(false)
      return
    }

    // Solo contar si intentan scrollear hacia abajo (deltaY positivo)
    if (e.deltaY > 0) {
      const now = Date.now()
      
      // Resetear si han pasado más de 2 segundos desde el último intento
      if (now - lastScrollTime.current > 2000) {
        scrollAttempts.current = 0
      }
      
      lastScrollTime.current = now
      scrollAttempts.current++
      setPullDistance(scrollAttempts.current)
      setIsPulling(true)

      // Activar si alcanzamos el umbral
      if (scrollAttempts.current >= wheelThreshold) {
        setIsPulling(false)
        setIsTriggered(true)
        scrollAttempts.current = 0
        setPullDistance(0)
        
        Promise.resolve(onTrigger()).finally(() => {
          setTimeout(() => {
            setIsTriggered(false)
          }, 1000)
        })
      }

      // Auto-reset después de 2 segundos de inactividad
      setTimeout(() => {
        if (Date.now() - lastScrollTime.current >= 2000) {
          scrollAttempts.current = 0
          setPullDistance(0)
          setIsPulling(false)
        }
      }, 2100)
    }
  }, [isLoading, isTriggered, isAtBottom, wheelThreshold, onTrigger])

  // --- Touch Events (para móvil) ---
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isLoading || isTriggered || !isAtBottom()) return
    
    startY.current = e.touches[0].clientY
    setIsPulling(true)
  }, [isLoading, isTriggered, isAtBottom])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || isLoading || isTriggered) return
    
    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current
    
    // Solo permitir arrastrar hacia abajo (negativo porque scrolleamos hacia abajo)
    if (diff < 0) {
      const distance = Math.abs(diff)
      setPullDistance(Math.min(distance / touchThreshold * 100, 100))
      
      // Prevenir el scroll nativo cuando estamos tirando
      if (distance > 10) {
        e.preventDefault()
      }
    }
  }, [isPulling, touchThreshold, isLoading, isTriggered])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || isLoading || isTriggered) return
    
    setIsPulling(false)
    
    if (pullDistance >= 100) { // 100% de progreso
      setIsTriggered(true)
      try {
        await onTrigger()
      } finally {
        setTimeout(() => {
          setIsTriggered(false)
          setPullDistance(0)
        }, 1000)
      }
    } else {
      setPullDistance(0)
    }
  }, [isPulling, pullDistance, onTrigger, isLoading, isTriggered])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Wheel event para desktop
    window.addEventListener('wheel', handleWheel, { passive: true })

    // Touch events para móvil
    window.addEventListener('touchstart', handleTouchStart, { passive: false })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      // Wheel event
      window.removeEventListener('wheel', handleWheel)
      
      // Touch events
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    pullDistance,
    isPulling: isPulling && pullDistance > 0,
    progress,
    isTriggered,
  }
}
