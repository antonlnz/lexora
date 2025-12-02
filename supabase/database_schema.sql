-- =============================================
-- LEXORA - Database Schema
-- Esquema completo de la base de datos
-- Versión: 2.1
-- Última actualización: 2 de diciembre de 2025
-- =============================================

-- =============================================
-- FUNCIONES AUXILIARES
-- =============================================

-- Función para manejar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TABLAS DE SUSCRIPCIÓN Y PLANES
-- =============================================

-- Tabla de planes de suscripción
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  price_monthly numeric(10,2),
  price_yearly numeric(10,2),
  features jsonb DEFAULT '{}'::jsonb,
  max_sources int,
  max_archived_items int,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de suscripciones de usuario
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  plan_id uuid REFERENCES public.subscription_plans ON DELETE RESTRICT NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT check_subscription_status CHECK (status IN ('active', 'past_due', 'canceled', 'trialing'))
);

-- Índice para foreign key sin índice (fix warning)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON public.user_subscriptions(plan_id);

-- =============================================
-- TABLAS DE CONFIGURACIÓN DE USUARIO
-- =============================================

-- Configuraciones del visor de contenido
CREATE TABLE IF NOT EXISTS public.user_viewer_settings (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  font_family text DEFAULT 'system',
  font_size text DEFAULT 'medium',
  line_height text DEFAULT 'comfortable',
  text_align text DEFAULT 'left',
  theme text DEFAULT 'auto',
  reading_speed int DEFAULT 250,
  auto_mark_read boolean DEFAULT true,
  auto_save_progress boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT check_font_size CHECK (font_size IN ('small', 'medium', 'large', 'x-large')),
  CONSTRAINT check_line_height CHECK (line_height IN ('compact', 'comfortable', 'spacious')),
  CONSTRAINT check_text_align CHECK (text_align IN ('left', 'justify')),
  CONSTRAINT check_theme CHECK (theme IN ('light', 'dark', 'auto'))
);

-- Configuraciones de interfaz
CREATE TABLE IF NOT EXISTS public.user_interface_settings (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  theme_preference text DEFAULT 'system',
  sidebar_collapsed boolean DEFAULT false,
  view_mode text DEFAULT 'comfortable',
  items_per_page int DEFAULT 20,
  show_thumbnails boolean DEFAULT true,
  show_excerpts boolean DEFAULT true,
  compact_view boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT check_theme_preference CHECK (theme_preference IN ('light', 'dark', 'system')),
  CONSTRAINT check_view_mode CHECK (view_mode IN ('compact', 'comfortable', 'spacious'))
);

-- Configuraciones de notificaciones
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT false,
  notify_new_content boolean DEFAULT true,
  notify_digest boolean DEFAULT true,
  digest_frequency text DEFAULT 'daily',
  notify_recommendations boolean DEFAULT true,
  quiet_hours_enabled boolean DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT check_digest_frequency CHECK (digest_frequency IN ('daily', 'weekly', 'monthly', 'never'))
);

-- Configuraciones de privacidad
CREATE TABLE IF NOT EXISTS public.user_privacy_settings (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  profile_public boolean DEFAULT false,
  activity_public boolean DEFAULT false,
  allow_analytics boolean DEFAULT true,
  allow_personalization boolean DEFAULT true,
  data_retention_days int DEFAULT 365,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- TABLAS DE PERFILES
-- =============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  bio text,
  onboarding_completed boolean DEFAULT false,
  onboarding_completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- TABLAS DE FUENTES DE CONTENIDO
-- =============================================

-- Fuentes compartidas (una fuente = un registro único)
CREATE TABLE IF NOT EXISTS public.content_sources (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_type text NOT NULL,
  url text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  favicon_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  last_fetched_at timestamp with time zone,
  fetch_error text,
  fetch_count int DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT check_source_type CHECK (source_type IN (
    'rss', 'youtube_channel', 'youtube_video', 'twitter', 
    'instagram', 'tiktok', 'newsletter', 'website', 'podcast'
  ))
);

-- Relación usuario-fuente (suscripciones)
CREATE TABLE IF NOT EXISTS public.user_sources (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  source_id uuid REFERENCES public.content_sources ON DELETE CASCADE NOT NULL,
  custom_title text,
  is_active boolean DEFAULT true,
  notification_enabled boolean DEFAULT true,
  folder text,
  tags text[] DEFAULT ARRAY[]::text[],
  subscribed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(user_id, source_id)
);

-- =============================================
-- TABLAS DE CONTENIDO POR TIPO
-- =============================================

-- Contenido RSS (artículos)
CREATE TABLE IF NOT EXISTS public.rss_content (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id uuid REFERENCES public.content_sources ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  author text,
  published_at timestamp with time zone,
  content text,
  excerpt text,
  featured_media_type text DEFAULT 'none',
  featured_media_url text,
  featured_thumbnail_url text,
  featured_media_duration int,
  reading_time int,
  word_count int,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(source_id, url),
  CONSTRAINT check_featured_media_type CHECK (featured_media_type IN ('none', 'image', 'video'))
);

-- Contenido de YouTube
CREATE TABLE IF NOT EXISTS public.youtube_content (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id uuid REFERENCES public.content_sources ON DELETE CASCADE NOT NULL,
  video_id text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  channel_name text,
  published_at timestamp with time zone,
  description text,
  thumbnail_url text,
  video_url text,
  duration int,
  view_count bigint,
  like_count bigint,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(source_id, video_id)
);

-- Contenido de Twitter
CREATE TABLE IF NOT EXISTS public.twitter_content (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id uuid REFERENCES public.content_sources ON DELETE CASCADE NOT NULL,
  tweet_id text NOT NULL,
  url text NOT NULL,
  author_username text,
  author_name text,
  published_at timestamp with time zone,
  text_content text NOT NULL,
  media_urls text[] DEFAULT ARRAY[]::text[],
  media_types text[] DEFAULT ARRAY[]::text[],
  retweet_count int,
  like_count int,
  reply_count int,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(source_id, tweet_id)
);

-- Contenido de Instagram
CREATE TABLE IF NOT EXISTS public.instagram_content (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id uuid REFERENCES public.content_sources ON DELETE CASCADE NOT NULL,
  post_id text NOT NULL,
  url text NOT NULL,
  author_username text,
  published_at timestamp with time zone,
  caption text,
  media_urls text[] DEFAULT ARRAY[]::text[],
  media_type text,
  like_count bigint,
  comment_count bigint,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(source_id, post_id),
  CONSTRAINT check_media_type CHECK (media_type IN ('image', 'video', 'carousel'))
);

-- Contenido de TikTok
CREATE TABLE IF NOT EXISTS public.tiktok_content (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id uuid REFERENCES public.content_sources ON DELETE CASCADE NOT NULL,
  video_id text NOT NULL,
  url text NOT NULL,
  author_username text,
  published_at timestamp with time zone,
  description text,
  video_url text,
  thumbnail_url text,
  duration int,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  share_count bigint,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(source_id, video_id)
);

-- Contenido de Podcast
CREATE TABLE IF NOT EXISTS public.podcast_content (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id uuid REFERENCES public.content_sources ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  author text,
  published_at timestamp with time zone,
  description text,
  show_notes text,
  audio_url text NOT NULL,
  image_url text,
  duration int,
  episode_number int,
  season_number int,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(source_id, url)
);

-- =============================================
-- TABLAS DE RELACIÓN USUARIO-CONTENIDO
-- =============================================

-- Estado del usuario con contenido (leído, favorito, archivado, etc.)
CREATE TABLE IF NOT EXISTS public.user_content (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  is_read boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  is_favorite boolean DEFAULT false,
  reading_progress int DEFAULT 0,
  time_spent int DEFAULT 0,
  notes text,
  read_at timestamp with time zone,
  archived_at timestamp with time zone,
  favorited_at timestamp with time zone,
  last_accessed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(user_id, content_type, content_id),
  CONSTRAINT check_content_type CHECK (content_type IN (
    'rss', 'youtube', 'twitter', 'instagram', 'tiktok', 'podcast'
  ))
);

-- =============================================
-- TABLAS DE COLECCIONES
-- =============================================

CREATE TABLE IF NOT EXISTS public.collections_new (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366f1',
  icon text,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para foreign key sin índice (fix warning)
CREATE INDEX IF NOT EXISTS idx_collections_new_user_id ON public.collections_new(user_id);

-- Items en colecciones
CREATE TABLE IF NOT EXISTS public.collection_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  collection_id uuid REFERENCES public.collections_new ON DELETE CASCADE NOT NULL,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  position int DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  UNIQUE(collection_id, content_type, content_id),
  CONSTRAINT check_content_type CHECK (content_type IN (
    'rss', 'youtube', 'twitter', 'instagram', 'tiktok', 'podcast'
  ))
);

-- =============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =============================================

-- Índices para content_sources
CREATE INDEX IF NOT EXISTS idx_content_sources_type ON public.content_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_content_sources_url ON public.content_sources(url);
CREATE INDEX IF NOT EXISTS idx_content_sources_last_fetched ON public.content_sources(last_fetched_at);

-- Índices para user_sources
CREATE INDEX IF NOT EXISTS idx_user_sources_user_id ON public.user_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sources_source_id ON public.user_sources(source_id);
-- NOTA: idx_user_sources_active e idx_user_sources_folder eliminados por no usarse

-- Índices para rss_content
CREATE INDEX IF NOT EXISTS idx_rss_content_source_id ON public.rss_content(source_id);
CREATE INDEX IF NOT EXISTS idx_rss_content_published ON public.rss_content(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_rss_content_url ON public.rss_content(url);

-- Índices para youtube_content
CREATE INDEX IF NOT EXISTS idx_youtube_content_source_id ON public.youtube_content(source_id);
CREATE INDEX IF NOT EXISTS idx_youtube_content_published ON public.youtube_content(published_at DESC);
-- NOTA: idx_youtube_content_video_id eliminado por no usarse (video_id ya tiene UNIQUE)

-- Índices para twitter_content
CREATE INDEX IF NOT EXISTS idx_twitter_content_source_id ON public.twitter_content(source_id);
CREATE INDEX IF NOT EXISTS idx_twitter_content_published ON public.twitter_content(published_at DESC);
-- NOTA: idx_twitter_content_tweet_id eliminado por no usarse (tweet_id ya tiene UNIQUE)

-- Índices para instagram_content
CREATE INDEX IF NOT EXISTS idx_instagram_content_source_id ON public.instagram_content(source_id);
CREATE INDEX IF NOT EXISTS idx_instagram_content_published ON public.instagram_content(published_at DESC);
-- NOTA: idx_instagram_content_post_id eliminado por no usarse (post_id ya tiene UNIQUE)

-- Índices para tiktok_content
CREATE INDEX IF NOT EXISTS idx_tiktok_content_source_id ON public.tiktok_content(source_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_content_published ON public.tiktok_content(published_at DESC);
-- NOTA: idx_tiktok_content_video_id eliminado por no usarse (video_id ya tiene UNIQUE)

-- Índices para podcast_content
CREATE INDEX IF NOT EXISTS idx_podcast_content_source_id ON public.podcast_content(source_id);
CREATE INDEX IF NOT EXISTS idx_podcast_content_published ON public.podcast_content(published_at DESC);

-- Índices para user_content - Solo los necesarios
-- NOTA: Varios índices eliminados por no usarse en queries reales
CREATE INDEX IF NOT EXISTS idx_user_content_user_type_archived ON public.user_content(user_id, content_type, is_archived);
CREATE INDEX IF NOT EXISTS idx_user_content_user_archived_at ON public.user_content(user_id, archived_at DESC) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_user_content_user_favorite ON public.user_content(user_id) WHERE is_favorite = true;

-- Índices para collection_items
CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON public.collection_items(collection_id);
-- NOTA: idx_collection_items_content eliminado por no usarse

-- =============================================
-- TRIGGERS PARA updated_at
-- =============================================

CREATE TRIGGER set_updated_at_content_sources
  BEFORE UPDATE ON public.content_sources
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_user_sources
  BEFORE UPDATE ON public.user_sources
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_rss_content
  BEFORE UPDATE ON public.rss_content
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_youtube_content
  BEFORE UPDATE ON public.youtube_content
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_twitter_content
  BEFORE UPDATE ON public.twitter_content
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_instagram_content
  BEFORE UPDATE ON public.instagram_content
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_tiktok_content
  BEFORE UPDATE ON public.tiktok_content
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_podcast_content
  BEFORE UPDATE ON public.podcast_content
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_user_content
  BEFORE UPDATE ON public.user_content
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_user_subscriptions
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_user_viewer_settings
  BEFORE UPDATE ON public.user_viewer_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_user_interface_settings
  BEFORE UPDATE ON public.user_interface_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_user_notification_settings
  BEFORE UPDATE ON public.user_notification_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_user_privacy_settings
  BEFORE UPDATE ON public.user_privacy_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_subscription_plans
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_collections_new
  BEFORE UPDATE ON public.collections_new
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- =============================================
-- FUNCIÓN PARA NUEVOS USUARIOS
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user_v2()
RETURNS trigger AS $$
BEGIN
  -- Crear perfil
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'avatar_url'
  );
  
  -- Crear configuraciones
  INSERT INTO public.user_viewer_settings (user_id) VALUES (new.id);
  INSERT INTO public.user_interface_settings (user_id) VALUES (new.id);
  INSERT INTO public.user_notification_settings (user_id) VALUES (new.id);
  INSERT INTO public.user_privacy_settings (user_id) VALUES (new.id);
  
  -- Asignar plan gratuito por defecto
  INSERT INTO public.user_subscriptions (user_id, plan_id, status)
  SELECT new.id, id, 'active'
  FROM public.subscription_plans
  WHERE name = 'free'
  LIMIT 1;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger existente si existe y recrearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user_v2();

-- =============================================
-- DATOS INICIALES
-- =============================================

INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, max_sources, max_archived_items, features)
VALUES 
  ('free', 'Plan gratuito', 0, 0, 10, 100, '{"ads": true, "basic_analytics": true}'::jsonb),
  ('pro', 'Plan profesional', 9.99, 99.99, 100, 10000, '{"ads": false, "advanced_analytics": true, "priority_support": true, "custom_filters": true}'::jsonb),
  ('premium', 'Plan premium', 19.99, 199.99, -1, -1, '{"ads": false, "advanced_analytics": true, "priority_support": true, "custom_filters": true, "api_access": true, "team_collaboration": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- FIN DEL SCHEMA
-- =============================================
