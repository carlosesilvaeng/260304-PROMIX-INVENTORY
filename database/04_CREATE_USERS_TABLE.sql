-- ============================================================================
-- PROMIX PLANT INVENTORY - TABLA DE USUARIOS
-- ============================================================================
-- Este script crea la tabla de usuarios con integración a Supabase Auth
-- ============================================================================

-- ============================================================================
-- TABLA: users_02205af0
-- ============================================================================
-- Almacena información de usuarios del sistema con roles y permisos

CREATE TABLE IF NOT EXISTS users_02205af0 (
  -- Identificación (usamos el UUID de Supabase Auth)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información personal
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  
  -- Rol del usuario
  role TEXT NOT NULL DEFAULT 'plant_manager',
  -- Valores: 'plant_manager', 'admin', 'super_admin'
  
  -- Plantas asignadas (array de IDs de plantas)
  assigned_plants TEXT[] DEFAULT '{}',
  
  -- Estado del usuario
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata de Supabase Auth (vinculado)
  auth_user_id UUID UNIQUE, -- ID del usuario en auth.users de Supabase
  
  -- Trazabilidad
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID, -- ID del usuario que lo creó (Super Admin)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID, -- ID del usuario que lo modificó
  
  -- Última actividad
  last_login_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_role CHECK (role IN ('plant_manager', 'admin', 'super_admin')),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users_02205af0(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users_02205af0(role);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users_02205af0(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users_02205af0(is_active);

-- ============================================================================
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Actualizar updated_at en cada UPDATE
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users_02205af0;
CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON users_02205af0
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE users_02205af0 IS 
'Usuarios del sistema PROMIX Plant Inventory con roles y permisos';

COMMENT ON COLUMN users_02205af0.id IS 
'UUID único del usuario (generado automáticamente)';

COMMENT ON COLUMN users_02205af0.auth_user_id IS 
'ID del usuario en Supabase Auth (auth.users) - usado para login';

COMMENT ON COLUMN users_02205af0.role IS 
'Rol del usuario: plant_manager (solo plantas asignadas), admin (todas las plantas), super_admin (gestión completa)';

COMMENT ON COLUMN users_02205af0.assigned_plants IS 
'Array de IDs de plantas asignadas (ej: {CAROLINA, CEIBA}). Solo aplica para plant_manager.';

COMMENT ON COLUMN users_02205af0.is_active IS 
'Indica si el usuario está activo. Si es false, no puede hacer login.';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT 
  '✅ Tabla users_02205af0 creada exitosamente' as status,
  NOW() as created_at;

-- Para verificar la estructura:
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users_02205af0'
ORDER BY ordinal_position;
