-- =============================================
-- MIGRACIÓN: Sistema de Suscripciones
-- Versión: 00008
-- Descripción: Configura los planes de suscripción Free y Pro
-- =============================================

-- Limpiar planes existentes (si existen)
TRUNCATE TABLE public.subscription_plans CASCADE;

-- =============================================
-- INSERTAR PLANES DE SUSCRIPCIÓN
-- =============================================

-- Plan Free: 10 fuentes, funcionalidades básicas
INSERT INTO public.subscription_plans (
  id,
  name,
  description,
  price_monthly,
  price_yearly,
  features,
  max_sources,
  max_archived_items
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, -- UUID fijo para referencia
  'Free',
  'Plan gratuito con funcionalidades básicas. Perfecto para empezar a organizar tu contenido.',
  0.00,
  0.00,
  '{
    "archive_search": false,
    "archive_download": false,
    "advanced_filters": false,
    "export_data": false,
    "priority_updates": false,
    "custom_themes": false,
    "api_access": false,
    "max_collections": 3,
    "max_folders": 5
  }'::jsonb,
  10,    -- 10 fuentes máximo
  100    -- 100 items archivados máximo
);

-- Plan Pro: Fuentes ilimitadas (10000), todas las funcionalidades
INSERT INTO public.subscription_plans (
  id,
  name,
  description,
  price_monthly,
  price_yearly,
  features,
  max_sources,
  max_archived_items
) VALUES (
  'a87ff679-a2f3-4c48-b5e6-4f7b2c1d9e8f'::uuid, -- UUID fijo para referencia
  'Pro',
  'Plan profesional con acceso ilimitado. Ideal para lectores ávidos y profesionales.',
  3.99,   -- $3.99/mes según especificación
  39.99,  -- $39.99/año (ahorro de ~17%)
  '{
    "archive_search": true,
    "archive_download": true,
    "advanced_filters": true,
    "export_data": true,
    "priority_updates": true,
    "custom_themes": true,
    "api_access": true,
    "max_collections": 999999,
    "max_folders": 999999
  }'::jsonb,
  10000,   -- 10000 fuentes (prácticamente ilimitado)
  999999   -- Prácticamente ilimitado
);

-- =============================================
-- FUNCIÓN: Asignar plan free a nuevos usuarios
-- =============================================

-- Función que se ejecuta cuando se crea un nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger AS $$
DECLARE
  free_plan_id uuid;
BEGIN
  -- Obtener el ID del plan Free
  SELECT id INTO free_plan_id FROM public.subscription_plans WHERE name = 'Free' LIMIT 1;
  
  -- Crear suscripción gratuita para el nuevo usuario
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status)
    VALUES (NEW.id, free_plan_id, 'active')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para asignar plan free automáticamente cuando se crea un perfil
DROP TRIGGER IF EXISTS on_profile_created_subscription ON public.profiles;
CREATE TRIGGER on_profile_created_subscription
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- =============================================
-- FUNCIÓN: Verificar límite de fuentes
-- =============================================

-- Función para verificar si un usuario puede añadir fuentes
CREATE OR REPLACE FUNCTION public.check_user_source_limit(p_user_id uuid)
RETURNS TABLE (
  can_add boolean,
  current_count bigint,
  max_allowed int,
  plan_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (COUNT(us.id) < COALESCE(sp.max_sources, 10))::boolean AS can_add,
    COUNT(us.id) AS current_count,
    COALESCE(sp.max_sources, 10) AS max_allowed,
    COALESCE(sp.name, 'Free') AS plan_name
  FROM public.user_subscriptions sub
  LEFT JOIN public.subscription_plans sp ON sp.id = sub.plan_id
  LEFT JOIN public.user_sources us ON us.user_id = p_user_id
  WHERE sub.user_id = p_user_id AND sub.status = 'active'
  GROUP BY sp.max_sources, sp.name;
  
  -- Si no tiene suscripción, devolver valores por defecto (plan Free)
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      (COUNT(us.id) < 10)::boolean AS can_add,
      COUNT(us.id) AS current_count,
      10 AS max_allowed,
      'Free'::text AS plan_name
    FROM public.user_sources us
    WHERE us.user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FUNCIÓN: Verificar acceso a funcionalidad
-- =============================================

-- Función para verificar si un usuario tiene acceso a una funcionalidad
CREATE OR REPLACE FUNCTION public.check_user_feature(p_user_id uuid, p_feature text)
RETURNS boolean AS $$
DECLARE
  has_feature boolean;
BEGIN
  SELECT (sp.features->>p_feature)::boolean INTO has_feature
  FROM public.user_subscriptions sub
  JOIN public.subscription_plans sp ON sp.id = sub.plan_id
  WHERE sub.user_id = p_user_id AND sub.status = 'active'
  LIMIT 1;
  
  -- Si no tiene suscripción o la feature no existe, devolver false
  RETURN COALESCE(has_feature, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- POLÍTICAS RLS PARA PLANES Y SUSCRIPCIONES
-- =============================================

-- Los planes son visibles para todos (público)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_plans_select" ON public.subscription_plans;
CREATE POLICY "subscription_plans_select" ON public.subscription_plans
  FOR SELECT USING (true);

-- Solo admins pueden modificar planes (por ahora no hay admins, así que nadie puede)
DROP POLICY IF EXISTS "subscription_plans_insert" ON public.subscription_plans;
CREATE POLICY "subscription_plans_insert" ON public.subscription_plans
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "subscription_plans_update" ON public.subscription_plans;
CREATE POLICY "subscription_plans_update" ON public.subscription_plans
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "subscription_plans_delete" ON public.subscription_plans;
CREATE POLICY "subscription_plans_delete" ON public.subscription_plans
  FOR DELETE USING (false);

-- Usuarios solo pueden ver su propia suscripción
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_subscriptions_select" ON public.user_subscriptions;
CREATE POLICY "user_subscriptions_select" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Usuarios pueden insertar su propia suscripción (para onboarding)
DROP POLICY IF EXISTS "user_subscriptions_insert" ON public.user_subscriptions;
CREATE POLICY "user_subscriptions_insert" ON public.user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden actualizar su propia suscripción
DROP POLICY IF EXISTS "user_subscriptions_update" ON public.user_subscriptions;
CREATE POLICY "user_subscriptions_update" ON public.user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- No se permite eliminar suscripciones directamente
DROP POLICY IF EXISTS "user_subscriptions_delete" ON public.user_subscriptions;
CREATE POLICY "user_subscriptions_delete" ON public.user_subscriptions
  FOR DELETE USING (false);

-- =============================================
-- POLÍTICA RLS PARA VERIFICAR LÍMITE AL AÑADIR FUENTES
-- =============================================

-- Función auxiliar para verificar límite en user_sources
CREATE OR REPLACE FUNCTION public.can_add_source()
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_current_count bigint;
  v_max_allowed int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Contar fuentes actuales
  SELECT COUNT(*) INTO v_current_count
  FROM public.user_sources
  WHERE user_id = v_user_id;
  
  -- Obtener límite del plan
  SELECT COALESCE(sp.max_sources, 10) INTO v_max_allowed
  FROM public.user_subscriptions sub
  JOIN public.subscription_plans sp ON sp.id = sub.plan_id
  WHERE sub.user_id = v_user_id AND sub.status = 'active'
  LIMIT 1;
  
  -- Si no tiene suscripción, usar límite free
  IF v_max_allowed IS NULL THEN
    v_max_allowed := 10;
  END IF;
  
  RETURN v_current_count < v_max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar la política de INSERT en user_sources para verificar límite
-- Primero necesitamos eliminar la política existente si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_sources' AND policyname = 'user_sources_insert'
  ) THEN
    DROP POLICY "user_sources_insert" ON public.user_sources;
  END IF;
END $$;

-- Crear nueva política que verifica el límite
CREATE POLICY "user_sources_insert" ON public.user_sources
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND public.can_add_source()
  );

-- =============================================
-- ASIGNAR PLAN FREE A USUARIOS EXISTENTES
-- =============================================

-- Asignar plan free a usuarios que no tengan suscripción
INSERT INTO public.user_subscriptions (user_id, plan_id, status)
SELECT 
  p.id,
  (SELECT id FROM public.subscription_plans WHERE name = 'Free' LIMIT 1),
  'active'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions sub WHERE sub.user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =============================================

-- Índice para búsquedas por nombre de plan
CREATE INDEX IF NOT EXISTS idx_subscription_plans_name ON public.subscription_plans(name);

-- Índice para búsquedas de suscripción por estado
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);

-- =============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =============================================

COMMENT ON TABLE public.subscription_plans IS 'Planes de suscripción disponibles en Lexora';
COMMENT ON COLUMN public.subscription_plans.features IS 'JSON con las funcionalidades habilitadas para el plan';
COMMENT ON COLUMN public.subscription_plans.max_sources IS 'Número máximo de fuentes que puede tener un usuario con este plan';

COMMENT ON TABLE public.user_subscriptions IS 'Suscripciones activas de los usuarios';
COMMENT ON COLUMN public.user_subscriptions.cancel_at_period_end IS 'Si es true, la suscripción se cancelará al final del período actual';

COMMENT ON FUNCTION public.check_user_source_limit(uuid) IS 'Verifica si un usuario puede añadir más fuentes según su plan';
COMMENT ON FUNCTION public.check_user_feature(uuid, text) IS 'Verifica si un usuario tiene acceso a una funcionalidad específica';
COMMENT ON FUNCTION public.can_add_source() IS 'Función interna para verificar límite de fuentes en RLS';
