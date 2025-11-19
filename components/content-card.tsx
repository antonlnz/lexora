"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Bookmark, BookmarkCheck, Clock, ExternalLink, Play, Share, User } from "lucide-react"
import type { ArticleWithUserData } from "@/types/database"
import { articleService } from "@/lib/services/article-service"

interface ContentCardProps {
  article: ArticleWithUserData
  viewMode: "grid" | "list"
  onOpenViewer?: (article: ArticleWithUserData, cardElement: HTMLElement) => void
}

const typeIcons: Record<string, string> = {
  rss: "📰",
  youtube: "🎥",
  twitter: "🐦",
  instagram: "📸",
  tiktok: "🎵",
  newsletter: "📧",
  website: "🌐",
}

const typeColors: Record<string, string> = {
  news: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  rss: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  youtube: "bg-red-500/10 text-red-600 border-red-500/20",
  twitter: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  tiktok: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  newsletter: "bg-green-500/10 text-green-600 border-green-500/20",
  website: "bg-gray-500/10 text-gray-600 border-gray-500/20",
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

export function ContentCard({ article, viewMode, onOpenViewer }: ContentCardProps) {
  const [isSaved, setIsSaved] = useState(article.user_article?.is_favorite || false)
  const [isRead, setIsRead] = useState(article.user_article?.is_read || false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await articleService.toggleFavorite(article.id, !isSaved)
      setIsSaved(!isSaved)
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (!isRead) {
        await articleService.markAsRead(article.id)
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
  const readTime = article.reading_time ? `${article.reading_time} min read` : undefined
  
  // Detectar si es video: por media_type, video_url, o si image_url es un video
  const hasVideoUrl = !!article.video_url
  const imageUrlIsVideo = isVideoUrl(article.image_url)
  const isVideo = article.media_type === 'video' || hasVideoUrl || imageUrlIsVideo || 
                  sourceType === 'youtube' || sourceType === 'tiktok'
  
  const videoDuration = article.video_duration ? formatVideoDuration(article.video_duration) : null
  
  // Determinar qué URL usar para cada propósito
  // Si image_url es un video, usarlo como video y buscar poster alternativo
  const videoSrc = hasVideoUrl ? article.video_url : (imageUrlIsVideo ? article.image_url : null)
  const imageSrc = imageUrlIsVideo ? "/placeholder.svg" : (article.image_url || "/placeholder.svg")

  if (viewMode === "list") {
    return (
      <Card
        ref={cardRef}
        className={`glass-card p-4 hover-lift-subtle transition-all duration-300 cursor-pointer ${isRead ? "opacity-60" : ""}`}
        onClick={handleOpenContent}
      >
        <div className="flex gap-4">
          <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden">
            {isVideo ? (
              <>
                {videoSrc ? (
                  <video 
                    src={videoSrc}
                    poster={imageSrc !== "/placeholder.svg" ? imageSrc : undefined}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  // Fallback: usar solo el poster si no hay video_url
                  <img 
                    src={imageSrc}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                  <div className="bg-white/90 rounded-full p-2 shadow-lg">
                    <Play className="h-4 w-4 text-black fill-black" />
                  </div>
                </div>
                {videoDuration && (
                  <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                    {videoDuration}
                  </div>
                )}
              </>
            ) : (
              // Usar img normal en lugar de Image de Next.js para evitar errores con URLs inesperadas
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
                <Badge variant="outline" className={typeColors[sourceType] || typeColors.rss}>
                  {typeIcons[sourceType] || typeIcons.rss} {sourceType}
                </Badge>
                <span className="text-sm text-muted-foreground">{article.source.title}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleSave} className="h-8 w-8 p-0">
                  {isSaved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-pretty">{article.title}</h3>
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{article.excerpt || "No excerpt available"}</p>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                {article.author && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {article.author}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {relativeTime}
                </span>
                {readTime && <span>{readTime}</span>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkRead}
                className="text-xs"
              >
                {isRead ? "Mark Unread" : "Mark Read"}
              </Button>
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
        {isVideo ? (
          <>
            {videoSrc ? (
              <video
                src={videoSrc}
                poster={imageSrc !== "/placeholder.svg" ? imageSrc : undefined}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              // Fallback: usar solo el poster si no hay video_url
              <img
                src={imageSrc}
                alt={article.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-linear-to-t from-black/60 via-transparent to-transparent">
              <div className="bg-white/95 rounded-full p-4 group-hover:bg-white group-hover:scale-110 transition-all duration-300 shadow-xl">
                <Play className="h-8 w-8 text-black fill-black" />
              </div>
            </div>
            {videoDuration && (
              <div className="absolute bottom-3 right-3 bg-black/90 text-white text-sm font-medium px-2.5 py-1 rounded backdrop-blur-sm">
                {videoDuration}
              </div>
            )}
          </>
        ) : (
          // Usar img normal en lugar de Image de Next.js para evitar errores con URLs inesperadas
          <img
            src={imageSrc}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        {(sourceType === "youtube" || sourceType === "tiktok") && !isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/50 rounded-full p-3 group-hover:bg-black/70 transition-colors">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge variant="outline" className={`${typeColors[sourceType] || typeColors.rss} backdrop-blur-sm`}>
            {typeIcons[sourceType] || typeIcons.rss} {sourceType}
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-sm text-muted-foreground font-medium">{article.source.title}</span>
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
        <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{article.excerpt || "No excerpt available"}</p>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            {article.author && (
              <>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {article.author}
                </span>
                <span>•</span>
              </>
            )}
            <span>{relativeTime}</span>
          </div>
          <div className="flex items-center gap-2">
            {readTime && <span>{readTime}</span>}
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
