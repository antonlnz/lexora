-- =============================================
-- Agregar política para permitir INSERT de artículos
-- Solo desde funciones del servidor
-- =============================================

-- Policy para permitir insert de artículos (necesario para el RSS service)
create policy "El sistema puede insertar artículos"
  on public.articles for insert
  to authenticated
  with check (
    exists (
      select 1 from public.sources
      where sources.id = articles.source_id
      and sources.user_id = auth.uid()
    )
  );

-- Policy para actualizar artículos
create policy "El sistema puede actualizar artículos"
  on public.articles for update
  to authenticated
  using (
    exists (
      select 1 from public.sources
      where sources.id = articles.source_id
      and sources.user_id = auth.uid()
    )
  );

-- Índice para optimizar búsqueda de artículos por URL
create index if not exists idx_articles_source_url on public.articles(source_id, url);

-- Índice para mejorar queries de artículos recientes
create index if not exists idx_articles_published_at_source on public.articles(source_id, published_at desc);
