-- ============================================================================
-- RELOAD POSTGREST SCHEMA CACHE
-- ============================================================================
-- Este comando fuerza a PostgREST a recargar su cache del schema
-- Ejecuta esto DESPUÉS de agregar/modificar columnas en las tablas
--
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard > SQL Editor
-- 2. Crea una nueva query
-- 3. Copia y pega este contenido
-- 4. Haz clic en "Run"
-- 5. Espera unos segundos para que el cache se recargue
-- 6. Vuelve a la aplicación y ejecuta "Cargar Configuraciones"
-- ============================================================================

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the columns exist
SELECT 
    table_name,
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'plant_aggregates_config'
  AND column_name IN ('location_area', 'box_width_ft', 'box_height_ft')
ORDER BY column_name;
