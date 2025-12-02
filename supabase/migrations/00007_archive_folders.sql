-- =============================================
-- MIGRACIÓN: Sistema de Carpetas para Archive
-- Versión: 00007
-- Fecha: Enero 2025
-- =============================================

-- =============================================
-- TABLA DE CARPETAS DE ARCHIVO
-- =============================================

-- Carpetas para organizar contenido archivado
-- Soporta jerarquía de carpetas (subcarpetas)
-- Compatible con formato OPML para importar/exportar
CREATE TABLE IF NOT EXISTS public.archive_folders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  icon text,  -- Nombre del icono (e.g., 'folder', 'star', 'bookmark')
  color text DEFAULT '#6366f1',  -- Color hex para el icono
  parent_id uuid REFERENCES public.archive_folders ON DELETE CASCADE,  -- Para subcarpetas
  position int DEFAULT 0,  -- Orden de la carpeta dentro del mismo nivel
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Constraint para evitar ciclos en la jerarquía (una carpeta no puede ser su propio padre)
  CONSTRAINT check_not_self_parent CHECK (id != parent_id)
);

-- Índices para archive_folders
CREATE INDEX IF NOT EXISTS idx_archive_folders_user_id ON public.archive_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_archive_folders_parent_id ON public.archive_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_archive_folders_position ON public.archive_folders(user_id, parent_id, position);

-- Trigger para updated_at
CREATE TRIGGER handle_archive_folders_updated_at
  BEFORE UPDATE ON public.archive_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- MODIFICAR TABLA user_content
-- =============================================

-- Añadir columna folder_id a user_content para asociar contenido archivado con carpetas
ALTER TABLE public.user_content 
ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.archive_folders ON DELETE SET NULL;

-- Índice para buscar contenido por carpeta
CREATE INDEX IF NOT EXISTS idx_user_content_folder_id ON public.user_content(folder_id);

-- Índice compuesto para búsquedas de contenido archivado por carpeta
CREATE INDEX IF NOT EXISTS idx_user_content_archived_folder 
ON public.user_content(user_id, is_archived, folder_id) 
WHERE is_archived = true;

-- =============================================
-- POLÍTICAS RLS PARA archive_folders
-- =============================================

-- Habilitar RLS
ALTER TABLE public.archive_folders ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver sus propias carpetas
CREATE POLICY "Users can view own archive folders" 
ON public.archive_folders FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Política: Los usuarios solo pueden crear carpetas para sí mismos
CREATE POLICY "Users can create own archive folders" 
ON public.archive_folders FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios solo pueden actualizar sus propias carpetas
CREATE POLICY "Users can update own archive folders" 
ON public.archive_folders FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios solo pueden eliminar sus propias carpetas
CREATE POLICY "Users can delete own archive folders" 
ON public.archive_folders FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- =============================================
-- FUNCIÓN PARA VERIFICAR INTEGRIDAD DE JERARQUÍA
-- =============================================

-- Función para verificar que no se creen ciclos en la jerarquía de carpetas
CREATE OR REPLACE FUNCTION public.check_folder_hierarchy()
RETURNS trigger AS $$
DECLARE
  current_id uuid;
  max_depth int := 10;  -- Limitar profundidad máxima
  depth int := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  current_id := NEW.parent_id;
  
  WHILE current_id IS NOT NULL AND depth < max_depth LOOP
    -- Verificar si encontramos un ciclo
    IF current_id = NEW.id THEN
      RAISE EXCEPTION 'Cannot create circular folder hierarchy';
    END IF;
    
    -- Subir un nivel en la jerarquía
    SELECT parent_id INTO current_id
    FROM public.archive_folders
    WHERE id = current_id;
    
    depth := depth + 1;
  END LOOP;
  
  IF depth >= max_depth THEN
    RAISE EXCEPTION 'Maximum folder hierarchy depth exceeded';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para verificar jerarquía antes de insertar o actualizar
CREATE TRIGGER check_folder_hierarchy_trigger
  BEFORE INSERT OR UPDATE OF parent_id ON public.archive_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_folder_hierarchy();

-- =============================================
-- FUNCIÓN PARA OBTENER TODAS LAS SUBCARPETAS
-- =============================================

-- Función recursiva para obtener todas las subcarpetas de una carpeta
CREATE OR REPLACE FUNCTION public.get_folder_descendants(folder_uuid uuid)
RETURNS TABLE(id uuid, name text, parent_id uuid, depth int) AS $$
WITH RECURSIVE folder_tree AS (
  -- Caso base: la carpeta inicial
  SELECT 
    f.id, 
    f.name, 
    f.parent_id, 
    0 as depth
  FROM public.archive_folders f
  WHERE f.id = folder_uuid
  
  UNION ALL
  
  -- Caso recursivo: hijos de las carpetas actuales
  SELECT 
    f.id, 
    f.name, 
    f.parent_id, 
    ft.depth + 1
  FROM public.archive_folders f
  INNER JOIN folder_tree ft ON f.parent_id = ft.id
  WHERE ft.depth < 10  -- Limitar profundidad
)
SELECT * FROM folder_tree WHERE id != folder_uuid;  -- Excluir la carpeta inicial
$$ LANGUAGE sql STABLE;

-- =============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =============================================

COMMENT ON TABLE public.archive_folders IS 'Carpetas para organizar contenido archivado por el usuario';
COMMENT ON COLUMN public.archive_folders.parent_id IS 'Referencia a carpeta padre para crear subcarpetas (null = carpeta raíz)';
COMMENT ON COLUMN public.archive_folders.position IS 'Orden de la carpeta dentro del mismo nivel de jerarquía';
COMMENT ON COLUMN public.archive_folders.icon IS 'Nombre del icono a mostrar (lucide icons)';
COMMENT ON COLUMN public.archive_folders.color IS 'Color hex para personalizar la carpeta';

COMMENT ON COLUMN public.user_content.folder_id IS 'Carpeta donde está archivado el contenido (null = sin carpeta)';
