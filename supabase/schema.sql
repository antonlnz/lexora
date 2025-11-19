-- =============================================
-- LEXORA - Esquema de Base de Datos
-- =============================================

-- Habilitar extensiones necesarias
create extension if not exists "uuid-ossp";

-- =============================================
-- TABLA: profiles
-- Perfil extendido de usuario
-- =============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  
  -- Preferencias de lectura
  reading_speed int default 250, -- palabras por minuto
  font_size text default 'medium',
  theme_preference text default 'system',
  
  -- Metadata
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Onboarding
  onboarding_completed boolean default false,
  onboarding_completed_at timestamp with time zone
);

-- =============================================
-- TABLA: sources
-- Fuentes RSS/feeds que el usuario sigue
-- =============================================
create table public.sources (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  
  title text not null,
  url text not null,
  description text,
  favicon_url text,
  source_type text default 'rss' not null,
  
  -- Estado
  is_active boolean default true,
  last_fetched_at timestamp with time zone,
  fetch_error text,
  
  -- Metadata
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Índices
  unique(user_id, url),
  
  -- Constraints
  constraint check_source_type check (source_type in ('rss', 'youtube', 'twitter', 'instagram', 'tiktok', 'newsletter', 'website'))
);

-- =============================================
-- TABLA: articles
-- Artículos/contenido de las fuentes
-- =============================================
create table public.articles (
  id uuid default uuid_generate_v4() primary key,
  source_id uuid references public.sources(id) on delete cascade not null,
  
  title text not null,
  url text not null,
  content text,
  excerpt text,
  author text,
  published_at timestamp with time zone,
  
  -- Metadata
  image_url text,
  reading_time int, -- minutos estimados
  word_count int,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Índices
  unique(source_id, url)
);

-- =============================================
-- TABLA: user_articles
-- Relación entre usuarios y artículos (leídos, guardados, etc.)
-- =============================================
create table public.user_articles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  article_id uuid references public.articles(id) on delete cascade not null,
  
  -- Estado de lectura
  is_read boolean default false,
  is_archived boolean default false,
  is_favorite boolean default false,
  
  -- Progreso de lectura
  reading_progress int default 0, -- porcentaje 0-100
  reading_time_spent int default 0, -- segundos
  
  -- Timestamps
  read_at timestamp with time zone,
  archived_at timestamp with time zone,
  favorited_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Índices
  unique(user_id, article_id)
);

-- =============================================
-- TABLA: collections
-- Colecciones de artículos creadas por el usuario
-- =============================================
create table public.collections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  
  name text not null,
  description text,
  color text default '#6366f1',
  icon text,
  
  is_public boolean default false,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- TABLA: collection_articles
-- Artículos dentro de colecciones
-- =============================================
create table public.collection_articles (
  id uuid default uuid_generate_v4() primary key,
  collection_id uuid references public.collections(id) on delete cascade not null,
  article_id uuid references public.articles(id) on delete cascade not null,
  
  position int default 0,
  notes text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(collection_id, article_id)
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS en todas las tablas
alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.user_articles enable row level security;
alter table public.collections enable row level security;
alter table public.collection_articles enable row level security;

-- Policies para profiles
create policy "Los usuarios pueden ver su propio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Los usuarios pueden actualizar su propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Policies para sources
create policy "Los usuarios pueden ver sus propias fuentes"
  on public.sources for select
  using (auth.uid() = user_id);

create policy "Los usuarios pueden crear sus propias fuentes"
  on public.sources for insert
  with check (auth.uid() = user_id);

create policy "Los usuarios pueden actualizar sus propias fuentes"
  on public.sources for update
  using (auth.uid() = user_id);

create policy "Los usuarios pueden eliminar sus propias fuentes"
  on public.sources for delete
  using (auth.uid() = user_id);

-- Policies para user_articles
create policy "Los usuarios pueden ver sus propios artículos"
  on public.user_articles for select
  using (auth.uid() = user_id);

create policy "Los usuarios pueden crear sus propias relaciones con artículos"
  on public.user_articles for insert
  with check (auth.uid() = user_id);

create policy "Los usuarios pueden actualizar sus propias relaciones con artículos"
  on public.user_articles for update
  using (auth.uid() = user_id);

create policy "Los usuarios pueden eliminar sus propias relaciones con artículos"
  on public.user_articles for delete
  using (auth.uid() = user_id);

-- Policies para collections
create policy "Los usuarios pueden ver sus propias colecciones o las públicas"
  on public.collections for select
  using (auth.uid() = user_id or is_public = true);

create policy "Los usuarios pueden crear sus propias colecciones"
  on public.collections for insert
  with check (auth.uid() = user_id);

create policy "Los usuarios pueden actualizar sus propias colecciones"
  on public.collections for update
  using (auth.uid() = user_id);

create policy "Los usuarios pueden eliminar sus propias colecciones"
  on public.collections for delete
  using (auth.uid() = user_id);

-- Policies para articles (lectura pública, escritura limitada)
create policy "Todos pueden ver artículos"
  on public.articles for select
  to authenticated
  using (true);

-- Policies para collection_articles
create policy "Los usuarios pueden ver artículos de sus colecciones o públicas"
  on public.collection_articles for select
  using (
    exists (
      select 1 from public.collections
      where collections.id = collection_articles.collection_id
      and (collections.user_id = auth.uid() or collections.is_public = true)
    )
  );

create policy "Los usuarios pueden agregar artículos a sus colecciones"
  on public.collection_articles for insert
  with check (
    exists (
      select 1 from public.collections
      where collections.id = collection_articles.collection_id
      and collections.user_id = auth.uid()
    )
  );

create policy "Los usuarios pueden eliminar artículos de sus colecciones"
  on public.collection_articles for delete
  using (
    exists (
      select 1 from public.collections
      where collections.id = collection_articles.collection_id
      and collections.user_id = auth.uid()
    )
  );

-- =============================================
-- TRIGGERS
-- =============================================

-- Función para actualizar updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Aplicar trigger a todas las tablas relevantes
create trigger set_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at
  before update on public.sources
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at
  before update on public.articles
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at
  before update on public.user_articles
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at
  before update on public.collections
  for each row execute procedure public.handle_updated_at();

-- =============================================
-- FUNCIÓN: Crear perfil automáticamente al registrarse
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger para crear perfil automáticamente
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- ÍNDICES para mejor performance
-- =============================================
create index idx_sources_user_id on public.sources(user_id);
create index idx_sources_source_type on public.sources(source_type);
create index idx_articles_source_id on public.articles(source_id);
create index idx_articles_published_at on public.articles(published_at desc);
create index idx_user_articles_user_id on public.user_articles(user_id);
create index idx_user_articles_article_id on public.user_articles(article_id);
create index idx_user_articles_is_read on public.user_articles(is_read);
create index idx_user_articles_is_archived on public.user_articles(is_archived);
create index idx_collections_user_id on public.collections(user_id);
create index idx_collection_articles_collection_id on public.collection_articles(collection_id);
