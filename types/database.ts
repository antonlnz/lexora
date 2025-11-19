// Tipos generados a partir del schema de Supabase
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          reading_speed: number
          font_size: string
          theme_preference: string
          created_at: string
          updated_at: string
          onboarding_completed: boolean
          onboarding_completed_at: string | null
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          reading_speed?: number
          font_size?: string
          theme_preference?: string
          created_at?: string
          updated_at?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          reading_speed?: number
          font_size?: string
          theme_preference?: string
          created_at?: string
          updated_at?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
        }
      }
      sources: {
        Row: {
          id: string
          user_id: string
          title: string
          url: string
          description: string | null
          favicon_url: string | null
          source_type: 'rss' | 'youtube' | 'twitter' | 'instagram' | 'tiktok' | 'newsletter' | 'website'
          is_active: boolean
          last_fetched_at: string | null
          fetch_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          url: string
          description?: string | null
          favicon_url?: string | null
          source_type?: 'rss' | 'youtube' | 'twitter' | 'instagram' | 'tiktok' | 'newsletter' | 'website'
          is_active?: boolean
          last_fetched_at?: string | null
          fetch_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          url?: string
          description?: string | null
          favicon_url?: string | null
          source_type?: 'rss' | 'youtube' | 'twitter' | 'instagram' | 'tiktok' | 'newsletter' | 'website'
          is_active?: boolean
          last_fetched_at?: string | null
          fetch_error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      articles: {
        Row: {
          id: string
          source_id: string
          title: string
          url: string
          content: string | null
          excerpt: string | null
          author: string | null
          published_at: string | null
          image_url: string | null
          video_url: string | null
          media_type: 'image' | 'video' | 'audio' | 'none'
          video_duration: number | null
          reading_time: number | null
          word_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_id: string
          title: string
          url: string
          content?: string | null
          excerpt?: string | null
          author?: string | null
          published_at?: string | null
          image_url?: string | null
          video_url?: string | null
          media_type?: 'image' | 'video' | 'audio' | 'none'
          video_duration?: number | null
          reading_time?: number | null
          word_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          source_id?: string
          title?: string
          url?: string
          content?: string | null
          excerpt?: string | null
          author?: string | null
          published_at?: string | null
          image_url?: string | null
          video_url?: string | null
          media_type?: 'image' | 'video' | 'audio' | 'none'
          video_duration?: number | null
          reading_time?: number | null
          word_count?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      user_articles: {
        Row: {
          id: string
          user_id: string
          article_id: string
          is_read: boolean
          is_archived: boolean
          is_favorite: boolean
          reading_progress: number
          reading_time_spent: number
          read_at: string | null
          archived_at: string | null
          favorited_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          article_id: string
          is_read?: boolean
          is_archived?: boolean
          is_favorite?: boolean
          reading_progress?: number
          reading_time_spent?: number
          read_at?: string | null
          archived_at?: string | null
          favorited_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          article_id?: string
          is_read?: boolean
          is_archived?: boolean
          is_favorite?: boolean
          reading_progress?: number
          reading_time_spent?: number
          read_at?: string | null
          archived_at?: string | null
          favorited_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      collections: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          color: string
          icon: string | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          color?: string
          icon?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          color?: string
          icon?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      collection_articles: {
        Row: {
          id: string
          collection_id: string
          article_id: string
          position: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          collection_id: string
          article_id: string
          position?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          collection_id?: string
          article_id?: string
          position?: number
          notes?: string | null
          created_at?: string
        }
      }
    }
  }
}

// Tipos de conveniencia
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Source = Database['public']['Tables']['sources']['Row']
export type Article = Database['public']['Tables']['articles']['Row']
export type UserArticle = Database['public']['Tables']['user_articles']['Row']
export type Collection = Database['public']['Tables']['collections']['Row']
export type CollectionArticle = Database['public']['Tables']['collection_articles']['Row']

// Tipos para inserts
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type SourceInsert = Database['public']['Tables']['sources']['Insert']
export type ArticleInsert = Database['public']['Tables']['articles']['Insert']
export type UserArticleInsert = Database['public']['Tables']['user_articles']['Insert']
export type CollectionInsert = Database['public']['Tables']['collections']['Insert']
export type CollectionArticleInsert = Database['public']['Tables']['collection_articles']['Insert']

// Tipos para updates
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type SourceUpdate = Database['public']['Tables']['sources']['Update']
export type ArticleUpdate = Database['public']['Tables']['articles']['Update']
export type UserArticleUpdate = Database['public']['Tables']['user_articles']['Update']
export type CollectionUpdate = Database['public']['Tables']['collections']['Update']
export type CollectionArticleUpdate = Database['public']['Tables']['collection_articles']['Update']

// Tipos extendidos con relaciones
export type ArticleWithSource = Article & {
  source: Source
}

export type ArticleWithUserData = Article & {
  source: Source
  user_article: UserArticle | null
}

export type CollectionWithArticles = Collection & {
  collection_articles: (CollectionArticle & {
    article: ArticleWithSource
  })[]
}
