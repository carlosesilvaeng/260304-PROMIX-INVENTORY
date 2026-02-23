-- ============================================================================
-- MEGA MIGRATION: ALL CONFIGURATION TABLES
-- ============================================================================
-- Este script agrega TODAS las columnas necesarias para TODAS las tablas
-- de configuración de plantas de PROMIX PLANT INVENTORY
--
-- Es idempotente (se puede ejecutar varias veces sin problemas)
--
-- ⚠️  INSTRUCCIONES CRÍTICAS:
-- 1. Ve a Supabase Dashboard → SQL Editor
-- 2. Crea una nueva query
-- 3. Copia y pega TODO este contenido (COMPLETO)
-- 4. Haz clic en "Run"
-- 5. Verifica que todos los mensajes ✅ aparezcan
-- 6. LUEGO ejecuta en una nueva query: NOTIFY pgrst, 'reload schema';
-- 7. Espera 10 segundos
-- 8. Vuelve a la app y haz clic en "Cargar Configuraciones"
-- ============================================================================

-- ============================================================================
-- TABLA: plant_aggregates_config
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATING: plant_aggregates_config';
    RAISE NOTICE '========================================';
END $$;

-- material_type (PIEDRA, ARENA, etc.)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'material_type'
    ) THEN
        ALTER TABLE plant_aggregates_config ADD COLUMN material_type TEXT;
        RAISE NOTICE '✅ Added: material_type';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: material_type';
    END IF;
END $$;

-- location_area (ÁREA 1, CAJÓN A, etc.)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'location_area'
    ) THEN
        ALTER TABLE plant_aggregates_config ADD COLUMN location_area TEXT;
        RAISE NOTICE '✅ Added: location_area';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: location_area';
    END IF;
END $$;

-- measurement_method (CONE, BOX)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'measurement_method'
    ) THEN
        ALTER TABLE plant_aggregates_config ADD COLUMN measurement_method TEXT;
        RAISE NOTICE '✅ Added: measurement_method';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: measurement_method';
    END IF;
END $$;

-- box_width_ft
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'box_width_ft'
    ) THEN
        ALTER TABLE plant_aggregates_config ADD COLUMN box_width_ft DECIMAL(10,2);
        RAISE NOTICE '✅ Added: box_width_ft';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: box_width_ft';
    END IF;
END $$;

-- box_height_ft
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'box_height_ft'
    ) THEN
        ALTER TABLE plant_aggregates_config ADD COLUMN box_height_ft DECIMAL(10,2);
        RAISE NOTICE '✅ Added: box_height_ft';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: box_height_ft';
    END IF;
END $$;

-- sort_order
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE plant_aggregates_config ADD COLUMN sort_order INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added: sort_order';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: sort_order';
    END IF;
END $$;

-- is_active
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plant_aggregates_config ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Added: is_active';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: is_active';
    END IF;
END $$;

-- ============================================================================
-- TABLA: plant_silos_config
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATING: plant_silos_config';
    RAISE NOTICE '========================================';
END $$;

-- measurement_method
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_silos_config' 
        AND column_name = 'measurement_method'
    ) THEN
        ALTER TABLE plant_silos_config ADD COLUMN measurement_method TEXT;
        RAISE NOTICE '✅ Added: measurement_method';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: measurement_method';
    END IF;
END $$;

-- calibration_curve_name
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_silos_config' 
        AND column_name = 'calibration_curve_name'
    ) THEN
        ALTER TABLE plant_silos_config ADD COLUMN calibration_curve_name TEXT;
        RAISE NOTICE '✅ Added: calibration_curve_name';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: calibration_curve_name';
    END IF;
END $$;

-- sort_order
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_silos_config' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE plant_silos_config ADD COLUMN sort_order INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added: sort_order';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: sort_order';
    END IF;
END $$;

-- is_active
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_silos_config' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plant_silos_config ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Added: is_active';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: is_active';
    END IF;
END $$;

-- ============================================================================
-- TABLA: plant_additives_config
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATING: plant_additives_config';
    RAISE NOTICE '========================================';
END $$;

-- measurement_method
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_additives_config' 
        AND column_name = 'measurement_method'
    ) THEN
        ALTER TABLE plant_additives_config ADD COLUMN measurement_method TEXT;
        RAISE NOTICE '✅ Added: measurement_method';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: measurement_method';
    END IF;
END $$;

-- calibration_curve_name
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_additives_config' 
        AND column_name = 'calibration_curve_name'
    ) THEN
        ALTER TABLE plant_additives_config ADD COLUMN calibration_curve_name TEXT;
        RAISE NOTICE '✅ Added: calibration_curve_name';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: calibration_curve_name';
    END IF;
END $$;

-- sort_order
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_additives_config' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE plant_additives_config ADD COLUMN sort_order INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added: sort_order';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: sort_order';
    END IF;
END $$;

-- is_active
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_additives_config' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plant_additives_config ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Added: is_active';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: is_active';
    END IF;
END $$;

-- ============================================================================
-- TABLA: plant_diesel_config
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATING: plant_diesel_config';
    RAISE NOTICE '========================================';
END $$;

-- measurement_method
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_diesel_config' 
        AND column_name = 'measurement_method'
    ) THEN
        ALTER TABLE plant_diesel_config ADD COLUMN measurement_method TEXT;
        RAISE NOTICE '✅ Added: measurement_method';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: measurement_method';
    END IF;
END $$;

-- calibration_curve_name
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_diesel_config' 
        AND column_name = 'calibration_curve_name'
    ) THEN
        ALTER TABLE plant_diesel_config ADD COLUMN calibration_curve_name TEXT;
        RAISE NOTICE '✅ Added: calibration_curve_name';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: calibration_curve_name';
    END IF;
END $$;

-- is_active
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_diesel_config' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plant_diesel_config ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Added: is_active';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: is_active';
    END IF;
END $$;

-- ============================================================================
-- TABLA: plant_products_config
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATING: plant_products_config';
    RAISE NOTICE '========================================';
END $$;

-- unit
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_products_config' 
        AND column_name = 'unit'
    ) THEN
        ALTER TABLE plant_products_config ADD COLUMN unit TEXT;
        RAISE NOTICE '✅ Added: unit';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: unit';
    END IF;
END $$;

-- sort_order
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_products_config' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE plant_products_config ADD COLUMN sort_order INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added: sort_order';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: sort_order';
    END IF;
END $$;

-- is_active
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_products_config' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plant_products_config ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Added: is_active';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: is_active';
    END IF;
END $$;

-- ============================================================================
-- TABLA: plant_utilities_meters_config
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATING: plant_utilities_meters_config';
    RAISE NOTICE '========================================';
END $$;

-- meter_type
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_utilities_meters_config' 
        AND column_name = 'meter_type'
    ) THEN
        ALTER TABLE plant_utilities_meters_config ADD COLUMN meter_type TEXT;
        RAISE NOTICE '✅ Added: meter_type';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: meter_type';
    END IF;
END $$;

-- sort_order
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_utilities_meters_config' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE plant_utilities_meters_config ADD COLUMN sort_order INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added: sort_order';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: sort_order';
    END IF;
END $$;

-- is_active
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_utilities_meters_config' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plant_utilities_meters_config ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Added: is_active';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: is_active';
    END IF;
END $$;

-- ============================================================================
-- TABLA: plant_petty_cash_config
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATING: plant_petty_cash_config';
    RAISE NOTICE '========================================';
END $$;

-- monthly_amount
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_petty_cash_config' 
        AND column_name = 'monthly_amount'
    ) THEN
        ALTER TABLE plant_petty_cash_config ADD COLUMN monthly_amount DECIMAL(10,2);
        RAISE NOTICE '✅ Added: monthly_amount';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: monthly_amount';
    END IF;
END $$;

-- is_active
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_petty_cash_config' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plant_petty_cash_config ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Added: is_active';
    ELSE
        RAISE NOTICE 'ℹ️  Exists: is_active';
    END IF;
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'CRITICAL NEXT STEPS:';
    RAISE NOTICE '1. Execute in a NEW query: NOTIFY pgrst, ''reload schema'';';
    RAISE NOTICE '2. Wait 10 seconds for PostgREST to reload cache';
    RAISE NOTICE '3. Go to app → Database Setup';
    RAISE NOTICE '4. Click "Cargar Configuraciones"';
    RAISE NOTICE '';
END $$;
