-- =============================================
-- LEXORA - Políticas DELETE para content_sources y tablas de contenido
-- Esta migración añade políticas que permiten eliminar fuentes y contenido
-- cuando el usuario es el único suscriptor
-- =============================================

-- =============================================
-- PASO 1: POLÍTICA DELETE PARA content_sources
-- Un usuario puede eliminar una fuente si es el único suscriptor
-- =============================================

CREATE POLICY "Usuarios pueden eliminar fuentes si son únicos suscriptores"
  ON public.content_sources FOR DELETE
  TO authenticated
  USING (
    -- El usuario debe estar suscrito a la fuente
    EXISTS (
      SELECT 1 FROM public.user_sources
      WHERE user_sources.source_id = content_sources.id
      AND user_sources.user_id = auth.uid()
    )
    -- Y debe ser el único suscriptor (o no haber suscriptores después de eliminar el suyo)
    AND (
      SELECT COUNT(*) FROM public.user_sources
      WHERE user_sources.source_id = content_sources.id
    ) <= 1
  );

-- =============================================
-- PASO 2: POLÍTICAS DELETE PARA TABLAS DE CONTENIDO
-- Permitir eliminar contenido si el usuario puede eliminar la fuente
-- =============================================

-- YouTube content
CREATE POLICY "Usuarios pueden eliminar contenido YouTube de sus fuentes"
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

-- RSS content
CREATE POLICY "Usuarios pueden eliminar contenido RSS de sus fuentes"
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

-- Twitter content
CREATE POLICY "Usuarios pueden eliminar contenido Twitter de sus fuentes"
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

-- Instagram content
CREATE POLICY "Usuarios pueden eliminar contenido Instagram de sus fuentes"
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

-- TikTok content
CREATE POLICY "Usuarios pueden eliminar contenido TikTok de sus fuentes"
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

-- Podcast content
CREATE POLICY "Usuarios pueden eliminar contenido Podcast de sus fuentes"
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
-- COMENTARIOS
-- Estas políticas permiten la eliminación de fuentes y contenido
-- solo cuando el usuario es el único suscriptor de esa fuente.
-- Esto protege el contenido de otros usuarios.
-- =============================================
