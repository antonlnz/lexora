"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AmbientBackground } from "@/components/ambient-background"
import { DynamicIsland } from "@/components/dynamic-island"
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
} from "lucide-react"
import Image from "next/image"
import type { ArticleWithUserData } from "@/types/database"
import { useIsMobile } from "@/hooks/use-mobile"

interface ContentViewerProps {
  content: ArticleWithUserData | null
  isOpen: boolean
  onClose: () => void
  cardPosition?: DOMRect | null
  onNavigateNext?: () => void
  onNavigatePrevious?: () => void
  hasNext?: boolean
  hasPrevious?: boolean
}

const typeIcons = {
  news: "📰",
  rss: "📰",
  youtube: "🎥",
  twitter: "🐦",
  instagram: "📸",
  tiktok: "🎵",
  newsletter: "📧",
  website: "🌐",
}

const typeColors = {
  news: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  rss: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  youtube: "bg-red-500/10 text-red-600 border-red-500/20",
  twitter: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  tiktok: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  newsletter: "bg-green-500/10 text-green-600 border-green-500/20",
  website: "bg-gray-500/10 text-gray-600 border-gray-500/20",
}

// Helper function to normalize article data from database
function normalizeContent(article: ArticleWithUserData) {
  return {
    id: article.id,
    type: article.source.source_type,
    title: article.title,
    excerpt: article.excerpt || '',
    content: article.content || '',
    source: article.source.title,
    author: article.author || 'Unknown',
    publishedAt: article.published_at ? new Date(article.published_at).toLocaleDateString() : 'Unknown',
    url: article.url,
    readTime: article.reading_time ? `${article.reading_time} min read` : undefined,
    image: article.image_url || '/placeholder.svg',
    isRead: article.user_article?.is_read || false,
    isSaved: article.user_article?.is_favorite || false,
  }
}

export function ContentViewer({ content, isOpen, onClose, cardPosition, onNavigateNext, onNavigatePrevious, hasNext = false, hasPrevious = false }: ContentViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)
  const isMobile = useIsMobile()
  const [isSelectingText, setIsSelectingText] = useState(false)
  const [isInteractingWithVideo, setIsInteractingWithVideo] = useState(false)

  // Normalize article data from database
  const normalizedContent = content ? normalizeContent(content) : null

  // Reading customization state
  const [fontSize, setFontSize] = useState(16)
  const [fontFamily, setFontFamily] = useState("inter")
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [backgroundColor, setBackgroundColor] = useState("#ffffff")
  const [textColor, setTextColor] = useState("#000000")
  const [lineHeight, setLineHeight] = useState(1.6)
  const [maxWidth, setMaxWidth] = useState(800)

  const [shouldAnimateFromCard, setShouldAnimateFromCard] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update theme-color meta tag when background color changes
  useEffect(() => {
    if (!isOpen) return // Only update when viewer is open
    
    // Remove any existing theme-color meta tags to avoid conflicts
    const existingMetas = document.querySelectorAll('meta[name="theme-color"]')
    existingMetas.forEach(meta => meta.remove())
    
    // Create new theme-color meta tag
    const themeColorMeta = document.createElement('meta')
    themeColorMeta.setAttribute('name', 'theme-color')
    themeColorMeta.setAttribute('content', backgroundColor)
    document.head.appendChild(themeColorMeta)
    
    // Also update for Safari on macOS/iOS
    let appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    if (!appleStatusBarMeta) {
      appleStatusBarMeta = document.createElement('meta')
      appleStatusBarMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style')
      document.head.appendChild(appleStatusBarMeta)
    }
    appleStatusBarMeta.setAttribute('content', 'black-translucent')

    // Cleanup: restore default color when viewer closes
    return () => {
      const defaultColor = document.documentElement.classList.contains('dark') ? '#000000' : '#ffffff'
      const metas = document.querySelectorAll('meta[name="theme-color"]')
      metas.forEach(meta => meta.remove())
      const newMeta = document.createElement('meta')
      newMeta.setAttribute('name', 'theme-color')
      newMeta.setAttribute('content', defaultColor)
      document.head.appendChild(newMeta)
    }
  }, [backgroundColor, isOpen])

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

  useEffect(() => {
    if (normalizedContent) {
      setIsSaved(normalizedContent.isSaved)
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
  }, [isOpen])

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

  const handleSave = () => {
    setIsSaved(!isSaved)
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
    if (navigator.share && content && normalizedContent) {
      try {
        await navigator.share({
          title: normalizedContent.title,
          text: normalizedContent.excerpt,
          url: window.location.href,
        })
      } catch (err) {
        console.log("Error sharing:", err)
      }
    }
  }

  const handleOpenInNewTab = () => {
    if (normalizedContent) {
      window.open(`/read/${normalizedContent.id}`, "_blank")
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

  //if (!content) return null

  const isMultimedia = normalizedContent?.type === "youtube" || normalizedContent?.type === "tiktok" || normalizedContent?.type === "instagram"
  
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

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: [0.32, 0.72, 0, 1] as [number, number, number, number], // Type assertion para Bézier
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.3,
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
        borderRadius: 16,
        opacity: 1,
        scale: 1,
      }
    }
    return {
      scale: 0.95,
      opacity: 0,
    }
  }

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
      transition: {
        duration: 0.5,
        ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
        opacity: { duration: 0.3 },
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
            borderRadius: 16,
            opacity: 1,
            scale: 1,
            transition: {
              duration: 0.45,
              ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
              scale: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.2, delay: 0.25 },
            },
          }
        : {
            scale: 0.95,
            opacity: 0,
            transition: {
              duration: 0.3,
              ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
            },
          },
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && content && normalizedContent && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
            style={{
              opacity: isDragging && isMobile && !isSelectingText && !isInteractingWithVideo ? Math.max(0.3, 1 - dragX / 300) : 1,
            }}
          />

          {/* Content Viewer */}
          <motion.div
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
            style={{
              backgroundColor: isDarkMode ? "#0a0a0a" : backgroundColor,
              transformOrigin: cardPosition
                ? `${cardPosition.left + cardPosition.width / 2}px ${cardPosition.top + cardPosition.height / 2}px`
                : "center center",
              x: isDragging && isMobile && !isSelectingText && !isInteractingWithVideo ? dragX : 0,
            }}
          >
            {/* Ambient background for multimedia content */}
            {isMultimedia && <AmbientBackground imageUrl={normalizedContent.image} isActive={isPlaying} intensity={0.3} />}

            {/* Close Button - Always visible in top left corner */}
            <motion.button
              onClick={onClose}
              className="fixed top-4 left-4 z-30 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-colors"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
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
            <AnimatePresence>
              {isOpen && (
                <DynamicIsland
                  onClose={onClose}
                  isSaved={isSaved}
                  onSave={handleSave}
                  onDownload={handleDownload}
                  onShare={handleShare}
                  onOpenInNewTab={handleOpenInNewTab}
                  onOpenOriginal={handleOpenOriginal}
                  isMultimedia={isMultimedia}
                  isPlaying={isPlaying}
                  isMuted={isMuted}
                  onTogglePlayback={togglePlayback}
                  onToggleMute={toggleMute}
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
                />
              )}
            </AnimatePresence>

            {/* Scrollable Content */}
            <motion.div
              ref={contentRef}
              className="h-full overflow-y-auto pt-8 pb-32 px-4 select-text"
              style={{
                color: isDarkMode ? "#ffffff" : textColor,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
            >
              <article
                className="mx-auto transition-all duration-300 select-text"
                style={{
                  maxWidth: `${maxWidth}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: lineHeight,
                  fontFamily:
                    fontFamily === "inter"
                      ? "var(--font-inter)"
                      : fontFamily === "playfair"
                        ? "var(--font-playfair)"
                        : fontFamily === "mono"
                          ? "monospace"
                          : "serif",
                }}
              >
                {/* Article Header */}
                <header className="mb-8">
                  {/* Espacio vertical para el botón de cerrar en mobile */}
                  <div className="h-12 md:hidden" />
                  
                  <h1 className="text-4xl font-bold mb-4 text-balance leading-tight">{normalizedContent.title}</h1>

                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className={typeColors[normalizedContent.type as keyof typeof typeColors] || typeColors.website}>
                      {typeIcons[normalizedContent.type as keyof typeof typeIcons] || typeIcons.website} {normalizedContent.type}
                    </Badge>
                    <span className="text-sm opacity-70">{normalizedContent.source}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm opacity-70 mb-6">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {normalizedContent.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {normalizedContent.publishedAt}
                    </span>
                    {normalizedContent.readTime && <span>{normalizedContent.readTime}</span>}
                  </div>

                  {/* Featured Image or Video */}
                  <div className="relative aspect-video rounded-lg overflow-hidden mb-8">
                    {normalizedContent.image && 
                     (normalizedContent.image.endsWith('.mp4') || 
                      normalizedContent.image.endsWith('.webm') || 
                      normalizedContent.image.endsWith('.ogg') ||
                      normalizedContent.image.includes('video')) ? (
                      <video
                        ref={videoRef}
                        src={normalizedContent.image}
                        controls
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                        preload="metadata"
                      >
                        Tu navegador no soporta la reproducción de videos.
                      </video>
                    ) : (
                      <Image
                        src={normalizedContent.image || "/placeholder.svg"}
                        alt={normalizedContent.title}
                        fill
                        className="object-cover"
                        priority
                      />
                    )}
                  </div>
                </header>

                <Separator className="mb-8" />

                {/* Article Content */}
                <div
                  className="prose prose-lg max-w-none"
                  style={{
                    color: isDarkMode ? "#ffffff" : textColor,
                    fontSize: `${fontSize}px`,
                    lineHeight: lineHeight,
                  }}
                  dangerouslySetInnerHTML={{ __html: contentHtml }}
                />
              </article>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
