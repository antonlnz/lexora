-- =============================================
-- LEXORA - Comandos Útiles de Mantenimiento
-- Colección de queries y comandos útiles
-- =============================================

-- =============================================
-- INSPECCIÓN DE DATOS
-- =============================================

-- Ver estadísticas generales
SELECT 
  'Usuarios' as tipo, COUNT(*) as total FROM profiles
UNION ALL
SELECT 'Fuentes', COUNT(*) FROM content_sources
UNION ALL
SELECT 'Suscripciones a fuentes', COUNT(*) FROM user_sources
UNION ALL
SELECT 'Artículos RSS', COUNT(*) FROM rss_content
UNION ALL
SELECT 'Videos YouTube', COUNT(*) FROM youtube_content
UNION ALL
SELECT 'Contenido favorito', COUNT(*) FROM user_content WHERE is_favorite = true
UNION ALL
SELECT 'Contenido archivado', COUNT(*) FROM user_content WHERE is_archived = true;

-- Ver contenido RSS por tipo de media
SELECT 
  featured_media_type,
  COUNT(*) as count,
  COUNT(DISTINCT source_id) as unique_sources,
  COUNT(CASE WHEN featured_media_duration IS NOT NULL THEN 1 END) as with_duration
FROM rss_content
GROUP BY featured_media_type
ORDER BY count DESC;

-- Ver fuentes más activas
SELECT 
  cs.title as source_name,
  cs.source_type,
  COUNT(rc.id) as article_count,
  MAX(rc.published_at) as latest_article,
  cs.last_fetched_at
FROM content_sources cs
LEFT JOIN rss_content rc ON rc.source_id = cs.id
GROUP BY cs.id, cs.title, cs.source_type, cs.last_fetched_at
ORDER BY article_count DESC
LIMIT 20;

-- Ver usuarios más activos
SELECT 
  p.email,
  p.full_name,
  COUNT(DISTINCT us.source_id) as sources_count,
  COUNT(DISTINCT uc.content_id) as favorited_count,
  COUNT(DISTINCT CASE WHEN uc.is_archived THEN uc.content_id END) as archived_count
FROM profiles p
LEFT JOIN user_sources us ON us.user_id = p.id
LEFT JOIN user_content uc ON uc.user_id = p.id
GROUP BY p.id, p.email, p.full_name
ORDER BY sources_count DESC;

-- =============================================
-- LIMPIEZA Y MANTENIMIENTO
-- =============================================

-- Ejecutar limpieza manual de contenido antiguo (30 días)
SELECT cleanup_old_unarchived_content();

-- Ver contenido candidato a eliminación
SELECT 
  'RSS' as type,
  COUNT(*) as count
FROM rss_content
WHERE published_at < NOW() - INTERVAL '30 days'
AND id NOT IN (
  SELECT content_id FROM user_content 
  WHERE content_type = 'rss' AND is_archived = true
)
UNION ALL
SELECT 
  'YouTube',
  COUNT(*)
FROM youtube_content
WHERE published_at < NOW() - INTERVAL '30 days'
AND id NOT IN (
  SELECT content_id FROM user_content 
  WHERE content_type = 'youtube' AND is_archived = true
);

-- Ver fuentes sin contenido reciente (últimos 7 días)
SELECT 
  cs.title,
  cs.source_type,
  cs.url,
  cs.last_fetched_at,
  cs.fetch_error,
  COUNT(us.user_id) as subscriber_count
FROM content_sources cs
LEFT JOIN user_sources us ON us.source_id = cs.id
LEFT JOIN rss_content rc ON rc.source_id = cs.id AND rc.published_at > NOW() - INTERVAL '7 days'
WHERE cs.source_type = 'rss'
GROUP BY cs.id, cs.title, cs.source_type, cs.url, cs.last_fetched_at, cs.fetch_error
HAVING COUNT(rc.id) = 0
ORDER BY subscriber_count DESC;

-- Eliminar fuentes huérfanas (sin suscriptores)
-- CUIDADO: Esto eliminará las fuentes y su contenido
/*
DELETE FROM content_sources
WHERE id NOT IN (
  SELECT DISTINCT source_id FROM user_sources
);
*/

-- =============================================
-- ANÁLISIS DE RENDIMIENTO
-- =============================================

-- Ver tamaño de tablas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Ver índices no utilizados (requiere pg_stat_statements)
/*
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND idx_scan = 0
AND indexrelname NOT LIKE '%pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
*/

-- Ver consultas lentas (últimas 100)
/*
SELECT 
  mean_exec_time,
  calls,
  total_exec_time,
  query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 100;
*/

-- =============================================
-- DEBUGGING Y TROUBLESHOOTING
-- =============================================

-- Ver artículos con videos que no tienen thumbnail
SELECT 
  id,
  title,
  url,
  featured_media_url,
  featured_thumbnail_url,
  source_id
FROM rss_content
WHERE featured_media_type = 'video'
AND featured_thumbnail_url IS NULL
ORDER BY published_at DESC
LIMIT 50;

-- Ver fuentes con errores
SELECT 
  title,
  url,
  fetch_error,
  last_fetched_at,
  fetch_count
FROM content_sources
WHERE fetch_error IS NOT NULL
ORDER BY last_fetched_at DESC;

-- Ver usuarios sin configuraciones (detectar errores en trigger)
SELECT 
  p.id,
  p.email,
  p.created_at,
  CASE WHEN uvs.user_id IS NULL THEN '✗' ELSE '✓' END as viewer_settings,
  CASE WHEN uis.user_id IS NULL THEN '✗' ELSE '✓' END as interface_settings,
  CASE WHEN uns.user_id IS NULL THEN '✗' ELSE '✓' END as notification_settings,
  CASE WHEN ups.user_id IS NULL THEN '✗' ELSE '✓' END as privacy_settings,
  CASE WHEN us.user_id IS NULL THEN '✗' ELSE '✓' END as subscription
FROM profiles p
LEFT JOIN user_viewer_settings uvs ON uvs.user_id = p.id
LEFT JOIN user_interface_settings uis ON uis.user_id = p.id
LEFT JOIN user_notification_settings uns ON uns.user_id = p.id
LEFT JOIN user_privacy_settings ups ON ups.user_id = p.id
LEFT JOIN user_subscriptions us ON us.user_id = p.id
WHERE uvs.user_id IS NULL 
   OR uis.user_id IS NULL 
   OR uns.user_id IS NULL 
   OR ups.user_id IS NULL
   OR us.user_id IS NULL;

-- Reparar usuario sin configuraciones (ejecutar para cada user_id)
/*
DO $$
DECLARE
  target_user_id uuid := 'INSERTAR_UUID_AQUI';
BEGIN
  -- Crear configuraciones faltantes
  INSERT INTO user_viewer_settings (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO user_interface_settings (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO user_notification_settings (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO user_privacy_settings (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Asignar plan gratuito si no tiene
  INSERT INTO user_subscriptions (user_id, plan_id, status)
  SELECT target_user_id, id, 'active'
  FROM subscription_plans
  WHERE name = 'free'
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE NOTICE 'Configuraciones reparadas para usuario %', target_user_id;
END $$;
*/

-- =============================================
-- MIGRACIÓN DE DATOS LEGACY
-- =============================================

-- Si tienes datos con image_url pero sin featured_media_*, ejecutar:
/*
UPDATE rss_content
SET 
  featured_media_type = CASE 
    WHEN image_url IS NOT NULL THEN 'image'
    ELSE 'none'
  END,
  featured_media_url = image_url,
  featured_thumbnail_url = NULL
WHERE featured_media_type IS NULL
AND image_url IS NOT NULL;
*/

-- =============================================
-- REPORTES Y ESTADÍSTICAS
-- =============================================

-- Reporte de actividad por día (últimos 30 días)
SELECT 
  DATE(published_at) as date,
  COUNT(*) as articles_added,
  COUNT(DISTINCT source_id) as active_sources
FROM rss_content
WHERE published_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(published_at)
ORDER BY date DESC;

-- Reporte de engagement de usuarios
SELECT 
  p.email,
  COUNT(DISTINCT CASE WHEN uc.is_read THEN uc.content_id END) as read_count,
  COUNT(DISTINCT CASE WHEN uc.is_favorite THEN uc.content_id END) as favorite_count,
  COUNT(DISTINCT CASE WHEN uc.is_archived THEN uc.content_id END) as archived_count,
  MAX(uc.last_accessed_at) as last_activity
FROM profiles p
LEFT JOIN user_content uc ON uc.user_id = p.id
GROUP BY p.id, p.email
ORDER BY last_activity DESC NULLS LAST;

-- Top 10 fuentes más populares
SELECT 
  cs.title,
  cs.source_type,
  COUNT(DISTINCT us.user_id) as subscriber_count,
  COUNT(rc.id) as total_articles,
  MAX(rc.published_at) as latest_article
FROM content_sources cs
LEFT JOIN user_sources us ON us.source_id = cs.id
LEFT JOIN rss_content rc ON rc.source_id = cs.id
GROUP BY cs.id, cs.title, cs.source_type
ORDER BY subscriber_count DESC
LIMIT 10;

-- =============================================
-- BACKUP Y EXPORT
-- =============================================

-- Exportar configuración de un usuario (para backup)
/*
SELECT json_build_object(
  'profile', (SELECT row_to_json(p.*) FROM profiles p WHERE id = 'USER_ID_AQUI'),
  'viewer_settings', (SELECT row_to_json(vs.*) FROM user_viewer_settings vs WHERE user_id = 'USER_ID_AQUI'),
  'interface_settings', (SELECT row_to_json(uis.*) FROM user_interface_settings uis WHERE user_id = 'USER_ID_AQUI'),
  'sources', (SELECT json_agg(row_to_json(us.*)) FROM user_sources us WHERE user_id = 'USER_ID_AQUI')
) as user_backup;
*/

-- =============================================
-- NOTAS FINALES
-- =============================================

-- Para ejecutar este archivo:
-- psql -U postgres -d lexora -f supabase/maintenance_queries.sql

-- Para ejecutar una consulta específica, copia y pega en SQL Editor

-- Recuerda: Los comandos comentados con /* */ requieren
-- que descomentas y ajustes los parámetros antes de ejecutar
