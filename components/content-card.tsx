"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Bookmark, BookmarkCheck, Clock, ExternalLink, Play, Share, User, Eye, ThumbsUp } from "lucide-react"
import { contentService, type ContentWithMetadata } from "@/lib/services/content-service"
import { 
  getSourceTypeIcon, 
  getSourceTypeLabel, 
  getSourceTypeColor,
  getContentExcerpt,
  getContentAuthor,
  getContentDuration,
  getContentThumbnail,
  getContentMediaUrl,
  getContentMediaType,
  isVideoContent as checkIsVideoContent,
  getContentViewCount,
  getContentLikeCount,
  formatCount,
  formatDuration
} from "@/lib/content-type-config"
import type { SourceType } from "@/types/database"

interface ContentCardProps {
  article: ContentWithMetadata
  viewMode: "grid" | "list"
  onOpenViewer?: (article: ContentWithMetadata, cardElement: HTMLElement) => void
}

// Función auxiliar para calcular tiempo relativo
function getRelativeTime(date: string | null): string {
  if (!date) return "Unknown"
  
  const now = new Date()
  const publishedDate = new Date(date)
  const diffInMs = now.getTime() - publishedDate.getTime()
  
  const minutes = Math.floor(diffInMs / 60000)
  const hours = Math.floor(diffInMs / 3600000)
  const days = Math.floor(diffInMs / 86400000)
  
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

// Función auxiliar para formatear duración de video
function formatVideoDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Función auxiliar para detectar si una URL es un video
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

// Función para determinar el thumbnail de un video
function getVideoThumbnail(article: ContentWithMetadata): string | null {
  // 1. Usar el helper centralizado primero
  const thumbnail = getContentThumbnail(article)
  if (thumbnail) return thumbnail
  
  // 2. Si es YouTube, extraer el thumbnail de la URL
  if (article.source.source_type === 'youtube_channel' || article.source.source_type === 'youtube_video') {
    const ytThumbnail = getYouTubeThumbnail(article.url)
    if (ytThumbnail) return ytThumbnail
  }
  
  // 3. Fallback a null (sin thumbnail)
  return null
}

// Función para obtener la URL del video
function getVideoUrl(article: ContentWithMetadata): string | null {
  // Usar el helper centralizado
  const mediaType = getContentMediaType(article)
  if (mediaType === 'video') {
    return getContentMediaUrl(article)
  }
  return null
}

// Función para determinar si es contenido de video
function isVideoContent(article: ContentWithMetadata): boolean {
  return checkIsVideoContent(article)
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

export function ContentCard({ article, viewMode, onOpenViewer }: ContentCardProps) {
  const [isSaved, setIsSaved] = useState(article.user_content?.is_favorite || false)
  const [isRead, setIsRead] = useState(article.user_content?.is_read || false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await contentService.toggleFavorite(article.content_type, article.id, !isSaved)
      setIsSaved(!isSaved)
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (!isRead) {
        await contentService.markAsRead(article.content_type, article.id)
      }
      setIsRead(!isRead)
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const handleOpenContent = () => {
    if (onOpenViewer && cardRef.current) {
      onOpenViewer(article, cardRef.current)
    }
  }

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`/read/${article.id}`, "_blank")
  }

  const sourceType = article.source.source_type
  const relativeTime = getRelativeTime(article.published_at)
  const readingTime = getContentDuration(article)
  const readTime = readingTime ? `${readingTime} min read` : undefined
  
  // Detectar si es video usando la nueva función helper
  const isVideo = isVideoContent(article)
  
  // Obtener URLs de video y thumbnail
  const videoSrc = getVideoUrl(article)
  const posterSrc = isVideo ? getVideoThumbnail(article) : getContentMediaUrl(article)

  // Para imageSrc de fallback: usar poster o placeholder
  const imageSrc = posterSrc || "/placeholder.svg"
  // Duración del video (si está disponible)
  const videoDuration = isVideo ? getContentDuration(article) : null
  const videoDurationFormatted = formatDuration(videoDuration)
  
  // Estadísticas de video (YouTube)
  const viewCount = getContentViewCount(article)
  const likeCount = getContentLikeCount(article)
  const viewCountFormatted = formatCount(viewCount)
  const likeCountFormatted = formatCount(likeCount)
  
  // Si hay video pero no hay poster, mostrar el video con metadata para cargar el primer frame
  const showVideoWithoutPoster = isVideo && videoSrc && !posterSrc

  if (viewMode === "list") {
    return (
      <Card
        ref={cardRef}
        className={`glass-card p-4 hover-lift-subtle transition-all duration-300 cursor-pointer ${isRead ? "opacity-60" : ""}`}
        onClick={handleOpenContent}
      >
        <div className="flex gap-4">
          <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-muted">
            {isVideo && videoSrc ? (
              <>
                {/* Si hay poster, mostrarlo como fondo */}
                {posterSrc && (
                  <img 
                    src={posterSrc}
                    alt={article.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {/* Video siempre visible - si no hay poster, el atributo preload="metadata" cargará el primer frame */}
                <video 
                  src={videoSrc}
                  poster={posterSrc || undefined}
                  className="relative w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  style={{ pointerEvents: 'none' }}
                  // Forzar que se muestre algo aunque no haya poster
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget
                    video.currentTime = 0.1 // Buscar 0.1 segundos para asegurar que se muestre un frame
                  }}
                />
                {/* Overlay de play */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                  <div className="bg-white/90 rounded-full p-2 shadow-lg">
                    <Play className="h-4 w-4 text-black fill-black" />
                  </div>
                </div>
                {/* Mostrar duración si está disponible */}
                {videoDuration && (
                  <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatVideoDuration(videoDuration)}
                  </div>
                )}
              </>
            ) : (
              // Usar img normal para imágenes o cuando solo hay thumbnail sin video
              <img 
                src={imageSrc} 
                alt={article.title} 
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <TypeBadge sourceType={sourceType as SourceType} />
                <div className="flex items-center gap-1.5">
                  {article.source.favicon_url ? (
                    <img 
                      src={article.source.favicon_url} 
                      alt="" 
                      className="h-4 w-4 rounded-sm object-cover"
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  ) : null}
                  <span className="text-sm text-muted-foreground">{article.source.title}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleSave} className="h-8 w-8 p-0 hover-lift-subtle">
                  {isSaved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover-lift-subtle">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-pretty">{article.title}</h3>
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{getContentExcerpt(article) || "No excerpt available"}</p>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4 flex-wrap">
                {getContentAuthor(article) && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {getContentAuthor(article)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {relativeTime}
                </span>
                {/* Para videos: mostrar duración, vistas y likes */}
                {isVideo && videoDurationFormatted && (
                  <span className="flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    {videoDurationFormatted}
                  </span>
                )}
                {viewCountFormatted && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {viewCountFormatted}
                  </span>
                )}
                {likeCountFormatted && (
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    {likeCountFormatted}
                  </span>
                )}
                {/* Para artículos: mostrar tiempo de lectura */}
                {!isVideo && readTime && <span>{readTime}</span>}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkRead}
                className="text-xs hover-lift-subtle"
              >
                {isRead ? "Mark Unread" : "Mark Read"}
              </Button>
              <Button size="sm" className="default hover-lift-subtle" onClick={handleOpenInNewTab}>
                <ExternalLink className="h-3 w-3 mr-2" />
                Read
              </Button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      ref={cardRef}
      className={`glass-card overflow-hidden hover-lift-strong transition-all duration-300 group cursor-pointer ${isRead ? "opacity-60" : ""}`}
      onClick={handleOpenContent}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {isVideo && videoSrc ? (
          <>
            {/* Si hay poster, mostrarlo como fondo */}
            {posterSrc && (
              <img
                src={posterSrc}
                alt={article.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            )}
            {/* Video siempre visible - si no hay poster, el atributo preload="metadata" cargará el primer frame */}
            <video
              src={videoSrc}
              poster={posterSrc || undefined}
              className="relative w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              muted
              playsInline
              preload="metadata"
              style={{ pointerEvents: 'none' }}
              // Forzar que se muestre algo aunque no haya poster
              onLoadedMetadata={(e) => {
                const video = e.currentTarget
                video.currentTime = 0.1 // Buscar 0.1 segundos para asegurar que se muestre un frame
              }}
            />
            {/* Overlay de play */}
            <div className="absolute inset-0 flex items-center justify-center bg-linear-to-t from-black/60 via-transparent to-transparent">
              <div className="bg-white/95 rounded-full p-4 group-hover:bg-white group-hover:scale-110 transition-all duration-300 shadow-xl">
                <Play className="h-8 w-8 text-black fill-black" />
              </div>
            </div>
            {/* Mostrar duración si está disponible */}
            {videoDuration && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-sm px-2 py-1 rounded">
                {formatVideoDuration(videoDuration)}
              </div>
            )}
          </>
        ) : isVideo && !videoSrc ? (
          <>
            {/* Mostrar thumbnail cuando no hay videoSrc */}
            <img
              src={imageSrc}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {/* Overlay de play */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="bg-white/95 rounded-full p-4 group-hover:bg-white group-hover:scale-110 transition-all duration-300 shadow-xl">
                <Play className="h-8 w-8 text-black fill-black" />
              </div>
            </div>
          </>
        ) : (
          // Usar img normal para imágenes
          <img
            src={imageSrc}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        <div className="absolute top-2 left-2">
          <TypeBadge sourceType={sourceType as SourceType} className="backdrop-blur-sm" />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            {article.source.favicon_url ? (
              <img 
                src={article.source.favicon_url} 
                alt="" 
                className="h-4 w-4 rounded-sm object-cover"
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
            ) : null}
            <span className="text-sm text-muted-foreground font-medium">{article.source.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleSave} className="h-8 w-8 p-0">
              {isSaved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Share className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-pretty">{article.title}</h3>
        <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{getContentExcerpt(article) || "No excerpt available"}</p>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            {getContentAuthor(article) && (
              <>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {getContentAuthor(article)}
                </span>
                <span>•</span>
              </>
            )}
            <span>{relativeTime}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Para videos: mostrar duración, vistas y likes */}
            {isVideo && videoDurationFormatted && (
              <span className="flex items-center gap-1" title="Duración">
                <Play className="h-3 w-3" />
                {videoDurationFormatted}
              </span>
            )}
            {viewCountFormatted && (
              <span className="flex items-center gap-1" title="Visualizaciones">
                <Eye className="h-3 w-3" />
                {viewCountFormatted}
              </span>
            )}
            {likeCountFormatted && (
              <span className="flex items-center gap-1" title="Me gusta">
                <ThumbsUp className="h-3 w-3" />
                {likeCountFormatted}
              </span>
            )}
            {/* Para artículos: mostrar tiempo de lectura */}
            {!isVideo && readTime && <span>{readTime}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkRead}
            className="text-xs"
          >
            {isRead ? "Mark Unread" : "Mark Read"}
          </Button>
          <Button size="sm" className="default" onClick={handleOpenInNewTab}>
            <ExternalLink className="h-3 w-3 mr-2" />
            Read
          </Button>
        </div>
      </div>
    </Card>
  )
}
