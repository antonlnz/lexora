"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Bookmark, BookmarkCheck, Clock, ExternalLink, Play, Share, User, Eye, ThumbsUp, Loader2 } from "lucide-react"
import { contentService, type ContentWithMetadata } from "@/lib/services/content-service"
import { FolderPicker } from "@/components/folder-picker"
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
import { useCardDisplaySettings } from "@/contexts/interface-settings-context"
import type { SourceType } from "@/types/database"

interface ContentCardProps {
  article: ContentWithMetadata
  viewMode: "grid" | "list"
  onOpenViewer?: (article: ContentWithMetadata, cardElement: HTMLElement) => void
  onUnarchive?: (article: ContentWithMetadata) => void
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

// Función para obtener la URL del video (solo para videos que se pueden cargar directamente, NO YouTube)
function getVideoUrl(article: ContentWithMetadata): string | null {
  // YouTube no se puede cargar directamente en un elemento <video>
  // Solo usar el thumbnail + botón de play
  if (article.source.source_type === 'youtube_channel' || article.source.source_type === 'youtube_video') {
    return null
  }
  
  // Para otros videos (RSS con video embebido), usar el helper centralizado
  const mediaType = getContentMediaType(article)
  if (mediaType === 'video') {
    return getContentMediaUrl(article)
  }
  return null
}

// Función para verificar si es contenido de YouTube
function isYouTubeContent(article: ContentWithMetadata): boolean {
  return article.source.source_type === 'youtube_channel' || article.source.source_type === 'youtube_video'
}

// Función para determinar si es contenido de video
function isVideoContent(article: ContentWithMetadata): boolean {
  return checkIsVideoContent(article)
}

// Función para obtener el excerpt con manejo inteligente para videos sin descripción
function getSmartExcerpt(article: ContentWithMetadata): string | null {
  const excerpt = getContentExcerpt(article)
  if (excerpt) return excerpt
  
  // Para videos sin descripción (como Shorts), no mostrar nada
  // en lugar de "No excerpt available"
  if (checkIsVideoContent(article)) {
    return null
  }
  
  return null
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

export function ContentCard({ article, viewMode, onOpenViewer, onUnarchive }: ContentCardProps) {
  const [isSaved, setIsSaved] = useState(article.user_content?.is_archived || false)
  const [isRead, setIsRead] = useState(article.user_content?.is_read || false)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    article.user_content?.folder_id || null
  )
  const [savingToFolder, setSavingToFolder] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const pointerDownTarget = useRef<EventTarget | null>(null)
  
  // Get display settings from context
  const { showThumbnails, showExcerpts, compactView } = useCardDisplaySettings()

  // Handler para guardar con carpeta usando FolderPicker
  const handleSaveToFolder = async (folderId: string | null) => {
    setSavingToFolder(true)
    try {
      await contentService.archiveToFolder(article.content_type, article.id, folderId)
      setIsSaved(true)
      setCurrentFolderId(folderId)
    } catch (error) {
      console.error('Error saving to folder:', error)
    } finally {
      setSavingToFolder(false)
    }
  }

  // Handler para quitar del archivo (si ya está guardado y se hace clic)
  const handleToggleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSaved) {
      // Si ya está guardado, quitarlo del archivo
      try {
        await contentService.toggleArchive(article.content_type, article.id, false)
        setIsSaved(false)
        setCurrentFolderId(null)
        // Notificar al padre para actualizar la lista
        onUnarchive?.(article)
      } catch (error) {
        console.error('Error removing from archive:', error)
      }
    }
    // Si no está guardado, el FolderPicker manejará la acción
  }

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await contentService.toggleArchive(article.content_type, article.id, !isSaved)
      setIsSaved(!isSaved)
    } catch (error) {
      console.error('Error toggling archive:', error)
    }
  }

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const newIsRead = !isRead
      await contentService.toggleRead(article.content_type, article.id, newIsRead)
      setIsRead(newIsRead)
    } catch (error) {
      console.error('Error toggling read status:', error)
    }
  }

  const handleOpenContent = () => {
    if (onOpenViewer && cardRef.current) {
      onOpenViewer(article, cardRef.current)
    }
  }

  // Handlers para evitar problemas de doble clic con elementos interactivos anidados
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownTarget.current = e.target
  }

  const handleClick = (e: React.MouseEvent) => {
    // Solo abrir el viewer si el pointerDown y el click fueron en el mismo elemento
    // y no fue en un elemento interactivo (botones, links, etc.)
    const target = e.target as HTMLElement
    const isInteractive = target.closest('button, a, [role="button"], [data-radix-collection-item]')
    
    if (!isInteractive && pointerDownTarget.current === e.target) {
      handleOpenContent()
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
  
  // Verificar si es contenido de YouTube (no se puede cargar directamente en <video>)
  const isYouTube = isYouTubeContent(article)

  if (viewMode === "list") {
    return (
      <Card
        ref={cardRef}
        className={`glass-card ${compactView ? 'p-2' : 'p-4'} hover-lift-subtle transition-all duration-300 cursor-pointer ${isRead ? "opacity-60" : ""}`}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <div className="flex gap-4">
          {showThumbnails && (
            <div className={`relative ${compactView ? 'w-16 h-16' : 'w-24 h-24'} shrink-0 rounded-lg overflow-hidden bg-muted`}>
              {isVideo && videoSrc && !isYouTube ? (
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
                  {videoDuration && !compactView && (
                    <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                      {formatVideoDuration(videoDuration)}
                    </div>
                  )}
                </>
              ) : isYouTube || isVideo ? (
                // YouTube o video sin src: mostrar thumbnail con overlay de play
                <>
                  <img 
                    src={imageSrc} 
                    alt={article.title} 
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay de play para videos */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                    <div className="bg-white/90 rounded-full p-2 shadow-lg">
                      <Play className="h-4 w-4 text-black fill-black" />
                    </div>
                  </div>
                  {/* Mostrar duración si está disponible */}
                  {videoDuration && !compactView && (
                    <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                      {formatVideoDuration(videoDuration)}
                    </div>
                  )}
                </>
              ) : (
                // Usar img normal para imágenes
                <img 
                  src={imageSrc} 
                  alt={article.title} 
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {!compactView && <TypeBadge sourceType={sourceType as SourceType} />}
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
                {isSaved ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleToggleArchive} 
                    className="h-8 w-8 p-0 hover-lift-subtle"
                    title="Quitar del archivo"
                  >
                    <BookmarkCheck className="h-4 w-4 text-primary" />
                  </Button>
                ) : (
                  <FolderPicker
                    selectedFolderId={currentFolderId}
                    onSelect={handleSaveToFolder}
                    trigger={
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 hover-lift-subtle"
                        onClick={(e) => e.stopPropagation()}
                        disabled={savingToFolder}
                        title="Guardar en carpeta"
                      >
                        {savingToFolder ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Bookmark className="h-4 w-4" />
                        )}
                      </Button>
                    }
                  />
                )}
                {!compactView && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover-lift-subtle">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <h3 className={`font-semibold ${compactView ? 'text-base' : 'text-lg'} mb-2 ${compactView ? 'line-clamp-1' : 'line-clamp-2'} text-pretty`}>{article.title}</h3>
            {showExcerpts && !compactView && getSmartExcerpt(article) && (
              <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{getSmartExcerpt(article)}</p>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4 flex-wrap">
                {!compactView && getContentAuthor(article) && (
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
                {isVideo && videoDurationFormatted && !compactView && (
                  <span className="flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    {videoDurationFormatted}
                  </span>
                )}
                {viewCountFormatted && !compactView && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {viewCountFormatted}
                  </span>
                )}
                {likeCountFormatted && !compactView && (
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    {likeCountFormatted}
                  </span>
                )}
                {/* Para artículos: mostrar tiempo de lectura */}
                {!isVideo && readTime && !compactView && <span>{readTime}</span>}
              </div>
            </div>

            {!compactView && (
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
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      ref={cardRef}
      className={`glass-card overflow-hidden hover-lift-strong transition-all duration-300 group cursor-pointer flex flex-col h-full p-0! gap-0! ${isRead ? "opacity-60" : ""}`}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {showThumbnails && (
        <div className={`relative ${compactView ? 'aspect-2/1' : 'aspect-video'} overflow-hidden bg-muted rounded-t-xl`}>
          {isVideo && videoSrc && !isYouTube ? (
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
                <div className={`bg-white/95 rounded-full ${compactView ? 'p-2' : 'p-4'} group-hover:bg-white group-hover:scale-110 transition-all duration-300 shadow-xl`}>
                  <Play className={`${compactView ? 'h-5 w-5' : 'h-8 w-8'} text-black fill-black`} />
                </div>
              </div>
              {/* Mostrar duración si está disponible */}
              {videoDuration && (
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-sm px-2 py-1 rounded">
                  {formatVideoDuration(videoDuration)}
                </div>
              )}
            </>
          ) : isYouTube || isVideo ? (
            <>
              {/* YouTube o video sin src: mostrar thumbnail con overlay de play */}
              <img
                src={imageSrc}
                alt={article.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {/* Overlay de play */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className={`bg-white/95 rounded-full ${compactView ? 'p-2' : 'p-4'} group-hover:bg-white group-hover:scale-110 transition-all duration-300 shadow-xl`}>
                  <Play className={`${compactView ? 'h-5 w-5' : 'h-8 w-8'} text-black fill-black`} />
                </div>
              </div>
              {/* Mostrar duración si está disponible */}
              {videoDuration && (
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-sm px-2 py-1 rounded">
                  {formatVideoDuration(videoDuration)}
                </div>
              )}
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
      )}

      <div className={`${compactView ? 'p-3 pb-3' : 'p-4 pb-4'} flex flex-col flex-1 ${showThumbnails ? (compactView ? 'min-h-[180px]' : 'min-h-[280px]') : 'min-h-[120px]'}`}>
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
            {isSaved ? (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleToggleArchive} 
                className="h-8 w-8 p-0"
                title="Quitar del archivo"
              >
                <BookmarkCheck className="h-4 w-4 text-primary" />
              </Button>
            ) : (
              <FolderPicker
                selectedFolderId={currentFolderId}
                onSelect={handleSaveToFolder}
                trigger={
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                    disabled={savingToFolder}
                    title="Guardar en carpeta"
                  >
                    {savingToFolder ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </Button>
                }
              />
            )}
            {!compactView && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Share className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Show type badge here if thumbnails are hidden */}
        {!showThumbnails && (
          <div className="mb-2">
            <TypeBadge sourceType={sourceType as SourceType} />
          </div>
        )}

        <h3 className={`font-semibold ${compactView ? 'text-base' : 'text-lg'} mb-2 ${compactView ? 'line-clamp-2' : 'line-clamp-2'} text-pretty`}>{article.title}</h3>
        {showExcerpts && !compactView && getSmartExcerpt(article) && (
          <p className="text-muted-foreground text-sm line-clamp-3">{getSmartExcerpt(article)}</p>
        )}

        {/* Spacer para empujar todo lo de abajo hacia el fondo */}
        <div className="flex-1" />

        <div className="mt-auto">
          <div className={`flex items-center justify-between text-sm text-muted-foreground ${compactView ? 'mb-2' : 'mb-3'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              {!compactView && getContentAuthor(article) && (
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
              {isVideo && videoDurationFormatted && !compactView && (
                <span className="flex items-center gap-1" title="Duración">
                  <Play className="h-3 w-3" />
                  {videoDurationFormatted}
                </span>
              )}
              {viewCountFormatted && !compactView && (
                <span className="flex items-center gap-1" title="Visualizaciones">
                  <Eye className="h-3 w-3" />
                  {viewCountFormatted}
                </span>
              )}
              {likeCountFormatted && !compactView && (
                <span className="flex items-center gap-1" title="Me gusta">
                  <ThumbsUp className="h-3 w-3" />
                  {likeCountFormatted}
                </span>
              )}
              {/* Para artículos: mostrar tiempo de lectura */}
              {!isVideo && readTime && !compactView && <span>{readTime}</span>}
            </div>
          </div>

          {!compactView && (
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
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
          )}
        </div>
      </div>
    </Card>
  )
}
