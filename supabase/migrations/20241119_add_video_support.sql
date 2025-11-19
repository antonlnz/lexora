-- Agregar soporte para videos y otros tipos de media
-- Migración: 20241119_add_video_support.sql

-- Agregar columnas para metadata de video/media
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS video_url text,
ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'image',
ADD COLUMN IF NOT EXISTS video_duration int; -- duración en segundos

-- Actualizar constraint para media_type
ALTER TABLE public.articles
ADD CONSTRAINT check_media_type 
CHECK (media_type IN ('image', 'video', 'audio', 'none'));

-- Crear índice para media_type
CREATE INDEX IF NOT EXISTS idx_articles_media_type ON public.articles(media_type);

-- Comentarios para documentación
COMMENT ON COLUMN public.articles.video_url IS 'URL del video si el contenido es multimedia (YouTube, TikTok, etc.)';
COMMENT ON COLUMN public.articles.media_type IS 'Tipo de media: image, video, audio, none';
COMMENT ON COLUMN public.articles.video_duration IS 'Duración del video en segundos';
