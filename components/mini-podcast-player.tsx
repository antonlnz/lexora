"use client"

import { motion, AnimatePresence } from "framer-motion"
import { 
  usePodcastPlayer, 
  formatTime, 
  calculateProgress 
} from "@/contexts/podcast-player-context"
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  X,
  Maximize2,
} from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { getBackgroundYouTubePlayer } from "./youtube-background-player"

export function MiniPodcastPlayer() {
  const {
    currentEpisode,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    isMinimized,
    isVisible,
    dominantColor,
    isYouTubeVideo,
    togglePlayPause,
    seekForward,
    seekBackward,
    maximize,
    close,
    updateFromYouTube,
  } = usePodcastPlayer()

  const isMobile = useIsMobile()

  // Solo mostrar si hay episodio y está minimizado
  if (!isVisible || !isMinimized || !currentEpisode) {
    return null
  }

  const progress = calculateProgress(currentTime, duration)
  
  // Color de fondo basado en el artwork
  const bgColor = dominantColor || 'rgb(79, 70, 229)' // Fallback a indigo
  const bgColorWithAlpha = dominantColor 
    ? dominantColor.replace('rgb', 'rgba').replace(')', ', 0.95)')
    : 'rgba(79, 70, 229, 0.95)'

  const handleExpand = () => {
    // Capturar si estaba reproduciendo ANTES de pausar el background player
    const wasPlaying = isPlaying
    
    // Pausar el background player de YouTube antes de maximizar para evitar audio doble
    if (isYouTubeVideo) {
      const bgPlayer = getBackgroundYouTubePlayer()
      bgPlayer?.pauseVideo()
    }
    
    // Si estaba reproduciendo, asegurarnos de que el estado se mantiene
    // para que el viewer lo auto-reproduzca cuando esté listo
    if (wasPlaying && isYouTubeVideo) {
      updateFromYouTube({ isPlaying: true })
    }
    
    // Llamar a maximize que también setea shouldOpenViewer
    maximize()
  }

  // Para videos de YouTube, usar el background player
  const handlePlayPause = () => {
    if (isYouTubeVideo) {
      const bgPlayer = getBackgroundYouTubePlayer()
      if (bgPlayer) {
        if (isPlaying) {
          bgPlayer.pauseVideo()
        } else {
          bgPlayer.playVideo()
          // Actualizar estado inmediatamente para feedback visual
          // El onStateChange confirmará cuando realmente empiece
          updateFromYouTube({ isPlaying: true })
        }
      } else {
        // Si no hay background player, expandir el viewer
        console.warn('Background player not ready, expanding viewer')
        updateFromYouTube({ isPlaying: true })
        maximize()
      }
    } else {
      togglePlayPause()
    }
  }

  // Para videos de YouTube, usar el background player para seek
  const handleSeekForward = () => {
    if (isYouTubeVideo) {
      const bgPlayer = getBackgroundYouTubePlayer()
      bgPlayer?.seekTo(currentTime + 10, true)
    } else {
      seekForward(10)
    }
  }

  const handleSeekBackward = () => {
    if (isYouTubeVideo) {
      const bgPlayer = getBackgroundYouTubePlayer()
      bgPlayer?.seekTo(Math.max(0, currentTime - 10), true)
    } else {
      seekBackward(10)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.9 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`fixed z-50 ${
          isMobile 
            ? 'left-4 right-4' 
            : 'bottom-6 left-1/2 -translate-x-1/2 max-w-md w-full mx-auto'
        }`}
        style={isMobile ? { 
          // Usar env(safe-area-inset-bottom) para adaptarse a la barra de Safari
          // Cuando la barra está expandida, safe-area es mayor; cuando se minimiza, es menor
          // Añadimos un pequeño margen base de 12px
          bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' 
        } : undefined}
        layoutId="podcast-player"
      >
        <motion.div
          className="rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
          style={{
            background: `linear-gradient(135deg, ${bgColorWithAlpha}, ${bgColorWithAlpha.replace('0.95', '0.85')})`,
            boxShadow: `0 20px 60px -15px ${bgColor.replace('rgb', 'rgba').replace(')', ', 0.4)')}`,
          }}
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          {/* Barra de progreso superior */}
          <div className="h-1 bg-white/20 relative overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-white"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          <div className="p-3 flex items-center gap-3">
            {/* Artwork */}
            <motion.div 
              className="w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-lg cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExpand}
              layoutId="podcast-artwork"
            >
              {currentEpisode.image_url ? (
                <img
                  src={currentEpisode.image_url}
                  alt={currentEpisode.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                  <Play className="h-6 w-6 text-white" />
                </div>
              )}
            </motion.div>

            {/* Info */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={handleExpand}>
              <p className="text-white font-medium text-sm truncate">
                {currentEpisode.title}
              </p>
              <p className="text-white/60 text-xs truncate">
                {formatTime(currentTime)} / {formatTime(duration)}
              </p>
            </div>

            {/* Controles */}
            <div className="flex items-center gap-2">
              {/* -10s */}
              <button
                className="h-8 w-8 flex items-center justify-center text-white/70 hover:text-white transition-colors active:scale-95"
                onClick={handleSeekBackward}
              >
                <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
              </button>

              {/* Play/Pause */}
              <button
                className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all active:scale-95 disabled:opacity-50"
                onClick={handlePlayPause}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" strokeWidth={1.5} />
                )}
              </button>

              {/* +10s */}
              <button
                className="h-8 w-8 flex items-center justify-center text-white/70 hover:text-white transition-colors active:scale-95"
                onClick={handleSeekForward}
              >
                <RotateCw className="h-4 w-4" strokeWidth={1.5} />
              </button>

              {/* Expand */}
              <button
                className="h-8 w-8 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                onClick={handleExpand}
              >
                <Maximize2 className="h-4 w-4" strokeWidth={1.5} />
              </button>

              {/* Close */}
              <button
                className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                onClick={close}
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
