"use client"

import { useEffect, useRef, useState, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import gsap from "gsap"
import { Flip } from "gsap/Flip"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AmbientBackground } from "@/components/ambient-background"
import { VideoAmbientBackground } from "@/components/video-ambient-background"
import { DynamicIsland } from "@/components/dynamic-island"
import { contentService, type ContentWithMetadata } from "@/lib/services/content-service"
import { useReaderSettings } from "@/hooks/use-reader-settings"
import {
  X,
  Bookmark,
  BookmarkCheck,
  Share,
  Play,
  Pause,
  Volume2,
  VolumeX,
  User,
  Clock,
  Maximize2,
  Download,
  ExternalLink,
  Eye,
  ThumbsUp,
} from "lucide-react"
import type { SourceType } from "@/types/database"
import { useIsMobile } from "@/hooks/use-mobile"
import { sanitizeHTML } from "@/lib/utils/security"
import {
  getSourceTypeIcon,
  getSourceTypeLabel,
  getSourceTypeColor,
  extractYouTubeVideoId,
  formatCount,
  formatDuration
} from "@/lib/content-type-config"

interface ContentViewerProps {
  content: ContentWithMetadata | null
  isOpen: boolean
  onClose: () => void
  cardPosition?: DOMRect | null
  onNavigateNext?: () => void
  onNavigatePrevious?: () => void
  hasNext?: boolean
  hasPrevious?: boolean
}

// Función para detectar si una URL es un video
function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.m4v']
  const lowerUrl = url.toLowerCase()
  return videoExtensions.some(ext => lowerUrl.includes(ext))
}

// Función para obtener el thumbnail de un video de YouTube
function getYouTubeThumbnail(url: string | null | undefined): string | null {
  if (!url) return null

  // Extraer el ID del video de YouTube
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /youtube\.com\/shorts\/([^&\?\/]+)/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      // Usar maxresdefault para mejor calidad, fallback a hqdefault
      return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`
    }
  }

  return null
}

// Función para extraer el ID de video de YouTube
function getYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /youtube\.com\/shorts\/([^&\?\/]+)/
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) return match[1]
  }
  return null
}

// Helper function to normalize article data from database
function normalizeContent(article: ContentWithMetadata) {
  // Determinar el autor según el tipo de contenido
  // Para YouTube el campo es channel_name, para RSS es author, para podcast es author
  const sourceType = article.source.source_type
  let author = 'Unknown'
  if (sourceType === 'youtube_channel' || sourceType === 'youtube_video') {
    // Para YouTube, el campo channel_name está en el artículo
    author = (article as any).channel_name || 'Unknown'
  } else if (sourceType === 'podcast') {
    author = (article as any).author || article.source.title || 'Unknown'
  } else {
    author = (article as any).author || 'Unknown'
  }

  // Determinar excerpt/descripción
  let excerpt = ''
  if (sourceType === 'youtube_channel' || sourceType === 'youtube_video') {
    excerpt = (article as any).description || ''
  } else {
    excerpt = (article as any).excerpt || ''
  }

  return {
    id: article.id,
    type: sourceType,
    title: article.title,
    excerpt,
    content: (article as any).content || '',
    source: article.source.title,
    author,
    publishedAt: article.published_at ? new Date(article.published_at).toLocaleDateString() : 'Unknown',
    url: article.url,
    readTime: (article as any).reading_time ? `${(article as any).reading_time} min read` : undefined,
    // Usar las nuevas columnas featured_media primero, fallback a image_url (legacy)
    image: (article as any).featured_media_type === 'image'
      ? ((article as any).featured_media_url || (article as any).image_url || '/placeholder.svg')
      : ((article as any).featured_thumbnail_url || (article as any).image_url || '/placeholder.svg'),
    isRead: article.user_content?.is_read || false,
    isSaved: article.user_content?.is_archived || false,
    folderId: article.user_content?.folder_id || null,
    // Datos de video: para YouTube usar article.url, para otros usar featured_media_url
    videoUrl: (sourceType === 'youtube_channel' || sourceType === 'youtube_video')
      ? article.url
      : ((article as any).featured_media_type === 'video' ? (article as any).featured_media_url : null),
    videoDuration: (article as any).duration || (article as any).featured_media_duration,
    viewCount: (article as any).view_count || null,
    likeCount: (article as any).like_count || null,
    mediaType: (article as any).featured_media_type,
    isYouTube: sourceType === 'youtube_channel' || sourceType === 'youtube_video',
    isPodcast: sourceType === 'podcast',
    // Campos específicos de podcast
    audioUrl: (article as any).audio_url || null,
    showNotes: (article as any).show_notes || null,
    episodeNumber: (article as any).episode_number || null,
    seasonNumber: (article as any).season_number || null,
    duration: (article as any).duration || null,
  }
}

// Componente unificado para mostrar el badge del tipo de fuente
function TypeBadge({ sourceType, className = "" }: { sourceType: SourceType; className?: string }) {
  const IconComponent = getSourceTypeIcon(sourceType)
  const colorClass = getSourceTypeColor(sourceType)
  const label = getSourceTypeLabel(sourceType)

  return (
    <Badge variant="outline" className={`${colorClass} ${className}`}>
      <IconComponent className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  )
}

export function ContentViewer({ content, isOpen, onClose, cardPosition, onNavigateNext, onNavigatePrevious, hasNext = false, hasPrevious = false }: ContentViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const floatingVideoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [savingToFolder, setSavingToFolder] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)
  const isMobile = useIsMobile()
  const [isSelectingText, setIsSelectingText] = useState(false)
  const [isInteractingWithVideo, setIsInteractingWithVideo] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [shouldFloatVideo, setShouldFloatVideo] = useState(false)
  const [showPlayButton, setShowPlayButton] = useState(true)
  const [currentVideoTime, setCurrentVideoTime] = useState(0)
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number | null>(null)
  const [isMediaVertical, setIsMediaVertical] = useState(false)
  const [dominantColor, setDominantColor] = useState<string | null>(null)

  // Normalize article data from database
  const normalizedContent = content ? normalizeContent(content) : null

  // Reading customization from global settings
  const { settings: readerSettings, updateSetting, getFontFamilyCSS } = useReaderSettings()
  const { fontSize, fontFamily, lineHeight, maxWidth, backgroundColor, textColor } = readerSettings
  const isDarkMode = backgroundColor.toLowerCase() === '#000000' ||
    parseInt(backgroundColor.replace('#', ''), 16) < 0x808080

  // Create setters that use updateSetting
  const setFontSize = (value: number) => updateSetting('fontSize', value)
  const setFontFamily = (value: string) => updateSetting('fontFamily', value)
  const setBackgroundColor = (value: string) => updateSetting('backgroundColor', value)
  const setTextColor = (value: string) => updateSetting('textColor', value)
  const setLineHeight = (value: number) => updateSetting('lineHeight', value)
  const setMaxWidth = (value: number) => updateSetting('maxWidth', value)
  const setIsDarkMode = (value: boolean) => {
    if (value) {
      updateSetting('backgroundColor', '#000000')
      updateSetting('textColor', '#ffffff')
    } else {
      updateSetting('backgroundColor', '#ffffff')
      updateSetting('textColor', '#000000')
    }
  }

  const [shouldAnimateFromCard, setShouldAnimateFromCard] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0) // Pull-to-dismiss vertical drag
  const [isDragging, setIsDragging] = useState(false)
  const [isPullingDown, setIsPullingDown] = useState(false) // Pull-to-dismiss active
  const [isAtScrollTop, setIsAtScrollTop] = useState(true) // Track if scroll is at top
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Ref para rastrear el meta tag que creamos
  const themeColorMetaRef = useRef<HTMLMetaElement | null>(null)
  // Refs para GSAP FLIP animation
  const viewerImageRef = useRef<HTMLDivElement>(null)
  const flipAnimationRef = useRef<gsap.core.Animation | null>(null)
  const [flipAnimationComplete, setFlipAnimationComplete] = useState(false)

  // Register GSAP Flip plugin
  if (typeof window !== 'undefined') {
    gsap.registerPlugin(Flip)
  }

  // Update theme-color meta tag - use dark color for immersive hero image experience
  useEffect(() => {
    if (!isOpen) return // Only update when viewer is open

    // Use black/dark theme when we have a hero image for immersive effect
    // This makes the status bar blend with the hero image
    const hasHeroImage = normalizedContent?.image || normalizedContent?.videoUrl
    const themeColor = hasHeroImage ? '#000000' : backgroundColor

    // Si ya tenemos un meta tag creado, solo actualizar su contenido
    if (themeColorMetaRef.current) {
      themeColorMetaRef.current.setAttribute('content', themeColor)
    } else {
      // Crear nuevo meta tag y guardarlo en el ref
      const themeColorMeta = document.createElement('meta')
      themeColorMeta.setAttribute('name', 'theme-color')
      themeColorMeta.setAttribute('content', themeColor)
      document.head.appendChild(themeColorMeta)
      themeColorMetaRef.current = themeColorMeta
    }

    // Also update for Safari on macOS/iOS - use black-translucent for edge-to-edge display
    let appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null
    if (!appleStatusBarMeta) {
      appleStatusBarMeta = document.createElement('meta')
      appleStatusBarMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style')
      document.head.appendChild(appleStatusBarMeta)
    }
    appleStatusBarMeta.setAttribute('content', 'black-translucent')

    // Cleanup: restore default color when viewer closes
    return () => {
      // Solo eliminar el meta tag que creamos usando el ref
      if (themeColorMetaRef.current && themeColorMetaRef.current.parentNode) {
        try {
          themeColorMetaRef.current.parentNode.removeChild(themeColorMetaRef.current)
        } catch (e) {
          // Ignorar errores si el elemento ya fue eliminado
        }
        themeColorMetaRef.current = null
      }
    }
  }, [backgroundColor, isOpen, normalizedContent?.image, normalizedContent?.videoUrl])

  // Extract dominant color from hero image for immersive theme-color
  useEffect(() => {
    if (!isOpen || !normalizedContent) return

    const imageUrl = normalizedContent.image || normalizedContent.videoUrl
    if (!imageUrl) return

    // Create an off-screen image to sample colors
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        // Create a small canvas to sample the top of the image
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Sample a small area at the top of the image
        const sampleSize = 50
        canvas.width = sampleSize
        canvas.height = sampleSize

        // Draw the top portion of the image
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * 0.15, 0, 0, sampleSize, sampleSize)

        // Get the average color
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
        const data = imageData.data
        let r = 0, g = 0, b = 0, count = 0

        for (let i = 0; i < data.length; i += 4) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count++
        }

        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)

        // Convert to hex and set as dominant color
        const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        setDominantColor(hexColor)
      } catch (e) {
        // If color extraction fails (e.g., CORS), fall back to default
        console.debug('Could not extract dominant color from image')
      }
    }

    img.onerror = () => {
      // Fall back to default if image fails to load
      setDominantColor(null)
    }

    img.src = imageUrl
  }, [isOpen, normalizedContent?.id, normalizedContent?.image, normalizedContent?.videoUrl])

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

  useEffect(() => {
    if (isOpen && cardPosition) {
      setShouldAnimateFromCard(true)
      setDragX(0) // Reset drag position when opening
      setIsDragging(false)
    } else if (!isOpen) {
      // Reset animation flag only after exit animation completes
      setTimeout(() => {
        setShouldAnimateFromCard(false)
      }, 500) // Match with exit animation duration
      setDragX(0)
      setIsDragging(false)
    }
  }, [isOpen, cardPosition])

  // GSAP FLIP animation effect
  useLayoutEffect(() => {
    if (!isOpen || !content || !cardPosition) {
      setFlipAnimationComplete(false)
      return
    }

    // Wait for next frame to ensure DOM is ready
    const animationFrame = requestAnimationFrame(() => {
      const cardImage = document.querySelector(`[data-flip-id="card-image-${content.id}"]`) as HTMLElement
      const viewerImage = document.querySelector(`[data-flip-id="viewer-image-${normalizedContent?.id}"]`) as HTMLElement

      if (!cardImage || !viewerImage) {
        setFlipAnimationComplete(true)
        return
      }

      // Capture the state of the card image
      const state = Flip.getState(cardImage)

      // Apply the FLIP animation to the viewer image
      flipAnimationRef.current = Flip.from(state, {
        targets: viewerImage,
        duration: 0.7,
        ease: "power3.out",
        absolute: true,
        scale: true,
        onComplete: () => {
          setFlipAnimationComplete(true)
        }
      })
    })

    return () => {
      cancelAnimationFrame(animationFrame)
      if (flipAnimationRef.current) {
        flipAnimationRef.current.kill()
      }
    }
  }, [isOpen, content?.id, cardPosition, normalizedContent?.id])

  // Solo sincronizar estado cuando cambia el contenido (diferente ID)
  const previousContentIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (normalizedContent && normalizedContent.id !== previousContentIdRef.current) {
      previousContentIdRef.current = normalizedContent.id
      setIsSaved(normalizedContent.isSaved)
      setCurrentFolderId(normalizedContent.folderId)
      // Resetear estado de orientación cuando cambia el contenido
      setMediaAspectRatio(null)
      setIsMediaVertical(false)
      // Resetear scroll al principio cuando cambia el contenido
      if (contentRef.current) {
        contentRef.current.scrollTop = 0
      }
      // Resetear estado de video
      setIsVideoPlaying(false)
      setShouldFloatVideo(false)
      setShowPlayButton(true)
      setCurrentVideoTime(0)
      setReadingProgress(0)
    }
  }, [normalizedContent])

  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current && isOpen) {
        const element = contentRef.current
        const scrollTop = element.scrollTop
        const scrollHeight = element.scrollHeight - element.clientHeight
        const progress = scrollHeight > 0 ? Math.min((scrollTop / scrollHeight) * 100, 100) : 0
        setReadingProgress(progress)

        // Track if at scroll top for pull-to-dismiss
        setIsAtScrollTop(scrollTop <= 0)

        // Detectar si está scrolleando
        setIsScrolling(true)

        // Limpiar timeout anterior
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }

        // Establecer nuevo timeout para detectar cuando deja de scrollear
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false)
        }, 1000)

        // Lógica para video flotante
        if (videoContainerRef.current && isVideoPlaying) {
          const videoContainer = videoContainerRef.current
          const rect = videoContainer.getBoundingClientRect()
          const containerTop = contentRef.current.getBoundingClientRect().top

          // Si menos de la mitad del video es visible desde arriba
          const videoVisibleFromTop = rect.top - containerTop
          const videoHeight = rect.height
          const halfVideoHeight = videoHeight / 2

          // Activar modo flotante si el video está scrolleado más de la mitad hacia arriba
          if (videoVisibleFromTop < -halfVideoHeight) {
            setShouldFloatVideo(true)
          } else {
            setShouldFloatVideo(false)
          }
        }
      }
    }

    const element = contentRef.current
    if (element) {
      element.addEventListener("scroll", handleScroll)
      return () => {
        element.removeEventListener("scroll", handleScroll)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
      }
    }
  }, [isOpen, isVideoPlaying])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  // Sincronizar videos cuando cambia el modo flotante
  useEffect(() => {
    if (!videoRef.current) return

    if (shouldFloatVideo) {
      // Guardar el tiempo actual y pausar el video original
      setCurrentVideoTime(videoRef.current.currentTime)
      videoRef.current.pause()

      // Cuando el video flotante esté listo, sincronizar el tiempo
      if (floatingVideoRef.current) {
        floatingVideoRef.current.currentTime = videoRef.current.currentTime
        if (isVideoPlaying) {
          floatingVideoRef.current.play()
        }
      }
    } else {
      // Volver al video original
      if (floatingVideoRef.current && videoRef.current) {
        videoRef.current.currentTime = floatingVideoRef.current.currentTime
        if (isVideoPlaying) {
          videoRef.current.play()
        }
      }
    }
  }, [shouldFloatVideo, isVideoPlaying])

  // Detectar selección de texto
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      const hasSelection = selection && selection.toString().length > 0
      setIsSelectingText(!!hasSelection)
    }

    if (isOpen && isMobile) {
      document.addEventListener('selectionchange', handleSelectionChange)
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange)
      }
    }
  }, [isOpen, isMobile])

  // Detectar interacción con controles de video
  useEffect(() => {
    const videoElement = videoRef.current

    if (!videoElement || !isOpen || !isMobile) return

    const handleVideoInteractionStart = () => {
      setIsInteractingWithVideo(true)
    }

    const handleVideoInteractionEnd = () => {
      // Pequeño delay para asegurar que la interacción terminó
      setTimeout(() => {
        setIsInteractingWithVideo(false)
      }, 300)
    }

    // Eventos para detectar interacción con controles
    videoElement.addEventListener('touchstart', handleVideoInteractionStart)
    videoElement.addEventListener('touchend', handleVideoInteractionEnd)
    videoElement.addEventListener('seeking', handleVideoInteractionStart)
    videoElement.addEventListener('seeked', handleVideoInteractionEnd)
    videoElement.addEventListener('volumechange', handleVideoInteractionStart)

    return () => {
      videoElement.removeEventListener('touchstart', handleVideoInteractionStart)
      videoElement.removeEventListener('touchend', handleVideoInteractionEnd)
      videoElement.removeEventListener('seeking', handleVideoInteractionStart)
      videoElement.removeEventListener('seeked', handleVideoInteractionEnd)
      videoElement.removeEventListener('volumechange', handleVideoInteractionStart)
    }
  }, [isOpen, isMobile, normalizedContent?.image])

  // Handler para guardar con carpeta usando FolderPicker
  const handleSaveToFolder = async (folderId: string | null) => {
    if (!content) return
    setSavingToFolder(true)
    try {
      await contentService.archiveToFolder(content.content_type, content.id, folderId)
      setIsSaved(true)
      setCurrentFolderId(folderId)
    } catch (error) {
      console.error('Error saving to folder:', error)
    } finally {
      setSavingToFolder(false)
    }
  }

  // Handler para quitar del archivo
  const handleToggleArchive = async () => {
    if (!content) return
    if (isSaved) {
      try {
        // Usar content.content_type que ya tiene el tipo correcto
        await contentService.toggleArchive(content.content_type, content.id, false)
        setIsSaved(false)
        setCurrentFolderId(null)
      } catch (error) {
        console.error('Error removing from archive:', error)
      }
    }
  }

  const handleDownload = async () => {
    if (!content || !normalizedContent) return

    try {
      const contentHtml = normalizedContent.content || `<p>${normalizedContent.excerpt}</p>`

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${normalizedContent.title}</title>
            <style>
              body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
              h1 { font-size: 2em; margin-bottom: 20px; }
              .meta { color: #666; margin-bottom: 30px; }
            </style>
          </head>
          <body>
            <h1>${normalizedContent.title}</h1>
            <div class="meta">
              <p>By ${normalizedContent.author} | ${normalizedContent.source} | ${normalizedContent.publishedAt}</p>
            </div>
            <div>${contentHtml}</div>
          </body>
        </html>
      `

      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${normalizedContent.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading:', err)
    }
  }

  const handleShare = async () => {
    if (content && normalizedContent) {
      const shareUrl = `${window.location.origin}/read/${normalizedContent.id}`

      if (navigator.share) {
        try {
          await navigator.share({
            title: normalizedContent.title,
            text: normalizedContent.excerpt,
            url: shareUrl,
          })
        } catch (err) {
          console.log("Error sharing:", err)
        }
      } else {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl)
          // You could show a toast here
        } catch (err) {
          console.error('Error copying to clipboard:', err)
        }
      }
    }
  }

  const handleOpenInNewTab = () => {
    if (normalizedContent) {
      // Usar un enlace temporal para evitar bloqueo de popups en producción
      const link = document.createElement('a')
      link.href = `/read/${normalizedContent.id}`
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleOpenOriginal = () => {
    if (normalizedContent && normalizedContent.url && normalizedContent.url !== '#') {
      // Open in new tab - browser history will work normally
      window.open(normalizedContent.url, "_blank")
    }
  }

  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const handleVideoPlay = () => {
    setIsVideoPlaying(true)
    setShowPlayButton(false)
  }

  const handleVideoPause = () => {
    setIsVideoPlaying(false)
  }

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  //if (!content) return null

  const isMultimedia = normalizedContent?.type === "youtube_channel" ||
    normalizedContent?.type === "youtube_video" ||
    normalizedContent?.type === "tiktok" ||
    normalizedContent?.type === "instagram"

  // Determinar si el contenido tiene video
  const hasVideo = normalizedContent?.videoUrl ||
    normalizedContent?.mediaType === 'video' ||
    isVideoUrl(normalizedContent?.image)

  // Obtener el thumbnail apropiado para el video
  let videoThumbnail: string | null = null
  if (normalizedContent?.type === 'youtube_channel' || normalizedContent?.type === 'youtube_video') {
    videoThumbnail = getYouTubeThumbnail(content?.url) || getYouTubeThumbnail(normalizedContent?.videoUrl)
  }
  // Si no es YouTube o no tiene thumbnail de YT, usar image si no es un video
  if (!videoThumbnail && normalizedContent?.image && !isVideoUrl(normalizedContent.image)) {
    videoThumbnail = normalizedContent.image
  }

  // URL del video para reproducir
  const videoPlayUrl = normalizedContent?.videoUrl ||
    (isVideoUrl(normalizedContent?.image) ? normalizedContent?.image : null)

  // Use real content from database, fallback to excerpt if no content
  const contentHtml = content && normalizedContent
    ? (normalizedContent.content || `<p>${normalizedContent.excerpt}</p>`)
    : ""

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    // Solo permitir swipe en mobile y cuando no se está seleccionando texto ni interactuando con video
    if (!isMobile || isSelectingText || isInteractingWithVideo) {
      setDragX(0)
      setIsDragging(false)
      return
    }

    const swipeThreshold = 100
    const swipeVelocityThreshold = 500

    // Deslizar hacia la derecha
    if (info.offset.x > swipeThreshold || info.velocity.x > swipeVelocityThreshold) {
      if (hasPrevious && onNavigatePrevious) {
        // Navegar al artículo anterior
        setDragX(0)
        setIsDragging(false)
        onNavigatePrevious()
      } else {
        // No hay artículo anterior, cerrar el visor
        setDragX(0)
        onClose()
      }
    }
    // Deslizar hacia la izquierda
    else if (info.offset.x < -swipeThreshold || info.velocity.x < -swipeVelocityThreshold) {
      if (hasNext && onNavigateNext) {
        // Navegar al siguiente artículo
        setDragX(0)
        setIsDragging(false)
        onNavigateNext()
      } else {
        // No hay siguiente artículo, volver a la posición original
        setDragX(0)
        setIsDragging(false)
      }
    }
    // Volver a la posición original
    else {
      setDragX(0)
      setIsDragging(false)
    }
  }

  // Pull-to-dismiss handlers (vertical swipe down to close)
  const touchStartY = useRef<number>(0)
  const pullThreshold = 80 // Distance to trigger dismiss (reduced for easier activation)
  const [readyToClose, setReadyToClose] = useState(false) // Visual feedback when threshold reached

  const handlePullStart = (e: React.TouchEvent) => {
    if (!isMobile || !isAtScrollTop) return
    touchStartY.current = e.touches[0].clientY
    setIsPullingDown(true)
    setReadyToClose(false)
  }

  const handlePullMove = (e: React.TouchEvent) => {
    if (!isPullingDown || !isAtScrollTop) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - touchStartY.current

    // Only allow downward pull (deltaY > 0)
    if (deltaY > 0) {
      // Apply progressive resistance - less at start, more as you pull further
      const normalizedDelta = deltaY / window.innerHeight
      const resistance = 0.6 - normalizedDelta * 0.3 // 0.6 at start, decreasing to 0.3
      const resistedDeltaY = deltaY * Math.max(0.3, resistance)
      setDragY(resistedDeltaY)

      // Set ready to close state when threshold is reached
      setReadyToClose(resistedDeltaY > pullThreshold)

      // Prevent default scroll behavior when pulling
      if (contentRef.current && contentRef.current.scrollTop <= 0) {
        e.preventDefault()
      }
    } else {
      setDragY(0)
      setReadyToClose(false)
    }
  }

  const handlePullEnd = () => {
    if (!isPullingDown) return

    if (readyToClose || dragY > pullThreshold) {
      // Close the viewer
      onClose()
    }

    // Reset pull state
    setDragY(0)
    setIsPullingDown(false)
    setReadyToClose(false)
    touchStartY.current = 0
  }

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.4,
        ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
      },
    },
  }

  const getInitialPosition = () => {
    if (cardPosition) {
      return {
        position: "fixed" as const,
        top: cardPosition.top,
        left: cardPosition.left,
        width: cardPosition.width,
        height: cardPosition.height,
        borderRadius: 20,
        opacity: 1,
        scale: 1,
      }
    }
    return {
      scale: 0.92,
      opacity: 0,
      borderRadius: 20,
      y: 40,
    }
  }

  // Curvas de animación estilo App Store
  // [0.32, 0.72, 0, 1] - Spring suave de Apple
  // [0.4, 0, 0.2, 1] - Material Design ease-out
  // [0.16, 1, 0.3, 1] - Ease-out muy suave
  const appleSpringEase = [0.32, 0.72, 0, 1] as [number, number, number, number]
  const appleSmoothEase = [0.25, 0.1, 0.25, 1] as [number, number, number, number]
  const appleExitEase = [0.4, 0, 0.6, 1] as [number, number, number, number]

  const viewerVariants = {
    hidden: getInitialPosition(),
    visible: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: 0,
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        // Usar transiciones escalonadas para mayor fluidez
        duration: 0.6,
        ease: appleSpringEase,
        // El border radius se anima más lento para dar sensación de expansión
        borderRadius: {
          duration: 0.5,
          delay: 0.05,
          ease: appleSmoothEase
        },
        // La opacidad es instantánea para que no parpadee
        opacity: { duration: 0.1 },
      },
    },
    exit:
      cardPosition && shouldAnimateFromCard
        ? {
          position: "fixed" as const,
          top: cardPosition.top,
          left: cardPosition.left,
          width: cardPosition.width,
          height: cardPosition.height,
          borderRadius: 20,
          opacity: 1,
          scale: 1,
          transition: {
            // Usar la misma duración que la entrada para consistencia
            duration: 0.55,
            // Curva más suave para la salida - similar a iOS
            ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
            // Border radius se anima primero y más rápido
            borderRadius: {
              duration: 0.25,
              ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
            },
            // Opacity permanece constante hasta el final
            opacity: {
              duration: 0.1,
              delay: 0.45,
            },
          },
        }
        : {
          scale: 0.92,
          opacity: 0,
          borderRadius: 20,
          y: 30,
          transition: {
            duration: 0.4,
            ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
          },
        },
  }

  // Ensure we are on client side for portal
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence mode="sync">
      {isOpen && content && normalizedContent && (
        <div key="content-viewer-wrapper">
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
            style={{
              opacity: (() => {
                // Reduce opacity when dragging horizontally
                if (isDragging && isMobile && !isSelectingText && !isInteractingWithVideo) {
                  return Math.max(0.3, 1 - dragX / 300)
                }
                // Reduce opacity significantly when ready to close
                if (readyToClose && isMobile) {
                  return 0.2
                }
                // Reduce opacity when pulling down
                if (isPullingDown && isMobile) {
                  return Math.max(0.4, 1 - dragY / 120)
                }
                return 1
              })(),
              transition: 'opacity 0.15s ease',
            }}
          />
          {/* Content Viewer */}
          <motion.div
            key="viewer"
            variants={viewerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed z-50 overflow-hidden"
            drag={isMobile && !isSelectingText && !isInteractingWithVideo ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            dragDirectionLock
            onDragStart={() => {
              if (isMobile && !isSelectingText && !isInteractingWithVideo) {
                setIsDragging(true)
              }
            }}
            onDrag={(_, info) => {
              if (isMobile && !isSelectingText && !isInteractingWithVideo) {
                setDragX(info.offset.x)
              }
            }}
            onDragEnd={handleDragEnd}
            // Pull-to-dismiss touch handlers
            onTouchStart={handlePullStart}
            onTouchMove={handlePullMove}
            onTouchEnd={handlePullEnd}
            style={{
              backgroundColor: hasVideo && isVideoPlaying
                ? (isDarkMode ? "rgba(10, 10, 10, 0.7)" : "rgba(255, 255, 255, 0.7)")
                : (isDarkMode ? "#0a0a0a" : backgroundColor),
              transformOrigin: cardPosition
                ? `${cardPosition.left + cardPosition.width / 2}px ${cardPosition.top + cardPosition.height / 2}px`
                : "center center",
              x: isDragging && isMobile && !isSelectingText && !isInteractingWithVideo ? dragX : 0,
              // Pull-to-dismiss Y transform with enhanced visual feedback
              y: isPullingDown && isMobile ? dragY : 0,
              // More pronounced scale when ready to close
              scale: isPullingDown && isMobile
                ? (readyToClose ? 0.88 : Math.max(0.92, 1 - dragY / 400))
                : 1,
              // Larger border radius when ready to close
              borderRadius: isPullingDown && isMobile
                ? (readyToClose ? 24 : Math.min(16, dragY / 3))
                : 0,
              // Smooth transition for scale/borderRadius changes
              transition: isPullingDown ? 'scale 0.15s ease, border-radius 0.15s ease' : 'none',
            }}
          >
            {/* Ambient background for multimedia content */}
            { /* isMultimedia && <AmbientBackground imageUrl={normalizedContent.image} isActive={isPlaying} intensity={0.3} /> */}
            {hasVideo && isVideoPlaying && videoRef.current ? (
              <VideoAmbientBackground
                videoElement={videoRef.current}
                isPlaying={isVideoPlaying}
                intensity={0.6}
                updateInterval={200}
              />
            ) : isMultimedia ? (
              <AmbientBackground imageUrl={normalizedContent.image} isActive={isPlaying} intensity={0.3} />
            ) : null}

            {/* Close Button - Always visible in top right corner, respetando safe area */}
            <motion.button
              onClick={onClose}
              className="fixed right-4 z-30 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-colors"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
              initial={{ opacity: 0, scale: 0.5, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                delay: 0.3,
                duration: 0.4,
                ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="h-5 w-5 text-black" strokeWidth={2.5} />
            </motion.button>

            {/* Swipe indicators - only visible on touch devices */}
            {hasPrevious && (
              <motion.div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-linear-to-r from-primary/40 to-transparent rounded-r-full z-10 md:hidden pointer-events-none"
                initial={{ opacity: 0, x: -10 }}
                animate={{
                  opacity: isDragging ? 0 : [0, 0.6, 0],
                  x: isDragging ? 0 : [-10, 0, -10]
                }}
                transition={{
                  repeat: isDragging ? 0 : Infinity,
                  duration: 2,
                  ease: "easeInOut",
                  delay: 1,
                }}
              />
            )}
            {hasNext && (
              <motion.div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-linear-to-l from-primary/40 to-transparent rounded-l-full z-10 md:hidden pointer-events-none"
                initial={{ opacity: 0, x: 10 }}
                animate={{
                  opacity: isDragging ? 0 : [0, 0.6, 0],
                  x: isDragging ? 0 : [10, 0, 10]
                }}
                transition={{
                  repeat: isDragging ? 0 : Infinity,
                  duration: 2,
                  ease: "easeInOut",
                  delay: 1.5,
                }}
              />
            )}

            {/* Dynamic Island */}
            <DynamicIsland
              onClose={onClose}
              isSaved={isSaved}
              onToggleArchive={handleToggleArchive}
              onSaveToFolder={handleSaveToFolder}
              currentFolderId={currentFolderId}
              savingToFolder={savingToFolder}
              onDownload={handleDownload}
              onShare={handleShare}
              onOpenInNewTab={handleOpenInNewTab}
              onOpenOriginal={handleOpenOriginal}
              isScrolling={isScrolling}
              scrollProgress={readingProgress}
              fontSize={fontSize}
              setFontSize={setFontSize}
              fontFamily={fontFamily}
              setFontFamily={setFontFamily}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              backgroundColor={backgroundColor}
              setBackgroundColor={setBackgroundColor}
              textColor={textColor}
              setTextColor={setTextColor}
              lineHeight={lineHeight}
              setLineHeight={setLineHeight}
              maxWidth={maxWidth}
              setMaxWidth={setMaxWidth}
              shareUrl={normalizedContent ? `${window.location.origin}/read/${normalizedContent.id}` : undefined}
            />

            {/* Content Area - Different layout for YouTube vs other content */}
            {(() => {
              // Detectar YouTube por el tipo de fuente O por el URL del video
              const youtubeId = getYouTubeVideoId(normalizedContent.videoUrl) || getYouTubeVideoId(normalizedContent.url)
              const isYouTubeContent = normalizedContent.isYouTube || !!youtubeId

              if (isYouTubeContent && youtubeId) {
                // YouTube Layout: Video fijo arriba, metadata debajo, descripción scrollable
                return (
                  <motion.div
                    className="h-full flex flex-col"
                    style={{
                      color: isDarkMode ? "#ffffff" : textColor,
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.15,
                      duration: 0.5,
                      ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
                    }}
                  >
                    {/* Video flotante con márgenes y sombra */}
                    <div className="shrink-0 w-full pt-16 px-4 pb-4">
                      <div
                        ref={videoContainerRef}
                        className="relative w-full aspect-video max-h-[50vh] rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10"
                        style={{
                          boxShadow: isDarkMode
                            ? '0 10px 40px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                            : '0 10px 40px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
                        }}
                      >
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&controls=1&fs=1`}
                          title={normalizedContent.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full"
                        />
                      </div>
                    </div>

                    {/* Contenido scrollable: metadata + descripción */}
                    <div
                      ref={contentRef}
                      className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-32 select-text"
                    >
                      <article
                        className="mx-auto transition-all duration-300 select-text pt-6"
                        style={{
                          maxWidth: `${maxWidth}px`,
                          fontSize: `${fontSize}px`,
                          lineHeight: lineHeight,
                          fontFamily: getFontFamilyCSS(),
                        }}
                      >
                        {/* Metadata debajo del video */}
                        <header className="mb-6">
                          <h1 className="text-2xl md:text-3xl font-bold mb-3 text-balance leading-tight">{normalizedContent.title}</h1>

                          <div className="flex items-center gap-2 mb-3">
                            <TypeBadge sourceType={normalizedContent.type as SourceType} />
                            <span className="text-sm opacity-70">{normalizedContent.source}</span>
                          </div>

                          <div className="flex items-center gap-4 text-sm opacity-70 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {normalizedContent.author}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {normalizedContent.publishedAt}
                            </span>
                            {normalizedContent.videoDuration && (
                              <span className="flex items-center gap-1">
                                <Play className="h-3 w-3" />
                                {formatDuration(normalizedContent.videoDuration)}
                              </span>
                            )}
                            {normalizedContent.viewCount && (
                              <span className="flex items-center gap-1" title={`${normalizedContent.viewCount.toLocaleString()} visualizaciones`}>
                                <Eye className="h-3 w-3" />
                                {formatCount(normalizedContent.viewCount)}
                              </span>
                            )}
                            {normalizedContent.likeCount && (
                              <span className="flex items-center gap-1" title={`${normalizedContent.likeCount.toLocaleString()} me gusta`}>
                                <ThumbsUp className="h-3 w-3" />
                                {formatCount(normalizedContent.likeCount)}
                              </span>
                            )}
                          </div>
                        </header>

                        <Separator className="mb-6" />

                        {/* Descripción del video - preservar formato original */}
                        <div
                          className="max-w-none"
                          style={{
                            color: isDarkMode ? "#ffffff" : textColor,
                            fontSize: `${fontSize}px`,
                            lineHeight: lineHeight,
                          }}
                        >
                          {normalizedContent.excerpt ? (
                            <pre
                              className="whitespace-pre-wrap wrap-break-words font-[inherit] m-0"
                              style={{
                                fontFamily: 'inherit',
                                fontSize: 'inherit',
                                lineHeight: 'inherit',
                              }}
                            >
                              {normalizedContent.excerpt}
                            </pre>
                          ) : (
                            <p className="opacity-70">No hay descripción disponible para este video.</p>
                          )}
                        </div>
                      </article>
                    </div>
                  </motion.div>
                )
              }

              // Layout App Store style para contenido que no es YouTube
              return (
                <motion.div
                  ref={contentRef}
                  className="h-full overflow-y-auto overflow-x-hidden select-text"
                  style={{
                    color: isDarkMode ? "#ffffff" : textColor,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: 0.1,
                    duration: 0.4,
                    ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
                  }}
                >
                  {/* Hero Header Section - extends into safe area for edge-to-edge image */}
                  <div
                    className="relative w-full"
                    style={{
                      minHeight: '55vh',
                      // Extend into safe area (notch/status bar area)
                      marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
                      paddingTop: 'env(safe-area-inset-top, 0px)',
                    }}
                  >
                    {/* Hero Image - positioned to fill including safe area */}
                    <div
                      ref={videoContainerRef}
                      className="absolute w-full h-full"
                      style={{
                        top: 'calc(-1 * env(safe-area-inset-top, 0px))',
                        height: 'calc(100% + env(safe-area-inset-top, 0px))',
                        left: 0,
                        right: 0,
                      }}
                      data-flip-id={`viewer-image-${normalizedContent.id}`}
                    >
                      {(() => {
                        if (hasVideo && videoPlayUrl) {
                          return (
                            <div className="relative w-full h-full">
                              {videoThumbnail && (
                                <img
                                  src={videoThumbnail}
                                  alt={normalizedContent.title}
                                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isVideoPlaying ? 'opacity-0' : 'opacity-100'}`}
                                />
                              )}
                              <video
                                ref={videoRef}
                                src={videoPlayUrl}
                                poster={videoThumbnail || undefined}
                                className="absolute inset-0 w-full h-full object-cover"
                                controls={isVideoPlaying}
                                muted={isMuted}
                                playsInline
                                onPlay={() => {
                                  setIsVideoPlaying(true)
                                  setIsPlaying(true)
                                  setShowPlayButton(false)
                                }}
                                onPause={() => {
                                  setIsVideoPlaying(false)
                                  setIsPlaying(false)
                                }}
                                onEnded={() => {
                                  setIsVideoPlaying(false)
                                  setIsPlaying(false)
                                  setShowPlayButton(true)
                                }}
                              />
                              {/* Play button overlay */}
                              {showPlayButton && (
                                <button
                                  onClick={() => videoRef.current?.play()}
                                  className="absolute inset-0 flex items-center justify-center bg-black/20 z-10"
                                >
                                  <div className="bg-white/95 rounded-full p-6 shadow-xl hover:bg-white hover:scale-110 transition-all duration-300">
                                    <Play className="h-10 w-10 text-black fill-black" />
                                  </div>
                                </button>
                              )}
                            </div>
                          )
                        } else {
                          return (
                            <img
                              src={videoThumbnail || normalizedContent.image || "/placeholder.svg"}
                              alt={normalizedContent.title}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          )
                        }
                      })()}
                    </div>

                    {/* Gradient Overlay - from transparent to solid */}
                    <div
                      className="absolute inset-x-0 bottom-0 pointer-events-none"
                      style={{
                        height: '60%',
                        background: `linear-gradient(to bottom, transparent 0%, ${backgroundColor}40 35%, ${backgroundColor}90 65%, ${backgroundColor} 100%)`,
                      }}
                    />

                    {/* Title and Metadata - positioned at bottom quarter of hero */}
                    <motion.div
                      className="absolute inset-x-0 bottom-0 px-6 pb-8 z-10"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                    >
                      <div
                        className="mx-auto"
                        style={{ maxWidth: `${maxWidth}px` }}
                      >
                        {/* Source info */}
                        <div className="flex items-center gap-2 mb-3">
                          <TypeBadge sourceType={normalizedContent.type as SourceType} />
                          <span className="text-sm font-medium opacity-80">{normalizedContent.source}</span>
                        </div>

                        {/* Title */}
                        <h1
                          className="text-3xl md:text-5xl font-bold mb-4 text-balance leading-tight"
                          style={{
                            fontFamily: getFontFamilyCSS(),
                            textShadow: isDarkMode ? 'none' : '0 2px 10px rgba(0,0,0,0.1)'
                          }}
                        >
                          {normalizedContent.title}
                        </h1>

                        {/* Author and date */}
                        <div className="flex items-center gap-4 text-sm opacity-70">
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            {normalizedContent.author}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {normalizedContent.publishedAt}
                          </span>
                          {normalizedContent.readTime && (
                            <span className="flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5" />
                              {normalizedContent.readTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Article Content - below hero */}
                  <motion.div
                    className="px-6 pb-32"
                    style={{ backgroundColor }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <div
                      className="mx-auto pt-8"
                      style={{ maxWidth: `${maxWidth}px` }}
                    >
                      <Separator className="mb-8 opacity-30" />

                      {/* Article Content */}
                      <div
                        className="prose prose-lg max-w-none"
                        style={{
                          color: isDarkMode ? "#ffffff" : textColor,
                          fontSize: `${fontSize}px`,
                          lineHeight: lineHeight,
                          fontFamily: getFontFamilyCSS(),
                        }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHTML(contentHtml) }}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              )
            })()}

            {/* Video Flotante (Picture-in-Picture Manual) */}
            <AnimatePresence>
              {shouldFloatVideo && hasVideo && videoPlayUrl && !getYouTubeVideoId(normalizedContent.videoUrl) && (
                <motion.div
                  key="floating-video"
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                  className="fixed top-20 right-4 z-40 rounded-lg overflow-hidden shadow-2xl bg-black"
                  style={{
                    width: isMobile ? 'calc(100vw - 2rem)' : '400px',
                    aspectRatio: '16/9',
                  }}
                >
                  {/* Video clonado para el modo flotante */}
                  <video
                    ref={floatingVideoRef}
                    src={videoPlayUrl}
                    controls
                    muted={isMuted}
                    autoPlay={isVideoPlaying}
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                    onLoadedMetadata={(e) => {
                      // Sincronizar tiempo cuando se carga
                      e.currentTarget.currentTime = currentVideoTime
                    }}
                    onPause={() => {
                      // Sincronizar estado de pausa
                      if (videoRef.current) {
                        videoRef.current.pause()
                      }
                      setIsVideoPlaying(false)
                    }}
                    onPlay={() => {
                      setIsVideoPlaying(true)
                    }}
                    onTimeUpdate={(e) => {
                      // Actualizar el tiempo guardado
                      setCurrentVideoTime(e.currentTarget.currentTime)
                    }}
                  />

                  {/* Botón para cerrar el video flotante y volver al original */}
                  <button
                    onClick={() => {
                      // Guardar el tiempo actual del video flotante
                      if (floatingVideoRef.current) {
                        setCurrentVideoTime(floatingVideoRef.current.currentTime)
                      }
                      setShouldFloatVideo(false)
                      // Scroll de vuelta al video original
                      if (videoContainerRef.current && contentRef.current) {
                        const containerTop = contentRef.current.scrollTop
                        const videoTop = videoContainerRef.current.offsetTop
                        contentRef.current.scrollTo({
                          top: videoTop - 100,
                          behavior: 'smooth'
                        })
                      }
                    }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors z-10"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>

                  {/* Indicador de que es video flotante */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                    Modo flotante
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )
      }
    </AnimatePresence >,
    document.body
  )
}
