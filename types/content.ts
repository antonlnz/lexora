export type ContentType = "news" | "youtube" | "twitter" | "instagram" | "tiktok" | "newsletter"

export interface ContentItem {
  id: string
  type: ContentType
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
