/**
 * Configuración centralizada de tipos de contenido y fuentes
 * 
 * Este archivo contiene toda la configuración visual (iconos, colores, labels)
 * para mantener consistencia en toda la UI.
 */

import {
  Youtube,
  Twitter,
  Instagram,
  Music2,
  Mail,
  Rss,
  Globe,
  Headphones,
  type LucideIcon
} from "lucide-react"
import type { ContentType, SourceType, RSSContent, YouTubeContent } from "@/types/database"
import type { ContentWithMetadata } from "@/lib/services/content-service"

// ============================================================================
// ICONOS - Lucide Icons para componentes React
// ============================================================================

/**
 * Iconos de Lucide para cada tipo de fuente
 */
export const SOURCE_TYPE_ICONS: Record<SourceType, LucideIcon> = {
  rss: Rss,
  youtube_channel: Youtube,
  youtube_video: Youtube,
  twitter: Twitter,
  instagram: Instagram,
  tiktok: Music2,
  newsletter: Mail,
  website: Globe,
  podcast: Headphones,
}

/**
 * Iconos de Lucide para cada tipo de contenido
 */
export const CONTENT_TYPE_ICONS: Record<ContentType, LucideIcon> = {
  rss: Rss,
  youtube: Youtube,
  twitter: Twitter,
  instagram: Instagram,
  tiktok: Music2,
  podcast: Headphones,
}

// ============================================================================
// LABELS - Nombres amigables para mostrar en la UI
// ============================================================================

/**
 * Labels para tipos de fuente
 */
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  rss: "RSS",
  youtube_channel: "YouTube",
  youtube_video: "YouTube",
  twitter: "Twitter",
  instagram: "Instagram",
  tiktok: "TikTok",
  newsletter: "Newsletter",
  website: "Website",
  podcast: "Podcast",
}

/**
 * Labels para tipos de contenido
 */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  rss: "RSS",
  youtube: "YouTube",
  twitter: "Twitter",
  instagram: "Instagram",
  tiktok: "TikTok",
  podcast: "Podcast",
}

// ============================================================================
// COLORES - Clases de Tailwind para badges y elementos visuales
// ============================================================================

/**
 * Colores para tipos de fuente (incluye variantes como youtube_channel)
 */
export const SOURCE_TYPE_COLORS: Record<SourceType, string> = {
  rss: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  youtube_channel: "bg-red-500/10 text-red-600 border-red-500/20",
  youtube_video: "bg-red-500/10 text-red-600 border-red-500/20",
  twitter: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  tiktok: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  newsletter: "bg-green-500/10 text-green-600 border-green-500/20",
  website: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  podcast: "bg-violet-500/10 text-violet-600 border-violet-500/20",
}

/**
 * Colores para tipos de contenido
 */
export const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  rss: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  youtube: "bg-red-500/10 text-red-600 border-red-500/20",
  twitter: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  tiktok: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  podcast: "bg-violet-500/10 text-violet-600 border-violet-500/20",
}

// ============================================================================
// HELPERS - Funciones de utilidad
// ============================================================================

/**
 * Obtiene el icono para un tipo de fuente
 */
export function getSourceTypeIcon(sourceType: SourceType): LucideIcon {
  return SOURCE_TYPE_ICONS[sourceType] || Globe
}

/**
 * Obtiene el icono para un tipo de contenido
 */
export function getContentTypeIcon(contentType: ContentType): LucideIcon {
  return CONTENT_TYPE_ICONS[contentType] || Rss
}

/**
 * Obtiene el label para un tipo de fuente
 */
export function getSourceTypeLabel(sourceType: SourceType): string {
  return SOURCE_TYPE_LABELS[sourceType] || sourceType
}

/**
 * Obtiene el label para un tipo de contenido
 */
export function getContentTypeLabel(contentType: ContentType): string {
  return CONTENT_TYPE_LABELS[contentType] || contentType
}

/**
 * Obtiene el color para un tipo de fuente
 */
export function getSourceTypeColor(sourceType: SourceType): string {
  return SOURCE_TYPE_COLORS[sourceType] || SOURCE_TYPE_COLORS.website
}

/**
 * Obtiene el color para un tipo de contenido
 */
export function getContentTypeColor(contentType: ContentType): string {
  return CONTENT_TYPE_COLORS[contentType] || CONTENT_TYPE_COLORS.rss
}

/**
 * Mapea un source_type a content_type
 * Útil para normalizar youtube_channel/youtube_video -> youtube
 */
export function sourceTypeToContentType(sourceType: SourceType): ContentType {
  switch (sourceType) {
    case 'youtube_channel':
    case 'youtube_video':
      return 'youtube'
    case 'newsletter':
    case 'website':
      return 'rss'
    default:
      return sourceType as ContentType
  }
}

// ============================================================================
// HELPERS DE ACCESO NORMALIZADO A CONTENIDO
// ============================================================================

/**
 * Type guard para verificar si es contenido RSS
 */
export function isRSSContent(content: ContentWithMetadata): content is ContentWithMetadata & RSSContent {
  return content.content_type === 'rss'
}

/**
 * Type guard para verificar si es contenido de YouTube
 */
export function isYouTubeContent(content: ContentWithMetadata): content is ContentWithMetadata & YouTubeContent {
  return content.content_type === 'youtube'
}

/**
 * Obtiene el excerpt/descripción del contenido de forma normalizada
 */
export function getContentExcerpt(content: ContentWithMetadata): string | null {
  if (isRSSContent(content)) {
    return content.excerpt || null
  }
  if (isYouTubeContent(content)) {
    return content.description || null
  }
  return null
}

/**
 * Obtiene el autor del contenido de forma normalizada
 */
export function getContentAuthor(content: ContentWithMetadata): string | null {
  if (isRSSContent(content)) {
    return content.author || null
  }
  if (isYouTubeContent(content)) {
    return content.channel_name || null
  }
  return null
}

/**
 * Obtiene el tiempo de lectura/duración del contenido
 */
export function getContentDuration(content: ContentWithMetadata): number | null {
  if (isRSSContent(content)) {
    return content.reading_time || null
  }
  if (isYouTubeContent(content)) {
    return content.duration || null
  }
  return null
}

/**
 * Obtiene la URL de la imagen/thumbnail del contenido
 */
export function getContentThumbnail(content: ContentWithMetadata): string | null {
  if (isRSSContent(content)) {
    return content.featured_thumbnail_url || content.featured_media_url || content.image_url || null
  }
  if (isYouTubeContent(content)) {
    return content.thumbnail_url || null
  }
  return null
}

/**
 * Obtiene la URL del media (video/imagen) del contenido
 * Para YouTube, usa la URL del video directamente
 */
export function getContentMediaUrl(content: ContentWithMetadata): string | null {
  if (isRSSContent(content)) {
    return content.featured_media_url || content.image_url || null
  }
  if (isYouTubeContent(content)) {
    // Usar la URL del video de YouTube directamente
    return content.url || null
  }
  return null
}

/**
 * Obtiene el tipo de media del contenido
 */
export function getContentMediaType(content: ContentWithMetadata): 'none' | 'image' | 'video' {
  if (isRSSContent(content)) {
    return content.featured_media_type || 'none'
  }
  if (isYouTubeContent(content)) {
    return 'video'
  }
  return 'none'
}

/**
 * Verifica si el contenido es de tipo video
 */
export function isVideoContent(content: ContentWithMetadata): boolean {
  if (content.content_type === 'rss') {
    return (content as ContentWithMetadata & RSSContent).featured_media_type === 'video'
  }
  // YouTube siempre es video
  if (content.content_type === 'youtube') {
    return true
  }
  // Por tipo de fuente
  const sourceType = content.source.source_type
  return sourceType === 'youtube_channel' || sourceType === 'youtube_video' || sourceType === 'tiktok'
}

/**
 * Obtiene el número de visualizaciones (solo YouTube por ahora)
 */
export function getContentViewCount(content: ContentWithMetadata): number | null {
  if (isYouTubeContent(content)) {
    return content.view_count || null
  }
  return null
}

/**
 * Obtiene el número de likes (solo YouTube por ahora)
 */
export function getContentLikeCount(content: ContentWithMetadata): number | null {
  if (isYouTubeContent(content)) {
    return content.like_count || null
  }
  return null
}

/**
 * Formatea un número grande de forma legible (1.2K, 3.4M, etc.)
 */
export function formatCount(count: number | null): string | null {
  if (count === null || count === undefined) return null
  
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

/**
 * Formatea duración en segundos a formato legible (mm:ss o hh:mm:ss)
 */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Extrae el ID del video de YouTube de una URL
 */
export function extractYouTubeVideoId(url: string | null): string | null {
  if (!url) return null
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /youtube\.com\/shorts\/([^&\?\/]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

