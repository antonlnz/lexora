-- Migración para actualizar user_viewer_settings con campos más flexibles
-- Permite valores numéricos personalizados para fontSize, lineHeight, maxWidth
-- y colores personalizados para background y texto

-- Primero, eliminamos las restricciones CHECK existentes
ALTER TABLE public.user_viewer_settings 
  DROP CONSTRAINT IF EXISTS check_font_size,
  DROP CONSTRAINT IF EXISTS check_line_height,
  DROP CONSTRAINT IF EXISTS check_text_align,
  DROP CONSTRAINT IF EXISTS check_theme;

-- Eliminar defaults antes de cambiar tipos
ALTER TABLE public.user_viewer_settings 
  ALTER COLUMN font_size DROP DEFAULT,
  ALTER COLUMN line_height DROP DEFAULT;

-- Modificar font_size: text -> integer
ALTER TABLE public.user_viewer_settings 
  ALTER COLUMN font_size TYPE integer USING 
    CASE font_size 
      WHEN 'small' THEN 14 
      WHEN 'medium' THEN 16 
      WHEN 'large' THEN 18 
      WHEN 'x-large' THEN 20 
      ELSE 16 
    END;

-- Restaurar default para font_size
ALTER TABLE public.user_viewer_settings 
  ALTER COLUMN font_size SET DEFAULT 16;

-- Modificar line_height: text -> numeric
ALTER TABLE public.user_viewer_settings 
  ALTER COLUMN line_height TYPE numeric(3,1) USING 
    CASE line_height 
      WHEN 'compact' THEN 1.4 
      WHEN 'comfortable' THEN 1.6 
      WHEN 'spacious' THEN 2.0 
      ELSE 1.6 
    END;

-- Restaurar default para line_height
ALTER TABLE public.user_viewer_settings 
  ALTER COLUMN line_height SET DEFAULT 1.6;

-- Agregar nuevas columnas
ALTER TABLE public.user_viewer_settings 
  ADD COLUMN IF NOT EXISTS max_width integer DEFAULT 800,
  ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS text_color text DEFAULT '#000000';

-- Agregar nuevas restricciones para validación
ALTER TABLE public.user_viewer_settings 
  ADD CONSTRAINT check_font_size CHECK (font_size BETWEEN 12 AND 24),
  ADD CONSTRAINT check_line_height CHECK (line_height BETWEEN 1.0 AND 3.0),
  ADD CONSTRAINT check_max_width CHECK (max_width BETWEEN 400 AND 1600),
  ADD CONSTRAINT check_background_color CHECK (background_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD CONSTRAINT check_text_color CHECK (text_color ~ '^#[0-9a-fA-F]{6}$');

-- Comentarios descriptivos
COMMENT ON COLUMN public.user_viewer_settings.font_size IS 'Tamaño de fuente en píxeles (12-24)';
COMMENT ON COLUMN public.user_viewer_settings.line_height IS 'Altura de línea (1.0-3.0)';
COMMENT ON COLUMN public.user_viewer_settings.max_width IS 'Ancho máximo del contenido en píxeles (400-1600)';
COMMENT ON COLUMN public.user_viewer_settings.background_color IS 'Color de fondo en formato hex (#RRGGBB)';
COMMENT ON COLUMN public.user_viewer_settings.text_color IS 'Color del texto en formato hex (#RRGGBB)';
