"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DynamicIsland } from "@/components/dynamic-island"
import { AmbientBackground } from "@/components/ambient-background"
import { VideoAmbientBackground } from "@/components/video-ambient-background"
import {
  User,
  Clock,
  Eye,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import type { ArticleWithUserData } from "@/types/database"
import { useIsMobile } from "@/hooks/use-mobile"
import { LexoraLogo } from "@/components/lexora-logo"
import { sanitizeHTML } from "@/lib/utils/security"

const typeIcons = {
  news: "📰",
  rss: "📰",
  youtube: "🎥",
  youtube_channel: "🎥",
  youtube_video: "🎥",
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
  youtube_channel: "bg-red-500/10 text-red-600 border-red-500/20",
  youtube_video: "bg-red-500/10 text-red-600 border-red-500/20",
  twitter: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  tiktok: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  newsletter: "bg-green-500/10 text-green-600 border-green-500/20",
  website: "bg-gray-500/10 text-gray-600 border-gray-500/20",
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
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /youtube\.com\/shorts\/([^&\?\/]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
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
    image: article.featured_media_type === 'image' 
      ? (article.featured_media_url || article.image_url || '/placeholder.svg')
      : (article.featured_thumbnail_url || article.image_url || '/placeholder.svg'),
    isRead: article.user_article?.is_read || false,
    isSaved: article.user_article?.is_favorite || false,
    videoUrl: article.featured_media_type === 'video' ? article.featured_media_url : null,
    videoDuration: article.featured_media_duration,
    mediaType: article.featured_media_type,
  }
}

export default function ReadPageClient({ initialId }: { initialId?: string }) {
  const params = useParams()
  const router = useRouter()
  const contentRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [content, setContent] = useState<ArticleWithUserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaved, setIsSaved] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [showPlayButton, setShowPlayButton] = useState(true)
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number | null>(null)
  const [isMediaVertical, setIsMediaVertical] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMobile = useIsMobile()

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
    const existingMetas = document.querySelectorAll('meta[name="theme-color"]')
    existingMetas.forEach(meta => meta.remove())
    
    const themeColorMeta = document.createElement('meta')
    themeColorMeta.setAttribute('name', 'theme-color')
    themeColorMeta.setAttribute('content', backgroundColor)
    document.head.appendChild(themeColorMeta)
    
    let appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    if (!appleStatusBarMeta) {
      appleStatusBarMeta = document.createElement('meta')
      appleStatusBarMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style')
      document.head.appendChild(appleStatusBarMeta)
    }
    appleStatusBarMeta.setAttribute('content', 'black-translucent')

    return () => {
      const defaultColor = document.documentElement.classList.contains('dark') ? '#000000' : '#ffffff'
      existingMetas.forEach(meta => meta.remove())
      const newMeta = document.createElement('meta')
      newMeta.setAttribute('name', 'theme-color')
      newMeta.setAttribute('content', defaultColor)
      document.head.appendChild(newMeta)
    }
  }, [backgroundColor])

  // Fetch article data
  useEffect(() => {
    const fetchArticle = async () => {
      const id = params.id as string
      if (!id) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/articles/${id}`)
        if (!response.ok) {
          throw new Error('Article not found')
        }
        const data = await response.json()
        setContent(data)
        setIsSaved(data.user_article?.is_favorite || false)
        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching article:', error)
        setIsLoading(false)
      }
    }

    fetchArticle()
  }, [params.id])

  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        const element = contentRef.current
        const scrollTop = element.scrollTop
        const scrollHeight = element.scrollHeight - element.clientHeight
        const progress = scrollHeight > 0 ? Math.min((scrollTop / scrollHeight) * 100, 100) : 0
        setReadingProgress(progress)
        
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

  useEffect(() => {
    if (content) {
      setMediaAspectRatio(null)
      setIsMediaVertical(false)
    }
  }, [content])

  const handleDownload = async () => {
    if (!content) return

    try {
      const contentHtml = content.content || `<p>${content.excerpt || ''}</p>`
      
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
              <p>By ${content.author || 'Unknown'} | ${content.source.title} | ${content.published_at ? new Date(content.published_at).toLocaleDateString() : 'Unknown'}</p>
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
    if (!content) return
    
    const shareUrl = `${window.location.origin}/read/${content.id}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: content.title,
          text: content.excerpt || '',
          url: shareUrl,
        })
      } catch (err) {
        // User cancelled or error occurred
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

  const handleOpenOriginal = () => {
    if (content && content.url && content.url !== '#') {
      window.open(content.url, "_blank")
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading article...</p>
        </div>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Content not found</h1>
          <p className="text-muted-foreground mb-4">The content you're looking for doesn't exist.</p>
          <Button onClick={() => router.push("/")} className="default hover-lift-subtle">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  const normalizedContent = normalizeContent(content)
  const isMultimedia = normalizedContent.type === "youtube_channel" || 
                       normalizedContent.type === "youtube_video" || 
                       normalizedContent.type === "tiktok" || 
                       normalizedContent.type === "instagram"
  
  const hasVideo = normalizedContent.videoUrl || 
                   normalizedContent.mediaType === 'video' || 
                   isVideoUrl(normalizedContent.image)
  
  let videoThumbnail: string | null = null
  if (normalizedContent.type === 'youtube_channel' || normalizedContent.type === 'youtube_video') {
    videoThumbnail = getYouTubeThumbnail(content.url) || getYouTubeThumbnail(normalizedContent.videoUrl)
  }
  if (!videoThumbnail && normalizedContent.image && !isVideoUrl(normalizedContent.image)) {
    videoThumbnail = normalizedContent.image
  }
  
  const videoPlayUrl = normalizedContent.videoUrl || 
                       (isVideoUrl(normalizedContent.image) ? normalizedContent.image : null)
  
  const contentHtml = normalizedContent.content || `<p>${normalizedContent.excerpt}</p>`

  // Get share URL
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/read/${content.id}` : ''

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundColor: isDarkMode ? "#0a0a0a" : backgroundColor,
      }}
    >
      {/* Ambient background for multimedia content */}
      {/* {hasVideo && isVideoPlaying && videoRef.current ? (
        <VideoAmbientBackground 
          videoElement={videoRef.current} 
          isPlaying={isVideoPlaying} 
          intensity={0.6}
          updateInterval={200}
        /> */}
      ) : isMultimedia ? (
        <AmbientBackground imageUrl={normalizedContent.image} isActive={isPlaying} intensity={0.3} />
      ) : null

      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-border/20 z-10">
        <div className="h-full bg-primary transition-all duration-200" style={{ width: `${readingProgress}%` }} />
      </div>

      {/* Header with Lexora logo */}
      <header className="fixed top-0 left-0 right-0 z-30 backdrop-blur-sm bg-background/20 border-b border-border/20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <LexoraLogo href="/signup" />
          
          <Button 
            variant="ghost" 
            onClick={() => router.push("/signup")} 
            size="sm" 
            className="hover-lift-subtle"
          >
            Sign up
          </Button>
        </div>
      </header>

      {/* Dynamic Island - without close button */}
      <DynamicIsland
        onClose={() => {}} // No-op since we're in public page
        onDownload={handleDownload}
        onShare={handleShare}
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
        hideCloseButton={true}
        shareUrl={shareUrl}
      />

      {/* Scrollable Content */}
      <div
        ref={contentRef}
        className="overflow-y-auto pt-20 pb-16 px-4"
        style={{
          color: isDarkMode ? "#ffffff" : textColor,
          minHeight: "100vh",
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
              <Badge variant="outline" className={typeColors[normalizedContent.type as keyof typeof typeColors] || typeColors.website}>
                {typeIcons[normalizedContent.type as keyof typeof typeIcons] || typeIcons.website} {normalizedContent.type}
              </Badge>
              <span className="text-sm opacity-70">{normalizedContent.source}</span>
            </div>

            <h1 className="text-4xl font-bold mb-4 text-balance leading-tight">{normalizedContent.title}</h1>

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
            <div 
              className={`relative rounded-lg overflow-hidden mb-8 bg-muted ${
                mediaAspectRatio !== null
                  ? isMediaVertical
                    ? 'aspect-[9/16] max-h-[80vh]'
                    : 'aspect-video'
                  : 'aspect-video'
              }`}
              style={{
                ...(mediaAspectRatio !== null && isMediaVertical
                  ? { maxWidth: '100%', width: 'auto', margin: '0 auto' }
                  : {})
              }}
            >
              {(() => {
                const youtubeId = getYouTubeVideoId(normalizedContent.videoUrl)
                
                if (youtubeId) {
                  return (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`}
                      title={normalizedContent.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  )
                } else if (hasVideo && videoPlayUrl) {
                  return (
                    <div className="relative w-full h-full group">
                      {videoThumbnail && (
                        <img
                          src={videoThumbnail}
                          alt={normalizedContent.title}
                          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${isVideoPlaying ? 'opacity-0' : 'opacity-100'}`}
                          onLoad={(e) => {
                            const img = e.currentTarget
                            const aspectRatio = img.naturalWidth / img.naturalHeight
                            setMediaAspectRatio(aspectRatio)
                            setIsMediaVertical(aspectRatio < 1)
                          }}
                        />
                      )}
                      
                      {showPlayButton && (
                        <button
                          onClick={() => videoRef.current?.play()}
                          className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-all duration-300 hover:bg-black/40 z-10"
                        >
                          <div className="bg-white/95 rounded-full p-6 shadow-2xl transform transition-transform hover:scale-110">
                            <svg className="h-12 w-12 text-black fill-black" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </button>
                      )}

                      <video
                        ref={videoRef}
                        src={videoPlayUrl}
                        poster={videoThumbnail || undefined}
                        controls
                        muted={isMuted}
                        loop
                        playsInline
                        className="relative w-full h-full object-contain"
                        preload="metadata"
                        onPlay={handleVideoPlay}
                        onPause={handleVideoPause}
                        onLoadedMetadata={(e) => {
                          const video = e.currentTarget
                          const aspectRatio = video.videoWidth / video.videoHeight
                          setMediaAspectRatio(aspectRatio)
                          setIsMediaVertical(aspectRatio < 1)
                          if (!videoThumbnail) {
                            video.currentTime = 0.1
                          }
                        }}
                      >
                        Tu navegador no soporta la reproducción de videos.
                      </video>
                    </div>
                  )
                } else {
                  return (
                    <img
                      src={videoThumbnail || normalizedContent.image || "/placeholder.svg"}
                      alt={normalizedContent.title}
                      className="absolute inset-0 w-full h-full object-contain"
                      onLoad={(e) => {
                        const img = e.currentTarget
                        const aspectRatio = img.naturalWidth / img.naturalHeight
                        setMediaAspectRatio(aspectRatio)
                        setIsMediaVertical(aspectRatio < 1)
                      }}
                    />
                  )
                }
              })()}
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
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(contentHtml) }}
          />
        </article>
      </div>
    </div>
  )
}
