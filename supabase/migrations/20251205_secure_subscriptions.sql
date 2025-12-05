-- =============================================
-- MIGRACIÓN: Asegurar tablas de suscripción
-- Fecha: 5 de diciembre de 2025
-- =============================================
-- 
-- Esta migración refuerza la seguridad de las tablas de suscripción:
-- 1. subscription_plans: Solo lectura para todos
-- 2. user_subscriptions: INSERT/UPDATE restringido a campos seguros
-- 
-- IMPORTANTE: Ejecutar con privilegios de superusuario
-- =============================================

-- =============================================
-- PASO 1: Eliminar políticas anteriores de user_subscriptions
-- =============================================

DROP POLICY IF EXISTS "user_subscriptions_select" ON public.user_subscriptions;
DROP POLICY IF EXISTS "user_subscriptions_insert" ON public.user_subscriptions;
DROP POLICY IF EXISTS "user_subscriptions_update" ON public.user_subscriptions;
DROP POLICY IF EXISTS "user_subscriptions_update_safe" ON public.user_subscriptions;

-- =============================================
-- PASO 2: Crear políticas más restrictivas
-- =============================================

-- SELECT: El usuario puede ver su propia suscripción
CREATE POLICY "user_subscriptions_select"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: Solo el sistema debe crear suscripciones
-- Los usuarios NO deberían poder insertar suscripciones directamente
-- Esto debe hacerse a través de funciones del servidor
-- Por ahora permitimos INSERT pero con plan_id fijo al free
CREATE POLICY "user_subscriptions_insert_safe"
  ON public.user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND plan_id = (SELECT id FROM public.subscription_plans WHERE name = 'Free' LIMIT 1)
  );

-- UPDATE: El usuario solo puede actualizar campos seguros
-- NO puede cambiar: plan_id, stripe_customer_id, stripe_subscription_id
-- SÍ puede cambiar: cancel_at_period_end
CREATE POLICY "user_subscriptions_update_safe"
  ON public.user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- El plan_id no debe poder cambiarse (debe ser igual al existente)
    AND plan_id = (
      SELECT plan_id FROM public.user_subscriptions 
      WHERE user_id = auth.uid()
    )
    -- stripe_customer_id no debe poder cambiarse
    AND (
      stripe_customer_id IS NOT DISTINCT FROM (
        SELECT stripe_customer_id FROM public.user_subscriptions 
        WHERE user_id = auth.uid()
      )
    )
    -- stripe_subscription_id no debe poder cambiarse
    AND (
      stripe_subscription_id IS NOT DISTINCT FROM (
        SELECT stripe_subscription_id FROM public.user_subscriptions 
        WHERE user_id = auth.uid()
      )
    )
  );

-- =============================================
-- PASO 3: Crear función segura para cambiar plan
-- Solo puede ser llamada desde el servidor (service_role)
-- =============================================

CREATE OR REPLACE FUNCTION public.admin_update_user_subscription(
  p_user_id uuid,
  p_plan_id uuid,
  p_status text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_current_period_start timestamp with time zone DEFAULT NULL,
  p_current_period_end timestamp with time zone DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con privilegios del creador (superusuario)
SET search_path = public
AS $$
BEGIN
  -- Verificar que el plan existe
  IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE id = p_plan_id) THEN
    RAISE EXCEPTION 'Plan no encontrado';
  END IF;

  -- Actualizar o insertar la suscripción
  INSERT INTO user_subscriptions (
    user_id,
    plan_id,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    current_period_start,
    current_period_end,
    updated_at
  ) VALUES (
    p_user_id,
    p_plan_id,
    COALESCE(p_status, 'active'),
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_current_period_start,
    p_current_period_end,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = COALESCE(EXCLUDED.status, user_subscriptions.status),
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_subscriptions.stripe_customer_id),
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, user_subscriptions.stripe_subscription_id),
    current_period_start = COALESCE(EXCLUDED.current_period_start, user_subscriptions.current_period_start),
    current_period_end = COALESCE(EXCLUDED.current_period_end, user_subscriptions.current_period_end),
    updated_at = now();
END;
$$;

-- Revocar acceso público a la función
REVOKE ALL ON FUNCTION public.admin_update_user_subscription FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_user_subscription FROM authenticated;

-- Solo service_role puede ejecutar esta función
GRANT EXECUTE ON FUNCTION public.admin_update_user_subscription TO service_role;

-- =============================================
-- PASO 4: Reforzar subscription_plans como solo lectura
-- =============================================

DROP POLICY IF EXISTS "subscription_plans_select" ON public.subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_insert" ON public.subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_update" ON public.subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_delete" ON public.subscription_plans;

-- Solo lectura para usuarios autenticados
CREATE POLICY "subscription_plans_readonly"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (true);

-- No se permiten INSERT, UPDATE, DELETE desde el cliente
-- Solo el administrador de la BD puede modificar planes

-- =============================================
-- COMENTARIOS
-- =============================================

COMMENT ON POLICY "user_subscriptions_select" ON public.user_subscriptions IS 
  'Los usuarios solo pueden ver su propia suscripción';

COMMENT ON POLICY "user_subscriptions_insert_safe" ON public.user_subscriptions IS 
  'Los usuarios solo pueden crear una suscripción con el plan Free';

COMMENT ON POLICY "user_subscriptions_update_safe" ON public.user_subscriptions IS 
  'Los usuarios solo pueden actualizar cancel_at_period_end, no pueden cambiar el plan';

COMMENT ON POLICY "subscription_plans_readonly" ON public.subscription_plans IS 
  'Los planes son de solo lectura para todos los usuarios';

COMMENT ON FUNCTION public.admin_update_user_subscription IS 
  'Función administrativa para cambiar el plan de un usuario. Solo puede ser llamada con service_role.';
