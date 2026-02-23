-- ============================================================================
-- PROMIX PLANT INVENTORY SYSTEM - DATABASE SCHEMA
-- ============================================================================
-- Este script crea todas las tablas necesarias para el sistema de inventarios
-- de plantas de concreto PROMIX.
--
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard > SQL Editor
-- 2. Crea una nueva query
-- 3. Copia y pega este contenido completo
-- 4. Haz clic en "Run" para ejecutar
-- 5. Vuelve a la aplicación y ejecuta "Cargar Configuraciones"
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE 1: CALIBRATION CURVES
-- ============================================================================
-- Almacena las curvas de calibración para convertir lecturas (ej: pulgadas → galones)

CREATE TABLE IF NOT EXISTS calibration_curves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id TEXT NOT NULL,
    curve_name TEXT NOT NULL,
    measurement_type TEXT NOT NULL, -- 'tank_inches_to_gallons', 'silo_feet_to_cubic_yards', etc.
    data_points JSONB NOT NULL, -- Array de {reading: number, value: number}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plant_id, curve_name)
);

CREATE INDEX IF NOT EXISTS idx_calibration_curves_plant_id ON calibration_curves(plant_id);
CREATE INDEX IF NOT EXISTS idx_calibration_curves_curve_name ON calibration_curves(curve_name);

-- ============================================================================
-- TABLE 2: PLANT AGGREGATES CONFIG
-- ============================================================================
-- Configuración de agregados por planta (Piedra, Arena, etc.)

CREATE TABLE IF NOT EXISTS plant_aggregates_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id TEXT NOT NULL,
    aggregate_name TEXT NOT NULL, -- 'PIEDRA #67', 'ARENA', 'PIEDRA #8', etc.
    material_type TEXT, -- 'PIEDRA', 'ARENA', 'GRAVILLA' (informativo)
    location_area TEXT, -- 'ÁREA 1', 'CAJÓN A', etc. (informativo)
    measurement_method TEXT NOT NULL, -- 'CONE' or 'BOX'
    unit TEXT NOT NULL DEFAULT 'CUBIC_YARDS', -- 'CUBIC_YARDS'
    -- Para método BOX (cajón):
    box_width_ft DECIMAL(10,2), -- Ancho en pies (fijo)
    box_height_ft DECIMAL(10,2), -- Alto en pies (fijo)
    -- box_length_ft será capturado por el gerente cada mes
    sort_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plant_id, aggregate_name)
);

CREATE INDEX IF NOT EXISTS idx_plant_aggregates_plant_id ON plant_aggregates_config(plant_id);

-- ============================================================================
-- TABLE 3: PLANT SILOS CONFIG
-- ============================================================================
-- Configuración de silos por planta

CREATE TABLE IF NOT EXISTS plant_silos_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id TEXT NOT NULL,
    silo_name TEXT NOT NULL, -- 'CEMENTO SILO #1', 'SLAG SILO #3', etc.
    measurement_method TEXT NOT NULL, -- 'FEET_TO_CUBIC_YARDS'
    calibration_curve_name TEXT, -- Referencia a calibration_curves.curve_name
    sort_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plant_id, silo_name)
);

CREATE INDEX IF NOT EXISTS idx_plant_silos_plant_id ON plant_silos_config(plant_id);

-- ============================================================================
-- TABLE 4: SILO ALLOWED PRODUCTS
-- ============================================================================
-- Productos permitidos por silo (relación muchos a muchos)

CREATE TABLE IF NOT EXISTS silo_allowed_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    silo_config_id UUID NOT NULL REFERENCES plant_silos_config(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL, -- 'CEMENTO', 'SLAG', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(silo_config_id, product_name)
);

CREATE INDEX IF NOT EXISTS idx_silo_allowed_products_silo_id ON silo_allowed_products(silo_config_id);

-- ============================================================================
-- TABLE 5: PLANT ADDITIVES CONFIG
-- ============================================================================
-- Configuración de tanques de aditivos por planta

CREATE TABLE IF NOT EXISTS plant_additives_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id TEXT NOT NULL,
    additive_name TEXT NOT NULL, -- 'AIR ENTRALNING', 'RETARDANT', etc.
    measurement_method TEXT NOT NULL, -- 'INCHES_TO_GALLONS'
    calibration_curve_name TEXT, -- Referencia a calibration_curves.curve_name
    sort_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plant_id, additive_name)
);

CREATE INDEX IF NOT EXISTS idx_plant_additives_plant_id ON plant_additives_config(plant_id);

-- ============================================================================
-- TABLE 6: PLANT DIESEL CONFIG
-- ============================================================================
-- Configuración del tanque de diesel por planta (uno por planta)

CREATE TABLE IF NOT EXISTS plant_diesel_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id TEXT NOT NULL UNIQUE,
    measurement_method TEXT NOT NULL, -- 'INCHES_TO_GALLONS'
    calibration_curve_name TEXT, -- Referencia a calibration_curves.curve_name
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plant_diesel_plant_id ON plant_diesel_config(plant_id);

-- ============================================================================
-- TABLE 7: PLANT PRODUCTS CONFIG
-- ============================================================================
-- Configuración de productos de aceite/lubricante por planta

CREATE TABLE IF NOT EXISTS plant_products_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id TEXT NOT NULL,
    product_name TEXT NOT NULL, -- 'ENGINE OIL 15W-40', 'HYDRAULIC OIL', etc.
    unit TEXT NOT NULL, -- 'GALLON', 'QUART', 'PAIL', etc.
    sort_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plant_id, product_name)
);

CREATE INDEX IF NOT EXISTS idx_plant_products_plant_id ON plant_products_config(plant_id);

-- ============================================================================
-- TABLE 8: PLANT UTILITIES METERS CONFIG
-- ============================================================================
-- Configuración de medidores de utilidades (agua, electricidad) por planta

CREATE TABLE IF NOT EXISTS plant_utilities_meters_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id TEXT NOT NULL,
    meter_name TEXT NOT NULL, -- 'WATER METER', 'ELECTRIC METER', etc.
    meter_type TEXT NOT NULL, -- 'WATER', 'ELECTRICITY'
    unit TEXT NOT NULL, -- 'GALLONS', 'KWH', etc.
    sort_order INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plant_id, meter_name)
);

CREATE INDEX IF NOT EXISTS idx_plant_utilities_plant_id ON plant_utilities_meters_config(plant_id);

-- ============================================================================
-- TABLE 9: PLANT PETTY CASH CONFIG
-- ============================================================================
-- Configuración de Petty Cash por planta (monto inicial)

CREATE TABLE IF NOT EXISTS plant_petty_cash_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id TEXT NOT NULL UNIQUE,
    initial_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plant_petty_cash_plant_id ON plant_petty_cash_config(plant_id);

-- ============================================================================
-- TABLAS MENSUALES TRANSACCIONALES
-- ============================================================================

-- ============================================================================
-- TABLE 10: INVENTORY MONTH
-- ============================================================================
-- Registro principal del inventario mensual por planta

CREATE TABLE IF NOT EXISTS inventory_month (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id TEXT NOT NULL,
    year_month TEXT NOT NULL, -- Formato: 'YYYY-MM'
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'SUBMITTED', 'APPROVED'
    created_by TEXT NOT NULL, -- User ID
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plant_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_inventory_month_plant_id ON inventory_month(plant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_month_year_month ON inventory_month(year_month);
CREATE INDEX IF NOT EXISTS idx_inventory_month_status ON inventory_month(status);

-- ============================================================================
-- TABLE 11: INVENTORY AGGREGATES ENTRIES
-- ============================================================================
-- Entradas de inventario de agregados

CREATE TABLE IF NOT EXISTS inventory_aggregates_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_month_id UUID NOT NULL REFERENCES inventory_month(id) ON DELETE CASCADE,
    aggregate_config_id UUID NOT NULL REFERENCES plant_aggregates_config(id),
    -- Campos comunes
    calculated_volume_cy DECIMAL(10,2), -- Volumen calculado en yardas cúbicas
    photo_url TEXT,
    notes TEXT,
    -- Campos para método BOX
    box_length_ft DECIMAL(10,2), -- Largo capturado por gerente (ancho y alto vienen de config)
    -- Campos para método CONE
    cone_m1 DECIMAL(10,2), -- Medida 1 del cono
    cone_m2 DECIMAL(10,2), -- Medida 2 del cono
    cone_m3 DECIMAL(10,2), -- Medida 3 del cono
    cone_m4 DECIMAL(10,2), -- Medida 4 del cono
    cone_m5 DECIMAL(10,2), -- Medida 5 del cono
    cone_m6 DECIMAL(10,2), -- Medida 6 del cono
    cone_d1 DECIMAL(10,2), -- Diámetro 1 del cono
    cone_d2 DECIMAL(10,2), -- Diámetro 2 del cono
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inventory_month_id, aggregate_config_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_aggregates_month_id ON inventory_aggregates_entries(inventory_month_id);

-- ============================================================================
-- TABLE 12: INVENTORY SILOS ENTRIES
-- ============================================================================
-- Entradas de inventario de silos

CREATE TABLE IF NOT EXISTS inventory_silos_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_month_id UUID NOT NULL REFERENCES inventory_month(id) ON DELETE CASCADE,
    silo_config_id UUID NOT NULL REFERENCES plant_silos_config(id),
    product_in_silo TEXT, -- Producto actual en el silo ('CEMENTO', 'SLAG', etc.)
    reading DECIMAL(10,2), -- Lectura en feet
    calculated_volume DECIMAL(10,2), -- Volumen calculado en cubic yards
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inventory_month_id, silo_config_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_silos_month_id ON inventory_silos_entries(inventory_month_id);

-- ============================================================================
-- TABLE 13: INVENTORY ADDITIVES ENTRIES
-- ============================================================================
-- Entradas de inventario de aditivos

CREATE TABLE IF NOT EXISTS inventory_additives_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_month_id UUID NOT NULL REFERENCES inventory_month(id) ON DELETE CASCADE,
    additive_config_id UUID NOT NULL REFERENCES plant_additives_config(id),
    reading DECIMAL(10,2), -- Lectura en pulgadas
    calculated_gallons DECIMAL(10,2), -- Galones calculados
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inventory_month_id, additive_config_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_additives_month_id ON inventory_additives_entries(inventory_month_id);

-- ============================================================================
-- TABLE 14: INVENTORY DIESEL ENTRIES
-- ============================================================================
-- Entrada de inventario de diesel (una por mes)

CREATE TABLE IF NOT EXISTS inventory_diesel_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_month_id UUID NOT NULL UNIQUE REFERENCES inventory_month(id) ON DELETE CASCADE,
    diesel_config_id UUID NOT NULL REFERENCES plant_diesel_config(id),
    reading DECIMAL(10,2), -- Lectura en pulgadas
    calculated_gallons DECIMAL(10,2), -- Galones calculados
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_diesel_month_id ON inventory_diesel_entries(inventory_month_id);

-- ============================================================================
-- TABLE 15: INVENTORY PRODUCTS ENTRIES
-- ============================================================================
-- Entradas de inventario de productos (aceites/lubricantes)

CREATE TABLE IF NOT EXISTS inventory_products_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_month_id UUID NOT NULL REFERENCES inventory_month(id) ON DELETE CASCADE,
    product_config_id UUID NOT NULL REFERENCES plant_products_config(id),
    quantity DECIMAL(10,2), -- Cantidad en la unidad configurada
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inventory_month_id, product_config_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_products_month_id ON inventory_products_entries(inventory_month_id);

-- ============================================================================
-- TABLE 16: INVENTORY UTILITIES ENTRIES
-- ============================================================================
-- Entradas de inventario de utilidades (medidores)

CREATE TABLE IF NOT EXISTS inventory_utilities_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_month_id UUID NOT NULL REFERENCES inventory_month(id) ON DELETE CASCADE,
    utility_config_id UUID NOT NULL REFERENCES plant_utilities_meters_config(id),
    reading DECIMAL(10,2), -- Lectura del medidor
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inventory_month_id, utility_config_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_utilities_month_id ON inventory_utilities_entries(inventory_month_id);

-- ============================================================================
-- TABLE 17: INVENTORY PETTY CASH ENTRIES
-- ============================================================================
-- Entrada de inventario de petty cash (una por mes)

CREATE TABLE IF NOT EXISTS inventory_petty_cash_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_month_id UUID NOT NULL UNIQUE REFERENCES inventory_month(id) ON DELETE CASCADE,
    petty_cash_config_id UUID NOT NULL REFERENCES plant_petty_cash_config(id),
    amount DECIMAL(10,2), -- Monto actual en caja
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_petty_cash_month_id ON inventory_petty_cash_entries(inventory_month_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
-- Función para actualizar automáticamente el campo updated_at

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at

DROP TRIGGER IF EXISTS update_calibration_curves_updated_at ON calibration_curves;
CREATE TRIGGER update_calibration_curves_updated_at BEFORE UPDATE ON calibration_curves
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plant_aggregates_config_updated_at ON plant_aggregates_config;
CREATE TRIGGER update_plant_aggregates_config_updated_at BEFORE UPDATE ON plant_aggregates_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plant_silos_config_updated_at ON plant_silos_config;
CREATE TRIGGER update_plant_silos_config_updated_at BEFORE UPDATE ON plant_silos_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plant_additives_config_updated_at ON plant_additives_config;
CREATE TRIGGER update_plant_additives_config_updated_at BEFORE UPDATE ON plant_additives_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plant_diesel_config_updated_at ON plant_diesel_config;
CREATE TRIGGER update_plant_diesel_config_updated_at BEFORE UPDATE ON plant_diesel_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plant_products_config_updated_at ON plant_products_config;
CREATE TRIGGER update_plant_products_config_updated_at BEFORE UPDATE ON plant_products_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plant_utilities_meters_config_updated_at ON plant_utilities_meters_config;
CREATE TRIGGER update_plant_utilities_meters_config_updated_at BEFORE UPDATE ON plant_utilities_meters_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plant_petty_cash_config_updated_at ON plant_petty_cash_config;
CREATE TRIGGER update_plant_petty_cash_config_updated_at BEFORE UPDATE ON plant_petty_cash_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_month_updated_at ON inventory_month;
CREATE TRIGGER update_inventory_month_updated_at BEFORE UPDATE ON inventory_month
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_aggregates_entries_updated_at ON inventory_aggregates_entries;
CREATE TRIGGER update_inventory_aggregates_entries_updated_at BEFORE UPDATE ON inventory_aggregates_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_silos_entries_updated_at ON inventory_silos_entries;
CREATE TRIGGER update_inventory_silos_entries_updated_at BEFORE UPDATE ON inventory_silos_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_additives_entries_updated_at ON inventory_additives_entries;
CREATE TRIGGER update_inventory_additives_entries_updated_at BEFORE UPDATE ON inventory_additives_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_diesel_entries_updated_at ON inventory_diesel_entries;
CREATE TRIGGER update_inventory_diesel_entries_updated_at BEFORE UPDATE ON inventory_diesel_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_products_entries_updated_at ON inventory_products_entries;
CREATE TRIGGER update_inventory_products_entries_updated_at BEFORE UPDATE ON inventory_products_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_utilities_entries_updated_at ON inventory_utilities_entries;
CREATE TRIGGER update_inventory_utilities_entries_updated_at BEFORE UPDATE ON inventory_utilities_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_petty_cash_entries_updated_at ON inventory_petty_cash_entries;
CREATE TRIGGER update_inventory_petty_cash_entries_updated_at BEFORE UPDATE ON inventory_petty_cash_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMENTARIOS DE FINALIZACIÓN
-- ============================================================================

-- Las 17 tablas han sido creadas exitosamente:
-- 
-- CONFIGURACIÓN (8 tablas):
-- ✅ calibration_curves
-- ✅ plant_aggregates_config
-- ✅ plant_silos_config
-- ✅ silo_allowed_products
-- ✅ plant_additives_config
-- ✅ plant_diesel_config
-- ✅ plant_products_config
-- ✅ plant_utilities_meters_config
-- ✅ plant_petty_cash_config
-- 
-- MENSUALES (8 tablas):
-- ✅ inventory_month
-- ✅ inventory_aggregates_entries
-- ✅ inventory_silos_entries
-- ✅ inventory_additives_entries
-- ✅ inventory_diesel_entries
-- ✅ inventory_products_entries
-- ✅ inventory_utilities_entries
-- ✅ inventory_petty_cash_entries
--
-- PRÓXIMO PASO:
-- Vuelve a la aplicación y ejecuta "Cargar Configuraciones" para insertar
-- los datos de las 6 plantas PROMIX (CAROLINA, CEIBA, GUAYNABO, GURABO, 
-- VEGA BAJA, HUMACAO) con todas sus configuraciones específicas.