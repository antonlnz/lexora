// Tipos generados a partir del nuevo schema normalizado de Supabase
export type SourceType = 'rss' | 'youtube_channel' | 'youtube_video' | 'twitter' | 'instagram' | 'tiktok' | 'newsletter' | 'website' | 'podcast'
export type ContentType = 'rss' | 'youtube' | 'twitter' | 'instagram' | 'tiktok' | 'podcast'
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing'

export interface Database {
  public: {
    Tables: {
      // ===== PERFILES Y CONFIGURACIONES =====
      profiles_new: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          updated_at?: string
        }
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          description: string | null
          price_monthly: number | null
          price_yearly: number | null
          features: Record<string, any>
          max_sources: number | null
          max_archived_items: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price_monthly?: number | null
          price_yearly?: number | null
          features?: Record<string, any>
          max_sources?: number | null
          max_archived_items?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          price_monthly?: number | null
          price_yearly?: number | null
          features?: Record<string, any>
          max_sources?: number | null
          max_archived_items?: number | null
          updated_at?: string
        }
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          status: SubscriptionStatus
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          status?: SubscriptionStatus
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          plan_id?: string
          status?: SubscriptionStatus
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
      }
      user_viewer_settings: {
        Row: {
          user_id: string
          font_family: string
          font_size: number
          line_height: number
          max_width: number
          background_color: string
          text_color: string
          text_align: 'left' | 'justify'
          theme: 'light' | 'dark' | 'auto'
          reading_speed: number
          auto_mark_read: boolean
          auto_save_progress: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          font_family?: string
          font_size?: number
          line_height?: number
          max_width?: number
          background_color?: string
          text_color?: string
          text_align?: 'left' | 'justify'
          theme?: 'light' | 'dark' | 'auto'
          reading_speed?: number
          auto_mark_read?: boolean
          auto_save_progress?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          font_family?: string
          font_size?: number
          line_height?: number
          max_width?: number
          background_color?: string
          text_color?: string
          text_align?: 'left' | 'justify'
          theme?: 'light' | 'dark' | 'auto'
          reading_speed?: number
          auto_mark_read?: boolean
          auto_save_progress?: boolean
          updated_at?: string
        }
      }
      user_interface_settings: {
        Row: {
          user_id: string
          theme_preference: 'light' | 'dark' | 'system'
          font_family: string
          font_size: number
          sidebar_collapsed: boolean
          view_mode: 'compact' | 'comfortable' | 'spacious'
          items_per_page: number
          show_thumbnails: boolean
          show_excerpts: boolean
          compact_view: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          theme_preference?: 'light' | 'dark' | 'system'
          font_family?: string
          font_size?: number
          sidebar_collapsed?: boolean
          view_mode?: 'compact' | 'comfortable' | 'spacious'
          items_per_page?: number
          show_thumbnails?: boolean
          show_excerpts?: boolean
          compact_view?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          theme_preference?: 'light' | 'dark' | 'system'
          font_family?: string
          font_size?: number
          sidebar_collapsed?: boolean
          view_mode?: 'compact' | 'comfortable' | 'spacious'
          items_per_page?: number
          show_thumbnails?: boolean
          show_excerpts?: boolean
          compact_view?: boolean
          updated_at?: string
        }
      }
      user_notification_settings: {
        Row: {
          user_id: string
          email_notifications: boolean
          push_notifications: boolean
          notify_new_content: boolean
          notify_digest: boolean
          digest_frequency: 'daily' | 'weekly' | 'monthly' | 'never'
          notify_recommendations: boolean
          quiet_hours_enabled: boolean
          quiet_hours_start: string | null
          quiet_hours_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email_notifications?: boolean
          push_notifications?: boolean
          notify_new_content?: boolean
          notify_digest?: boolean
          digest_frequency?: 'daily' | 'weekly' | 'monthly' | 'never'
          notify_recommendations?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_start?: string | null
          quiet_hours_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email_notifications?: boolean
          push_notifications?: boolean
          notify_new_content?: boolean
          notify_digest?: boolean
          digest_frequency?: 'daily' | 'weekly' | 'monthly' | 'never'
          notify_recommendations?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_start?: string | null
          quiet_hours_end?: string | null
          updated_at?: string
        }
      }
      user_privacy_settings: {
        Row: {
          user_id: string
          profile_public: boolean
          activity_public: boolean
          allow_analytics: boolean
          allow_personalization: boolean
          data_retention_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          profile_public?: boolean
          activity_public?: boolean
          allow_analytics?: boolean
          allow_personalization?: boolean
          data_retention_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile_public?: boolean
          activity_public?: boolean
          allow_analytics?: boolean
          allow_personalization?: boolean
          data_retention_days?: number
          updated_at?: string
        }
      }
      // ===== FUENTES Y CONTENIDO =====
      content_sources: {
        Row: {
          id: string
          source_type: SourceType
          url: string
          title: string
          description: string | null
          favicon_url: string | null
          image_url: string | null
          metadata: Record<string, any>
          last_fetched_at: string | null
          fetch_error: string | null
          fetch_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_type: SourceType
          url: string
          title: string
          description?: string | null
          favicon_url?: string | null
          image_url?: string | null
          metadata?: Record<string, any>
          last_fetched_at?: string | null
          fetch_error?: string | null
          fetch_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          source_type?: SourceType
          title?: string
          description?: string | null
          favicon_url?: string | null
          image_url?: string | null
          metadata?: Record<string, any>
          last_fetched_at?: string | null
          fetch_error?: string | null
          fetch_count?: number
          updated_at?: string
        }
      }
      user_sources: {
        Row: {
          id: string
          user_id: string
          source_id: string
          custom_title: string | null
          is_active: boolean
          notification_enabled: boolean
          folder: string | null
          tags: string[]
          subscribed_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_id: string
          custom_title?: string | null
          is_active?: boolean
          notification_enabled?: boolean
          folder?: string | null
          tags?: string[]
          subscribed_at?: string
          updated_at?: string
        }
        Update: {
          custom_title?: string | null
          is_active?: boolean
          notification_enabled?: boolean
          folder?: string | null
          tags?: string[]
          updated_at?: string
        }
      }
      rss_content: {
        Row: {
          id: string
          source_id: string
          title: string
          url: string
          author: string | null
          published_at: string | null
          content: string | null
          excerpt: string | null
          // Nueva estructura para media destacada
          featured_media_type: 'none' | 'image' | 'video'
          featured_media_url: string | null
          featured_thumbnail_url: string | null
          featured_media_duration: number | null
          // Campos legacy (mantener para compatibilidad)
          image_url: string | null
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
          author?: string | null
          published_at?: string | null
          content?: string | null
          excerpt?: string | null
          // Nueva estructura para media destacada
          featured_media_type?: 'none' | 'image' | 'video'
          featured_media_url?: string | null
          featured_thumbnail_url?: string | null
          featured_media_duration?: number | null
          // Campos legacy (mantener para compatibilidad)
          image_url?: string | null
          reading_time?: number | null
          word_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          author?: string | null
          published_at?: string | null
          content?: string | null
          excerpt?: string | null
          // Nueva estructura para media destacada
          featured_media_type?: 'none' | 'image' | 'video'
          featured_media_url?: string | null
          featured_thumbnail_url?: string | null
          featured_media_duration?: number | null
          // Campos legacy (mantener para compatibilidad)
          image_url?: string | null
          reading_time?: number | null
          word_count?: number | null
          updated_at?: string
        }
      }
      youtube_content: {
        Row: {
          id: string
          source_id: string
          video_id: string
          title: string
          url: string
          channel_name: string | null
          published_at: string | null
          description: string | null
          thumbnail_url: string | null
          video_url: string | null
          duration: number | null
          view_count: number | null
          like_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_id: string
          video_id: string
          title: string
          url: string
          channel_name?: string | null
          published_at?: string | null
          description?: string | null
          thumbnail_url?: string | null
          video_url?: string | null
          duration?: number | null
          view_count?: number | null
          like_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          thumbnail_url?: string | null
          view_count?: number | null
          like_count?: number | null
          updated_at?: string
        }
      }
      twitter_content: {
        Row: {
          id: string
          source_id: string
          tweet_id: string
          url: string
          author_username: string | null
          author_name: string | null
          published_at: string | null
          text_content: string
          media_urls: string[]
          media_types: string[]
          retweet_count: number | null
          like_count: number | null
          reply_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_id: string
          tweet_id: string
          url: string
          author_username?: string | null
          author_name?: string | null
          published_at?: string | null
          text_content: string
          media_urls?: string[]
          media_types?: string[]
          retweet_count?: number | null
          like_count?: number | null
          reply_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          text_content?: string
          retweet_count?: number | null
          like_count?: number | null
          reply_count?: number | null
          updated_at?: string
        }
      }
      instagram_content: {
        Row: {
          id: string
          source_id: string
          post_id: string
          url: string
          author_username: string | null
          published_at: string | null
          caption: string | null
          media_urls: string[]
          media_type: 'image' | 'video' | 'carousel'
          like_count: number | null
          comment_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_id: string
          post_id: string
          url: string
          author_username?: string | null
          published_at?: string | null
          caption?: string | null
          media_urls?: string[]
          media_type: 'image' | 'video' | 'carousel'
          like_count?: number | null
          comment_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          like_count?: number | null
          comment_count?: number | null
          updated_at?: string
        }
      }
      tiktok_content: {
        Row: {
          id: string
          source_id: string
          video_id: string
          url: string
          author_username: string | null
          published_at: string | null
          description: string | null
          video_url: string | null
          thumbnail_url: string | null
          duration: number | null
          view_count: number | null
          like_count: number | null
          comment_count: number | null
          share_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_id: string
          video_id: string
          url: string
          author_username?: string | null
          published_at?: string | null
          description?: string | null
          video_url?: string | null
          thumbnail_url?: string | null
          duration?: number | null
          view_count?: number | null
          like_count?: number | null
          comment_count?: number | null
          share_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          view_count?: number | null
          like_count?: number | null
          comment_count?: number | null
          share_count?: number | null
          updated_at?: string
        }
      }
      podcast_content: {
        Row: {
          id: string
          source_id: string
          title: string
          url: string
          author: string | null
          published_at: string | null
          description: string | null
          show_notes: string | null
          audio_url: string
          image_url: string | null
          duration: number | null
          episode_number: number | null
          season_number: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_id: string
          title: string
          url: string
          author?: string | null
          published_at?: string | null
          description?: string | null
          show_notes?: string | null
          audio_url: string
          image_url?: string | null
          duration?: number | null
          episode_number?: number | null
          season_number?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          show_notes?: string | null
          updated_at?: string
        }
      }
      user_content: {
        Row: {
          id: string
          user_id: string
          content_type: ContentType
          content_id: string
          is_read: boolean
          is_archived: boolean
          is_favorite: boolean
          folder_id: string | null
          reading_progress: number
          time_spent: number
          notes: string | null
          read_at: string | null
          archived_at: string | null
          favorited_at: string | null
          last_accessed_at: string | null
          clip_start_seconds: number | null
          clip_end_seconds: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content_type: ContentType
          content_id: string
          is_read?: boolean
          is_archived?: boolean
          is_favorite?: boolean
          folder_id?: string | null
          reading_progress?: number
          time_spent?: number
          notes?: string | null
          read_at?: string | null
          archived_at?: string | null
          favorited_at?: string | null
          last_accessed_at?: string | null
          clip_start_seconds?: number | null
          clip_end_seconds?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_read?: boolean
          is_archived?: boolean
          is_favorite?: boolean
          folder_id?: string | null
          reading_progress?: number
          time_spent?: number
          notes?: string | null
          read_at?: string | null
          archived_at?: string | null
          favorited_at?: string | null
          last_accessed_at?: string | null
          clip_start_seconds?: number | null
          clip_end_seconds?: number | null
          updated_at?: string
        }
      }
      // ===== CARPETAS DE ARCHIVO =====
      archive_folders: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          color: string | null
          parent_id: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string | null
          color?: string | null
          parent_id?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          icon?: string | null
          color?: string | null
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
      }
      // ===== COLECCIONES =====
      collections_new: {
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
          name?: string
          description?: string | null
          color?: string
          icon?: string | null
          is_public?: boolean
          updated_at?: string
        }
      }
      collection_items: {
        Row: {
          id: string
          collection_id: string
          content_type: ContentType
          content_id: string
          position: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          collection_id: string
          content_type: ContentType
          content_id: string
          position?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          position?: number
          notes?: string | null
        }
      }
    }
  }
}

// ===== TIPOS DE CONVENIENCIA =====

// Perfiles y configuraciones
export type Profile = Database['public']['Tables']['profiles_new']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles_new']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles_new']['Update']

export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']
export type UserSubscription = Database['public']['Tables']['user_subscriptions']['Row']
export type UserViewerSettings = Database['public']['Tables']['user_viewer_settings']['Row']
export type UserInterfaceSettings = Database['public']['Tables']['user_interface_settings']['Row']
export type UserNotificationSettings = Database['public']['Tables']['user_notification_settings']['Row']
export type UserPrivacySettings = Database['public']['Tables']['user_privacy_settings']['Row']

// Fuentes
export type ContentSource = Database['public']['Tables']['content_sources']['Row']
export type ContentSourceInsert = Database['public']['Tables']['content_sources']['Insert']
export type ContentSourceUpdate = Database['public']['Tables']['content_sources']['Update']

export type UserSource = Database['public']['Tables']['user_sources']['Row']
export type UserSourceInsert = Database['public']['Tables']['user_sources']['Insert']
export type UserSourceUpdate = Database['public']['Tables']['user_sources']['Update']

// Contenido por tipo
export type RSSContent = Database['public']['Tables']['rss_content']['Row']
export type RSSContentInsert = Database['public']['Tables']['rss_content']['Insert']
export type RSSContentUpdate = Database['public']['Tables']['rss_content']['Update']

export type YouTubeContent = Database['public']['Tables']['youtube_content']['Row']
export type YouTubeContentInsert = Database['public']['Tables']['youtube_content']['Insert']
export type YouTubeContentUpdate = Database['public']['Tables']['youtube_content']['Update']

export type TwitterContent = Database['public']['Tables']['twitter_content']['Row']
export type TwitterContentInsert = Database['public']['Tables']['twitter_content']['Insert']
export type TwitterContentUpdate = Database['public']['Tables']['twitter_content']['Update']

export type InstagramContent = Database['public']['Tables']['instagram_content']['Row']
export type InstagramContentInsert = Database['public']['Tables']['instagram_content']['Insert']
export type InstagramContentUpdate = Database['public']['Tables']['instagram_content']['Update']

export type TikTokContent = Database['public']['Tables']['tiktok_content']['Row']
export type TikTokContentInsert = Database['public']['Tables']['tiktok_content']['Insert']
export type TikTokContentUpdate = Database['public']['Tables']['tiktok_content']['Update']

export type PodcastContent = Database['public']['Tables']['podcast_content']['Row']
export type PodcastContentInsert = Database['public']['Tables']['podcast_content']['Insert']
export type PodcastContentUpdate = Database['public']['Tables']['podcast_content']['Update']

// Relación usuario-contenido
export type UserContent = Database['public']['Tables']['user_content']['Row']
export type UserContentInsert = Database['public']['Tables']['user_content']['Insert']
export type UserContentUpdate = Database['public']['Tables']['user_content']['Update']

// Carpetas de archivo
export type ArchiveFolder = Database['public']['Tables']['archive_folders']['Row']
export type ArchiveFolderInsert = Database['public']['Tables']['archive_folders']['Insert']
export type ArchiveFolderUpdate = Database['public']['Tables']['archive_folders']['Update']

// Tipo extendido para carpetas con hijos (para jerarquía)
export interface ArchiveFolderWithChildren extends ArchiveFolder {
  children?: ArchiveFolderWithChildren[]
}

// Colecciones
export type Collection = Database['public']['Tables']['collections_new']['Row']
export type CollectionInsert = Database['public']['Tables']['collections_new']['Insert']
export type CollectionUpdate = Database['public']['Tables']['collections_new']['Update']

export type CollectionItem = Database['public']['Tables']['collection_items']['Row']
export type CollectionItemInsert = Database['public']['Tables']['collection_items']['Insert']
export type CollectionItemUpdate = Database['public']['Tables']['collection_items']['Update']

// ===== TIPOS UNIFICADOS PARA CONTENIDO =====

// Union type para cualquier tipo de contenido
export type AnyContent = 
  | (RSSContent & { content_type: 'rss' })
  | (YouTubeContent & { content_type: 'youtube' })
  | (TwitterContent & { content_type: 'twitter' })
  | (InstagramContent & { content_type: 'instagram' })
  | (TikTokContent & { content_type: 'tiktok' })
  | (PodcastContent & { content_type: 'podcast' })

// Tipo para contenido con metadata de la fuente
export type ContentWithSource<T = AnyContent> = T & {
  source: ContentSource
  user_source: UserSource | null
}

// Tipo para contenido con datos del usuario
export type ContentWithUserData<T = AnyContent> = ContentWithSource<T> & {
  user_content: UserContent | null
}

// Tipo para colección con items
export type CollectionWithItems = Collection & {
  items: (CollectionItem & {
    content: AnyContent
    source: ContentSource
  })[]
}

// ===== TIPOS DE COMPATIBILIDAD HACIA ATRÁS =====
// Estos tipos mantienen compatibilidad con el código existente

/** @deprecated Use ContentSource instead */
export type Source = ContentSource & { user_id: string }

/** @deprecated Use RSSContent instead */
export type Article = RSSContent

/** @deprecated Use UserContent instead */
export type UserArticle = UserContent & { article_id: string }

/** @deprecated Use CollectionItem instead */
export type CollectionArticle = CollectionItem

// Tipos compatibles para inserts
/** @deprecated Use ContentSourceInsert instead */
export type SourceInsert = Omit<ContentSourceInsert, 'source_type'> & {
  user_id: string
  source_type?: 'rss' | 'youtube' | 'twitter' | 'instagram' | 'tiktok' | 'newsletter' | 'website'
}

/** @deprecated Use RSSContentInsert instead */
export type ArticleInsert = RSSContentInsert

/** @deprecated Use UserContentInsert instead */
export type UserArticleInsert = Omit<UserContentInsert, 'content_type' | 'content_id'> & {
  article_id: string
}

/** @deprecated Use CollectionItemInsert instead */
export type CollectionArticleInsert = CollectionItemInsert

// Tipos compatibles para updates  
/** @deprecated Use ContentSourceUpdate instead */
export type SourceUpdate = ContentSourceUpdate

/** @deprecated Use RSSContentUpdate instead */
export type ArticleUpdate = RSSContentUpdate

/** @deprecated Use UserContentUpdate instead */
export type UserArticleUpdate = UserContentUpdate

/** @deprecated Use CollectionItemUpdate instead */
export type CollectionArticleUpdate = CollectionItemUpdate

// Tipos extendidos compatibles
/** @deprecated Use ContentWithSource<RSSContent> instead */
export type ArticleWithSource = RSSContent & {
  source: ContentSource
}

/** @deprecated Use ContentWithUserData<RSSContent> instead */
export type ArticleWithUserData = RSSContent & {
  source: ContentSource
  user_article: UserContent | null
}

/** @deprecated Use CollectionWithItems instead */
export type CollectionWithArticles = Collection & {
  collection_articles: (CollectionItem & {
    article: ArticleWithSource
  })[]
}
