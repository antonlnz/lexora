-- Migración: Añadir columnas para clips de podcasts y videos
-- Permite guardar fragmentos específicos de contenido multimedia

-- Añadir columnas para definir el rango del clip (en segundos)
ALTER TABLE user_content
ADD COLUMN IF NOT EXISTS clip_start_seconds INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS clip_end_seconds INTEGER DEFAULT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN user_content.clip_start_seconds IS 'Segundo de inicio del clip guardado (null = desde el principio)';
COMMENT ON COLUMN user_content.clip_end_seconds IS 'Segundo de fin del clip guardado (null = hasta el final)';

-- Crear índice para búsquedas de clips
CREATE INDEX IF NOT EXISTS idx_user_content_clips 
ON user_content (user_id, content_type) 
WHERE clip_start_seconds IS NOT NULL OR clip_end_seconds IS NOT NULL;
