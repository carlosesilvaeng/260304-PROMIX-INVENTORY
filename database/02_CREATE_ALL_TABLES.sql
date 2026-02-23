-- ============================================================================
-- PROMIX PLANT INVENTORY - CREACIÓN COMPLETA DE TABLAS
-- ============================================================================
-- Este script crea TODAS las tablas necesarias para el sistema desde cero
-- Versión: 2.0 (actualizada con todas las mejoras)
-- Fecha: Febrero 2026
-- ============================================================================

-- PREREQUISITOS:
-- ✅ Haber ejecutado 01_CLEANUP_ALL_TABLES.sql (si había tablas previas)
-- ✅ Base de datos Supabase activa
-- ✅ Conexión con permisos de CREATE TABLE

-- ============================================================================
-- TABLA 1: inventory_month_02205af0
-- ============================================================================
-- Tabla principal que registra cada mes de inventario por planta

CREATE TABLE IF NOT EXISTS inventory_month_02205af0 (
  -- Identificación
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  plant_name TEXT NOT NULL,
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  
  -- Estado del inventario
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  -- Valores posibles: 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'
  
  -- Trazabilidad - Inicio
  started_by TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  
  -- Trazabilidad - Envío
  submitted_by TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  -- Trazabilidad - Aprobación
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Trazabilidad - Rechazo
  rejected_by TEXT,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_plant_month_year UNIQUE (plant_id, month, year),
  CONSTRAINT valid_status CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'))
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_inventory_plant_id ON inventory_month_02205af0(plant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_month_02205af0(status);
CREATE INDEX IF NOT EXISTS idx_inventory_year_month ON inventory_month_02205af0(year, month);

-- ============================================================================
-- TABLA 2: aggregates_entries_02205af0
-- ============================================================================
-- Registros de inventario de agregados (arena, piedra, etc.)

CREATE TABLE IF NOT EXISTS aggregates_entries_02205af0 (
  -- Identificación
  id SERIAL PRIMARY KEY,
  inventory_month_id TEXT NOT NULL,
  
  -- Datos del agregado
  item_name TEXT NOT NULL,
  quantity_tons DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  
  -- Evidencia y notas
  evidence_photo TEXT,
  notes TEXT,
  
  -- Trazabilidad
  captured_by TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign Key
  CONSTRAINT fk_aggregates_inventory 
    FOREIGN KEY (inventory_month_id) 
    REFERENCES inventory_month_02205af0(id) 
    ON DELETE CASCADE,
  
  -- Validaciones
  CONSTRAINT positive_quantity CHECK (quantity_tons > 0),
  CONSTRAINT positive_price CHECK (unit_price > 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_aggregates_inventory ON aggregates_entries_02205af0(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_aggregates_item ON aggregates_entries_02205af0(item_name);

-- ============================================================================
-- TABLA 3: silos_entries_02205af0
-- ============================================================================
-- Registros de inventario de silos de cemento

CREATE TABLE IF NOT EXISTS silos_entries_02205af0 (
  -- Identificación
  id SERIAL PRIMARY KEY,
  inventory_month_id TEXT NOT NULL,
  
  -- Datos del silo
  silo_name TEXT NOT NULL,
  cement_type TEXT NOT NULL,
  quantity_tons DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  
  -- Evidencia y notas
  evidence_photo TEXT,
  notes TEXT,
  
  -- Trazabilidad
  captured_by TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign Key
  CONSTRAINT fk_silos_inventory 
    FOREIGN KEY (inventory_month_id) 
    REFERENCES inventory_month_02205af0(id) 
    ON DELETE CASCADE,
  
  -- Validaciones
  CONSTRAINT positive_quantity CHECK (quantity_tons > 0),
  CONSTRAINT positive_price CHECK (unit_price > 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_silos_inventory ON silos_entries_02205af0(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_silos_name ON silos_entries_02205af0(silo_name);

-- ============================================================================
-- TABLA 4: additives_entries_02205af0
-- ============================================================================
-- Registros de inventario de aditivos

CREATE TABLE IF NOT EXISTS additives_entries_02205af0 (
  -- Identificación
  id SERIAL PRIMARY KEY,
  inventory_month_id TEXT NOT NULL,
  
  -- Datos del aditivo
  product_name TEXT NOT NULL,
  quantity_gallons DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  
  -- Evidencia y notas
  evidence_photo TEXT,
  notes TEXT,
  
  -- Trazabilidad
  captured_by TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign Key
  CONSTRAINT fk_additives_inventory 
    FOREIGN KEY (inventory_month_id) 
    REFERENCES inventory_month_02205af0(id) 
    ON DELETE CASCADE,
  
  -- Validaciones
  CONSTRAINT positive_quantity CHECK (quantity_gallons > 0),
  CONSTRAINT positive_price CHECK (unit_price > 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_additives_inventory ON additives_entries_02205af0(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_additives_product ON additives_entries_02205af0(product_name);

-- ============================================================================
-- TABLA 5: diesel_entries_02205af0
-- ============================================================================
-- Registros de inventario de diesel (lectura de medidores)

CREATE TABLE IF NOT EXISTS diesel_entries_02205af0 (
  -- Identificación
  id SERIAL PRIMARY KEY,
  inventory_month_id TEXT NOT NULL,
  
  -- Lecturas del medidor
  initial_reading DECIMAL(10, 2) NOT NULL,
  final_reading DECIMAL(10, 2) NOT NULL,
  total_gallons_consumed DECIMAL(10, 2) NOT NULL,
  
  -- Recibos de compra
  receipts_gallons DECIMAL(10, 2) NOT NULL,
  unit_price_per_gallon DECIMAL(10, 2) NOT NULL,
  
  -- Evidencia y notas
  evidence_photo TEXT,
  notes TEXT,
  
  -- Trazabilidad
  captured_by TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign Key
  CONSTRAINT fk_diesel_inventory 
    FOREIGN KEY (inventory_month_id) 
    REFERENCES inventory_month_02205af0(id) 
    ON DELETE CASCADE,
  
  -- Validaciones
  CONSTRAINT valid_readings CHECK (final_reading >= initial_reading),
  CONSTRAINT positive_consumed CHECK (total_gallons_consumed > 0),
  CONSTRAINT positive_receipts CHECK (receipts_gallons > 0),
  CONSTRAINT positive_price CHECK (unit_price_per_gallon > 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_diesel_inventory ON diesel_entries_02205af0(inventory_month_id);

-- ============================================================================
-- TABLA 6: products_entries_02205af0
-- ============================================================================
-- Registros de inventario de productos terminados

CREATE TABLE IF NOT EXISTS products_entries_02205af0 (
  -- Identificación
  id SERIAL PRIMARY KEY,
  inventory_month_id TEXT NOT NULL,
  
  -- Datos del producto
  product_name TEXT NOT NULL,
  quantity_units DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  
  -- Evidencia y notas
  evidence_photo TEXT,
  notes TEXT,
  
  -- Trazabilidad
  captured_by TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign Key
  CONSTRAINT fk_products_inventory 
    FOREIGN KEY (inventory_month_id) 
    REFERENCES inventory_month_02205af0(id) 
    ON DELETE CASCADE,
  
  -- Validaciones
  CONSTRAINT positive_quantity CHECK (quantity_units > 0),
  CONSTRAINT positive_price CHECK (unit_price > 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_products_inventory ON products_entries_02205af0(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products_entries_02205af0(product_name);

-- ============================================================================
-- TABLA 7: utilities_entries_02205af0
-- ============================================================================
-- Registros de servicios (agua y electricidad)

CREATE TABLE IF NOT EXISTS utilities_entries_02205af0 (
  -- Identificación
  id SERIAL PRIMARY KEY,
  inventory_month_id TEXT NOT NULL,
  
  -- Tipo de servicio
  utility_type TEXT NOT NULL,
  -- Valores: 'AGUA' o 'ELECTRICIDAD'
  
  -- Medidor
  meter_number TEXT NOT NULL,
  previous_reading DECIMAL(10, 2) NOT NULL,
  current_reading DECIMAL(10, 2) NOT NULL,
  consumption DECIMAL(10, 2) NOT NULL,
  
  -- Precio
  unit_price DECIMAL(10, 4) NOT NULL,
  
  -- Evidencia y notas
  evidence_photo TEXT,
  notes TEXT,
  
  -- Trazabilidad
  captured_by TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign Key
  CONSTRAINT fk_utilities_inventory 
    FOREIGN KEY (inventory_month_id) 
    REFERENCES inventory_month_02205af0(id) 
    ON DELETE CASCADE,
  
  -- Validaciones
  CONSTRAINT valid_utility_type CHECK (utility_type IN ('AGUA', 'ELECTRICIDAD')),
  CONSTRAINT valid_readings CHECK (current_reading >= previous_reading),
  CONSTRAINT positive_consumption CHECK (consumption >= 0),
  CONSTRAINT positive_price CHECK (unit_price > 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_utilities_inventory ON utilities_entries_02205af0(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_utilities_type ON utilities_entries_02205af0(utility_type);

-- ============================================================================
-- TABLA 8: petty_cash_entries_02205af0
-- ============================================================================
-- Registros de Petty Cash

CREATE TABLE IF NOT EXISTS petty_cash_entries_02205af0 (
  -- Identificación
  id SERIAL PRIMARY KEY,
  inventory_month_id TEXT NOT NULL,
  
  -- Montos
  initial_balance DECIMAL(10, 2) NOT NULL,
  receipts_total DECIMAL(10, 2) NOT NULL,
  expenses_total DECIMAL(10, 2) NOT NULL,
  final_balance DECIMAL(10, 2) NOT NULL,
  discrepancy DECIMAL(10, 2) NOT NULL,
  
  -- Evidencia y notas
  evidence_photo TEXT,
  notes TEXT,
  
  -- Trazabilidad
  captured_by TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign Key
  CONSTRAINT fk_petty_cash_inventory 
    FOREIGN KEY (inventory_month_id) 
    REFERENCES inventory_month_02205af0(id) 
    ON DELETE CASCADE,
  
  -- Validaciones
  CONSTRAINT positive_initial_balance CHECK (initial_balance >= 0),
  CONSTRAINT positive_receipts CHECK (receipts_total >= 0),
  CONSTRAINT positive_expenses CHECK (expenses_total >= 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_petty_cash_inventory ON petty_cash_entries_02205af0(inventory_month_id);

-- ============================================================================
-- TABLA 9: kv_store_02205af0 (Si no existe)
-- ============================================================================
-- Tabla KV para configuraciones del sistema
-- NOTA: Esta tabla puede ya existir desde antes

-- Primero, intentar agregar columnas si la tabla existe pero sin ellas
DO $$ 
BEGIN
  -- Agregar created_at si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kv_store_02205af0' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE kv_store_02205af0 ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  -- Agregar updated_at si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kv_store_02205af0' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE kv_store_02205af0 ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- La tabla no existe, se creará a continuación
    NULL;
END $$;

-- Ahora crear la tabla si no existe (con todas las columnas)
CREATE TABLE IF NOT EXISTS kv_store_02205af0 (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas por prefijo
CREATE INDEX IF NOT EXISTS idx_kv_key_prefix ON kv_store_02205af0(key text_pattern_ops);

-- ============================================================================
-- CONFIGURACIÓN INICIAL DE MÓDULOS
-- ============================================================================
-- Insertar configuración por defecto (solo Agregados habilitado)

INSERT INTO kv_store_02205af0 (key, value)
VALUES (
  'modules_config',
  '{
    "agregados": {"enabled": true, "enabledAt": "2026-02-16T00:00:00Z", "enabledBy": "system"},
    "silos": {"enabled": false},
    "aditivos": {"enabled": false},
    "diesel": {"enabled": false},
    "productos": {"enabled": false},
    "utilities": {"enabled": false},
    "pettyCash": {"enabled": false}
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();
-- Nota: Removidas las columnas created_at/updated_at del INSERT ya que tienen DEFAULT NOW()

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

-- Contar tablas creadas
SELECT 
  '=== TABLAS CREADAS ===' as section,
  '' as table_name,
  '' as exists
UNION ALL
SELECT 
  '',
  'inventory_month_02205af0',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_month_02205af0') 
    THEN '✅ Existe' ELSE '❌ No existe' END
UNION ALL
SELECT 
  '',
  'aggregates_entries_02205af0',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'aggregates_entries_02205af0') 
    THEN '✅ Existe' ELSE '❌ No existe' END
UNION ALL
SELECT 
  '',
  'silos_entries_02205af0',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'silos_entries_02205af0') 
    THEN '✅ Existe' ELSE '❌ No existe' END
UNION ALL
SELECT 
  '',
  'additives_entries_02205af0',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'additives_entries_02205af0') 
    THEN '✅ Existe' ELSE '❌ No existe' END
UNION ALL
SELECT 
  '',
  'diesel_entries_02205af0',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'diesel_entries_02205af0') 
    THEN '✅ Existe' ELSE '❌ No existe' END
UNION ALL
SELECT 
  '',
  'products_entries_02205af0',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products_entries_02205af0') 
    THEN '✅ Existe' ELSE '❌ No existe' END
UNION ALL
SELECT 
  '',
  'utilities_entries_02205af0',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'utilities_entries_02205af0') 
    THEN '✅ Existe' ELSE '❌ No existe' END
UNION ALL
SELECT 
  '',
  'petty_cash_entries_02205af0',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'petty_cash_entries_02205af0') 
    THEN '✅ Existe' ELSE '❌ No existe' END
UNION ALL
SELECT 
  '',
  'kv_store_02205af0',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kv_store_02205af0') 
    THEN '✅ Existe' ELSE '❌ No existe' END;

-- ============================================================================
-- RESULTADO ESPERADO:
-- ============================================================================
-- ✅ 9 tablas creadas
-- ✅ Todos los índices aplicados
-- ✅ Todas las constraints activas
-- ✅ Configuración inicial de módulos insertada
-- ✅ Base de datos lista para usar

-- ============================================================================
-- PRÓXIMO PASO:
-- ============================================================================
-- OPCIONAL: Ejecutar 03_LOAD_DUMMY_DATA.sql
-- Para cargar datos de prueba de Enero 2026

SELECT 
  '✅ CREACIÓN COMPLETADA' as status,
  NOW() as executed_at,
  'Base de datos inicializada y lista para usar' as message;