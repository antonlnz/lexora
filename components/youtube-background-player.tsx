"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { usePodcastPlayer } from "@/contexts/podcast-player-context"

/**
 * YouTubeBackgroundPlayer
 * 
 * Componente global que mantiene un iframe de YouTube oculto siempre que hay
 * un video de YouTube activo. Este iframe permanece montado incluso cuando
 * el viewer se cierra/minimiza, permitiendo que el audio continúe.
 * 
 * ESTRATEGIA DE PRE-CARGA:
 * 1. Cuando hay un video de YouTube visible (viewer abierto), PRE-CARGAMOS el background player
 *    pero lo mantenemos pausado
 * 2. Cuando isMinimized = true, hacemos seek al tiempo actual y reproducimos
 * 3. Esto minimiza el gap de audio porque el player ya está cargado
 * 
 * NOTA iOS: El iframe usa `playsinline: 1` para permitir reproducción inline
 * y está posicionado de forma que iOS no lo considere "oculto"
 */
export function YouTubeBackgroundPlayer() {
  const {
    isVisible,
    isMinimized,
    isYouTubeVideo,
    youTubeVideoId,
    currentTime,
    wasPlayingBeforeMinimize,
    updateFromYouTube,
  } = usePodcastPlayer()

  const playerRef = useRef<YT.Player | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAPIReady, setIsAPIReady] = useState(false)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  
  // Refs para capturar el estado
  const capturedTimeRef = useRef(currentTime)
  const previousMinimizedRef = useRef(isMinimized)
  const previousWasPlayingRef = useRef(wasPlayingBeforeMinimize)
  const currentVideoIdRef = useRef<string | null>(null)
  const isActivelyPlayingRef = useRef(false) // Si ESTE player está reproduciendo activamente
  const hasHandledMinimizeRef = useRef(false) // Evitar manejar la misma transición múltiples veces

  // Capturar el tiempo actual continuamente (para cuando se minimice)
  useEffect(() => {
    if (!isMinimized && !isActivelyPlayingRef.current) {
      // Solo actualizar el tiempo capturado si el viewer está controlando (no nosotros)
      capturedTimeRef.current = currentTime
    }
  }, [currentTime, isMinimized])

  // Detectar transición a minimizado - solo capturar tiempo
  useEffect(() => {
    if (isMinimized && !previousMinimizedRef.current) {
      // Acabamos de minimizar - capturar el tiempo actual
      capturedTimeRef.current = currentTime
    }
    previousMinimizedRef.current = isMinimized
  }, [isMinimized, currentTime])

  // Resetear el flag cuando se maximiza
  useEffect(() => {
    if (!isMinimized) {
      hasHandledMinimizeRef.current = false
    }
  }, [isMinimized])

  // Inicializar YouTube API
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    if (window.YT?.Player) {
      setIsAPIReady(true)
      return
    }

    const checkYT = () => {
      if (window.YT?.Player) {
        setIsAPIReady(true)
      }
    }

    const interval = setInterval(checkYT, 100)
    
    const originalCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      originalCallback?.()
      setIsAPIReady(true)
    }

    return () => {
      clearInterval(interval)
    }
  }, [])

  // Cleanup function
  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (playerRef.current) {
      try {
        playerRef.current.destroy()
      } catch {
        // Ignorar errores al destruir
      }
      playerRef.current = null
    }
    setIsPlayerReady(false)
    currentVideoIdRef.current = null
    isActivelyPlayingRef.current = false
  }, [])

  // PRE-CARGA: Crear player cuando hay un video de YouTube visible (incluso sin minimizar)
  // Esto permite que el player esté listo cuando el usuario minimice
  const shouldPreload = isVisible && isYouTubeVideo && youTubeVideoId && !isMinimized
  const shouldBeActive = isVisible && isYouTubeVideo && youTubeVideoId && isMinimized

  // Crear el player para pre-carga O cuando está minimizado
  useEffect(() => {
    const shouldCreatePlayer = (shouldPreload || shouldBeActive) && isAPIReady
    
    if (!shouldCreatePlayer) {
      cleanup()
      return
    }

    // Si ya tenemos un player con el mismo video, no recrear
    if (playerRef.current && currentVideoIdRef.current === youTubeVideoId) {
      return
    }

    const container = containerRef.current
    if (!container) return

    // Limpiar player anterior si el video cambió
    if (currentVideoIdRef.current && currentVideoIdRef.current !== youTubeVideoId) {
      cleanup()
    }
    
    container.innerHTML = ''

    const playerDiv = document.createElement('div')
    playerDiv.id = 'yt-bg-player-inner'
    container.appendChild(playerDiv)

    currentVideoIdRef.current = youTubeVideoId

    try {
      // Usamos un tamaño pequeño pero no mínimo para mejorar compatibilidad iOS
      playerRef.current = new window.YT.Player(playerDiv.id, {
        videoId: youTubeVideoId,
        width: 16,
        height: 16,
        playerVars: {
          autoplay: 0, // Nunca autoplay - controlamos manualmente
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setIsPlayerReady(true)
          },
          onStateChange: (event: { data: number }) => {
            // Solo reportar cambios de estado cuando este player está activo
            if (isActivelyPlayingRef.current) {
              if (event.data === window.YT.PlayerState.PLAYING) {
                updateFromYouTube({ isPlaying: true })
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                updateFromYouTube({ isPlaying: false })
              } else if (event.data === window.YT.PlayerState.ENDED) {
                updateFromYouTube({ isPlaying: false })
              }
            }
          },
        },
      })
    } catch (error) {
      console.error('Error creating background YouTube player:', error)
    }
  }, [shouldPreload, shouldBeActive, isAPIReady, youTubeVideoId, cleanup, updateFromYouTube])

  // Cuando se minimiza Y el player está pre-cargado, hacer seek y play
  useEffect(() => {
    // Actualizar ref de wasPlaying
    previousWasPlayingRef.current = wasPlayingBeforeMinimize
    
    // Solo actuar si:
    // 1. Estamos minimizados
    // 2. El player está listo
    // 3. Deberíamos estar reproduciendo
    // 4. No hemos manejado esta transición aún
    if (isMinimized && isPlayerReady && playerRef.current && wasPlayingBeforeMinimize && !hasHandledMinimizeRef.current) {
      // Marcar que ya manejamos esta transición
      hasHandledMinimizeRef.current = true
      
      // Hacer seek al tiempo capturado
      playerRef.current.seekTo(capturedTimeRef.current, true)
      
      // Marcar como activo para empezar a trackear tiempo
      isActivelyPlayingRef.current = true
      
      // Iniciar interval para actualizar tiempo
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          if (playerRef.current && isActivelyPlayingRef.current) {
            try {
              const time = playerRef.current.getCurrentTime() || 0
              const dur = playerRef.current.getDuration() || 0
              updateFromYouTube({ currentTime: time, duration: dur })
            } catch {
              // Ignorar
            }
          }
        }, 500)
      }
      
      // Reproducir - dar un pequeño delay para que el seek se complete
      setTimeout(() => {
        try {
          playerRef.current?.playVideo()
        } catch (error) {
          console.warn('Background playVideo failed:', error)
        }
      }, 200)
    }
    
    // Cuando se maximiza, detener este player y desactivarlo
    if (!isMinimized && isActivelyPlayingRef.current) {
      if (playerRef.current) {
        playerRef.current.pauseVideo()
      }
      isActivelyPlayingRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isMinimized, isPlayerReady, wasPlayingBeforeMinimize, updateFromYouTube])

  // El player necesita estar expuesto para que el mini-podcast-player pueda controlarlo
  useEffect(() => {
    // Guardar referencia global para que el mini-player pueda acceder
    if (typeof window !== 'undefined' && isPlayerReady && playerRef.current) {
      (window as Window & { __ytBgPlayer?: YT.Player | null }).__ytBgPlayer = playerRef.current
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as Window & { __ytBgPlayer?: YT.Player | null }).__ytBgPlayer = null
      }
    }
  }, [isPlayerReady])

  // Este componente no renderiza nada visible al usuario
  // IMPORTANTE para iOS: El contenedor debe estar técnicamente "visible" para que
  // iOS permita la reproducción de audio. Usamos:
  // - Posición fija en bottom-left (dentro del viewport)
  // - Tamaño pequeño pero no 0 (16x16 para el iframe)
  // - Opacity muy baja pero no 0 (0.01)
  // - z-index -1 para estar detrás de todo
  // - NO usamos posiciones negativas que iOS detecta como oculto
  return (
    <div
      ref={containerRef}
      id="yt-bg-player-container"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '16px',
        height: '16px',
        opacity: 0.01,
        zIndex: -1,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  )
}

// Helper para acceder al player desde el mini-podcast-player
export function getBackgroundYouTubePlayer(): YT.Player | null {
  if (typeof window === 'undefined') return null
  return (window as Window & { __ytBgPlayer?: YT.Player | null }).__ytBgPlayer || null
}
