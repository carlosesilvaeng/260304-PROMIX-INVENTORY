-- ============================================================================
-- CREATE FUNCTION TO RELOAD POSTGREST SCHEMA CACHE
-- ============================================================================
-- Esta función permite recargar el cache de PostgREST desde la aplicación
-- sin necesidad de ejecutar comandos manualmente en SQL Editor
--
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard > SQL Editor
-- 2. Crea una nueva query
-- 3. Copia y pega este contenido
-- 4. Haz clic en "Run"
-- ============================================================================

-- Create or replace the function
CREATE OR REPLACE FUNCTION reload_schema_cache_fn()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Send NOTIFY signal to PostgREST to reload schema cache
  NOTIFY pgrst, 'reload schema';
  
  RAISE NOTICE 'PostgREST schema cache reload signal sent';
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION reload_schema_cache_fn() TO anon, authenticated;

-- Test the function
SELECT reload_schema_cache_fn();
