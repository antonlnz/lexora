-- Migración para añadir font_family y font_size a user_interface_settings

ALTER TABLE public.user_interface_settings 
  ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'inter',
  ADD COLUMN IF NOT EXISTS font_size integer DEFAULT 16;

-- Restricciones de validación
ALTER TABLE public.user_interface_settings 
  ADD CONSTRAINT check_font_size_range CHECK (font_size BETWEEN 12 AND 24);

-- Comentarios
COMMENT ON COLUMN public.user_interface_settings.font_family IS 'Familia de fuente de la app (inter, system, serif, mono)';
COMMENT ON COLUMN public.user_interface_settings.font_size IS 'Tamaño de fuente base de la app (12-24px)';
