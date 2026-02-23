-- ============================================================================
-- PROMIX PLANT INVENTORY - LIMPIEZA COMPLETA DE BASE DE DATOS
-- ============================================================================
-- ⚠️ ADVERTENCIA: Este script BORRA TODAS las tablas del sistema
-- ⚠️ TODOS LOS DATOS SE PERDERÁN PERMANENTEMENTE
-- ⚠️ Solo ejecutar si estás SEGURO de querer empezar desde cero
-- ============================================================================

-- INSTRUCCIONES:
-- 1. Hacer BACKUP de cualquier dato importante ANTES de ejecutar
-- 2. Verificar que estás en el ambiente correcto (NO PRODUCCIÓN)
-- 3. Leer el script completo antes de ejecutar
-- 4. Ejecutar TODO el script de una vez

-- ============================================================================
-- PASO 1: Verificar qué tablas existen actualmente
-- ============================================================================

-- Descomentar para ver las tablas antes de borrar:
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_name LIKE '%_02205af0'
-- ORDER BY table_name;

-- ============================================================================
-- PASO 2: Eliminar tablas en orden inverso (por dependencias)
-- ============================================================================

-- Nota: El orden es importante para evitar errores de foreign keys

-- 2.1 - Tablas de entries (tienen FK a inventory_month)
DROP TABLE IF EXISTS petty_cash_entries_02205af0 CASCADE;
DROP TABLE IF EXISTS utilities_entries_02205af0 CASCADE;
DROP TABLE IF EXISTS products_entries_02205af0 CASCADE;
DROP TABLE IF EXISTS diesel_entries_02205af0 CASCADE;
DROP TABLE IF EXISTS additives_entries_02205af0 CASCADE;
DROP TABLE IF EXISTS silos_entries_02205af0 CASCADE;
DROP TABLE IF EXISTS aggregates_entries_02205af0 CASCADE;

-- 2.2 - Tabla principal de inventarios
DROP TABLE IF EXISTS inventory_month_02205af0 CASCADE;

-- 2.3 - Tabla KV Store (ya existe, pero por si acaso)
-- NOTA: Esta tabla es usada por el sistema. Solo borrar si quieres limpiar TODO
-- DROP TABLE IF EXISTS kv_store_02205af0 CASCADE;

-- ============================================================================
-- PASO 3: Verificar limpieza
-- ============================================================================

-- Descomentar para verificar que todas las tablas fueron eliminadas:
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_name LIKE '%_02205af0'
--   AND table_name != 'kv_store_02205af0'  -- Esta puede quedar
-- ORDER BY table_name;

-- Si el query anterior no devuelve filas (excepto kv_store), la limpieza fue exitosa

-- ============================================================================
-- RESULTADO ESPERADO:
-- ============================================================================
-- ✅ Todas las tablas de inventario eliminadas
-- ✅ kv_store_02205af0 puede quedar (tiene configuraciones del sistema)
-- ✅ Base de datos lista para inicialización limpia

-- ============================================================================
-- PRÓXIMO PASO:
-- ============================================================================
-- Ejecutar: 02_CREATE_ALL_TABLES.sql
-- Para crear todas las tablas desde cero con la estructura actualizada

-- ============================================================================
-- CONFIRMACIÓN DE EJECUCIÓN:
-- ============================================================================
SELECT 
  '✅ LIMPIEZA COMPLETADA' as status,
  NOW() as executed_at,
  'Base de datos lista para inicialización limpia' as message;
