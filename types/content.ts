import type {
  ContentType,
  SourceType,
  RSSContent,
  YouTubeContent,
  TwitterContent,
  InstagramContent,
  TikTokContent,
  PodcastContent,
  ContentSource,
  UserSource,
  UserContent,
  AnyContent,
  ContentWithSource,
  ContentWithUserData
} from './database'

// ===== COMPATIBILIDAD HACIA ATRÁS =====

/** @deprecated Use ContentType from database.ts instead */
export type LegacyContentType = "news" | "youtube" | "twitter" | "instagram" | "tiktok" | "newsletter"

/** @deprecated Use NormalizedContent instead */
export interface ContentItem {
  id: string
  type: LegacyContentType
  title: string
  content: string
  excerpt: string
  source: string
  author: string
  publishedAt: string
  image: string
  tags: string[]
  isRead: boolean
  isSaved: boolean
  readTime?: string
  duration?: string
  views?: string
  engagement?: string
}

// ===== UTILIDADES PARA CONTENIDO POLIMÓRFICO =====

/**
 * Mapea un tipo de contenido a su tabla correspondiente
 */
export const CONTENT_TYPE_TO_TABLE: Record<ContentType, string> = {
  rss: 'rss_content',
  youtube: 'youtube_content',
  twitter: 'twitter_content',
  instagram: 'instagram_content',
  tiktok: 'tiktok_content',
  podcast: 'podcast_content'
}

/**
 * Array con todos los tipos de contenido disponibles
 * Útil para iterar sobre todos los tipos
 */
export const ALL_CONTENT_TYPES = Object.keys(CONTENT_TYPE_TO_TABLE) as ContentType[]

/**
 * Tipos de contenido actualmente implementados/soportados
 * (excluye los que aún no tienen handler completo)
 */
export const ACTIVE_CONTENT_TYPES: ContentType[] = ['rss', 'youtube', 'podcast']

/**
 * Mapea un tipo de fuente a su tipo de contenido
 */
export const SOURCE_TYPE_TO_CONTENT_TYPE: Record<SourceType, ContentType | null> = {
  rss: 'rss',
  youtube_channel: 'youtube',
  youtube_video: 'youtube',
  twitter: 'twitter',
  instagram: 'instagram',
  tiktok: 'tiktok',
  podcast: 'podcast',
  newsletter: 'rss', // Los newsletters se tratan como RSS
  website: 'rss' // Los websites genéricos se tratan como RSS
}

/**
 * Nombres amigables para tipos de fuente
 */
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  rss: 'RSS Feed',
  youtube_channel: 'Canal de YouTube',
  youtube_video: 'Video de YouTube',
  twitter: 'Twitter/X',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  newsletter: 'Newsletter',
  website: 'Sitio Web',
  podcast: 'Podcast'
}

/**
 * Nombres amigables para tipos de contenido
 */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  rss: 'Artículo',
  youtube: 'Video',
  twitter: 'Tweet',
  instagram: 'Publicación',
  tiktok: 'Video',
  podcast: 'Episodio'
}

// ===== INTERFACES NORMALIZADAS =====

/**
 * Interfaz normalizada para cualquier contenido
 * Todos los tipos de contenido pueden ser mapeados a esta estructura
 */
export interface NormalizedContent {
  id: string
  contentType: ContentType
  sourceId: string
  
  // Campos comunes
  title: string
  url: string
  publishedAt: string | null
  createdAt: string
  
  // Campos opcionales
  description?: string | null
  excerpt?: string | null
  author?: string | null
  thumbnailUrl?: string | null
  mediaUrl?: string | null
  duration?: number | null // en segundos
  
  // Metadata adicional
  metadata?: Record<string, any>
}

/**
 * Contenido normalizado con datos de la fuente
 */
export interface NormalizedContentWithSource extends NormalizedContent {
  source: ContentSource
  userSource: UserSource | null
}

/**
 * Contenido normalizado con datos del usuario
 */
export interface NormalizedContentWithUserData extends NormalizedContentWithSource {
  userContent: UserContent | null
  
  // Acceso rápido a propiedades del usuario
  isRead: boolean
  isArchived: boolean
  isFavorite: boolean
  readingProgress: number
}

// ===== FUNCIONES DE NORMALIZACIÓN =====

/**
 * Normaliza contenido RSS
 */
export function normalizeRSSContent(content: RSSContent): NormalizedContent {
  return {
    id: content.id,
    contentType: 'rss',
    sourceId: content.source_id,
    title: content.title,
    url: content.url,
    publishedAt: content.published_at,
    createdAt: content.created_at,
    description: content.content,
    excerpt: content.excerpt,
    author: content.author,
    thumbnailUrl: content.image_url,
    duration: content.reading_time ? content.reading_time * 60 : null, // convertir minutos a segundos
    metadata: {
      wordCount: content.word_count,
      readingTime: content.reading_time
    }
  }
}

/**
 * Normaliza contenido de YouTube
 */
export function normalizeYouTubeContent(content: YouTubeContent): NormalizedContent {
  return {
    id: content.id,
    contentType: 'youtube',
    sourceId: content.source_id,
    title: content.title,
    url: content.url,
    publishedAt: content.published_at,
    createdAt: content.created_at,
    description: content.description,
    author: content.channel_name,
    thumbnailUrl: content.thumbnail_url,
    mediaUrl: content.video_url,
    duration: content.duration,
    metadata: {
      videoId: content.video_id,
      viewCount: content.view_count,
      likeCount: content.like_count
    }
  }
}

/**
 * Normaliza contenido de Twitter
 */
export function normalizeTwitterContent(content: TwitterContent): NormalizedContent {
  return {
    id: content.id,
    contentType: 'twitter',
    sourceId: content.source_id,
    title: content.text_content.substring(0, 100) + (content.text_content.length > 100 ? '...' : ''),
    url: content.url,
    publishedAt: content.published_at,
    createdAt: content.created_at,
    description: content.text_content,
    author: content.author_name || content.author_username,
    thumbnailUrl: content.media_urls?.[0],
    metadata: {
      tweetId: content.tweet_id,
      username: content.author_username,
      mediaUrls: content.media_urls,
      mediaTypes: content.media_types,
      retweetCount: content.retweet_count,
      likeCount: content.like_count,
      replyCount: content.reply_count
    }
  }
}

/**
 * Normaliza contenido de Instagram
 */
export function normalizeInstagramContent(content: InstagramContent): NormalizedContent {
  return {
    id: content.id,
    contentType: 'instagram',
    sourceId: content.source_id,
    title: content.caption?.substring(0, 100) + (content.caption && content.caption.length > 100 ? '...' : '') || 'Publicación de Instagram',
    url: content.url,
    publishedAt: content.published_at,
    createdAt: content.created_at,
    description: content.caption,
    author: content.author_username,
    thumbnailUrl: content.media_urls?.[0],
    metadata: {
      postId: content.post_id,
      mediaUrls: content.media_urls,
      mediaType: content.media_type,
      likeCount: content.like_count,
      commentCount: content.comment_count
    }
  }
}

/**
 * Normaliza contenido de TikTok
 */
export function normalizeTikTokContent(content: TikTokContent): NormalizedContent {
  return {
    id: content.id,
    contentType: 'tiktok',
    sourceId: content.source_id,
    title: content.description?.substring(0, 100) + (content.description && content.description.length > 100 ? '...' : '') || 'Video de TikTok',
    url: content.url,
    publishedAt: content.published_at,
    createdAt: content.created_at,
    description: content.description,
    author: content.author_username,
    thumbnailUrl: content.thumbnail_url,
    mediaUrl: content.video_url,
    duration: content.duration,
    metadata: {
      videoId: content.video_id,
      viewCount: content.view_count,
      likeCount: content.like_count,
      commentCount: content.comment_count,
      shareCount: content.share_count
    }
  }
}

/**
 * Normaliza contenido de Podcast
 */
export function normalizePodcastContent(content: PodcastContent): NormalizedContent {
  return {
    id: content.id,
    contentType: 'podcast',
    sourceId: content.source_id,
    title: content.title,
    url: content.url,
    publishedAt: content.published_at,
    createdAt: content.created_at,
    description: content.description,
    author: content.author,
    thumbnailUrl: content.image_url,
    mediaUrl: content.audio_url,
    duration: content.duration,
    metadata: {
      showNotes: content.show_notes,
      episodeNumber: content.episode_number,
      seasonNumber: content.season_number
    }
  }
}

/**
 * Normaliza cualquier tipo de contenido
 */
export function normalizeContent(content: AnyContent): NormalizedContent {
  const contentType = content.content_type
  
  switch (contentType) {
    case 'rss':
      return normalizeRSSContent(content as RSSContent & { content_type: 'rss' })
    case 'youtube':
      return normalizeYouTubeContent(content as YouTubeContent & { content_type: 'youtube' })
    case 'twitter':
      return normalizeTwitterContent(content as TwitterContent & { content_type: 'twitter' })
    case 'instagram':
      return normalizeInstagramContent(content as InstagramContent & { content_type: 'instagram' })
    case 'tiktok':
      return normalizeTikTokContent(content as TikTokContent & { content_type: 'tiktok' })
    case 'podcast':
      return normalizePodcastContent(content as PodcastContent & { content_type: 'podcast' })
    default:
      throw new Error(`Unknown content type: ${contentType}`)
  }
}

/**
 * Normaliza contenido con datos de la fuente
 */
export function normalizeContentWithSource<T extends AnyContent>(
  content: ContentWithSource<T>
): NormalizedContentWithSource {
  const normalized = normalizeContent(content)
  return {
    ...normalized,
    source: content.source,
    userSource: content.user_source
  }
}

/**
 * Normaliza contenido con datos del usuario
 */
export function normalizeContentWithUserData<T extends AnyContent>(
  content: ContentWithUserData<T>
): NormalizedContentWithUserData {
  const normalized = normalizeContentWithSource(content)
  return {
    ...normalized,
    userContent: content.user_content,
    isRead: content.user_content?.is_read ?? false,
    isArchived: content.user_content?.is_archived ?? false,
    isFavorite: content.user_content?.is_favorite ?? false,
    readingProgress: content.user_content?.reading_progress ?? 0
  }
}

// ===== TYPE GUARDS =====

export function isRSSContent(content: AnyContent): content is RSSContent & { content_type: 'rss' } {
  return content.content_type === 'rss'
}

export function isYouTubeContent(content: AnyContent): content is YouTubeContent & { content_type: 'youtube' } {
  return content.content_type === 'youtube'
}

export function isTwitterContent(content: AnyContent): content is TwitterContent & { content_type: 'twitter' } {
  return content.content_type === 'twitter'
}

export function isInstagramContent(content: AnyContent): content is InstagramContent & { content_type: 'instagram' } {
  return content.content_type === 'instagram'
}

export function isTikTokContent(content: AnyContent): content is TikTokContent & { content_type: 'tiktok' } {
  return content.content_type === 'tiktok'
}

export function isPodcastContent(content: AnyContent): content is PodcastContent & { content_type: 'podcast' } {
  return content.content_type === 'podcast'
}

export function isVideoContent(content: AnyContent): boolean {
  return content.content_type === 'youtube' || content.content_type === 'tiktok'
}

export function isAudioContent(content: AnyContent): boolean {
  return content.content_type === 'podcast'
}

export function isTextContent(content: AnyContent): boolean {
  return content.content_type === 'rss' || content.content_type === 'twitter'
}

export function isSocialMediaContent(content: AnyContent): boolean {
  return content.content_type === 'twitter' || 
         content.content_type === 'instagram' || 
         content.content_type === 'tiktok'
}
