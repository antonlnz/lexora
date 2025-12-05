"use client"

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import type { PodcastContent, ContentSource } from "@/types/database"

// ============================================================================
// UTILIDADES YOUTUBE
// ============================================================================

/**
 * Detecta si una URL es un video de YouTube
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url) return false
  return url.includes('youtube.com/watch') || 
         url.includes('youtu.be/') ||
         url.includes('youtube.com/embed/')
}

/**
 * Extrae el video ID de una URL de YouTube
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null
  
  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/)
  if (watchMatch) return watchMatch[1]
  
  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)
  if (shortMatch) return shortMatch[1]
  
  // youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/)
  if (embedMatch) return embedMatch[1]
  
  return null
}

// ============================================================================
// TIPOS
// ============================================================================

export interface PodcastEpisode extends PodcastContent {
  source: ContentSource
  // Campos opcionales para clips guardados
  clip_start_seconds?: number | null
  clip_end_seconds?: number | null
}

export interface PodcastPlayerState {
  // Episodio actual
  currentEpisode: PodcastEpisode | null
  // Estado de reproducción
  isPlaying: boolean
  isLoading: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  playbackRate: number
  // Estado del reproductor
  isMinimized: boolean
  isVisible: boolean
  // Color dominante del artwork para el mini reproductor
  dominantColor: string | null
  // Flag para indicar que se quiere maximizar (abrir el viewer)
  shouldOpenViewer: boolean
  // Flag para indicar si el episodio actual es un video de YouTube
  isYouTubeVideo: boolean
  youTubeVideoId: string | null
  // Flag para recordar si estaba reproduciéndose al minimizar (para YouTube)
  wasPlayingBeforeMinimize: boolean
}

interface PodcastPlayerContextType extends PodcastPlayerState {
  // Acciones de reproducción
  loadEpisode: (episode: PodcastEpisode) => void
  play: (episode?: PodcastEpisode) => void
  pause: () => void
  togglePlayPause: () => void
  seek: (time: number) => void
  seekForward: (seconds?: number) => void
  seekBackward: (seconds?: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setPlaybackRate: (rate: number) => void
  // Acciones del reproductor
  minimize: () => void
  minimizeWithPlayingState: (wasPlaying: boolean) => void
  maximize: () => void
  clearShouldOpenViewer: () => void
  close: () => void
  // Referencia al elemento de audio
  audioRef: React.RefObject<HTMLAudioElement | null>
  // Referencia al reproductor de YouTube (para control externo)
  youTubePlayerRef: React.MutableRefObject<YT.Player | null>
  setYouTubePlayer: (player: YT.Player | null) => void
  // Actualizar estado desde YouTube player
  updateFromYouTube: (updates: { currentTime?: number; duration?: number; isPlaying?: boolean }) => void
}

// ============================================================================
// CONTEXTO
// ============================================================================

const PodcastPlayerContext = createContext<PodcastPlayerContextType | null>(null)

export function usePodcastPlayer() {
  const context = useContext(PodcastPlayerContext)
  if (!context) {
    throw new Error("usePodcastPlayer must be used within PodcastPlayerProvider")
  }
  return context
}

// ============================================================================
// PROVIDER
// ============================================================================

const SEEK_SECONDS = 10 // Segundos para saltar adelante/atrás
const STORAGE_KEY = 'lexora-podcast-player-state'

// Tipo para el estado persistido
interface PersistedState {
  currentEpisode: PodcastEpisode | null
  currentTime: number
  volume: number
  isMuted: boolean
  playbackRate: number
  isMinimized: boolean
  isVisible: boolean
}

// Función para cargar estado desde localStorage
function loadPersistedState(): Partial<PersistedState> | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.warn('Error loading podcast player state:', error)
  }
  return null
}

// Función para guardar estado en localStorage
function savePersistedState(state: PersistedState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('Error saving podcast player state:', error)
  }
}

// Función para actualizar Media Session (notificación del SO)
function updateMediaSession(episode: PodcastEpisode | null, isPlaying: boolean) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return
  
  if (!episode) {
    // Limpiar la sesión si no hay episodio
    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'none'
    return
  }
  
  // Obtener la imagen del episodio o del podcast
  let artworkUrl = episode.image_url || episode.source?.image_url || episode.source?.favicon_url || '/placeholder-logo.png'
  
  // Asegurar que la URL sea absoluta (Media Session requiere URLs absolutas)
  if (artworkUrl.startsWith('/')) {
    artworkUrl = `${window.location.origin}${artworkUrl}`
  }
  
  // Detectar el tipo de imagen basado en la extensión
  const getImageType = (url: string): string => {
    const lowercaseUrl = url.toLowerCase()
    if (lowercaseUrl.includes('.jpg') || lowercaseUrl.includes('.jpeg')) return 'image/jpeg'
    if (lowercaseUrl.includes('.webp')) return 'image/webp'
    if (lowercaseUrl.includes('.gif')) return 'image/gif'
    return 'image/png' // Default
  }
  
  // Crear metadata para la notificación del SO
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.title,
      artist: episode.author || episode.source?.title || 'Podcast',
      album: episode.source?.title || 'Lexora',
      artwork: [
        { src: artworkUrl, sizes: '96x96', type: getImageType(artworkUrl) },
        { src: artworkUrl, sizes: '128x128', type: getImageType(artworkUrl) },
        { src: artworkUrl, sizes: '192x192', type: getImageType(artworkUrl) },
        { src: artworkUrl, sizes: '256x256', type: getImageType(artworkUrl) },
        { src: artworkUrl, sizes: '384x384', type: getImageType(artworkUrl) },
        { src: artworkUrl, sizes: '512x512', type: getImageType(artworkUrl) },
      ]
    })
    
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  } catch (error) {
    console.warn('Error setting media session metadata:', error)
  }
}

export function PodcastPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const youTubePlayerRef = useRef<YT.Player | null>(null)
  const hasRestoredRef = useRef(false)
  
  const [state, setState] = useState<PodcastPlayerState>({
    currentEpisode: null,
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    isMinimized: false,
    isVisible: false,
    dominantColor: null,
    shouldOpenViewer: false,
    isYouTubeVideo: false,
    youTubeVideoId: null,
    wasPlayingBeforeMinimize: false,
  })

  // Restaurar estado desde localStorage al montar
  useEffect(() => {
    if (hasRestoredRef.current) return
    hasRestoredRef.current = true
    
    // Verificar si fue cerrado explícitamente en esta sesión
    const wasClosed = typeof window !== 'undefined' && sessionStorage.getItem('lexora-podcast-closed') === 'true'
    
    // Limpiar el flag de cierre después de verificar
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('lexora-podcast-closed')
    }
    
    // No restaurar si fue cerrado explícitamente
    if (wasClosed) {
      // Asegurarse de limpiar localStorage también
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY)
      }
      return
    }
    
    const persisted = loadPersistedState()
    if (persisted && persisted.currentEpisode) {
      // Verificar si es un video de YouTube - no restaurar porque no funciona en mini reproductor
      const isYouTube = isYouTubeUrl(persisted.currentEpisode.audio_url)
      
      if (isYouTube) {
        // No restaurar videos de YouTube - limpiar localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY)
        }
        return
      }
      
      // Al restaurar, siempre mostrar como minimizado (mini reproductor)
      // para que el usuario pueda expandir si quiere
      setState(prev => ({
        ...prev,
        currentEpisode: persisted.currentEpisode || null,
        currentTime: persisted.currentTime || 0,
        volume: persisted.volume ?? 1,
        isMuted: persisted.isMuted ?? false,
        playbackRate: persisted.playbackRate ?? 1,
        isMinimized: true, // Siempre minimizado al restaurar
        isVisible: true,   // Visible para mostrar el mini reproductor
        isYouTubeVideo: false,
        youTubeVideoId: null,
      }))
    }
  }, [])

  // Guardar estado en localStorage cuando cambia
  useEffect(() => {
    // Solo guardar si hay un episodio activo Y el reproductor está visible
    // No guardar si currentEpisode es null (fue cerrado explícitamente)
    // No guardar videos de YouTube (no funcionan en mini reproductor)
    if (state.currentEpisode && state.isVisible && !state.isYouTubeVideo) {
      savePersistedState({
        currentEpisode: state.currentEpisode,
        currentTime: state.currentTime,
        volume: state.volume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        isMinimized: state.isMinimized,
        isVisible: state.isVisible,
      })
    }
    // No eliminar aquí - la eliminación se hace en close()
  }, [
    state.currentEpisode,
    state.currentTime,
    state.volume,
    state.isMuted,
    state.playbackRate,
    state.isMinimized,
    state.isVisible,
  ])

  // Crear elemento de audio al montar
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'metadata' // Solo metadata inicialmente para ahorrar ancho de banda
      
      // Restaurar configuración de audio desde el estado
      const persisted = loadPersistedState()
      if (persisted) {
        audioRef.current.volume = persisted.volume ?? 1
        audioRef.current.muted = persisted.isMuted ?? false
        audioRef.current.playbackRate = persisted.playbackRate ?? 1
        
        // Si había un episodio, configurar el src pero NO cargar completamente
        // El usuario decidirá si quiere reproducir
        // IMPORTANTE: No intentar cargar URLs de YouTube como audio
        if (persisted.currentEpisode?.audio_url && !isYouTubeUrl(persisted.currentEpisode.audio_url)) {
          audioRef.current.src = persisted.currentEpisode.audio_url
          // No llamar a load() aquí - se hará cuando el usuario presione play
          
          // Restaurar posición cuando se cargue metadata
          const onLoadedMetadata = () => {
            if (audioRef.current && persisted.currentTime) {
              audioRef.current.currentTime = persisted.currentTime
            }
            audioRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata)
          }
          
          audioRef.current.addEventListener('loadedmetadata', onLoadedMetadata)
          
          // No marcar como loading hasta que el usuario intente reproducir
          setState(prev => ({ ...prev, isLoading: false }))
        }
      }
      
      // Event listeners globales
      const audio = audioRef.current

      audio.addEventListener('loadstart', () => {
        // Solo marcar loading si hay un src válido
        if (audio.src) {
          setState(prev => ({ ...prev, isLoading: true }))
        }
      })

      audio.addEventListener('loadedmetadata', () => {
        setState(prev => ({ 
          ...prev, 
          duration: audio.duration,
        }))
      })

      audio.addEventListener('canplay', () => {
        setState(prev => ({ ...prev, isLoading: false }))
      })

      audio.addEventListener('timeupdate', () => {
        setState(prev => ({ ...prev, currentTime: audio.currentTime }))
      })

      audio.addEventListener('play', () => {
        setState(prev => ({ ...prev, isPlaying: true, isLoading: false }))
      })

      audio.addEventListener('pause', () => {
        setState(prev => ({ ...prev, isPlaying: false }))
      })

      audio.addEventListener('ended', () => {
        setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }))
      })

      audio.addEventListener('error', (e) => {
        // Ignorar errores cuando no hay src (ocurre al cerrar el reproductor)
        if (!audio.src || audio.src === '' || audio.src === window.location.href) {
          return
        }
        console.error('Audio error:', e)
        setState(prev => ({ ...prev, isLoading: false, isPlaying: false }))
      })
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  // Extraer color dominante del artwork
  useEffect(() => {
    if (!state.currentEpisode?.image_url) {
      setState(prev => ({ ...prev, dominantColor: null }))
      return
    }

    // Función para generar un color consistente basado en una cadena
    // Esto asegura que el mismo podcast siempre tenga el mismo color
    const generateColorFromString = (str: string): string => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convertir a 32bit integer
      }
      
      // Generar colores HSL para asegurar buena saturación y luminosidad
      const hue = Math.abs(hash) % 360
      const saturation = 50 + (Math.abs(hash >> 8) % 30) // 50-80%
      const lightness = 35 + (Math.abs(hash >> 16) % 20) // 35-55%
      
      // Convertir HSL a RGB
      const h = hue / 360
      const s = saturation / 100
      const l = lightness / 100
      
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      const r = Math.round(hue2rgb(p, q, h + 1/3) * 255)
      const g = Math.round(hue2rgb(p, q, h) * 255)
      const b = Math.round(hue2rgb(p, q, h - 1/3) * 255)
      
      return `rgb(${r}, ${g}, ${b})`
    }

    const extractColor = async () => {
      const imageUrl = state.currentEpisode!.image_url!
      
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = imageUrl
        
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = () => {
            // CORS falló - es esperado para muchos CDNs de podcasts
            // Usar color generado a partir de la URL para consistencia
            reject(new Error('CORS'))
          }
        })

        // Crear canvas pequeño para muestrear colores
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          // Fallback si canvas no disponible
          setState(prev => ({ ...prev, dominantColor: generateColorFromString(imageUrl) }))
          return
        }

        canvas.width = 50
        canvas.height = 50
        ctx.drawImage(img, 0, 0, 50, 50)

        // Obtener datos de imagen
        const imageData = ctx.getImageData(0, 0, 50, 50).data
        
        // Calcular color promedio (ponderando hacia colores más saturados)
        let r = 0, g = 0, b = 0, count = 0

        for (let i = 0; i < imageData.length; i += 4) {
          const pixelR = imageData[i]
          const pixelG = imageData[i + 1]
          const pixelB = imageData[i + 2]
          const alpha = imageData[i + 3]

          // Ignorar píxeles muy claros/oscuros
          const brightness = (pixelR + pixelG + pixelB) / 3
          if (brightness > 30 && brightness < 225 && alpha > 128) {
            r += pixelR
            g += pixelG
            b += pixelB
            count++
          }
        }

        if (count > 0) {
          r = Math.round(r / count)
          g = Math.round(g / count)
          b = Math.round(b / count)
          
          setState(prev => ({ 
            ...prev, 
            dominantColor: `rgb(${r}, ${g}, ${b})` 
          }))
        } else {
          // Si no hay píxeles válidos, usar color generado
          setState(prev => ({ ...prev, dominantColor: generateColorFromString(imageUrl) }))
        }
      } catch {
        // Usar color generado basado en la URL para consistencia
        setState(prev => ({ 
          ...prev, 
          dominantColor: generateColorFromString(state.currentEpisode!.image_url!) 
        }))
      }
    }

    extractColor()
  }, [state.currentEpisode?.image_url])

  // Actualizar Media Session API para notificaciones del SO
  useEffect(() => {
    updateMediaSession(state.currentEpisode, state.isPlaying)
  }, [state.currentEpisode, state.isPlaying])

  // Configurar action handlers de Media Session
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return

    const setupActionHandlers = () => {
      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current?.play()
      })
      
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause()
      })
      
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        if (audioRef.current) {
          const skipTime = details.seekOffset || SEEK_SECONDS
          audioRef.current.currentTime = Math.max(audioRef.current.currentTime - skipTime, 0)
        }
      })
      
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (audioRef.current) {
          const skipTime = details.seekOffset || SEEK_SECONDS
          audioRef.current.currentTime = Math.min(
            audioRef.current.currentTime + skipTime,
            audioRef.current.duration || 0
          )
        }
      })
      
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (audioRef.current && details.seekTime !== undefined) {
          audioRef.current.currentTime = details.seekTime
        }
      })

      // Limpiar handler de stop si está disponible
      try {
        navigator.mediaSession.setActionHandler('stop', () => {
          if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
          }
        })
      } catch {
        // El handler 'stop' no está soportado en todos los navegadores
      }
    }

    setupActionHandlers()

    return () => {
      // Limpiar handlers al desmontar
      try {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('seekbackward', null)
        navigator.mediaSession.setActionHandler('seekforward', null)
        navigator.mediaSession.setActionHandler('seekto', null)
        navigator.mediaSession.setActionHandler('stop', null)
      } catch {
        // Ignorar errores de limpieza
      }
    }
  }, [])

  // Actualizar posición de reproducción en Media Session
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return
    if (!state.currentEpisode || !state.duration) return

    try {
      navigator.mediaSession.setPositionState({
        duration: state.duration,
        playbackRate: state.playbackRate,
        position: state.currentTime,
      })
    } catch {
      // setPositionState puede no estar disponible en todos los navegadores
    }
  }, [state.currentTime, state.duration, state.playbackRate, state.currentEpisode])

  // ============================================================================
  // ACCIONES
  // ============================================================================

  // Cargar episodio sin reproducir
  const loadEpisode = useCallback((episode: PodcastEpisode) => {
    // Detectar si es un video de YouTube
    const isYouTube = isYouTubeUrl(episode.audio_url)
    const videoId = isYouTube ? extractYouTubeVideoId(episode.audio_url) : null
    
    // Pausar el audio HTML si está reproduciéndose
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
    }
    
    // Actualizar el estado
    // Si había un mini-player abierto, cerrarlo y abrir el viewer
    const hadMiniPlayerOpen = state.isMinimized && state.isVisible
    
    // Si hay un clip guardado, inicializar currentTime al inicio del clip
    // para que el indicador de progreso muestre la posición correcta desde el inicio
    const initialTime = episode.clip_start_seconds ?? 0
    
    setState(prev => {
      return {
        ...prev,
        currentEpisode: episode,
        currentTime: initialTime,
        duration: 0,
        isPlaying: false,
        isLoading: false,
        isVisible: true,
        isMinimized: false,
        isYouTubeVideo: isYouTube,
        youTubeVideoId: videoId,
        wasPlayingBeforeMinimize: false,
        // Si había un mini-player, indicar que debe abrirse el viewer
        shouldOpenViewer: hadMiniPlayerOpen,
      }
    })
    
    // Configurar el audio HTML si no es YouTube
    if (!isYouTube && audioRef.current) {
      audioRef.current.src = episode.audio_url
      audioRef.current.load()
      // Si hay un clip, hacer seek al inicio del clip cuando el audio esté listo
      if (episode.clip_start_seconds != null) {
        audioRef.current.addEventListener('loadedmetadata', () => {
          if (audioRef.current && episode.clip_start_seconds != null) {
            audioRef.current.currentTime = episode.clip_start_seconds
            // También actualizar el state
            setState(prev => ({ ...prev, currentTime: episode.clip_start_seconds! }))
          }
        }, { once: true })
      }
    }
  }, [])

  const play = useCallback((episode?: PodcastEpisode) => {
    // Determinar qué episodio reproducir
    const episodeToPlay = episode || state.currentEpisode
    
    if (!episodeToPlay) {
      console.error('No episode to play')
      return
    }
    
    // Detectar si es YouTube
    const isYouTube = isYouTubeUrl(episodeToPlay.audio_url)
    
    // Si es YouTube, usar el reproductor de YouTube
    if (isYouTube) {
      const videoId = extractYouTubeVideoId(episodeToPlay.audio_url)
      
      // SIEMPRE pausar el audio HTML si está reproduciéndose (para cambiar de audio a YouTube)
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause()
      }
      
      // Actualizar estado si es un nuevo episodio
      if (episode && episode.id !== state.currentEpisode?.id) {
        setState(prev => ({
          ...prev,
          currentEpisode: episode,
          currentTime: 0,
          isVisible: true,
          isMinimized: false,
          isLoading: true,
          isYouTubeVideo: true,
          youTubeVideoId: videoId,
        }))
      }
      
      // Intentar reproducir con el player de YouTube si está disponible
      if (youTubePlayerRef.current) {
        try {
          youTubePlayerRef.current.playVideo()
          setState(prev => ({ ...prev, isPlaying: true, isLoading: false }))
        } catch (error) {
          console.error('Error playing YouTube video:', error)
        }
      } else {
        // El player aún no está listo, marcar que queremos reproducir
        setState(prev => ({ ...prev, isPlaying: true }))
      }
      return
    }
    
    // Audio HTML normal
    if (!audioRef.current) return

    const audio = audioRef.current
    
    // Guardar el tiempo actual del estado para restaurarlo después de cargar
    const savedTime = state.currentTime
    const isSameEpisode = episodeToPlay.id === state.currentEpisode?.id

    // Si es un nuevo episodio (pasado como argumento y diferente al actual)
    if (episode && episode.id !== state.currentEpisode?.id) {
      // Primero pausar cualquier reproducción actual
      if (!audio.paused) {
        audio.pause()
      }
      
      // Nuevo episodio - cargar y reproducir desde el inicio
      setState(prev => ({
        ...prev,
        currentEpisode: episode,
        currentTime: 0,
        isVisible: true,
        isMinimized: false,
        isLoading: true,
        isYouTubeVideo: false,
        youTubeVideoId: null,
      }))
      audio.src = episode.audio_url
      audio.load()
    } else if (!audio.src || audio.src === window.location.href || audio.src !== episodeToPlay.audio_url) {
      // El audio no tiene src válido o tiene un src diferente
      // Esto ocurre después de loadEpisode sin reproducir
      audio.src = episodeToPlay.audio_url
      audio.load()
    }

    // Función para intentar reproducir
    const attemptPlay = () => {
      // Restaurar la posición si es el mismo episodio y tenemos un tiempo guardado
      if (savedTime > 0 && isSameEpisode && audio.currentTime === 0) {
        audio.currentTime = savedTime
      }
      
      audio.play()
        .then(() => {
          setState(prev => ({ ...prev, isLoading: false, isPlaying: true }))
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            console.error('Error playing audio:', error)
          }
          setState(prev => ({ ...prev, isLoading: false }))
        })
    }

    // Si el audio ya está suficientemente cargado, reproducir directamente
    // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
    if (audio.readyState >= 1) {
      attemptPlay()
      return
    }

    // Si el audio no tiene nada cargado, necesitamos esperar
    // Mostrar loader mientras carga
    setState(prev => ({ ...prev, isLoading: true }))
    
    // Flag para evitar múltiples llamadas
    let hasTriggered = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    
    const handleReady = () => {
      if (hasTriggered) return
      hasTriggered = true
      cleanup()
      attemptPlay()
    }
    
    const cleanup = () => {
      audio.removeEventListener('canplay', handleReady)
      audio.removeEventListener('canplaythrough', handleReady)
      audio.removeEventListener('loadeddata', handleReady)
      audio.removeEventListener('loadedmetadata', handleMetadata)
      if (timeoutId) clearTimeout(timeoutId)
    }
    
    // Si llegamos a loadedmetadata, intentar reproducir de todos modos
    const handleMetadata = () => {
      if (hasTriggered) return
      // Esperar un poco más para ver si llega canplay, si no, reproducir
      setTimeout(() => {
        if (!hasTriggered) {
          handleReady()
        }
      }, 500)
    }
    
    // Timeout de seguridad (8 segundos)
    timeoutId = setTimeout(() => {
      if (!hasTriggered) {
        hasTriggered = true
        cleanup()
        // Intentar reproducir de todos modos
        attemptPlay()
      }
    }, 8000)
    
    // Escuchar múltiples eventos para capturar cuando esté listo
    audio.addEventListener('canplay', handleReady)
    audio.addEventListener('canplaythrough', handleReady)
    audio.addEventListener('loadeddata', handleReady)
    audio.addEventListener('loadedmetadata', handleMetadata)
  }, [state.currentEpisode, state.currentTime])

  const pause = useCallback(() => {
    // Si es YouTube, pausar con el player de YouTube
    if (state.isYouTubeVideo && youTubePlayerRef.current) {
      try {
        youTubePlayerRef.current.pauseVideo()
      } catch (error) {
        console.error('Error pausing YouTube video:', error)
      }
    }
    // Pausar el audio HTML también (por si acaso)
    audioRef.current?.pause()
    setState(prev => ({ ...prev, isPlaying: false }))
  }, [state.isYouTubeVideo])

  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause()
    } else {
      play()
    }
  }, [state.isPlaying, play, pause])

  const seek = useCallback((time: number) => {
    // Para YouTube, no limitamos por duration porque puede no estar disponible aún
    // El player de YouTube manejará el seek internamente
    const maxTime = state.duration > 0 ? state.duration : Infinity
    const seekTime = Math.max(0, Math.min(time, maxTime))
    
    // Si es YouTube, usar el player de YouTube
    if (state.isYouTubeVideo && youTubePlayerRef.current) {
      try {
        youTubePlayerRef.current.seekTo(time, true) // Usar time directamente para YouTube
        setState(prev => ({ ...prev, currentTime: time }))
      } catch (error) {
        console.error('Error seeking YouTube video:', error)
      }
      return
    }
    
    // Audio HTML
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime
    }
  }, [state.duration, state.isYouTubeVideo])

  const seekForward = useCallback((seconds = SEEK_SECONDS) => {
    const newTime = Math.min(state.currentTime + seconds, state.duration)
    seek(newTime)
  }, [state.currentTime, state.duration, seek])

  const seekBackward = useCallback((seconds = SEEK_SECONDS) => {
    const newTime = Math.max(state.currentTime - seconds, 0)
    seek(newTime)
  }, [state.currentTime, seek])

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    
    // Si es YouTube, usar el player de YouTube
    if (state.isYouTubeVideo && youTubePlayerRef.current) {
      try {
        youTubePlayerRef.current.setVolume(clampedVolume * 100) // YouTube usa 0-100
        if (clampedVolume === 0) {
          youTubePlayerRef.current.mute()
        } else {
          youTubePlayerRef.current.unMute()
        }
      } catch (error) {
        console.error('Error setting YouTube volume:', error)
      }
    }
    
    // Audio HTML
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume
    }
    
    setState(prev => ({ ...prev, volume: clampedVolume, isMuted: clampedVolume === 0 }))
  }, [state.isYouTubeVideo])

  const toggleMute = useCallback(() => {
    const newMuted = !state.isMuted
    
    // Si es YouTube, usar el player de YouTube
    if (state.isYouTubeVideo && youTubePlayerRef.current) {
      try {
        if (newMuted) {
          youTubePlayerRef.current.mute()
        } else {
          youTubePlayerRef.current.unMute()
        }
      } catch (error) {
        console.error('Error toggling YouTube mute:', error)
      }
    }
    
    // Audio HTML
    if (audioRef.current) {
      audioRef.current.muted = newMuted
    }
    
    setState(prev => ({ ...prev, isMuted: newMuted }))
  }, [state.isMuted, state.isYouTubeVideo])

  const setPlaybackRate = useCallback((rate: number) => {
    // Si es YouTube, usar el player de YouTube
    if (state.isYouTubeVideo && youTubePlayerRef.current) {
      try {
        youTubePlayerRef.current.setPlaybackRate(rate)
      } catch (error) {
        console.error('Error setting YouTube playback rate:', error)
      }
    }
    
    // Audio HTML
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
    
    setState(prev => ({ ...prev, playbackRate: rate }))
  }, [state.isYouTubeVideo])

  const minimize = useCallback(() => {
    // Guardar el estado de reproducción antes de minimizar
    // para que el mini-reproductor sepa si debe auto-reproducir
    setState(prev => ({ 
      ...prev, 
      isMinimized: true, 
      shouldOpenViewer: false,
      wasPlayingBeforeMinimize: prev.isPlaying 
    }))
  }, [])

  // Variante de minimize que permite especificar explícitamente el estado de reproducción
  // Útil cuando el gesto de swipe puede interferir con el estado de isPlaying
  const minimizeWithPlayingState = useCallback((wasPlaying: boolean) => {
    setState(prev => ({ 
      ...prev, 
      isMinimized: true, 
      shouldOpenViewer: false,
      wasPlayingBeforeMinimize: wasPlaying 
    }))
  }, [])

  const maximize = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: false, shouldOpenViewer: true, wasPlayingBeforeMinimize: false }))
  }, [])

  const clearShouldOpenViewer = useCallback(() => {
    setState(prev => ({ ...prev, shouldOpenViewer: false }))
  }, [])

  const close = useCallback(() => {
    pause()
    // Limpiar localStorage y marcar como cerrado explícitamente
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
      // Marcar que fue cerrado explícitamente para evitar restaurar al recargar
      sessionStorage.setItem('lexora-podcast-closed', 'true')
    }
    // Limpiar src antes de actualizar el estado para evitar errores
    if (audioRef.current) {
      audioRef.current.removeAttribute('src')
      audioRef.current.load() // Esto limpia el buffer sin disparar error
    }
    youTubePlayerRef.current = null
    setState(prev => ({ 
      ...prev, 
      isVisible: false,
      isMinimized: false,
      currentEpisode: null,
      currentTime: 0,
      duration: 0,
      isYouTubeVideo: false,
      youTubeVideoId: null,
      wasPlayingBeforeMinimize: false,
    }))
  }, [pause])

  // Función para establecer el reproductor de YouTube
  const setYouTubePlayer = useCallback((player: YT.Player | null) => {
    youTubePlayerRef.current = player
  }, [])

  // Función para actualizar estado desde el reproductor de YouTube
  const updateFromYouTube = useCallback((updates: { currentTime?: number; duration?: number; isPlaying?: boolean }) => {
    setState(prev => ({
      ...prev,
      ...(updates.currentTime !== undefined && { currentTime: updates.currentTime }),
      ...(updates.duration !== undefined && { duration: updates.duration }),
      ...(updates.isPlaying !== undefined && { isPlaying: updates.isPlaying }),
    }))
  }, [])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <PodcastPlayerContext.Provider
      value={{
        ...state,
        loadEpisode,
        play,
        pause,
        togglePlayPause,
        seek,
        seekForward,
        seekBackward,
        setVolume,
        toggleMute,
        setPlaybackRate,
        minimize,
        minimizeWithPlayingState,
        maximize,
        clearShouldOpenViewer,
        close,
        audioRef,
        youTubePlayerRef,
        setYouTubePlayer,
        updateFromYouTube,
      }}
    >
      {children}
    </PodcastPlayerContext.Provider>
  )
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Formatea segundos a formato mm:ss o hh:mm:ss
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calcula el porcentaje de progreso
 */
export function calculateProgress(currentTime: number, duration: number): number {
  if (!duration || duration === 0) return 0
  return (currentTime / duration) * 100
}
