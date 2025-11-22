-- =============================================
-- LEXORA - Row Level Security Policies
-- Políticas de seguridad granular para todas las tablas
-- =============================================

-- =============================================
-- PASO 1: HABILITAR RLS EN TODAS LAS TABLAS
-- =============================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_viewer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interface_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twitter_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PASO 2: POLÍTICAS PARA subscription_plans
-- Los planes son visibles para todos, solo admin puede modificar
-- =============================================

CREATE POLICY "Los planes son visibles para usuarios autenticados"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- PASO 3: POLÍTICAS PARA user_subscriptions
-- =============================================

CREATE POLICY "Los usuarios pueden ver su propia suscripción"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear su propia suscripción"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar su propia suscripción"
  ON public.user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- PASO 4: POLÍTICAS PARA user_viewer_settings
-- =============================================

CREATE POLICY "Los usuarios pueden ver su configuración de visor"
  ON public.user_viewer_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar su configuración de visor"
  ON public.user_viewer_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar su configuración de visor"
  ON public.user_viewer_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- PASO 5: POLÍTICAS PARA user_interface_settings
-- =============================================

CREATE POLICY "Los usuarios pueden ver su configuración de interfaz"
  ON public.user_interface_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar su configuración de interfaz"
  ON public.user_interface_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar su configuración de interfaz"
  ON public.user_interface_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- PASO 6: POLÍTICAS PARA user_notification_settings
-- =============================================

CREATE POLICY "Los usuarios pueden ver su configuración de notificaciones"
  ON public.user_notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar su configuración de notificaciones"
  ON public.user_notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar su configuración de notificaciones"
  ON public.user_notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- PASO 7: POLÍTICAS PARA user_privacy_settings
-- =============================================

CREATE POLICY "Los usuarios pueden ver su configuración de privacidad"
  ON public.user_privacy_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar su configuración de privacidad"
  ON public.user_privacy_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar su configuración de privacidad"
  ON public.user_privacy_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- PASO 8: POLÍTICAS PARA content_sources
-- Fuentes visibles para usuarios autenticados que las usan
-- Los usuarios autenticados pueden crear nuevas fuentes
-- =============================================

-- Los usuarios pueden ver todas las fuentes (para facilitar búsqueda y evitar duplicados)
CREATE POLICY "Usuarios autenticados pueden ver todas las fuentes"
  ON public.content_sources FOR SELECT
  TO authenticated
  USING (true);

-- Cualquier usuario autenticado puede insertar nuevas fuentes
CREATE POLICY "Usuarios autenticados pueden insertar nuevas fuentes"
  ON public.content_sources FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Solo pueden actualizar fuentes a las que están suscritos
CREATE POLICY "Usuarios pueden actualizar fuentes a las que están suscritos"
  ON public.content_sources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = content_sources.id
      AND user_sources.user_id = auth.uid()
    )
  );

-- =============================================
-- PASO 9: POLÍTICAS PARA user_sources
-- =============================================

CREATE POLICY "Los usuarios pueden ver sus propias fuentes"
  ON public.user_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias suscripciones a fuentes"
  ON public.user_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias suscripciones"
  ON public.user_sources FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias suscripciones"
  ON public.user_sources FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- PASO 10: POLÍTICAS PARA rss_content
-- El contenido es visible si el usuario está suscrito a la fuente
-- =============================================

CREATE POLICY "Usuarios pueden ver contenido RSS de sus fuentes"
  ON public.rss_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = rss_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "Sistema puede insertar contenido RSS"
  ON public.rss_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = rss_content.source_id
    )
  );

CREATE POLICY "Sistema puede actualizar contenido RSS"
  ON public.rss_content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = rss_content.source_id
    )
  );

-- =============================================
-- PASO 11: POLÍTICAS PARA youtube_content
-- =============================================

CREATE POLICY "Usuarios pueden ver contenido YouTube de sus fuentes"
  ON public.youtube_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = youtube_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "Sistema puede insertar contenido YouTube"
  ON public.youtube_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = youtube_content.source_id
    )
  );

CREATE POLICY "Sistema puede actualizar contenido YouTube"
  ON public.youtube_content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = youtube_content.source_id
    )
  );

-- =============================================
-- PASO 12: POLÍTICAS PARA twitter_content
-- =============================================

CREATE POLICY "Usuarios pueden ver contenido Twitter de sus fuentes"
  ON public.twitter_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = twitter_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "Sistema puede insertar contenido Twitter"
  ON public.twitter_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = twitter_content.source_id
    )
  );

-- =============================================
-- PASO 13: POLÍTICAS PARA instagram_content
-- =============================================

CREATE POLICY "Usuarios pueden ver contenido Instagram de sus fuentes"
  ON public.instagram_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = instagram_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "Sistema puede insertar contenido Instagram"
  ON public.instagram_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = instagram_content.source_id
    )
  );

-- =============================================
-- PASO 14: POLÍTICAS PARA tiktok_content
-- =============================================

CREATE POLICY "Usuarios pueden ver contenido TikTok de sus fuentes"
  ON public.tiktok_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = tiktok_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "Sistema puede insertar contenido TikTok"
  ON public.tiktok_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = tiktok_content.source_id
    )
  );

-- =============================================
-- PASO 15: POLÍTICAS PARA podcast_content
-- =============================================

CREATE POLICY "Usuarios pueden ver contenido Podcast de sus fuentes"
  ON public.podcast_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = podcast_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "Sistema puede insertar contenido Podcast"
  ON public.podcast_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = podcast_content.source_id
    )
  );

-- =============================================
-- PASO 16: POLÍTICAS PARA user_content
-- =============================================

CREATE POLICY "Los usuarios pueden ver su propio contenido"
  ON public.user_content FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias relaciones con contenido"
  ON public.user_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias relaciones con contenido"
  ON public.user_content FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias relaciones con contenido"
  ON public.user_content FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- PASO 17: POLÍTICAS PARA profiles
-- Los perfiles son visibles para usuarios autenticados
-- Cada usuario solo puede modificar su propio perfil
-- =============================================

CREATE POLICY "Usuarios autenticados pueden ver perfiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Los usuarios pueden crear su propio perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- =============================================
-- PASO 18: POLÍTICAS PARA collections_new
-- =============================================

CREATE POLICY "Los usuarios pueden ver sus propias colecciones o las públicas"
  ON public.collections_new FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Los usuarios pueden crear sus propias colecciones"
  ON public.collections_new FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias colecciones"
  ON public.collections_new FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias colecciones"
  ON public.collections_new FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- PASO 19: POLÍTICAS PARA collection_items
-- =============================================

CREATE POLICY "Los usuarios pueden ver items de sus colecciones o públicas"
  ON public.collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collections_new
      WHERE collections_new.id = collection_items.collection_id
      AND (collections_new.user_id = auth.uid() OR collections_new.is_public = true)
    )
  );

CREATE POLICY "Los usuarios pueden agregar items a sus colecciones"
  ON public.collection_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections_new
      WHERE collections_new.id = collection_items.collection_id
      AND collections_new.user_id = auth.uid()
    )
  );

CREATE POLICY "Los usuarios pueden actualizar items de sus colecciones"
  ON public.collection_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.collections_new
      WHERE collections_new.id = collection_items.collection_id
      AND collections_new.user_id = auth.uid()
    )
  );

CREATE POLICY "Los usuarios pueden eliminar items de sus colecciones"
  ON public.collection_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.collections_new
      WHERE collections_new.id = collection_items.collection_id
      AND collections_new.user_id = auth.uid()
    )
  );

-- =============================================
-- PASO 20: FUNCIÓN PARA PREVENIR BORRADO DE CONTENIDO ARCHIVADO
-- =============================================

CREATE OR REPLACE FUNCTION prevent_archived_content_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si algún usuario tiene este contenido archivado
  IF EXISTS (
    SELECT 1 FROM public.user_content
    WHERE content_type = TG_ARGV[0]
    AND content_id = OLD.id
    AND is_archived = true
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar contenido que está archivado por algún usuario';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Aplicar el trigger a todas las tablas de contenido
CREATE TRIGGER prevent_rss_content_deletion
  BEFORE DELETE ON public.rss_content
  FOR EACH ROW
  EXECUTE FUNCTION prevent_archived_content_deletion('rss');

CREATE TRIGGER prevent_youtube_content_deletion
  BEFORE DELETE ON public.youtube_content
  FOR EACH ROW
  EXECUTE FUNCTION prevent_archived_content_deletion('youtube');

CREATE TRIGGER prevent_twitter_content_deletion
  BEFORE DELETE ON public.twitter_content
  FOR EACH ROW
  EXECUTE FUNCTION prevent_archived_content_deletion('twitter');

CREATE TRIGGER prevent_instagram_content_deletion
  BEFORE DELETE ON public.instagram_content
  FOR EACH ROW
  EXECUTE FUNCTION prevent_archived_content_deletion('instagram');

CREATE TRIGGER prevent_tiktok_content_deletion
  BEFORE DELETE ON public.tiktok_content
  FOR EACH ROW
  EXECUTE FUNCTION prevent_archived_content_deletion('tiktok');

CREATE TRIGGER prevent_podcast_content_deletion
  BEFORE DELETE ON public.podcast_content
  FOR EACH ROW
  EXECUTE FUNCTION prevent_archived_content_deletion('podcast');

-- =============================================
-- PASO 21: FUNCIÓN DE LIMPIEZA AUTOMÁTICA
-- Limpia contenido antiguo no archivado
-- =============================================

CREATE OR REPLACE FUNCTION cleanup_old_unarchived_content()
RETURNS void AS $$
DECLARE
  retention_days int := 30; -- Mantener contenido por 30 días
  cutoff_date timestamp with time zone;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::interval;
  
  -- Eliminar contenido RSS antiguo no archivado
  DELETE FROM public.rss_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'rss' AND is_archived = true
  );
  
  -- Eliminar contenido YouTube antiguo no archivado
  DELETE FROM public.youtube_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'youtube' AND is_archived = true
  );
  
  -- Eliminar contenido Twitter antiguo no archivado
  DELETE FROM public.twitter_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'twitter' AND is_archived = true
  );
  
  -- Eliminar contenido Instagram antiguo no archivado
  DELETE FROM public.instagram_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'instagram' AND is_archived = true
  );
  
  -- Eliminar contenido TikTok antiguo no archivado
  DELETE FROM public.tiktok_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'tiktok' AND is_archived = true
  );
  
  -- Eliminar contenido Podcast antiguo no archivado
  DELETE FROM public.podcast_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'podcast' AND is_archived = true
  );
  
  RAISE NOTICE 'Contenido antiguo no archivado eliminado exitosamente';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- COMENTARIOS FINALES
-- Todas las políticas RLS han sido configuradas
-- El acceso está restringido al mínimo necesario
-- Las funciones de protección y limpieza están activas
-- =============================================

