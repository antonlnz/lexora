-- =============================================
-- MIGRACIÓN: Función para eliminar cuenta de usuario
-- Versión: 00009
-- Descripción: Crea la función RPC para eliminar completamente una cuenta de usuario
-- =============================================

-- =============================================
-- FUNCIÓN: Eliminar datos del usuario (sin eliminar de auth.users)
-- Esta función elimina todos los datos del usuario de las tablas públicas
-- La eliminación de auth.users se hace desde el cliente con el admin SDK
-- o el usuario simplemente queda marcado para eliminación manual
-- =============================================

CREATE OR REPLACE FUNCTION public.delete_user_data()
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_source_ids uuid[];
  v_exclusive_source_ids uuid[];
  v_source_id uuid;
  v_subscriber_count int;
BEGIN
  -- Obtener el ID del usuario actual
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;

  -- 1. Obtener todas las fuentes del usuario
  SELECT ARRAY_AGG(source_id) INTO v_source_ids
  FROM public.user_sources
  WHERE user_id = v_user_id;

  -- 2. Identificar fuentes exclusivas (donde el usuario es el único suscriptor)
  IF v_source_ids IS NOT NULL AND array_length(v_source_ids, 1) > 0 THEN
    v_exclusive_source_ids := ARRAY[]::uuid[];
    
    FOREACH v_source_id IN ARRAY v_source_ids
    LOOP
      SELECT COUNT(*) INTO v_subscriber_count
      FROM public.user_sources
      WHERE source_id = v_source_id;
      
      IF v_subscriber_count = 1 THEN
        v_exclusive_source_ids := array_append(v_exclusive_source_ids, v_source_id);
      END IF;
    END LOOP;

    -- 3. Para fuentes exclusivas, eliminar todo el contenido asociado
    IF array_length(v_exclusive_source_ids, 1) > 0 THEN
      -- Eliminar contenido RSS
      DELETE FROM public.rss_content WHERE source_id = ANY(v_exclusive_source_ids);
      
      -- Eliminar contenido YouTube
      DELETE FROM public.youtube_content WHERE source_id = ANY(v_exclusive_source_ids);
      
      -- Eliminar contenido Twitter
      DELETE FROM public.twitter_content WHERE source_id = ANY(v_exclusive_source_ids);
      
      -- Eliminar contenido Instagram
      DELETE FROM public.instagram_content WHERE source_id = ANY(v_exclusive_source_ids);
      
      -- Eliminar contenido TikTok
      DELETE FROM public.tiktok_content WHERE source_id = ANY(v_exclusive_source_ids);
      
      -- Eliminar contenido Podcast
      DELETE FROM public.podcast_content WHERE source_id = ANY(v_exclusive_source_ids);
      
      -- Eliminar las fuentes exclusivas
      DELETE FROM public.content_sources WHERE id = ANY(v_exclusive_source_ids);
    END IF;
  END IF;

  -- 4. Eliminar datos del usuario (muchos tienen ON DELETE CASCADE, pero por seguridad)
  
  -- Eliminar carpetas del archivo
  DELETE FROM public.archive_folders WHERE user_id = v_user_id;
  
  -- Eliminar items de colecciones (cascade desde collections_new)
  DELETE FROM public.collections_new WHERE user_id = v_user_id;
  
  -- Eliminar user_content
  DELETE FROM public.user_content WHERE user_id = v_user_id;
  
  -- Eliminar user_sources
  DELETE FROM public.user_sources WHERE user_id = v_user_id;
  
  -- Eliminar configuraciones
  DELETE FROM public.user_viewer_settings WHERE user_id = v_user_id;
  DELETE FROM public.user_interface_settings WHERE user_id = v_user_id;
  DELETE FROM public.user_notification_settings WHERE user_id = v_user_id;
  DELETE FROM public.user_privacy_settings WHERE user_id = v_user_id;
  
  -- Eliminar suscripción
  DELETE FROM public.user_subscriptions WHERE user_id = v_user_id;
  
  -- Eliminar perfil
  DELETE FROM public.profiles WHERE id = v_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que los usuarios autenticados ejecuten esta función
GRANT EXECUTE ON FUNCTION public.delete_user_data() TO authenticated;

-- =============================================
-- FUNCIÓN: Eliminar cuenta completa (incluye auth.users)
-- NOTA: Esta función requiere SECURITY DEFINER con permisos especiales
-- Se necesita que el rol que ejecuta sea postgres o tenga permisos en auth.users
-- =============================================

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Obtener el ID del usuario actual
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;

  -- Primero eliminar todos los datos del usuario
  PERFORM public.delete_user_data();
  
  -- Luego eliminar de auth.users
  -- Esto requiere permisos especiales (el rol de la función debe poder escribir en auth.users)
  DELETE FROM auth.users WHERE id = v_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que los usuarios autenticados ejecuten esta función
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- =============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =============================================

COMMENT ON FUNCTION public.delete_user_data() IS 
'Elimina todos los datos del usuario autenticado de las tablas públicas:
- Sus configuraciones de perfil
- Sus suscripciones a fuentes
- Su contenido guardado/archivado
- Sus colecciones y carpetas
- Si es el único suscriptor de una fuente, elimina la fuente y todo su contenido
NO elimina el usuario de auth.users.
Esta acción es IRREVERSIBLE.';

COMMENT ON FUNCTION public.delete_user_account() IS 
'Elimina completamente la cuenta del usuario autenticado, incluyendo:
- Todos sus datos (llamando a delete_user_data())
- El usuario de auth.users
Requiere que la función tenga permisos especiales en auth.users.
Esta acción es IRREVERSIBLE.';
