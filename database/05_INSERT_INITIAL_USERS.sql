-- ============================================================================
-- PROMIX PLANT INVENTORY - DATOS INICIALES DE USUARIOS
-- ============================================================================
-- Este script inserta los 3 usuarios iniciales del sistema
-- ============================================================================

-- ============================================================================
-- PREREQUISITOS:
-- ============================================================================
-- ✅ Haber ejecutado 04_CREATE_USERS_TABLE.sql
-- ⚠️ IMPORTANTE: Estos usuarios deben crearse en Supabase Auth primero
-- ⚠️ Los auth_user_id deben coincidir con los UUIDs de Supabase Auth

-- ============================================================================
-- LIMPIEZA PREVIA (opcional - solo en desarrollo)
-- ============================================================================

-- DESCOMENTAR SOLO SI QUIERES BORRAR USUARIOS EXISTENTES:
-- DELETE FROM users_02205af0;

-- ============================================================================
-- INSERTAR USUARIOS INICIALES
-- ============================================================================

-- NOTA: Los UUIDs de auth_user_id serán generados por Supabase Auth
-- Por ahora usamos NULLs y se vincularán después del primer login

INSERT INTO users_02205af0 (
  id,
  name,
  email,
  role,
  assigned_plants,
  is_active,
  auth_user_id,
  created_at,
  last_login_at
) VALUES 
  -- ========================================================================
  -- Usuario 1: Gerente de Planta
  -- ========================================================================
  (
    '00000000-0000-0000-0000-000000000001'::UUID, -- ID fijo para referencias
    'GERENTE PLANTA',
    'gerente@promixpr.com',
    'plant_manager',
    ARRAY['CAROLINA', 'CEIBA'], -- Solo tiene acceso a 2 plantas
    true,
    NULL, -- Se llenará al hacer signup
    NOW(),
    NULL
  ),
  
  -- ========================================================================
  -- Usuario 2: Administrador (Ricardo del Rosario)
  -- ========================================================================
  (
    '00000000-0000-0000-0000-000000000002'::UUID,
    'Ricardo del Rosario',
    'rdelrosario@promixpr.com',
    'admin',
    ARRAY['CAROLINA', 'CEIBA', 'GUAYNABO', 'GURABO', 'VEGA_BAJA', 'HUMACAO'], -- Todas las plantas
    true,
    NULL,
    NOW(),
    NULL
  ),
  
  -- ========================================================================
  -- Usuario 3: Super Administrador
  -- ========================================================================
  (
    '00000000-0000-0000-0000-000000000003'::UUID,
    'SUPERUSER',
    'super@promix.com',
    'super_admin',
    ARRAY['CAROLINA', 'CEIBA', 'GUAYNABO', 'GURABO', 'VEGA_BAJA', 'HUMACAO'], -- Todas las plantas
    true,
    NULL,
    NOW(),
    NULL
  )
ON CONFLICT (email) DO NOTHING; -- No duplicar si ya existen

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT 
  '✅ Usuarios iniciales insertados' as status,
  COUNT(*) as total_users
FROM users_02205af0;

-- Ver todos los usuarios creados
SELECT 
  id,
  name,
  email,
  role,
  assigned_plants,
  is_active,
  created_at
FROM users_02205af0
ORDER BY 
  CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'plant_manager' THEN 3
  END;

-- ============================================================================
-- IMPORTANTE: CONTRASEÑAS POR DEFECTO
-- ============================================================================
-- Estos usuarios deben ser creados en Supabase Auth con estas contraseñas:
--
-- gerente@promixpr.com          → Password: promix2026
-- rdelrosario@promixpr.com      → Password: promix2026
-- super@promix.com              → Password: promix2026
--
-- Los usuarios DEBEN cambiar su contraseña en el primer login
-- ============================================================================
