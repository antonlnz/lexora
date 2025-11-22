-- =============================================
-- LEXORA - Script de Verificación
-- Ejecutar después de aplicar las migraciones
-- =============================================

-- =============================================
-- 1. VERIFICAR TABLAS CREADAS
-- =============================================

SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND columns.table_name = tables.table_name) as column_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =============================================
-- 2. VERIFICAR RLS HABILITADO
-- =============================================

SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✓ Habilitado'
    ELSE '✗ DESHABILITADO'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- =============================================
-- 3. VERIFICAR POLÍTICAS RLS
-- =============================================

SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- =============================================
-- 4. VERIFICAR ÍNDICES
-- =============================================

SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname NOT LIKE '%pkey'
ORDER BY tablename, indexname;

-- =============================================
-- 5. VERIFICAR TRIGGERS
-- =============================================

SELECT 
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- =============================================
-- 6. VERIFICAR FUNCIONES
-- =============================================

SELECT 
  proname as function_name,
  pg_get_function_result(oid) as return_type,
  pronargs as num_args
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
AND proname IN (
  'handle_updated_at',
  'handle_new_user_v2',
  'prevent_archived_content_deletion',
  'cleanup_old_unarchived_content'
)
ORDER BY proname;

-- =============================================
-- 7. VERIFICAR PLANES DE SUSCRIPCIÓN
-- =============================================

SELECT 
  name,
  price_monthly,
  price_yearly,
  max_sources,
  max_archived_items
FROM subscription_plans
ORDER BY price_monthly NULLS FIRST;

-- =============================================
-- 8. VERIFICAR SOPORTE DE VIDEOS EN RSS
-- =============================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'rss_content'
AND column_name IN (
  'featured_media_type',
  'featured_media_url',
  'featured_thumbnail_url',
  'featured_media_duration',
  'image_url'
)
ORDER BY column_name;

-- =============================================
-- 9. VERIFICAR CONSTRAINTS
-- =============================================

SELECT 
  conname as constraint_name,
  conrelid::regclass as table_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
AND conname IN (
  'check_subscription_status',
  'check_featured_media_type',
  'check_content_type'
)
ORDER BY conname;

-- =============================================
-- 10. VERIFICAR FOREIGN KEYS
-- =============================================

SELECT 
  tc.table_name,
  COUNT(*) as fk_count
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
GROUP BY tc.table_name
ORDER BY tc.table_name;

-- =============================================
-- 11. RESUMEN FINAL
-- =============================================

DO $$
DECLARE
  table_count int;
  rls_enabled_count int;
  policy_count int;
  trigger_count int;
  function_count int;
  plan_count int;
  index_count int;
BEGIN
  -- Contar tablas
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  
  -- Contar tablas con RLS
  SELECT COUNT(*) INTO rls_enabled_count
  FROM pg_tables 
  WHERE schemaname = 'public' AND rowsecurity = true;
  
  -- Contar políticas
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  -- Contar triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_schema = 'public';
  
  -- Contar funciones
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace;
  
  -- Contar planes
  SELECT COUNT(*) INTO plan_count
  FROM subscription_plans;
  
  -- Contar índices
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public' AND indexname NOT LIKE '%pkey';
  
  RAISE NOTICE '✓ Tablas creadas: %', table_count;
  RAISE NOTICE '✓ Tablas con RLS: %', rls_enabled_count;
  RAISE NOTICE '✓ Políticas RLS: %', policy_count;
  RAISE NOTICE '✓ Triggers: %', trigger_count;
  RAISE NOTICE '✓ Funciones: %', function_count;
  RAISE NOTICE '✓ Índices: %', index_count;
  RAISE NOTICE '✓ Planes de suscripción: %', plan_count;
  
  RAISE NOTICE '';
  
  IF table_count >= 18 AND rls_enabled_count >= 18 AND policy_count > 40 AND plan_count >= 3 THEN
    RAISE NOTICE '✓✓✓ VERIFICACIÓN EXITOSA ✓✓✓';
    RAISE NOTICE 'La base de datos está correctamente configurada.';
  ELSE
    RAISE WARNING '⚠ ADVERTENCIA: Algunos elementos pueden estar faltando.';
    RAISE NOTICE 'Revisa los detalles arriba.';
  END IF;
END $$;
