-- =============================================
-- LEXORA - Row Level Security Policies
-- Políticas de seguridad optimizadas
-- Versión: 2.1
-- Última actualización: 2 de diciembre de 2025
-- =============================================
-- 
-- NOTAS DE OPTIMIZACIÓN:
-- - Se consolidaron políticas múltiples permissive para evitar warnings
-- - Se eliminaron políticas redundantes
-- - Solo se permiten operaciones necesarias para el sistema
--
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
-- PASO 2: subscription_plans
-- Los planes son de solo lectura para usuarios
-- =============================================

CREATE POLICY "subscription_plans_select"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- PASO 3: user_subscriptions
-- CRUD solo para el propio usuario
-- =============================================

CREATE POLICY "user_subscriptions_select"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_subscriptions_insert"
  ON public.user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_subscriptions_update"
  ON public.user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- No se permite DELETE de suscripciones (se cancelan, no se eliminan)

-- =============================================
-- PASO 4: user_viewer_settings
-- CRUD solo para el propio usuario
-- =============================================

CREATE POLICY "user_viewer_settings_select"
  ON public.user_viewer_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_viewer_settings_insert"
  ON public.user_viewer_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_viewer_settings_update"
  ON public.user_viewer_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- No se permite DELETE (se crea con el usuario y se elimina en cascada)

-- =============================================
-- PASO 5: user_interface_settings
-- CRUD solo para el propio usuario
-- =============================================

CREATE POLICY "user_interface_settings_select"
  ON public.user_interface_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_interface_settings_insert"
  ON public.user_interface_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_interface_settings_update"
  ON public.user_interface_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- PASO 6: user_notification_settings
-- CRUD solo para el propio usuario
-- =============================================

CREATE POLICY "user_notification_settings_select"
  ON public.user_notification_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_notification_settings_insert"
  ON public.user_notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_notification_settings_update"
  ON public.user_notification_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- PASO 7: user_privacy_settings
-- CRUD solo para el propio usuario
-- =============================================

CREATE POLICY "user_privacy_settings_select"
  ON public.user_privacy_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_privacy_settings_insert"
  ON public.user_privacy_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_privacy_settings_update"
  ON public.user_privacy_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- PASO 8: profiles
-- Lectura pública, escritura solo propietario
-- =============================================

CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- No se permite DELETE (se elimina en cascada con auth.users)

-- =============================================
-- PASO 9: content_sources
-- Lectura para todos, escritura para suscriptores
-- =============================================

-- Todos los usuarios autenticados pueden ver fuentes
CREATE POLICY "content_sources_select"
  ON public.content_sources FOR SELECT
  TO authenticated
  USING (true);

-- Cualquier usuario puede crear fuentes nuevas
CREATE POLICY "content_sources_insert"
  ON public.content_sources FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Solo suscriptores pueden actualizar (ej: al sincronizar)
CREATE POLICY "content_sources_update"
  ON public.content_sources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = content_sources.id
      AND user_sources.user_id = auth.uid()
    )
  );

-- Solo el único suscriptor puede eliminar una fuente
CREATE POLICY "content_sources_delete"
  ON public.content_sources FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = content_sources.id
      AND user_sources.user_id = auth.uid()
    )
    AND (
      SELECT COUNT(*) FROM public.user_sources
      WHERE user_sources.source_id = content_sources.id
    ) <= 1
  );

-- =============================================
-- PASO 10: user_sources
-- CRUD completo para el usuario
-- =============================================

CREATE POLICY "user_sources_select"
  ON public.user_sources FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_sources_insert"
  ON public.user_sources FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_sources_update"
  ON public.user_sources FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_sources_delete"
  ON public.user_sources FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- PASO 11: rss_content
-- Lectura por suscriptores, escritura por sistema
-- =============================================

-- Solo suscriptores de la fuente pueden ver el contenido
CREATE POLICY "rss_content_select"
  ON public.rss_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = rss_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

-- El sistema puede insertar contenido si existe algún suscriptor
CREATE POLICY "rss_content_insert"
  ON public.rss_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = rss_content.source_id
    )
  );

-- El sistema puede actualizar contenido de fuentes suscritas
CREATE POLICY "rss_content_update"
  ON public.rss_content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = rss_content.source_id
    )
  );

-- Solo el único suscriptor puede eliminar contenido
CREATE POLICY "rss_content_delete"
  ON public.rss_content FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = rss_content.source_id
      AND user_sources.user_id = auth.uid()
    )
    AND (
      SELECT COUNT(*) FROM public.user_sources
      WHERE user_sources.source_id = rss_content.source_id
    ) <= 1
  );

-- =============================================
-- PASO 12: youtube_content
-- =============================================

CREATE POLICY "youtube_content_select"
  ON public.youtube_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = youtube_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "youtube_content_insert"
  ON public.youtube_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = youtube_content.source_id
    )
  );

CREATE POLICY "youtube_content_update"
  ON public.youtube_content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = youtube_content.source_id
    )
  );

CREATE POLICY "youtube_content_delete"
  ON public.youtube_content FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = youtube_content.source_id
      AND user_sources.user_id = auth.uid()
    )
    AND (
      SELECT COUNT(*) FROM public.user_sources
      WHERE user_sources.source_id = youtube_content.source_id
    ) <= 1
  );

-- =============================================
-- PASO 13: twitter_content
-- =============================================

CREATE POLICY "twitter_content_select"
  ON public.twitter_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = twitter_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "twitter_content_insert"
  ON public.twitter_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = twitter_content.source_id
    )
  );

CREATE POLICY "twitter_content_update"
  ON public.twitter_content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = twitter_content.source_id
    )
  );

CREATE POLICY "twitter_content_delete"
  ON public.twitter_content FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = twitter_content.source_id
      AND user_sources.user_id = auth.uid()
    )
    AND (
      SELECT COUNT(*) FROM public.user_sources
      WHERE user_sources.source_id = twitter_content.source_id
    ) <= 1
  );

-- =============================================
-- PASO 14: instagram_content
-- =============================================

CREATE POLICY "instagram_content_select"
  ON public.instagram_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = instagram_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "instagram_content_insert"
  ON public.instagram_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = instagram_content.source_id
    )
  );

CREATE POLICY "instagram_content_update"
  ON public.instagram_content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = instagram_content.source_id
    )
  );

CREATE POLICY "instagram_content_delete"
  ON public.instagram_content FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = instagram_content.source_id
      AND user_sources.user_id = auth.uid()
    )
    AND (
      SELECT COUNT(*) FROM public.user_sources
      WHERE user_sources.source_id = instagram_content.source_id
    ) <= 1
  );

-- =============================================
-- PASO 15: tiktok_content
-- =============================================

CREATE POLICY "tiktok_content_select"
  ON public.tiktok_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = tiktok_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "tiktok_content_insert"
  ON public.tiktok_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = tiktok_content.source_id
    )
  );

CREATE POLICY "tiktok_content_update"
  ON public.tiktok_content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = tiktok_content.source_id
    )
  );

CREATE POLICY "tiktok_content_delete"
  ON public.tiktok_content FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = tiktok_content.source_id
      AND user_sources.user_id = auth.uid()
    )
    AND (
      SELECT COUNT(*) FROM public.user_sources
      WHERE user_sources.source_id = tiktok_content.source_id
    ) <= 1
  );

-- =============================================
-- PASO 16: podcast_content
-- =============================================

CREATE POLICY "podcast_content_select"
  ON public.podcast_content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = podcast_content.source_id
      AND user_sources.user_id = auth.uid()
    )
  );

CREATE POLICY "podcast_content_insert"
  ON public.podcast_content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = podcast_content.source_id
    )
  );

CREATE POLICY "podcast_content_update"
  ON public.podcast_content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = podcast_content.source_id
    )
  );

CREATE POLICY "podcast_content_delete"
  ON public.podcast_content FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = podcast_content.source_id
      AND user_sources.user_id = auth.uid()
    )
    AND (
      SELECT COUNT(*) FROM public.user_sources
      WHERE user_sources.source_id = podcast_content.source_id
    ) <= 1
  );

-- =============================================
-- PASO 17: user_content
-- CRUD completo para el usuario (OPTIMIZADO)
-- Una sola política SELECT en vez de múltiples
-- =============================================

CREATE POLICY "user_content_select"
  ON public.user_content FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_content_insert"
  ON public.user_content FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_content_update"
  ON public.user_content FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_content_delete"
  ON public.user_content FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- PASO 18: collections_new
-- Lectura propias + públicas, escritura propias
-- =============================================

CREATE POLICY "collections_new_select"
  ON public.collections_new FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "collections_new_insert"
  ON public.collections_new FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections_new_update"
  ON public.collections_new FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "collections_new_delete"
  ON public.collections_new FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- PASO 19: collection_items
-- Acceso basado en propietario de la colección
-- =============================================

CREATE POLICY "collection_items_select"
  ON public.collection_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections_new
      WHERE collections_new.id = collection_items.collection_id
      AND (collections_new.user_id = auth.uid() OR collections_new.is_public = true)
    )
  );

CREATE POLICY "collection_items_insert"
  ON public.collection_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections_new
      WHERE collections_new.id = collection_items.collection_id
      AND collections_new.user_id = auth.uid()
    )
  );

CREATE POLICY "collection_items_update"
  ON public.collection_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections_new
      WHERE collections_new.id = collection_items.collection_id
      AND collections_new.user_id = auth.uid()
    )
  );

CREATE POLICY "collection_items_delete"
  ON public.collection_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections_new
      WHERE collections_new.id = collection_items.collection_id
      AND collections_new.user_id = auth.uid()
    )
  );

-- =============================================
-- FUNCIONES DE PROTECCIÓN Y LIMPIEZA
-- =============================================

-- Función para prevenir borrado de contenido archivado
CREATE OR REPLACE FUNCTION prevent_archived_content_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_content
    WHERE content_type = TG_ARGV[0]
    AND content_id = OLD.id
    AND is_archived = true
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar contenido archivado por algún usuario';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers de protección
CREATE TRIGGER prevent_rss_content_deletion
  BEFORE DELETE ON public.rss_content
  FOR EACH ROW EXECUTE FUNCTION prevent_archived_content_deletion('rss');

CREATE TRIGGER prevent_youtube_content_deletion
  BEFORE DELETE ON public.youtube_content
  FOR EACH ROW EXECUTE FUNCTION prevent_archived_content_deletion('youtube');

CREATE TRIGGER prevent_twitter_content_deletion
  BEFORE DELETE ON public.twitter_content
  FOR EACH ROW EXECUTE FUNCTION prevent_archived_content_deletion('twitter');

CREATE TRIGGER prevent_instagram_content_deletion
  BEFORE DELETE ON public.instagram_content
  FOR EACH ROW EXECUTE FUNCTION prevent_archived_content_deletion('instagram');

CREATE TRIGGER prevent_tiktok_content_deletion
  BEFORE DELETE ON public.tiktok_content
  FOR EACH ROW EXECUTE FUNCTION prevent_archived_content_deletion('tiktok');

CREATE TRIGGER prevent_podcast_content_deletion
  BEFORE DELETE ON public.podcast_content
  FOR EACH ROW EXECUTE FUNCTION prevent_archived_content_deletion('podcast');

-- Función de limpieza automática de contenido antiguo
CREATE OR REPLACE FUNCTION cleanup_old_unarchived_content()
RETURNS void AS $$
DECLARE
  retention_days int := 30;
  cutoff_date timestamp with time zone;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::interval;
  
  DELETE FROM public.rss_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'rss' AND is_archived = true
  );
  
  DELETE FROM public.youtube_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'youtube' AND is_archived = true
  );
  
  DELETE FROM public.twitter_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'twitter' AND is_archived = true
  );
  
  DELETE FROM public.instagram_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'instagram' AND is_archived = true
  );
  
  DELETE FROM public.tiktok_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'tiktok' AND is_archived = true
  );
  
  DELETE FROM public.podcast_content
  WHERE published_at < cutoff_date
  AND id NOT IN (
    SELECT content_id FROM public.user_content 
    WHERE content_type = 'podcast' AND is_archived = true
  );
  
  RAISE NOTICE 'Contenido antiguo no archivado eliminado';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FIN DE POLÍTICAS RLS
-- =============================================
