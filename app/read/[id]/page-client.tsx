"use client"

import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DynamicIsland } from "@/components/dynamic-island"
import { AmbientBackground } from "@/components/ambient-background"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  Eye,
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"

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
const mockContent: Record<string, ContentItem> = {
  "1": {
    id: "1",
    type: "news",
    title: "The Future of Sustainable Technology in 2025",
    excerpt:
      "Exploring breakthrough innovations that are reshaping how we think about environmental responsibility in tech.",
    source: "TechCrunch",
    author: "Sarah Chen",
    publishedAt: "2 hours ago",
    readTime: "5 min read",
    image: "/placeholder.svg?height=400&width=800",
    tags: ["Technology", "Sustainability", "Innovation"],
    isRead: false,
    isSaved: false,
  },
  "2": {
    id: "2",
    type: "youtube",
    title: "Building Modern Web Applications with Next.js 15",
    excerpt: "A comprehensive guide to the latest features and best practices for modern web development.",
    source: "Vercel",
    author: "Lee Robinson",
    publishedAt: "4 hours ago",
    duration: "24:15",
    image: "/placeholder.svg?height=400&width=800",
    tags: ["Web Development", "Next.js", "Tutorial"],
    isRead: false,
    isSaved: true,
    views: "125K views",
  },
}

const mockContentData: Record<string, string> = {
  "1": `
    <p>The world of technology is rapidly evolving, and sustainability has become a cornerstone of innovation. As we move into 2025, we're witnessing unprecedented developments that promise to reshape our relationship with the environment.</p>
    
    <h2>Revolutionary Breakthroughs</h2>
    <p>From carbon-negative data centers to biodegradable electronics, the tech industry is pioneering solutions that don't just minimize harm—they actively heal our planet. Companies are investing billions in research that could fundamentally change how we produce, consume, and dispose of technology.</p>
    
    <p>One of the most exciting developments is the emergence of bio-computing, where living organisms are used to process information. This technology could reduce energy consumption by up to 90% compared to traditional silicon-based processors.</p>
    
    <h2>The Role of AI in Sustainability</h2>
    <p>Artificial intelligence is playing a crucial role in optimizing energy consumption across industries. Smart grids powered by AI can predict energy demand with unprecedented accuracy, reducing waste and improving efficiency.</p>
    
    <p>Machine learning algorithms are also being used to design more efficient materials, predict equipment failures before they happen, and optimize supply chains to minimize carbon footprints.</p>
  `,
  "2": `
    <div class="video-container mb-6">
      <div class="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <div class="text-center">
          <div class="h-16 w-16 mx-auto mb-4 opacity-50">▶</div>
          <p class="text-muted-foreground">Video Player Placeholder</p>
        </div>
      </div>
    </div>
    
    <p>In this comprehensive tutorial, we'll explore the latest features of Next.js 15 and how they can revolutionize your web development workflow.</p>
    
    <h2>What's New in Next.js 15</h2>
    <p>Next.js 15 introduces several groundbreaking features that make building modern web applications faster and more efficient than ever before.</p>
    
    <h3>Server Components by Default</h3>
    <p>All components are now server components by default, providing better performance and smaller bundle sizes out of the box.</p>
    
    <h3>Improved Caching</h3>
    <p>The new caching system is more intelligent and provides better control over data freshness and revalidation strategies.</p>
  `,
}

export default function ReadPageClient() {
  const params = useParams()
  const router = useRouter()
  const contentRef = useRef<HTMLDivElement>(null)
  const [content, setContent] = useState<ContentItem | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Get all available articles for navigation
  const allArticleIds = Object.keys(mockContent)
  const currentArticleIndex = allArticleIds.indexOf(params.id as string)
  const hasNext = currentArticleIndex !== -1 && currentArticleIndex < allArticleIds.length - 1
  const hasPrevious = currentArticleIndex > 0

  // Reading customization state
  const [fontSize, setFontSize] = useState(16)
  const [fontFamily, setFontFamily] = useState("inter")
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [backgroundColor, setBackgroundColor] = useState("#ffffff")
  const [textColor, setTextColor] = useState("#000000")
  const [lineHeight, setLineHeight] = useState(1.6)
  const [maxWidth, setMaxWidth] = useState(800)

  // Update theme-color meta tag when background color changes
  useEffect(() => {
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

    // Cleanup: restore default color when component unmounts
    return () => {
      const defaultColor = document.documentElement.classList.contains('dark') ? '#000000' : '#ffffff'
      existingMetas.forEach(meta => meta.remove())
      const newMeta = document.createElement('meta')
      newMeta.setAttribute('name', 'theme-color')
      newMeta.setAttribute('content', defaultColor)
      document.head.appendChild(newMeta)
    }
  }, [backgroundColor])

  useEffect(() => {
    const id = params.id as string
    const foundContent = mockContent[id]
    if (foundContent) {
      setContent(foundContent)
      setIsSaved(foundContent.isSaved)
    }
  }, [params.id])

  const handleNavigateNext = () => {
    if (hasNext) {
      const nextId = allArticleIds[currentArticleIndex + 1]
      router.push(`/read/${nextId}`)
    }
  }

  const handleNavigatePrevious = () => {
    if (hasPrevious) {
      const previousId = allArticleIds[currentArticleIndex - 1]
      router.push(`/read/${previousId}`)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasNext) {
        handleNavigateNext()
      } else if (e.key === 'ArrowLeft' && hasPrevious) {
        handleNavigatePrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasNext, hasPrevious, currentArticleIndex])

  // Touch swipe navigation
  useEffect(() => {
    let touchStartX = 0
    let touchEndX = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].clientX
      handleSwipe()
    }

    const handleSwipe = () => {
      const swipeThreshold = 100
      const diff = touchStartX - touchEndX

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0 && hasNext) {
          // Swipe left - next article
          handleNavigateNext()
        } else if (diff < 0 && hasPrevious) {
          // Swipe right - previous article
          handleNavigatePrevious()
        }
      }
    }

    const contentElement = contentRef.current
    if (contentElement) {
      contentElement.addEventListener('touchstart', handleTouchStart, { passive: true })
      contentElement.addEventListener('touchend', handleTouchEnd, { passive: true })

      return () => {
        contentElement.removeEventListener('touchstart', handleTouchStart)
        contentElement.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [hasNext, hasPrevious, currentArticleIndex])

  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        const element = contentRef.current
        const scrollTop = element.scrollTop
        const scrollHeight = element.scrollHeight - element.clientHeight
        const progress = scrollHeight > 0 ? Math.min((scrollTop / scrollHeight) * 100, 100) : 0
        setReadingProgress(progress)
        
        // Detectar si está scrolling
        setIsScrolling(true)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false)
        }, 150)
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
  }, [])

  const handleSave = () => {
    setIsSaved(!isSaved)
  }

  const handleDownload = async () => {
    if (!content) return

    try {
      // Crear un blob con el contenido del artículo
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
    window.open(window.location.href, '_blank')
  }

  const handleClose = () => {
    router.back()
  }

  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Content not found</h1>
          <p className="text-muted-foreground mb-4">The content you're looking for doesn't exist.</p>
          <Button onClick={() => router.push("/")} className="default hover-lift-subtle">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Feed
          </Button>
        </div>
      </div>
    )
  }

  const isMultimedia = content.type === "youtube" || content.type === "tiktok" || content.type === "instagram"
  const contentHtml = mockContentData[content.id] || `<p>${content.excerpt}</p>`

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundColor: isDarkMode ? "#0a0a0a" : backgroundColor,
      }}
    >
      {/* Ambient background for multimedia content */}
      {isMultimedia && <AmbientBackground imageUrl={content.image} isActive={isPlaying} intensity={0.3} />}

      {/* Swipe indicators - only visible on touch devices */}
      {hasPrevious && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-linear-to-r from-primary/40 to-transparent rounded-r-full z-10 md:hidden pointer-events-none" />
      )}
      {hasNext && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-linear-to-l from-primary/40 to-transparent rounded-l-full z-10 md:hidden pointer-events-none" />
      )}

      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-border/20 z-10">
        <div className="h-full bg-primary transition-all duration-200" style={{ width: `${readingProgress}%` }} />
      </div>

      {/* Header - Navigation buttons */}
      <header className="sticky top-0 z-10 glass-card border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()} size="sm" className="hover-lift-subtle">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="hidden md:flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleNavigatePrevious} 
              disabled={!hasPrevious}
              className="hover-lift-subtle"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleNavigateNext} 
              disabled={!hasNext}
              className="hover-lift-subtle"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Dynamic Island with all controls */}
      <DynamicIsland
        onClose={handleClose}
        isSaved={isSaved}
        onSave={handleSave}
        onDownload={handleDownload}
        onShare={handleShare}
        onOpenInNewTab={handleOpenInNewTab}
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

      {/* Scrollable Content */}
      <div
        ref={contentRef}
        className="overflow-y-auto pt-8 pb-16 px-4"
        style={{
          color: isDarkMode ? "#ffffff" : textColor,
          minHeight: "calc(100vh - 73px)",
        }}
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
      </div>
    </div>
  )
}
