-- ============================================================================
-- COMPLETE MIGRATION FOR plant_aggregates_config TABLE
-- ============================================================================
-- Este script agrega TODAS las columnas necesarias para la tabla plant_aggregates_config
-- Es idempotente (se puede ejecutar varias veces sin problemas)
--
-- INSTRUCCIONES IMPORTANTES:
-- 1. Ve a Supabase Dashboard → SQL Editor
-- 2. Crea una nueva query
-- 3. Copia y pega TODO este contenido
-- 4. Haz clic en "Run"
-- 5. Después ejecuta: NOTIFY pgrst, 'reload schema';
-- 6. Espera 10 segundos y vuelve a la app
-- ============================================================================

-- Add material_type column (PIEDRA, ARENA, etc.)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'material_type'
    ) THEN
        ALTER TABLE plant_aggregates_config 
        ADD COLUMN material_type TEXT;
        
        RAISE NOTICE '✅ Column material_type added successfully';
    ELSE
        RAISE NOTICE 'ℹ️  Column material_type already exists';
    END IF;
END $$;

-- Add location_area column (ÁREA 1, CAJÓN A, etc.)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'location_area'
    ) THEN
        ALTER TABLE plant_aggregates_config 
        ADD COLUMN location_area TEXT;
        
        RAISE NOTICE '✅ Column location_area added successfully';
    ELSE
        RAISE NOTICE 'ℹ️  Column location_area already exists';
    END IF;
END $$;

-- Add measurement_method column (CONE, BOX)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'measurement_method'
    ) THEN
        ALTER TABLE plant_aggregates_config 
        ADD COLUMN measurement_method TEXT;
        
        RAISE NOTICE '✅ Column measurement_method added successfully';
    ELSE
        RAISE NOTICE 'ℹ️  Column measurement_method already exists';
    END IF;
END $$;

-- Add box_width_ft column (for BOX measurement method)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'box_width_ft'
    ) THEN
        ALTER TABLE plant_aggregates_config 
        ADD COLUMN box_width_ft DECIMAL(10,2);
        
        RAISE NOTICE '✅ Column box_width_ft added successfully';
    ELSE
        RAISE NOTICE 'ℹ️  Column box_width_ft already exists';
    END IF;
END $$;

-- Add box_height_ft column (for BOX measurement method)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'box_height_ft'
    ) THEN
        ALTER TABLE plant_aggregates_config 
        ADD COLUMN box_height_ft DECIMAL(10,2);
        
        RAISE NOTICE '✅ Column box_height_ft added successfully';
    ELSE
        RAISE NOTICE 'ℹ️  Column box_height_ft already exists';
    END IF;
END $$;

-- Add sort_order column (for display ordering)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE plant_aggregates_config 
        ADD COLUMN sort_order INTEGER DEFAULT 0;
        
        RAISE NOTICE '✅ Column sort_order added successfully';
    ELSE
        RAISE NOTICE 'ℹ️  Column sort_order already exists';
    END IF;
END $$;

-- Add is_active column (for soft delete)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_aggregates_config' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plant_aggregates_config 
        ADD COLUMN is_active BOOLEAN DEFAULT true;
        
        RAISE NOTICE '✅ Column is_active added successfully';
    ELSE
        RAISE NOTICE 'ℹ️  Column is_active already exists';
    END IF;
END $$;

-- Verify all columns were added
SELECT 
    'plant_aggregates_config' as table_name,
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'plant_aggregates_config'
  AND column_name IN (
    'material_type', 
    'location_area', 
    'measurement_method',
    'box_width_ft', 
    'box_height_ft',
    'sort_order',
    'is_active'
  )
ORDER BY column_name;

-- Show success message
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '1. Execute: NOTIFY pgrst, ''reload schema'';';
    RAISE NOTICE '2. Wait 10 seconds';
    RAISE NOTICE '3. Go back to the app and click "Cargar Configuraciones"';
    RAISE NOTICE '';
END $$;
