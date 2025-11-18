"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ReadingControls } from "@/components/reading-controls"
import { AmbientBackground } from "@/components/ambient-background"
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
  Eye,
  Maximize2,
  Download,
} from "lucide-react"
import Image from "next/image"

interface ContentItem {
  id: string
  type: "news" | "youtube" | "twitter" | "instagram" | "tiktok" | "newsletter"
  title: string
  excerpt: string
  content?: string
  source: string
  author: string
  publishedAt: string
  readTime?: string
  duration?: string
  image: string
  tags: string[]
  isRead: boolean
  isSaved: boolean
  views?: string
  engagement?: string
}

interface ContentViewerProps {
  content: ContentItem | null
  isOpen: boolean
  onClose: () => void
  cardPosition?: DOMRect | null
}

const typeIcons = {
  news: "📰",
  youtube: "🎥",
  twitter: "🐦",
  instagram: "📸",
  tiktok: "🎵",
  newsletter: "📧",
}

const typeColors = {
  news: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  youtube: "bg-red-500/10 text-red-600 border-red-500/20",
  twitter: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  tiktok: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  newsletter: "bg-green-500/10 text-green-600 border-green-500/20",
}

// Mock content data
const mockContentData: Record<string, string> = {
  "1": `
    <p>The world of technology is rapidly evolving, and sustainability has become a cornerstone of innovation. As we move into 2025, we're witnessing unprecedented developments that promise to reshape our relationship with the environment.</p>
    
    <h2>Revolutionary Breakthroughs</h2>
    <p>From carbon-negative data centers to biodegradable electronics, the tech industry is pioneering solutions that don't just minimize harm—they actively heal our planet. Companies are investing billions in research that could fundamentally change how we produce, consume, and dispose of technology.</p>
    
    <p>One of the most exciting developments is the emergence of bio-computing, where living organisms are used to process information. This technology could reduce energy consumption by up to 90% compared to traditional silicon-based processors.</p>
  `,
  "2": `
    <div class="video-container mb-6">
      <div class="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <div class="text-center">
          <Play class="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p class="text-muted-foreground">Video Player Placeholder</p>
        </div>
      </div>
    </div>
    
    <p>In this comprehensive tutorial, we'll explore the latest features of Next.js 15 and how they can revolutionize your web development workflow.</p>
    
    <h2>What's New in Next.js 15</h2>
    <p>Next.js 15 introduces several groundbreaking features that make building modern web applications faster and more efficient than ever before.</p>
  `,
}

export function ContentViewer({ content, isOpen, onClose, cardPosition }: ContentViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen && cardPosition) {
      setShouldAnimateFromCard(true)
      setDragX(0) // Reset drag position when opening
      setIsDragging(false)
    } else if (!isOpen) {
      // Reset states when closing
      setDragX(0)
      setIsDragging(false)
    }
  }, [isOpen, cardPosition])

  useEffect(() => {
    if (content) {
      setIsSaved(content.isSaved)
    }
  }, [content])

  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current && isOpen) {
        const element = contentRef.current
        const scrollTop = element.scrollTop
        const scrollHeight = element.scrollHeight - element.clientHeight
        const progress = scrollHeight > 0 ? Math.min((scrollTop / scrollHeight) * 100, 100) : 0
        setReadingProgress(progress)
      }
    }

    const element = contentRef.current
    if (element) {
      element.addEventListener("scroll", handleScroll)
      return () => element.removeEventListener("scroll", handleScroll)
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

  const handleSave = () => {
    setIsSaved(!isSaved)
  }
  
  const handleDownload = async () => {
    try {
      const contentHtml = mockContentData[content.id] || `<p>${content.excerpt}</p>`
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${content.title}</title>
            <style>
              body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
              h1 { font-size: 2em; margin-bottom: 20px; }
              .meta { color: #666; margin-bottom: 30px; }
            </style>
          </head>
          <body>
            <h1>${content.title}</h1>
            <div class="meta">
              <p>By ${content.author} | ${content.source} | ${content.publishedAt}</p>
            </div>
            <div>${contentHtml}</div>
          </body>
        </html>
      `

      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${content.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading:', err)
    }
  }

  const handleShare = async () => {
    if (navigator.share && content) {
      try {
        await navigator.share({
          title: content.title,
          text: content.excerpt,
          url: window.location.href,
        })
      } catch (err) {
        console.log("Error sharing:", err)
      }
    }
  }

  const handleOpenInNewTab = () => {
    if (content) {
      window.open(`/read/${content.id}`, "_blank")
    }
  }

  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  //if (!content) return null

  const isMultimedia = content?.type === "youtube" || content?.type === "tiktok" || content?.type === "instagram"
  const contentHtml = content ? (mockContentData[content.id] || `<p>${content.excerpt}</p>`) : ""

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipeThreshold = 100
    const swipeVelocityThreshold = 500

    if (info.offset.x > swipeThreshold || info.velocity.x > swipeVelocityThreshold) {
      // El usuario deslizó suficiente hacia la derecha
      setDragX(0) // Reset before closing
      onClose()
    } else {
      // Volver a la posición original
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

  const viewerVariants = {
    hidden:
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
          }
        : {
            scale: 0.95,
            opacity: 0,
          },
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
    <AnimatePresence mode="wait" onExitComplete={() => setShouldAnimateFromCard(false)}>
      {isOpen && content && (
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
              opacity: isDragging ? Math.max(0.3, 1 - dragX / 300) : 1,
            }}
          />

          {/* Content Viewer */}
          <motion.div
            variants={viewerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed z-50 overflow-hidden"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.2 }}
            dragDirectionLock
            onDragStart={() => setIsDragging(true)}
            onDrag={(_, info) => {
              // Solo permitir arrastrar hacia la derecha
              if (info.offset.x > 0) {
                setDragX(info.offset.x)
              }
            }}
            onDragEnd={handleDragEnd}
            style={{
              backgroundColor: isDarkMode ? "#0a0a0a" : backgroundColor,
              transformOrigin:
                cardPosition && shouldAnimateFromCard
                  ? `${cardPosition.left + cardPosition.width / 2}px ${cardPosition.top + cardPosition.height / 2}px`
                  : "center center",
              x: isDragging ? dragX : 0,
            }}
          >
            {/* Ambient background for multimedia content */}
            {isMultimedia && <AmbientBackground imageUrl={content.image} isActive={isPlaying} intensity={0.3} />}

            {/* Swipe indicator - only visible on touch devices */}
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-gradient-to-r from-primary/40 to-transparent rounded-r-full z-10 md:hidden pointer-events-none"
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

            {/* Reading progress bar */}
            <motion.div
              className="absolute top-0 left-0 w-full h-1 bg-border/20 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div
                className="h-full bg-primary"
                style={{ width: `${readingProgress}%` }}
                transition={{ duration: 0.2 }}
              />
            </motion.div>

            {/* Header */}
            <motion.header
              className="absolute top-0 left-0 right-0 z-10 glass-card border-b"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <div className="max-w-4xl mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={onClose} size="sm" className="hover-lift-subtle">
                    <X className="h-4 w-4 mr-2" />
                    Close
                  </Button>

                  <div className="flex items-center gap-2">
                    {isMultimedia && (
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={togglePlayback} className="hover-lift-subtle">
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={toggleMute} className="hover-lift-subtle">
                          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}

                    <Button variant="ghost" size="sm" onClick={handleSave} className="hover-lift-subtle">
                      {isSaved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                    </Button>

                    <Button variant="ghost" size="sm" onClick={handleDownload} className="hover-lift-subtle">
                      <Download className="h-4 w-4" />
                    </Button>

                    <Button variant="ghost" size="sm" onClick={handleShare} className="hover-lift-subtle">
                      <Share className="h-4 w-4" />
                    </Button>

                    <Button variant="ghost" size="sm" onClick={handleOpenInNewTab} className="hover-lift-subtle">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.header>

            {/* Reading Controls */}
            <motion.div
              className="absolute top-20 right-4 z-10"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              <ReadingControls
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
            </motion.div>

            {/* Scrollable Content */}
            <motion.div
              ref={contentRef}
              className="h-full overflow-y-auto pt-24 pb-8 px-4"
              style={{
                color: isDarkMode ? "#ffffff" : textColor,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
            >
              <article
                className="mx-auto transition-all duration-300"
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
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className={typeColors[content.type]}>
                      {typeIcons[content.type]} {content.type}
                    </Badge>
                    <span className="text-sm opacity-70">{content.source}</span>
                  </div>

                  <h1 className="text-4xl font-bold mb-4 text-balance leading-tight">{content.title}</h1>

                  <div className="flex items-center gap-4 text-sm opacity-70 mb-6">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {content.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {content.publishedAt}
                    </span>
                    {content.readTime && <span>{content.readTime}</span>}
                    {content.views && (
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {content.views}
                      </span>
                    )}
                  </div>

                  {/* Featured Image */}
                  <div className="relative aspect-video rounded-lg overflow-hidden mb-8">
                    <Image
                      src={content.image || "/placeholder.svg"}
                      alt={content.title}
                      fill
                      className="object-cover"
                      priority
                    />
                    {content.duration && (
                      <div className="absolute bottom-4 right-4 bg-black/80 text-white px-3 py-1 rounded text-sm">
                        {content.duration}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-8">
                    {content.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="glass">
                        {tag}
                      </Badge>
                    ))}
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
