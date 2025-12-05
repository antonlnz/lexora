"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion, AnimatePresence, PanInfo } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { TouchProgressSlider } from "@/components/ui/touch-progress-slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FolderPicker } from "@/components/folder-picker"
import { 
  usePodcastPlayer, 
  formatTime, 
  calculateProgress,
  isYouTubeUrl,
  extractYouTubeVideoId,
  type PodcastEpisode 
} from "@/contexts/podcast-player-context"
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  X,
  Minimize2,
  Maximize2,
  Volume2,
  VolumeX,
  ChevronDown,
  Clock,
  Calendar,
  Headphones,
  ListMusic,
  FileText,
  Share,
  ExternalLink,
  Youtube,
  Bookmark,
  BookmarkCheck,
  Scissors,
  Loader2,
} from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { contentService } from "@/lib/services/content-service"
import type { PodcastContent, ContentSource } from "@/types/database"

// ============================================================================
// YOUTUBE PLAYER HOOK - Custom hook para manejar el reproductor de YouTube
// ============================================================================

function useYouTubePlayer(
  videoId: string | null,
  containerId: string,
  isActive: boolean, // Nuevo: solo crear player cuando está activo
  initialSeekTime: number, // Tiempo inicial para hacer seek cuando el player esté listo
  onStateChange: (isPlaying: boolean) => void,
  onTimeUpdate: (currentTime: number, duration: number) => void,
  onReady: () => void
) {
  const playerRef = useRef<YT.Player | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isAPIReady, setIsAPIReady] = useState(false)
  const currentVideoIdRef = useRef<string | null>(null)
  const initialSeekTimeRef = useRef(initialSeekTime)
  const hasAppliedInitialSeekRef = useRef(false)

  // SIEMPRE actualizar el tiempo de seek inicial cuando cambia
  useEffect(() => {
    initialSeekTimeRef.current = initialSeekTime
    // Solo resetear el flag si no está activo
    if (!isActive) {
      hasAppliedInitialSeekRef.current = false
    }
  }, [initialSeekTime, isActive])

  // Cargar la API de YouTube
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Si la API ya está cargada
    if (window.YT && window.YT.Player) {
      setIsAPIReady(true)
      return
    }

    // Callback cuando la API esté lista
    const originalCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      setIsAPIReady(true)
      if (originalCallback) originalCallback()
    }

    // Cargar el script si no existe
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  // Función de limpieza
  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (playerRef.current) {
      try {
        playerRef.current.destroy()
      } catch (e) {
        // Ignorar errores al destruir
      }
      playerRef.current = null
    }
    currentVideoIdRef.current = null
    hasAppliedInitialSeekRef.current = false
  }, [])

  // Crear/actualizar el player cuando tenemos videoId, API lista y está activo
  useEffect(() => {
    // Si no está activo o no hay videoId, limpiar y salir
    if (!isActive || !videoId) {
      cleanup()
      return
    }

    if (!isAPIReady || !window.YT?.Player) return

    // Si el videoId es el mismo, no recrear
    if (currentVideoIdRef.current === videoId && playerRef.current) {
      return
    }

    // Limpiar player anterior
    cleanup()

    // Esperar a que el DOM esté listo
    const initPlayer = () => {
      const container = document.getElementById(containerId)
      if (!container) {
        // Reintentar en el siguiente frame si el contenedor no existe
        requestAnimationFrame(initPlayer)
        return
      }
      
      // Limpiar el contenedor antes de crear el nuevo player
      // Esto es necesario porque YouTube reemplaza el div con un iframe
      container.innerHTML = ''
      
      // Crear un nuevo div para el player
      const playerDiv = document.createElement('div')
      playerDiv.id = `${containerId}-inner-${videoId}`
      container.appendChild(playerDiv)

      try {
        currentVideoIdRef.current = videoId
        
        // Obtener dimensiones del contenedor
        const containerRect = container.getBoundingClientRect()
        const width = Math.floor(containerRect.width) || 480
        const height = Math.floor(containerRect.height) || 270
        
        playerRef.current = new window.YT.Player(playerDiv.id, {
          videoId: videoId,
          width: width,
          height: height,
          playerVars: {
            autoplay: 0,
            controls: 0, // Sin controles de YouTube - usamos nuestros propios controles
            modestbranding: 1,
            rel: 0,
            playsinline: 1, // Importante para iOS - reproduce inline, no fullscreen automático
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              // Si hay un tiempo inicial guardado y no se ha aplicado aún, hacer seek
              if (initialSeekTimeRef.current > 0 && !hasAppliedInitialSeekRef.current) {
                try {
                  playerRef.current?.seekTo(initialSeekTimeRef.current, true)
                  // Asegurar que quede pausado después del seek
                  playerRef.current?.pauseVideo()
                  hasAppliedInitialSeekRef.current = true
                } catch (e) {
                  console.error('[YTPlayer] Error seeking:', e)
                }
              }
              onReady()
              intervalRef.current = setInterval(() => {
                if (playerRef.current && currentVideoIdRef.current === videoId) {
                  try {
                    const currentTime = playerRef.current.getCurrentTime() || 0
                    const duration = playerRef.current.getDuration() || 0
                    onTimeUpdate(currentTime, duration)
                  } catch (e) {
                    // Player might not be ready
                  }
                }
              }, 250)
            },
            onStateChange: (event) => {
              const isPlaying = event.data === 1
              onStateChange(isPlaying)
            },
          },
        })
      } catch (e) {
        console.error('Error creating YouTube player:', e)
      }
    }

    // Dar tiempo al DOM para renderizar
    setTimeout(initPlayer, 100)

    return cleanup
  }, [isAPIReady, videoId, containerId, isActive, onStateChange, onTimeUpdate, onReady, cleanup])

  const play = useCallback(() => {
    playerRef.current?.playVideo()
  }, [])

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo()
  }, [])

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true)
  }, [])

  const setVolume = useCallback((volume: number) => {
    // YouTube usa 0-100
    playerRef.current?.setVolume(volume * 100)
  }, [])

  const mute = useCallback(() => {
    playerRef.current?.mute()
  }, [])

  const unMute = useCallback(() => {
    playerRef.current?.unMute()
  }, [])

  const setPlaybackRate = useCallback((rate: number) => {
    playerRef.current?.setPlaybackRate(rate)
  }, [])

  const getIframe = useCallback((): HTMLIFrameElement | null => {
    try {
      // getIframe existe en la API de YouTube pero no en los tipos de TypeScript
      return (playerRef.current as any)?.getIframe?.() || null
    } catch {
      return null
    }
  }, [])

  const getCurrentTime = useCallback((): number => {
    try {
      return playerRef.current?.getCurrentTime() || 0
    } catch {
      return 0
    }
  }, [])

  // Memoizar el objeto de retorno para evitar recrearlo en cada render
  return useMemo(() => ({
    play,
    pause,
    seekTo,
    setVolume,
    mute,
    unMute,
    setPlaybackRate,
    getIframe,
    getCurrentTime,
    isReady: isAPIReady && !!playerRef.current,
  }), [play, pause, seekTo, setVolume, mute, unMute, setPlaybackRate, getIframe, getCurrentTime, isAPIReady])
}

interface PodcastViewerProps {
  isOpen: boolean
  onClose: () => void
  episode: PodcastEpisode | null
  episodes?: PodcastEpisode[]
  source?: ContentSource
  // Props para navegación entre contenidos (opcional)
  onNavigateNext?: () => void
  onNavigatePrevious?: () => void
  hasNext?: boolean
  hasPrevious?: boolean
}

export function PodcastViewer({ 
  isOpen, 
  onClose, 
  episode,
  episodes = [],
  source,
  onNavigateNext,
  onNavigatePrevious,
  hasNext = false,
  hasPrevious = false,
}: PodcastViewerProps) {
  const isMobile = useIsMobile()
  const {
    currentEpisode,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    dominantColor,
    isYouTubeVideo,
    youTubeVideoId,
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
    isMinimized,
    updateFromYouTube,
    setYouTubePlayer,
  } = usePodcastPlayer()

  const [activeTab, setActiveTab] = useState<"player" | "description" | "episodes">("player")
  const [isDraggingDown, setIsDraggingDown] = useState(false)
  const [dragY, setDragY] = useState(0)
  // Estado para bloquear el drag vertical mientras se manipula el slider
  const [isSliderDragging, setIsSliderDragging] = useState(false)
  // Estado para pantalla completa del video
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false)
  // Estado para mostrar/ocultar el video (mostrar thumbnail vs iframe)
  const [showVideo, setShowVideo] = useState(false)
  // Estado para saber si el player de YouTube está listo
  const [ytPlayerReady, setYtPlayerReady] = useState(false)
  // Estado para detectar orientación del dispositivo (para fullscreen mobile)
  const [isLandscape, setIsLandscape] = useState(false)
  // Ref que mantiene el último estado de reproducción "intencionado" por el usuario
  // Se actualiza cuando el usuario hace play/pause explícito, no cuando el gesto interfiere
  const lastIntendedPlayingStateRef = useRef(false)
  
  // Estados para guardar podcast
  const [isSaved, setIsSaved] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [savingToFolder, setSavingToFolder] = useState(false)
  // Estados para guardar clip/sección
  const [isClipMode, setIsClipMode] = useState(false)
  const [clipStart, setClipStart] = useState<number | null>(null)
  const [clipEnd, setClipEnd] = useState<number | null>(null)

  // ID único para el contenedor del player de YouTube (fijo, no depende del videoId)
  const ytContainerId = 'yt-player-main'
  const ytFullscreenContainerId = 'yt-player-fullscreen'

  // Hook para el reproductor de YouTube
  // isActive controla si el hook debe inicializar el player
  // También activar si hay un clip guardado para poder obtener la duración
  // Verificar si hay un clip guardado (usar typeof para permitir clip_start = 0)
  const hasSavedClip = typeof episode?.clip_start_seconds === 'number'
  const isYouTubeActive = isOpen && isYouTubeVideo && (showVideo || hasSavedClip)
  
  // Referencia al clip start para usarlo en el callback onReady
  const clipStartRef = useRef<number | null>(null)
  clipStartRef.current = episode?.clip_start_seconds ?? null
  
  const ytPlayer = useYouTubePlayer(
    youTubeVideoId,
    ytContainerId,
    // isActive - solo inicializar cuando el visor está abierto y mostrando video
    isYouTubeActive,
    // initialSeekTime - usar clip_start_seconds si existe, sino currentTime
    episode?.clip_start_seconds ?? currentTime,
    // onStateChange
    useCallback((playing: boolean) => {
      updateFromYouTube({ isPlaying: playing })
    }, [updateFromYouTube]),
    // onTimeUpdate
    useCallback((time: number, dur: number) => {
      updateFromYouTube({ currentTime: time, duration: dur })
    }, [updateFromYouTube]),
    // onReady
    useCallback(() => {
      setYtPlayerReady(true)
      // Marcar que ya hicimos el seek inicial si había clip
      if (clipStartRef.current != null) {
        hasSeekToClipStart.current = true
      }
    }, [])
  )

  // Mantener lastIntendedPlayingStateRef actualizado con el estado de reproducción
  // Este ref captura si el usuario tenía la intención de reproducir
  useEffect(() => {
    // Solo actualizar si isPlaying es true (captura cuando el usuario reproduce)
    // No actualizar cuando pasa a false por gestos u otras interferencias
    if (isPlaying) {
      lastIntendedPlayingStateRef.current = true
    }
  }, [isPlaying])

  // Sincronizar controles de Lexora con YouTube
  useEffect(() => {
    if (!isYouTubeVideo || !ytPlayerReady || !showVideo) return

    // Solo sincronizar cuando cambian desde los controles de Lexora
    // Los cambios del YouTube player ya se manejan en los callbacks
  }, [isYouTubeVideo, ytPlayerReady, showVideo])

  // Auto-reproducir cuando el player está listo y el estado dice que debería estar reproduciendo
  // Esto maneja el caso de volver desde el mini-player o reanudar reproducción
  useEffect(() => {
    if (isOpen && isYouTubeVideo && ytPlayerReady && showVideo && isPlaying) {
      // El estado global dice que debería estar reproduciendo, iniciar el player
      ytPlayer.play()
    }
  }, [isOpen, isYouTubeVideo, ytPlayerReady, showVideo, isPlaying, ytPlayer])

  // Resetear estado cuando se cierra completamente (no cuando se minimiza)
  useEffect(() => {
    if (!isOpen && !isMinimized) {
      // Solo resetear cuando se cierra completamente, no al minimizar
      setShowVideo(false)
      setYtPlayerReady(false)
      setIsVideoFullscreen(false)
    }
  }, [isOpen, isMinimized])

  // Restaurar showVideo cuando se vuelve a abrir desde minimizado con YouTube
  useEffect(() => {
    if (isOpen && isYouTubeVideo && isPlaying && !showVideo) {
      // Si el viewer se abre y hay un video de YouTube reproduciéndose, mostrar el video
      setShowVideo(true)
    }
  }, [isOpen, isYouTubeVideo, isPlaying, showVideo])

  // Manejo de teclado para navegación entre contenidos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight' && hasNext && onNavigateNext) {
        onNavigateNext()
      } else if (e.key === 'ArrowLeft' && hasPrevious && onNavigatePrevious) {
        onNavigatePrevious()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, hasNext, hasPrevious, onNavigateNext, onNavigatePrevious])

  // Sincronizar estado de guardado cuando cambia el episodio
  const previousEpisodeIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (currentEpisode && currentEpisode.id !== previousEpisodeIdRef.current) {
      previousEpisodeIdRef.current = currentEpisode.id
      // Resetear estado - el usuario puede verificar si ya está guardado desde la UI
      setIsSaved(false)
      setCurrentFolderId(null)
      // Resetear estado de clip
      setIsClipMode(false)
      setClipStart(null)
      setClipEnd(null)
      
      // Cargar estado de guardado de forma asíncrona
      const loadSavedState = async () => {
        try {
          const userContent = await contentService.getUserContentState('podcast', currentEpisode.id)
          if (userContent) {
            setIsSaved(userContent.is_archived || false)
            setCurrentFolderId(userContent.folder_id || null)
          }
        } catch (error) {
          console.error('Error loading saved state:', error)
        }
      }
      loadSavedState()
    }
  }, [currentEpisode])

  // Handlers para guardar podcast
  const handleSaveToFolder = async (folderId: string | null) => {
    if (!currentEpisode) return
    setSavingToFolder(true)
    try {
      // Detectar el tipo de contenido (podcast o YouTube)
      const contentType = isYouTubeVideo ? 'youtube' : 'podcast'
      
      // Preparar datos del episodio para crear el contenido si no existe
      const episodeData = {
        title: currentEpisode.title,
        url: currentEpisode.url,
        source_id: currentEpisode.source_id,
        description: currentEpisode.description,
        image_url: currentEpisode.image_url,
        thumbnail_url: (currentEpisode as any).thumbnail_url,
        duration: currentEpisode.duration,
        published_at: currentEpisode.published_at,
        channel_name: (currentEpisode as any).channel_name,
        author: currentEpisode.author,
        audio_url: currentEpisode.audio_url,
      }
      
      await contentService.archiveToFolder(contentType, currentEpisode.id, folderId, episodeData)
      setIsSaved(true)
      setCurrentFolderId(folderId)
    } catch (error) {
      console.error('Error saving content to folder:', error)
    } finally {
      setSavingToFolder(false)
    }
  }

  const handleToggleArchive = async () => {
    if (!currentEpisode) return
    if (isSaved) {
      try {
        // Detectar el tipo de contenido (podcast o YouTube)
        const contentType = isYouTubeVideo ? 'youtube' : 'podcast'
        await contentService.toggleArchive(contentType, currentEpisode.id, false)
        setIsSaved(false)
        setCurrentFolderId(null)
      } catch (error) {
        console.error('Error removing content from archive:', error)
      }
    }
  }

  // Handlers para clip
  const handleSetClipStart = () => {
    setClipStart(currentTime)
    if (!isClipMode) setIsClipMode(true)
  }

  const handleSetClipEnd = () => {
    setClipEnd(currentTime)
    if (!isClipMode) setIsClipMode(true)
  }

  const handleClearClip = () => {
    setClipStart(null)
    setClipEnd(null)
    setIsClipMode(false)
  }

  const handleSaveClip = async (folderId: string | null) => {
    if (!currentEpisode || clipStart === null) return
    setSavingToFolder(true)
    try {
      // Detectar el tipo de contenido (podcast o YouTube)
      const contentType = isYouTubeVideo ? 'youtube' : 'podcast'
      
      // Usar la duración actual del player si está disponible (más precisa que la del episodio)
      const actualDuration = duration > 0 ? duration : currentEpisode.duration
      
      // Preparar datos del episodio para crear el contenido si no existe
      const episodeData = {
        title: currentEpisode.title,
        url: currentEpisode.url,
        source_id: currentEpisode.source_id,
        description: currentEpisode.description,
        image_url: currentEpisode.image_url,
        thumbnail_url: (currentEpisode as any).thumbnail_url,
        duration: actualDuration,
        published_at: currentEpisode.published_at,
        channel_name: (currentEpisode as any).channel_name,
        author: currentEpisode.author,
        audio_url: currentEpisode.audio_url,
      }
      
      // Guardar el contenido con los timestamps del clip
      await contentService.saveClip(
        contentType, 
        currentEpisode.id, 
        clipStart, 
        clipEnd || duration, // Si no hay fin, usar la duración total
        folderId,
        episodeData
      )
      setIsSaved(true)
      setCurrentFolderId(folderId)
      handleClearClip()
    } catch (error) {
      console.error('Error saving clip:', error)
    } finally {
      setSavingToFolder(false)
    }
  }

  // Detectar orientación del dispositivo en mobile
  useEffect(() => {
    if (!isMobile) return

    const checkOrientation = () => {
      // screen.orientation es más fiable, pero window.orientation es fallback para iOS
      if (window.screen?.orientation) {
        setIsLandscape(window.screen.orientation.type.includes('landscape'))
      } else {
        // Fallback: usar dimensiones de ventana
        setIsLandscape(window.innerWidth > window.innerHeight)
      }
    }

    // Comprobar orientación inicial
    checkOrientation()

    // Escuchar cambios de orientación
    window.addEventListener('orientationchange', checkOrientation)
    window.addEventListener('resize', checkOrientation)
    
    // También usar el evento de screen.orientation si está disponible
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', checkOrientation)
    }

    return () => {
      window.removeEventListener('orientationchange', checkOrientation)
      window.removeEventListener('resize', checkOrientation)
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', checkOrientation)
      }
    }
  }, [isMobile])

  // Ref para trackear el video anterior y solo resetear cuando realmente cambia
  const previousVideoIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    // Solo resetear si el videoId realmente cambió (no en el primer render)
    if (previousVideoIdRef.current !== null && previousVideoIdRef.current !== youTubeVideoId) {
      setShowVideo(false)
      setYtPlayerReady(false)
      setIsVideoFullscreen(false)
    }
    previousVideoIdRef.current = youTubeVideoId
  }, [youTubeVideoId])

  // Bloquear scroll del body y contraer barra de Safari cuando está abierto
  useEffect(() => {
    if (isOpen) {
      // Guardar scroll actual
      const scrollY = window.scrollY
      
      // Bloquear scroll del body
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      
      // En iOS Safari, esto ayuda a contraer la barra de búsqueda
      if (isMobile && typeof window !== 'undefined') {
        // Forzar re-layout para Safari
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
      }
      
      return () => {
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        // Restaurar scroll
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen, isMobile])

  // Cambiar theme-color cuando el viewer está abierto (para Safari iOS)
  useEffect(() => {
    if (!isMobile || !isOpen) return
    
    // Obtener o crear meta theme-color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    const originalColor = metaThemeColor?.content || ''
    
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta')
      metaThemeColor.name = 'theme-color'
      document.head.appendChild(metaThemeColor)
    }
    
    // Usar el color dominante o negro como fallback
    const themeColor = dominantColor || '#000000'
    metaThemeColor.content = themeColor
    
    return () => {
      if (metaThemeColor) {
        metaThemeColor.content = originalColor || ''
      }
    }
  }, [isOpen, isMobile, dominantColor])

  // Cargar episodio cuando se abre el visor por primera vez
  // IMPORTANTE: Solo al abrir, no cuando cambia currentEpisode
  const hasLoadedInitialEpisode = useRef(false)
  const hasSeekToClipStart = useRef(false)
  const hasPausedAtClipEnd = useRef(false)
  
  useEffect(() => {
    if (isOpen && episode && !hasLoadedInitialEpisode.current) {
      // Solo cargar el episodio inicial cuando se abre el visor
      if (!currentEpisode || currentEpisode.id !== episode.id) {
        loadEpisode(episode)
        // Resetear los flags al cargar un nuevo episodio
        hasSeekToClipStart.current = false
        hasPausedAtClipEnd.current = false
      }
      hasLoadedInitialEpisode.current = true
    }
    
    // Resetear cuando se cierra
    if (!isOpen) {
      hasLoadedInitialEpisode.current = false
      hasSeekToClipStart.current = false
      hasPausedAtClipEnd.current = false
    }
  }, [isOpen, episode, currentEpisode, loadEpisode])

  // Seek al inicio del clip si existe (después de que el reproductor esté listo)
  // Usar `episode` (la prop) ya que contiene los clip timestamps originales
  useEffect(() => {
    // Solo ejecutar si hay un clip y no hemos hecho seek aún
    // Usar typeof para permitir clip_start = 0
    const clipStart = episode?.clip_start_seconds
    const hasClipStart = typeof clipStart === 'number'
    
    if (!isOpen || !hasClipStart || hasSeekToClipStart.current) {
      return
    }
    
    // Para YouTube, necesitamos que el player esté listo
    // Para audio normal, necesitamos que duration > 0
    const playerReady = isYouTubeVideo ? ytPlayerReady : duration > 0
    
    if (!playerReady) {
      return
    }
    
    // Marcar como hecho ANTES de ejecutar para evitar múltiples ejecuciones
    hasSeekToClipStart.current = true
    
    // Pequeño delay para asegurar que el reproductor esté completamente listo
    const delay = isYouTubeVideo ? 300 : 100
    const timer = setTimeout(() => {
      // Para YouTube, usar el player local directamente
      if (isYouTubeVideo && ytPlayer) {
        ytPlayer.seekTo(clipStart!)
        updateFromYouTube({ currentTime: clipStart! })
      } else {
        seek(clipStart!)
      }
    }, delay)
    
    return () => clearTimeout(timer)
  }, [isOpen, episode?.clip_start_seconds, episode?.id, duration, seek, isYouTubeVideo, ytPlayerReady, ytPlayer, updateFromYouTube])

  // Detener reproducción cuando llegue al final del clip guardado
  useEffect(() => {
    const clipEnd = episode?.clip_end_seconds
    if (typeof clipEnd !== 'number' || !isPlaying || hasPausedAtClipEnd.current) {
      return
    }
    
    // Verificar si hemos llegado al final del clip (con un margen de 0.5 segundos)
    if (currentTime >= clipEnd - 0.5) {
      hasPausedAtClipEnd.current = true
      
      // Para YouTube, usar el player local directamente
      if (isYouTubeVideo && ytPlayer) {
        ytPlayer.pause()
        updateFromYouTube({ isPlaying: false })
      } else {
        pause()
      }
    }
  }, [isPlaying, currentTime, episode?.clip_end_seconds, pause, isYouTubeVideo, ytPlayer, updateFromYouTube])
  
  // Resetear el flag de pausa del clip cuando el usuario hace seek antes del clip end
  useEffect(() => {
    const hasClipEnd = episode?.clip_end_seconds != null
    if (hasClipEnd && currentTime < episode!.clip_end_seconds! - 2) {
      hasPausedAtClipEnd.current = false
    }
  }, [currentTime, episode?.clip_end_seconds])

  // Cerrar cuando se minimiza
  useEffect(() => {
    if (isMinimized && isOpen) {
      onClose()
    }
  }, [isMinimized, isOpen, onClose])

  const progress = calculateProgress(currentTime, duration)
  const displayEpisode = currentEpisode || episode
  
  // Usar la duración del player si está disponible, sino la del episodio
  // Para el clip indicator necesitamos la duración TOTAL real, no clip_end_seconds
  const episodeDuration = currentEpisode?.duration || episode?.duration || 0
  const effectiveDuration = duration > 0 ? duration : episodeDuration
  
  // Mostrar indicadores solo cuando tenemos la duración real (del player o del episodio)
  // No usar clip_end_seconds como duración porque distorsionaría el indicador
  const hasDuration = effectiveDuration > 0

  // Color de fondo basado en el artwork
  const bgColor = dominantColor || 'rgb(79, 70, 229)'
  const bgGradient = dominantColor 
    ? `linear-gradient(180deg, ${dominantColor} 0%, rgba(0,0,0,0.95) 50%)`
    : 'linear-gradient(180deg, rgb(79, 70, 229) 0%, rgba(0,0,0,0.95) 50%)'

  // Handler para drag down en mobile - NO funciona si estamos arrastrando el slider
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isSliderDragging) return
    if (info.offset.y > 100 || info.velocity.y > 500) {
      // Minimizar al mini-reproductor
      handleMinimizeFromSwipe()
    }
    setIsDraggingDown(false)
    setDragY(0)
  }

  // Handler para capturar el estado al inicio del drag
  const handleDragStart = () => {
    if (!isSliderDragging) {
      setIsDraggingDown(true)
    }
  }

  // Handler para cuando el slider empieza/termina de arrastrarse
  const handleSliderDraggingChange = (dragging: boolean) => {
    setIsSliderDragging(dragging)
  }

  // Velocidades de reproducción disponibles
  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

  // Refs para hacer scroll al episodio seleccionado
  const episodeRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // ===========================================================================
  // HANDLERS PERSONALIZADOS PARA YOUTUBE
  // ===========================================================================

  // Handler para play/pause que maneja tanto audio como YouTube
  const handlePlayPause = useCallback(() => {
    if (isYouTubeVideo) {
      if (isPlaying) {
        // Pausar
        lastIntendedPlayingStateRef.current = false
        if (ytPlayerReady) {
          ytPlayer.pause()
        }
      } else {
        // Reproducir - mostrar video si está oculto y reproducir
        lastIntendedPlayingStateRef.current = true
        if (!showVideo) {
          setShowVideo(true)
        }
        // Reproducir cuando el player esté listo
        if (ytPlayerReady) {
          ytPlayer.play()
        }
        // Marcar como playing en el estado (el player lo confirmará cuando empiece)
        updateFromYouTube({ isPlaying: true })
      }
    } else {
      togglePlayPause()
      lastIntendedPlayingStateRef.current = !isPlaying
    }
  }, [isYouTubeVideo, ytPlayerReady, isPlaying, showVideo, ytPlayer, togglePlayPause, updateFromYouTube])

  // Handler para seek que maneja tanto audio como YouTube
  const handleSeek = useCallback((time: number) => {
    if (isYouTubeVideo && ytPlayerReady) {
      ytPlayer.seekTo(time)
    } else {
      seek(time)
    }
  }, [isYouTubeVideo, ytPlayerReady, ytPlayer, seek])

  // Handler para seek forward
  const handleSeekForward = useCallback((seconds = 10) => {
    const newTime = Math.min(currentTime + seconds, duration)
    handleSeek(newTime)
  }, [currentTime, duration, handleSeek])

  // Handler para seek backward
  const handleSeekBackward = useCallback((seconds = 10) => {
    const newTime = Math.max(currentTime - seconds, 0)
    handleSeek(newTime)
  }, [currentTime, handleSeek])

  // Handler para minimizar - el mini player tomará el control
  const handleMinimize = useCallback(() => {
    // Llamar minimize() para que el background player active la reproducción
    minimize()
    
    // Para videos de YouTube, dar un pequeño delay para permitir que el
    // background player (que ya está pre-cargado) haga seek y empiece a reproducir
    if (isYouTubeVideo) {
      setTimeout(() => {
        onClose()
      }, 150)
    } else {
      onClose()
    }
  }, [minimize, onClose, isYouTubeVideo])

  // Handler para minimizar desde swipe
  // Para YouTube con video visible, siempre continuar reproducción (mejor UX)
  const handleMinimizeFromSwipe = useCallback(() => {
    // Para YouTube: si el video estaba mostrándose, asumir que debe continuar
    // Esto es mejor UX porque el swipe no debería detener el audio
    const shouldContinuePlaying = isYouTubeVideo && showVideo
    
    // Capturar el tiempo actual directamente del player antes de cerrar
    if (isYouTubeVideo && ytPlayerReady) {
      const capturedTime = ytPlayer.getCurrentTime()
      updateFromYouTube({ currentTime: capturedTime })
      
      // Pausar el player del viewer para evitar audio doble
      ytPlayer.pause()
    }
    
    // Minimizar con el estado de reproducción apropiado
    minimizeWithPlayingState(shouldContinuePlaying)
    
    // Resetear el ref para la próxima vez
    lastIntendedPlayingStateRef.current = false
    
    // Dar tiempo para que el background player se active
    setTimeout(() => {
      onClose()
    }, 200)
  }, [minimizeWithPlayingState, onClose, isYouTubeVideo, ytPlayerReady, ytPlayer, updateFromYouTube, showVideo])

  // Handler para cambiar volumen
  const handleVolumeChange = useCallback((vol: number) => {
    if (isYouTubeVideo && ytPlayerReady) {
      ytPlayer.setVolume(vol)
    }
    setVolume(vol)
  }, [isYouTubeVideo, ytPlayerReady, ytPlayer, setVolume])

  // Handler para mute/unmute
  const handleToggleMute = useCallback(() => {
    if (isYouTubeVideo && ytPlayerReady) {
      if (isMuted) {
        ytPlayer.unMute()
      } else {
        ytPlayer.mute()
      }
    }
    toggleMute()
  }, [isYouTubeVideo, ytPlayerReady, isMuted, ytPlayer, toggleMute])

  // Handler para cambiar velocidad de reproducción
  const handleSetPlaybackRate = useCallback((rate: number) => {
    if (isYouTubeVideo && ytPlayerReady) {
      ytPlayer.setPlaybackRate(rate)
    }
    setPlaybackRate(rate)
  }, [isYouTubeVideo, ytPlayerReady, ytPlayer, setPlaybackRate])

  // ===========================================================================
  // COMPONENTE DE VIDEO YOUTUBE
  // ===========================================================================

  // Ref para el contenedor del video
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Thumbnail URL de YouTube
  const ytThumbnailUrl = youTubeVideoId 
    ? `https://i.ytimg.com/vi/${youTubeVideoId}/maxresdefault.jpg`
    : null

  // Estado para el drag en fullscreen mobile
  const [fullscreenDragOffset, setFullscreenDragOffset] = useState({ x: 0, y: 0 })
  const [isDraggingFullscreen, setIsDraggingFullscreen] = useState(false)
  
  // Estado para mostrar prompt de fullscreen nativo cuando se gira a landscape
  const [showNativeFullscreenPrompt, setShowNativeFullscreenPrompt] = useState(false)

  // Handler para cuando se hace clic en el video (entrar en fullscreen)
  const handleVideoClick = useCallback(() => {
    if (!isVideoFullscreen) {
      setIsVideoFullscreen(true)
    }
  }, [isVideoFullscreen])

  // Activar fullscreen nativo del iframe de YouTube
  const activateNativeFullscreen = useCallback(() => {
    const iframe = ytPlayer.getIframe()
    if (iframe) {
      // Intentar activar fullscreen nativo del iframe
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen().catch(() => {
          // Si falla, al menos ocultamos el prompt
          setShowNativeFullscreenPrompt(false)
        })
      } else if ((iframe as any).webkitRequestFullscreen) {
        (iframe as any).webkitRequestFullscreen()
      } else if ((iframe as any).webkitEnterFullscreen) {
        // Para iOS Safari
        (iframe as any).webkitEnterFullscreen()
      }
    }
    setShowNativeFullscreenPrompt(false)
  }, [ytPlayer])

  // Salir de fullscreen
  const exitFullscreen = useCallback(() => {
    setIsVideoFullscreen(false)
    setShowNativeFullscreenPrompt(false)
  }, [])

  // Auto-fullscreen CSS cuando se gira a landscape en mobile mientras se reproduce
  useEffect(() => {
    if (!isMobile || !showVideo || !isYouTubeVideo) return

    let lastWidth = window.innerWidth
    let lastHeight = window.innerHeight

    const handleOrientationChange = () => {
      // Pequeño delay para que las dimensiones se actualicen
      setTimeout(() => {
        const newWidth = window.innerWidth
        const newHeight = window.innerHeight
        const wasLandscape = lastWidth > lastHeight
        const isNowLandscape = newWidth > newHeight
        
        lastWidth = newWidth
        lastHeight = newHeight

        // Si giró a landscape y el video está reproduciéndose, mostrar prompt para fullscreen nativo
        if (!wasLandscape && isNowLandscape && !isVideoFullscreen) {
          setIsVideoFullscreen(true)
          // Mostrar el prompt para activar fullscreen nativo
          setShowNativeFullscreenPrompt(true)
          // Ocultar el prompt automáticamente después de 3 segundos
          setTimeout(() => {
            setShowNativeFullscreenPrompt(false)
          }, 3000)
        }
        // Si giró a portrait y estaba en fullscreen landscape, salir de fullscreen
        else if (wasLandscape && !isNowLandscape && isVideoFullscreen) {
          setIsVideoFullscreen(false)
          setShowNativeFullscreenPrompt(false)
        }
      }, 150)
    }

    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)
    
    // También escuchar screen.orientation si está disponible
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange)
    }
    
    return () => {
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange)
      }
    }
  }, [isMobile, showVideo, isYouTubeVideo, isVideoFullscreen])

  // Renderizar el reproductor de YouTube o thumbnail
  const renderYouTubePlayer = (size: 'mobile' | 'desktop') => {
    if (!isYouTubeVideo || !youTubeVideoId) return null

    const isFullscreenMobile = isMobile && isVideoFullscreen
    const isFullscreenDesktop = !isMobile && isVideoFullscreen

    // En desktop
    if (!isMobile) {
      return (
        <>
          {/* Backdrop para fullscreen en desktop */}
          <AnimatePresence>
            {isFullscreenDesktop && (
              <motion.div 
                className="fixed inset-0 z-[199] bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={exitFullscreen}
              />
            )}
          </AnimatePresence>

          {/* Contenedor del video */}
          <div 
            ref={videoContainerRef}
            className={`bg-black overflow-hidden transition-all duration-300 ease-out ${
              isFullscreenDesktop
                ? 'fixed inset-0 z-[200] rounded-none'
                : 'relative rounded-2xl w-full max-w-[480px] cursor-pointer'
            }`}
            style={{ aspectRatio: isFullscreenDesktop ? undefined : '16/9' }}
          >
            {/* Thumbnail con botón de play (cuando no está mostrando el video) */}
            {!showVideo && (
              <div 
                className="absolute inset-0 cursor-pointer group"
                onClick={() => {
                  setShowVideo(true)
                  setTimeout(() => {
                    if (ytPlayerReady) ytPlayer.play()
                  }, 1000)
                }}
              >
                <img
                  src={ytThumbnailUrl || displayEpisode?.image_url || ''}
                  alt={displayEpisode?.title || 'Video'}
                  className="w-full h-full object-cover rounded-2xl"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    if (target.src.includes('maxresdefault')) {
                      target.src = `https://i.ytimg.com/vi/${youTubeVideoId}/hqdefault.jpg`
                    }
                  }}
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors rounded-2xl" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="h-8 w-8 md:h-10 md:w-10 text-red-600 ml-1" fill="currentColor" />
                  </div>
                </div>
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
                  <Youtube className="h-3 w-3" />
                  YouTube
                </div>
              </div>
            )}

            {/* Capa clickeable para entrar en fullscreen */}
            {showVideo && !isFullscreenDesktop && (
              <div 
                className="absolute inset-0 z-[5] cursor-pointer"
                onClick={handleVideoClick}
              />
            )}

            <div 
              id={ytContainerId}
              className={`absolute inset-0 ${showVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'} [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:inset-0`}
              style={{ width: '100%', height: '100%' }}
            />

            {/* Botón para salir de fullscreen */}
            {showVideo && isFullscreenDesktop && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white z-10"
                onClick={exitFullscreen}
              >
                <Minimize2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </>
      )
    }

    // En mobile
    return (
      <>
        {/* Backdrop para fullscreen en mobile */}
        <AnimatePresence>
          {isFullscreenMobile && (
            <motion.div 
              className={`fixed inset-0 z-[199] ${
                isLandscape ? 'bg-black' : 'bg-black/90 backdrop-blur-xl'
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={exitFullscreen}
            />
          )}
        </AnimatePresence>

        {/* Contenedor del video - cambia de posición relative a fixed según fullscreen */}
        <div 
          ref={videoContainerRef}
          className={`bg-black overflow-hidden ${
            isFullscreenMobile
              ? `fixed z-[200] ${isLandscape ? 'inset-0' : 'left-4 right-4 top-1/2 -translate-y-1/2 rounded-xl'}`
              : 'relative rounded-2xl w-full max-w-[320px] mx-auto'
          }`}
          style={{ 
            aspectRatio: isFullscreenMobile && isLandscape ? undefined : '16/9',
            transition: 'all 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            transform: isFullscreenMobile 
              ? (isLandscape 
                  ? `translate(${fullscreenDragOffset.x}px, ${fullscreenDragOffset.y}px) scale(${isDraggingFullscreen ? 0.95 : 1})`
                  : `translate(${fullscreenDragOffset.x}px, calc(-50% + ${fullscreenDragOffset.y}px)) scale(${isDraggingFullscreen ? 0.95 : 1})`)
              : undefined,
          }}
        >
          {/* Thumbnail con botón de play (cuando no está mostrando el video) */}
          {!showVideo && (
            <div 
              className="absolute inset-0 cursor-pointer group"
              onClick={() => {
                setShowVideo(true)
                setTimeout(() => {
                  if (ytPlayerReady) ytPlayer.play()
                }, 1000)
              }}
            >
              <img
                src={ytThumbnailUrl || displayEpisode?.image_url || ''}
                alt={displayEpisode?.title || 'Video'}
                className="w-full h-full object-cover rounded-2xl"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (target.src.includes('maxresdefault')) {
                    target.src = `https://i.ytimg.com/vi/${youTubeVideoId}/hqdefault.jpg`
                  }
                }}
              />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors rounded-2xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="h-8 w-8 text-red-600 ml-1" fill="currentColor" />
                </div>
              </div>
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
                <Youtube className="h-3 w-3" />
                YouTube
              </div>
            </div>
          )}

          {/* Capa para gestos de drag (solo en fullscreen mobile) */}
          {showVideo && isFullscreenMobile && (
            <motion.div 
              className="absolute inset-0 z-[5]"
              drag
              dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
              dragElastic={0.5}
              onDragStart={() => setIsDraggingFullscreen(true)}
              onDrag={(_, info) => {
                setFullscreenDragOffset({ x: info.offset.x, y: info.offset.y })
              }}
              onDragEnd={(_, info) => {
                setIsDraggingFullscreen(false)
                setFullscreenDragOffset({ x: 0, y: 0 })
                const threshold = 100
                if (Math.abs(info.offset.x) > threshold || Math.abs(info.offset.y) > threshold) {
                  exitFullscreen()
                }
              }}
            />
          )}

          {/* Capa clickeable para entrar en fullscreen (solo cuando no está en fullscreen) */}
          {showVideo && !isFullscreenMobile && (
            <div 
              className="absolute inset-0 z-[5] cursor-pointer"
              onClick={handleVideoClick}
            />
          )}

          {/* Contenedor para el iframe de YouTube */}
          <div 
            id={ytContainerId}
            className={`absolute inset-0 ${showVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'} [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:inset-0`}
            style={{ width: '100%', height: '100%' }}
          />

          {/* Botón para salir de fullscreen (solo visible en fullscreen mobile) */}
          {showVideo && isFullscreenMobile && (
            <Button
              variant="ghost"
              size="icon"
              className={`absolute bg-black/50 hover:bg-black/70 text-white z-10 ${
                isLandscape ? 'top-4 right-4' : 'top-2 right-2'
              }`}
              onClick={exitFullscreen}
            >
              <Minimize2 className={isLandscape ? 'h-6 w-6' : 'h-4 w-4'} />
            </Button>
          )}

          {/* Prompt para activar fullscreen nativo cuando se gira a landscape */}
          <AnimatePresence>
            {showVideo && isFullscreenMobile && isLandscape && showNativeFullscreenPrompt && (
              <motion.div
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <motion.button
                  className="flex flex-col items-center gap-3 px-8 py-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.1 }}
                  onClick={activateNativeFullscreen}
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                    <Maximize2 className="h-8 w-8 text-white" />
                  </div>
                  <span className="text-white font-medium text-lg">Pantalla completa</span>
                  <span className="text-white/60 text-sm">Toca para activar</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </>
    )
  }

  const handleSelectEpisode = (ep: PodcastEpisode) => {
    // Cargar el nuevo episodio (sin auto-reproducir)
    loadEpisode(ep)
    
    // En mobile, cambiar a la pestaña del reproductor
    if (isMobile) {
      setActiveTab("player")
    }
    
    // Hacer scroll al episodio después de que se actualice el DOM
    setTimeout(() => {
      const ref = episodeRefs.current.get(ep.id)
      if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  if (!displayEpisode) return null

  // ===========================================================================
  // MOBILE LAYOUT
  // ===========================================================================
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="podcast-viewer-mobile"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ 
              opacity: 1, 
              y: dragY,
              transition: { type: "spring", damping: 30, stiffness: 300 }
            }}
            exit={{ opacity: 0, y: "100%" }}
            drag={isSliderDragging ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragStart={handleDragStart}
            onDrag={(_, info) => {
              if (!isSliderDragging && info.offset.y > 0) {
                setDragY(info.offset.y)
              }
            }}
            onDragEnd={handleDragEnd}
            className="fixed inset-x-0 top-0 z-50 bg-black overflow-hidden"
            style={{
              background: bgGradient,
              height: '100dvh',
              minHeight: '-webkit-fill-available',
              // Padding para safe areas en dispositivos con notch
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Drag indicator - posicionado respetando safe area */}
            <div className="absolute left-0 right-0 flex justify-center" style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}>
              <div className="w-10 h-1 bg-white/30 rounded-full" />
            </div>

            {/* Close button - minimiza al mini-reproductor, respetando safe area */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-10 text-white hover:bg-white/20"
              style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
              onClick={handleMinimize}
            >
              <ChevronDown className="h-6 w-6" />
            </Button>

            {/* Tabs - ajustar padding top para respetar safe area */}
            <Tabs 
              value={activeTab} 
              onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              className="h-full flex flex-col overflow-hidden px-8 podcast-tabs-offset"
            >
              <TabsList className="mx-auto bg-white/10 border-0 w-full max-w-md">
                <TabsTrigger value="player" className="flex-1 data-[state=active]:bg-white/20 text-white">
                  <Headphones className="h-4 w-4 mr-2" />
                  Reproductor
                </TabsTrigger>
                <TabsTrigger value="description" className="flex-1 data-[state=active]:bg-white/20 text-white">
                  <FileText className="h-4 w-4 mr-2" />
                  Notas
                </TabsTrigger>
                <TabsTrigger value="episodes" className="flex-1 data-[state=active]:bg-white/20 text-white">
                  <ListMusic className="h-4 w-4 mr-2" />
                  Episodios
                </TabsTrigger>
              </TabsList>

              {/* Player Tab - forceMount para que el player de YouTube no se destruya al cambiar de tab */}
              <TabsContent 
                value="player" 
                className="flex-1 flex flex-col justify-center pb-8 data-[state=inactive]:hidden"
                forceMount
              >
                {/* Artwork / YouTube Video */}
                {isYouTubeVideo && youTubeVideoId ? (
                  // Para YouTube, NO usar motion.div con animación para evitar problemas con el iframe
                  <div className="mx-auto shadow-2xl mb-8 w-full max-w-[320px]">
                    {renderYouTubePlayer('mobile')}
                  </div>
                ) : (
                  <motion.div 
                    className="mx-auto shadow-2xl mb-8 rounded-2xl overflow-hidden aspect-square max-w-[280px]"
                    animate={{ scale: isPlaying ? 1 : 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    {displayEpisode.image_url ? (
                      <img
                        src={displayEpisode.image_url}
                        alt={displayEpisode.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <Headphones className="h-20 w-20 text-white/50" />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Title & Author */}
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white mb-1 line-clamp-2">
                    {displayEpisode.title}
                  </h2>
                  <p className="text-white/60 text-sm">
                    {displayEpisode.author || source?.title || "Podcast"}
                  </p>
                </div>

                {/* Progress Bar - Apple Music style */}
                <div className="mb-4">
                  <TouchProgressSlider
                    value={currentTime}
                    max={effectiveDuration || 100}
                    onChange={handleSeek}
                    onDraggingChange={handleSliderDraggingChange}
                    timestamps={{
                      current: formatTime(currentTime),
                      total: formatTime(effectiveDuration)
                    }}
                    clipSegment={typeof episode?.clip_start_seconds === 'number' && typeof episode?.clip_end_seconds === 'number' && hasDuration
                      ? { start: episode.clip_start_seconds, end: episode.clip_end_seconds }
                      : null
                    }
                  />
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-8">
                  {/* -10s */}
                  <button
                    className="relative text-white/70 hover:text-white transition-colors active:scale-95"
                    onClick={() => handleSeekBackward(10)}
                  >
                    <RotateCcw className="h-7 w-7" strokeWidth={1.5} />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold mt-0.5">10</span>
                  </button>

                  {/* Play/Pause */}
                  <button
                    className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95 disabled:opacity-50"
                    onClick={handlePlayPause}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-7 w-7" strokeWidth={1.5} />
                    ) : (
                      <Play className="h-7 w-7 ml-1" strokeWidth={1.5} />
                    )}
                  </button>

                  {/* +10s */}
                  <button
                    className="relative text-white/70 hover:text-white transition-colors active:scale-95"
                    onClick={() => handleSeekForward(10)}
                  >
                    <RotateCw className="h-7 w-7" strokeWidth={1.5} />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold mt-0.5">10</span>
                  </button>
                </div>

                {/* Secondary Controls */}
                <div className="flex items-center justify-center gap-8 mt-6">
                  {/* Playback Rate */}
                  <button
                    className="text-white/50 hover:text-white text-sm font-medium transition-colors"
                    onClick={() => {
                      const currentIndex = playbackRates.indexOf(playbackRate)
                      const nextIndex = (currentIndex + 1) % playbackRates.length
                      handleSetPlaybackRate(playbackRates[nextIndex])
                    }}
                  >
                    {playbackRate}x
                  </button>

                  {/* Volume */}
                  <button
                    className="text-white/50 hover:text-white transition-colors"
                    onClick={handleToggleMute}
                  >
                    {isMuted ? (
                      <VolumeX className="h-5 w-5" strokeWidth={1.5} />
                    ) : (
                      <Volume2 className="h-5 w-5" strokeWidth={1.5} />
                    )}
                  </button>

                  {/* Save/Bookmark */}
                  {isSaved ? (
                    <button
                      className="text-primary hover:text-primary/80 transition-colors"
                      onClick={handleToggleArchive}
                      title="Quitar de guardados"
                    >
                      <BookmarkCheck className="h-5 w-5" strokeWidth={1.5} />
                    </button>
                  ) : (
                    <FolderPicker
                      selectedFolderId={currentFolderId}
                      onSelect={handleSaveToFolder}
                      trigger={
                        <button
                          className="text-white/50 hover:text-white transition-colors"
                          disabled={savingToFolder}
                          title="Guardar podcast"
                        >
                          {savingToFolder ? (
                            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <Bookmark className="h-5 w-5" strokeWidth={1.5} />
                          )}
                        </button>
                      }
                    />
                  )}

                  {/* Clip - Marcar sección */}
                  <button
                    className={`transition-colors ${isClipMode ? 'text-orange-400 hover:text-orange-300' : 'text-white/50 hover:text-white'}`}
                    onClick={() => {
                      if (isClipMode) {
                        handleClearClip()
                      } else {
                        handleSetClipStart()
                      }
                    }}
                    title={isClipMode ? "Cancelar clip" : "Marcar inicio de clip"}
                  >
                    <Scissors className="h-5 w-5" strokeWidth={1.5} />
                  </button>

                  {/* Share */}
                  <button
                    className="text-white/50 hover:text-white transition-colors"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: displayEpisode.title,
                          url: displayEpisode.url,
                        })
                      }
                    }}
                  >
                    <Share className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Indicador de clip activo */}
                {isClipMode && (
                  <div className="mt-2 p-2 rounded-lg bg-orange-500/20 border border-orange-500/30">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-orange-300">
                        Clip: {formatTime(clipStart || 0)} - {clipEnd ? formatTime(clipEnd) : 'En curso'}
                      </span>
                      <div className="flex gap-2">
                        {!clipEnd && (
                          <button
                            className="text-orange-300 hover:text-orange-200 text-xs underline"
                            onClick={handleSetClipEnd}
                          >
                            Marcar fin
                          </button>
                        )}
                        <FolderPicker
                          selectedFolderId={currentFolderId}
                          onSelect={handleSaveClip}
                          trigger={
                            <button
                              className="text-orange-300 hover:text-orange-200 text-xs underline"
                              disabled={savingToFolder}
                            >
                              {savingToFolder ? 'Guardando...' : 'Guardar clip'}
                            </button>
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Description Tab - Solo notas del episodio */}
              <TabsContent value="description" className="flex-1 min-h-0 overflow-hidden pb-8 mt-0 data-[state=inactive]:hidden">
                <div className="h-full rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 overflow-hidden">
                  <div className="h-full overflow-y-auto overflow-x-hidden p-4" key={currentEpisode?.id || 'no-episode'}>
                    <div className="space-y-4">
                      {/* Episode info + Actions */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-white/80 text-sm flex-wrap">
                          {currentEpisode?.published_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(currentEpisode.published_at).toLocaleDateString()}
                            </span>
                          )}
                          {currentEpisode?.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {formatTime(currentEpisode.duration)}
                            </span>
                          )}
                          {currentEpisode?.season_number && (
                            <Badge variant="outline" className="border-white/20 text-white/60">
                              T{currentEpisode.season_number}
                            </Badge>
                          )}
                          {currentEpisode?.episode_number && (
                            <Badge variant="outline" className="border-white/20 text-white/60">
                              Ep. {currentEpisode.episode_number}
                            </Badge>
                          )}
                        </div>

                        {/* Actions - ahora debajo de la info */}
                        <div className="flex gap-2">
                          {/* Save Button */}
                          {isSaved ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="bg-primary/20 text-primary hover:bg-primary/30 border-0"
                              onClick={handleToggleArchive}
                            >
                              <BookmarkCheck className="h-4 w-4 mr-2" />
                              Guardado
                            </Button>
                          ) : (
                            <FolderPicker
                              selectedFolderId={currentFolderId}
                              onSelect={handleSaveToFolder}
                              trigger={
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="bg-white/20 text-white hover:bg-white/30 border-0"
                                  disabled={savingToFolder}
                                >
                                  {savingToFolder ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Bookmark className="h-4 w-4 mr-2" />
                                  )}
                                  Guardar
                                </Button>
                              }
                            />
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white/20 text-white hover:bg-white/30 border-0"
                            onClick={() => currentEpisode?.url && window.open(currentEpisode.url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Web
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white/20 text-white hover:bg-white/30 border-0"
                            onClick={() => {
                              if (navigator.share && currentEpisode) {
                                navigator.share({
                                  title: currentEpisode.title,
                                  url: currentEpisode.url,
                                })
                              }
                            }}
                          >
                            <Share className="h-4 w-4 mr-2" />
                            Compartir
                          </Button>
                        </div>
                      </div>

                      <Separator className="bg-white/20" />

                      {/* Show Notes */}
                      <div className="flex-1 min-h-0">
                        <h3 className="text-white font-semibold mb-3">Notas del episodio</h3>
                        <div 
                          className="text-white/90 text-sm leading-relaxed break-words [&_a]:text-indigo-300 [&_a]:underline [&_a]:break-all [&_p]:mb-3 [&_br]:block [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:my-1 [&_pre]:overflow-x-auto [&_pre]:bg-black/30 [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_code]:text-xs [&_code]:bg-black/30 [&_code]:px-1 [&_code]:rounded [&_img]:max-w-full [&_img]:rounded [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mb-2 [&_h3]:mt-2 [&_strong]:font-semibold [&_em]:italic"
                          dangerouslySetInnerHTML={{ __html: currentEpisode?.show_notes || currentEpisode?.description || "Sin notas disponibles." }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Episodes Tab */}
              <TabsContent value="episodes" className="flex-1 min-h-0 overflow-hidden pb-8 mt-0 data-[state=inactive]:hidden">
                <div className="h-full rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 overflow-hidden">
                  <div className="h-full overflow-y-auto p-4">
                    <div className="space-y-2">
                      {episodes.length === 0 ? (
                        <p className="text-white/60 text-center py-8">
                          No hay más episodios disponibles.
                        </p>
                      ) : (
                        episodes.map((ep, index) => (
                          <div
                            key={ep.id && ep.id.length > 0 ? ep.id : `episode-mobile-${index}`}
                            ref={(el) => {
                              if (el) episodeRefs.current.set(ep.id, el)
                              else episodeRefs.current.delete(ep.id)
                            }}
                            className={`p-3 rounded-xl cursor-pointer transition-all ${
                              ep.id === currentEpisode?.id
                                ? 'bg-white/30 border border-white/40'
                                : 'bg-white/10 border border-white/20 hover:bg-white/20'
                            }`}
                            onClick={() => handleSelectEpisode(ep)}
                          >
                            <div className="flex items-center gap-3">
                              {/* Mini artwork */}
                              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/10">
                                {ep.image_url ? (
                                  <img
                                    src={ep.image_url}
                                    alt={ep.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Headphones className="h-5 w-5 text-white/50" />
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium line-clamp-2">
                                  {ep.title}
                                </p>
                                <p className="text-white/60 text-xs mt-0.5">
                                  {ep.duration && formatTime(ep.duration)}
                                  {ep.published_at && ` • ${new Date(ep.published_at).toLocaleDateString()}`}
                                </p>
                              </div>

                              {/* Playing indicator */}
                              {ep.id === currentEpisode?.id && isPlaying && (
                                <div className="w-4 h-4 flex items-center justify-center gap-0.5 shrink-0">
                                  {[...Array(3)].map((_, i) => (
                                    <motion.div
                                      key={`mobile-bar-${i}`}
                                      className="w-1 bg-white rounded-full"
                                      animate={{ height: [4, 12, 4] }}
                                      transition={{
                                        duration: 0.5,
                                        repeat: Infinity,
                                        delay: i * 0.15,
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // ===========================================================================
  // DESKTOP LAYOUT
  // ===========================================================================
  return (
    <AnimatePresence>
      {isOpen && (
        <div key="podcast-viewer-desktop-container">
          {/* Backdrop - solo cierra el viewer, no minimiza */}
          <motion.div
            key="podcast-viewer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Player Modal */}
          <motion.div
            key="podcast-viewer-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-8 z-50 rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: bgGradient }}
          >
            {/* Close button - solo cierra el viewer, no minimiza */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Minimize button - minimiza a mini player y cierra el viewer */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-14 z-10 text-white hover:bg-white/20"
              onClick={handleMinimize}
            >
              <Minimize2 className="h-5 w-5" />
            </Button>

            <div className="h-full grid grid-cols-2 gap-8 p-8">
              {/* Left Column - Player */}
              <div className="flex flex-col items-center justify-center">
                {/* Artwork / YouTube Video */}
                {isYouTubeVideo && youTubeVideoId ? (
                  // Para YouTube, NO usar motion.div con animación para evitar problemas con el iframe
                  <div className="shadow-2xl mb-8 w-full max-w-[480px]">
                    {renderYouTubePlayer('desktop')}
                  </div>
                ) : (
                  <motion.div 
                    className="shadow-2xl mb-8 rounded-2xl overflow-hidden w-80 h-80"
                    animate={{ scale: isPlaying ? 1 : 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    {displayEpisode.image_url ? (
                      <img
                        src={displayEpisode.image_url}
                        alt={displayEpisode.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <Headphones className="h-24 w-24 text-white/50" />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Title & Author */}
                <div className="text-center mb-6 max-w-md">
                  <h2 className="text-2xl font-bold text-white mb-2 line-clamp-2">
                    {displayEpisode.title}
                  </h2>
                  <p className="text-white/60">
                    {displayEpisode.author || source?.title || "Podcast"}
                  </p>
                </div>

                {/* Progress Bar - Desktop con Slider clásico */}
                <div className="w-full max-w-md mb-6">
                  <div className="group relative h-2">
                    {/* Track de fondo (gris) */}
                    <div className="absolute inset-0 rounded-full bg-white/20" />
                    
                    {/* Progress actual (blanco) - z-10 */}
                    <div 
                      className="absolute top-0 bottom-0 left-0 rounded-full bg-white z-10"
                      style={{ width: `${hasDuration ? (currentTime / effectiveDuration) * 100 : 0}%` }}
                    />
                    
                    {/* Indicador de clip guardado (naranja) - z-20 para estar sobre el progreso */}
                    {typeof episode?.clip_start_seconds === 'number' && typeof episode?.clip_end_seconds === 'number' && hasDuration && (
                      <div 
                        className="absolute top-0 bottom-0 rounded-full z-20"
                        style={{
                          left: `${(episode.clip_start_seconds / effectiveDuration) * 100}%`,
                          // Asegurar un ancho mínimo visible de 0.5% (aproximadamente 2px en una barra de 400px)
                          width: `${Math.max(((episode.clip_end_seconds - episode.clip_start_seconds) / effectiveDuration) * 100, 0.5)}%`,
                          backgroundColor: '#F7831B'
                        }}
                      />
                    )}
                    
                    {/* Área interactiva transparente para seek - z-30 para estar sobre todo */}
                    <input
                      type="range"
                      min={0}
                      max={effectiveDuration || 100}
                      value={currentTime}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                    />
                    
                    {/* Thumb visual - solo visible en hover/focus del grupo, z-30 */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg pointer-events-none z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                      style={{ left: `calc(${hasDuration ? (currentTime / effectiveDuration) * 100 : 0}% - 8px)` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-white/60 mt-3">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(effectiveDuration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-10">
                  {/* -10s */}
                  <button
                    className="relative text-white/70 hover:text-white transition-colors active:scale-95"
                    onClick={() => handleSeekBackward(10)}
                  >
                    <RotateCcw className="h-8 w-8" strokeWidth={1.5} />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold mt-0.5">10</span>
                  </button>

                  {/* Play/Pause */}
                  <button
                    className="h-20 w-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95 disabled:opacity-50"
                    onClick={handlePlayPause}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-9 w-9" strokeWidth={1.5} />
                    ) : (
                      <Play className="h-9 w-9 ml-1" strokeWidth={1.5} />
                    )}
                  </button>

                  {/* +10s */}
                  <button
                    className="relative text-white/70 hover:text-white transition-colors active:scale-95"
                    onClick={() => handleSeekForward(10)}
                  >
                    <RotateCw className="h-8 w-8" strokeWidth={1.5} />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold mt-0.5">10</span>
                  </button>
                </div>

                {/* Secondary Controls */}
                <div className="flex items-center justify-center gap-6 mt-6">
                  {/* Playback Rate */}
                  <button
                    className="text-white/50 hover:text-white text-sm font-medium transition-colors min-w-12"
                    onClick={() => {
                      const currentIndex = playbackRates.indexOf(playbackRate)
                      const nextIndex = (currentIndex + 1) % playbackRates.length
                      handleSetPlaybackRate(playbackRates[nextIndex])
                    }}
                  >
                    {playbackRate}x
                  </button>

                  {/* Volume slider */}
                  <div className="flex items-center gap-3">
                    <button
                      className="text-white/50 hover:text-white transition-colors"
                      onClick={handleToggleMute}
                    >
                      {isMuted ? (
                        <VolumeX className="h-5 w-5" strokeWidth={1.5} />
                      ) : (
                        <Volume2 className="h-5 w-5" strokeWidth={1.5} />
                      )}
                    </button>
                    <Slider
                      value={[isMuted ? 0 : volume * 100]}
                      max={100}
                      step={1}
                      onValueChange={([value]) => handleVolumeChange(value / 100)}
                      className="w-24 cursor-pointer"
                    />
                  </div>

                  {/* Save/Bookmark */}
                  {isSaved ? (
                    <button
                      className="text-primary hover:text-primary/80 transition-colors"
                      onClick={handleToggleArchive}
                      title="Quitar de guardados"
                    >
                      <BookmarkCheck className="h-5 w-5" strokeWidth={1.5} />
                    </button>
                  ) : (
                    <FolderPicker
                      selectedFolderId={currentFolderId}
                      onSelect={handleSaveToFolder}
                      trigger={
                        <button
                          className="text-white/50 hover:text-white transition-colors"
                          disabled={savingToFolder}
                          title="Guardar"
                        >
                          {savingToFolder ? (
                            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <Bookmark className="h-5 w-5" strokeWidth={1.5} />
                          )}
                        </button>
                      }
                    />
                  )}

                  {/* Clip - Marcar sección */}
                  <button
                    className={`transition-colors ${isClipMode ? 'text-orange-400 hover:text-orange-300' : 'text-white/50 hover:text-white'}`}
                    onClick={() => {
                      if (isClipMode) {
                        handleClearClip()
                      } else {
                        handleSetClipStart()
                      }
                    }}
                    title={isClipMode ? "Cancelar clip" : "Marcar inicio de clip"}
                  >
                    <Scissors className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Indicador de clip activo - Desktop */}
                {isClipMode && (
                  <div className="mt-4 p-3 rounded-lg bg-orange-500/20 border border-orange-500/30 max-w-md mx-auto">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-orange-300">
                        Clip: {formatTime(clipStart || 0)} - {clipEnd ? formatTime(clipEnd) : 'En curso'}
                      </span>
                      <div className="flex gap-3">
                        {!clipEnd && (
                          <button
                            className="text-orange-300 hover:text-orange-200 text-xs underline"
                            onClick={handleSetClipEnd}
                          >
                            Marcar fin
                          </button>
                        )}
                        <FolderPicker
                          selectedFolderId={currentFolderId}
                          onSelect={handleSaveClip}
                          trigger={
                            <button
                              className="text-orange-300 hover:text-orange-200 text-xs underline"
                              disabled={savingToFolder}
                            >
                              {savingToFolder ? 'Guardando...' : 'Guardar clip'}
                            </button>
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Tabs */}
              <div className="flex flex-col h-full min-h-0 overflow-hidden">
                <Tabs defaultValue="description" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <TabsList className="bg-white/10 border-0 mb-4 shrink-0">
                    <TabsTrigger value="description" className="data-[state=active]:bg-white/20 text-white">
                      <FileText className="h-4 w-4 mr-2" />
                      Notas
                    </TabsTrigger>
                    <TabsTrigger value="episodes" className="data-[state=active]:bg-white/20 text-white">
                      <ListMusic className="h-4 w-4 mr-2" />
                      Episodios ({episodes.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Description Tab - Solo notas del episodio */}
                  <TabsContent value="description" className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden">
                    <div className="h-full rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 overflow-hidden">
                      <div className="h-full overflow-y-auto overflow-x-hidden p-4" key={currentEpisode?.id || 'no-episode'}>
                        <div className="space-y-4">
                          {/* Episode info + Actions */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-white/80 text-sm flex-wrap">
                              {currentEpisode?.published_at && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {new Date(currentEpisode.published_at).toLocaleDateString()}
                                </span>
                              )}
                              {currentEpisode?.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {formatTime(currentEpisode.duration)}
                                </span>
                              )}
                              {currentEpisode?.season_number && (
                                <Badge variant="outline" className="border-white/20 text-white/60">
                                  T{currentEpisode.season_number}
                                </Badge>
                              )}
                              {currentEpisode?.episode_number && (
                                <Badge variant="outline" className="border-white/20 text-white/60">
                                  Ep. {currentEpisode.episode_number}
                                </Badge>
                              )}
                            </div>

                            {/* Actions - ahora debajo de la info */}
                            <div className="flex gap-2">
                              {/* Save Button */}
                              {isSaved ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="bg-primary/20 text-primary hover:bg-primary/30 border-0"
                                  onClick={handleToggleArchive}
                                >
                                  <BookmarkCheck className="h-4 w-4 mr-2" />
                                  Guardado
                                </Button>
                              ) : (
                                <FolderPicker
                                  selectedFolderId={currentFolderId}
                                  onSelect={handleSaveToFolder}
                                  trigger={
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="bg-white/20 text-white hover:bg-white/30 border-0"
                                      disabled={savingToFolder}
                                    >
                                      {savingToFolder ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      ) : (
                                        <Bookmark className="h-4 w-4 mr-2" />
                                      )}
                                      Guardar
                                    </Button>
                                  }
                                />
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                className="bg-white/20 text-white hover:bg-white/30 border-0"
                                onClick={() => currentEpisode?.url && window.open(currentEpisode.url, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Web
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="bg-white/20 text-white hover:bg-white/30 border-0"
                                onClick={() => {
                                  if (navigator.share && currentEpisode) {
                                    navigator.share({
                                      title: currentEpisode.title,
                                      url: currentEpisode.url,
                                    })
                                  }
                                }}
                              >
                                <Share className="h-4 w-4 mr-2" />
                                Compartir
                              </Button>
                            </div>
                          </div>

                          <Separator className="bg-white/20" />

                          {/* Show Notes - Solo notas, sin descripción separada */}
                          <div className="flex-1 min-h-0">
                            <h3 className="text-white font-semibold mb-3">Notas del episodio</h3>
                            <div 
                              className="text-white/90 text-sm leading-relaxed break-words [&_a]:text-indigo-300 [&_a]:underline [&_a]:break-all [&_p]:mb-3 [&_br]:block [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:my-1 [&_pre]:overflow-x-auto [&_pre]:bg-black/30 [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_code]:text-xs [&_code]:bg-black/30 [&_code]:px-1 [&_code]:rounded [&_img]:max-w-full [&_img]:rounded [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mb-2 [&_h3]:mt-2 [&_strong]:font-semibold [&_em]:italic"
                              dangerouslySetInnerHTML={{ __html: currentEpisode?.show_notes || currentEpisode?.description || "Sin notas disponibles." }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Episodes Tab */}
                  <TabsContent value="episodes" className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden">
                    <div className="h-full rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 overflow-hidden">
                      <div className="h-full overflow-y-auto p-4">
                        <div className="space-y-2">
                          {episodes.length === 0 ? (
                            <p className="text-white/60 text-center py-8">
                              No hay más episodios disponibles.
                            </p>
                          ) : (
                            episodes.map((ep, index) => (
                              <div
                                key={ep.id && ep.id.length > 0 ? ep.id : `episode-desktop-${index}`}
                                ref={(el) => {
                                  if (el) episodeRefs.current.set(ep.id, el)
                                  else episodeRefs.current.delete(ep.id)
                                }}
                                className={`p-3 rounded-xl cursor-pointer transition-all ${
                                  ep.id === currentEpisode?.id
                                    ? 'bg-white/30 border border-white/40'
                                    : 'bg-white/10 border border-white/20 hover:bg-white/20'
                                }`}
                                onClick={() => handleSelectEpisode(ep)}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Mini artwork */}
                                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white/10">
                                    {ep.image_url ? (
                                      <img
                                        src={ep.image_url}
                                        alt={ep.title}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Headphones className="h-6 w-6 text-white/50" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium line-clamp-2">
                                      {ep.title}
                                    </p>
                                    <p className="text-white/60 text-sm mt-0.5">
                                      {ep.duration && formatTime(ep.duration)}
                                      {ep.published_at && ` • ${new Date(ep.published_at).toLocaleDateString()}`}
                                    </p>
                                  </div>

                                  {/* Playing indicator */}
                                  {ep.id === currentEpisode?.id && isPlaying && (
                                    <div className="w-5 h-5 flex items-center justify-center gap-0.5 shrink-0">
                                      {[...Array(3)].map((_, i) => (
                                        <motion.div
                                          key={`desktop-bar-${i}`}
                                          className="w-1 bg-white rounded-full"
                                          animate={{ height: [4, 14, 4] }}
                                          transition={{
                                            duration: 0.5,
                                            repeat: Infinity,
                                            delay: i * 0.15,
                                          }}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
