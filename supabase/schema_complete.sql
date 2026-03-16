-- ============================================================================
-- PROMIX PLANT INVENTORY SYSTEM - COMPLETE DATABASE SCHEMA
-- CREADO POR CODEX 26/03/05 05:30
-- ============================================================================
-- Script completo para un proyecto Supabase NUEVO (desde cero), alineado con
-- la API actual en /supabase/functions/make-server.
--
-- Ejecutar completo en Supabase SQL Editor.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- UTILITIES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CORE TABLES REQUIRED BY BACKEND
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('plant_manager', 'operations_manager', 'admin', 'super_admin')),
  assigned_plants TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  auth_user_id TEXT UNIQUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT,
  has_cone_measurement BOOLEAN NOT NULL DEFAULT true,
  has_cajon_measurement BOOLEAN NOT NULL DEFAULT true,
  petty_cash_established NUMERIC(12,2) NOT NULL DEFAULT 0,
  cajones JSONB NOT NULL DEFAULT '[]'::jsonb,
  silos JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_email TEXT,
  user_name TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  plant_id TEXT,
  inventory_month_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materiales_catalog (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL,
  clase TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (nombre, clase)
);

CREATE TABLE IF NOT EXISTS procedencias_catalog (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS additives_catalog (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL UNIQUE,
  marca TEXT,
  uom TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CONFIG TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS calibration_curves (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL,
  curve_name TEXT NOT NULL,
  measurement_type TEXT NOT NULL,
  reading_uom TEXT,
  data_points JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, curve_name)
);

CREATE TABLE IF NOT EXISTS calibration_curve_points (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  curve_id TEXT NOT NULL REFERENCES calibration_curves(id) ON DELETE CASCADE,
  point_key NUMERIC NOT NULL,
  point_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (curve_id, point_key)
);

CREATE TABLE IF NOT EXISTS plant_aggregates_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL,
  aggregate_name TEXT NOT NULL,
  material_type TEXT,
  location_area TEXT,
  measurement_method TEXT NOT NULL,
  unit TEXT DEFAULT 'CUBIC_YARDS',
  box_width_ft NUMERIC(12,2),
  box_height_ft NUMERIC(12,2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, aggregate_name)
);

CREATE TABLE IF NOT EXISTS plant_silos_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL,
  silo_name TEXT NOT NULL,
  measurement_method TEXT NOT NULL,
  calibration_curve_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, silo_name)
);

CREATE TABLE IF NOT EXISTS plant_cajones_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL,
  cajon_name TEXT NOT NULL,
  material TEXT,
  procedencia TEXT,
  box_width_ft NUMERIC(12,2),
  box_height_ft NUMERIC(12,2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, cajon_name)
);

CREATE TABLE IF NOT EXISTS silo_allowed_products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  silo_config_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (silo_config_id, product_name)
);

CREATE TABLE IF NOT EXISTS plant_additives_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL,
  catalog_additive_id TEXT,
  additive_name TEXT NOT NULL,
  additive_type TEXT NOT NULL DEFAULT 'MANUAL',
  measurement_method TEXT NOT NULL,
  calibration_curve_name TEXT,
  brand TEXT,
  uom TEXT,
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  tank_name TEXT,
  reading_uom TEXT,
  conversion_table JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, additive_name)
);

CREATE TABLE IF NOT EXISTS plant_diesel_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL UNIQUE,
  measurement_method TEXT NOT NULL,
  calibration_curve_name TEXT,
  reading_uom TEXT,
  tank_capacity_gallons NUMERIC(12,2),
  initial_inventory_gallons NUMERIC(12,2),
  calibration_table JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plant_products_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'OTHER',
  measure_mode TEXT NOT NULL DEFAULT 'COUNT',
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  reading_uom TEXT,
  calibration_table JSONB,
  tank_capacity NUMERIC(12,2),
  unit_volume NUMERIC(12,2),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, product_name)
);

CREATE TABLE IF NOT EXISTS plant_utilities_meters_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL,
  meter_name TEXT NOT NULL,
  meter_type TEXT NOT NULL,
  unit TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, meter_name)
);

CREATE TABLE IF NOT EXISTS plant_petty_cash_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL UNIQUE,
  monthly_amount NUMERIC(12,2),
  initial_amount NUMERIC(12,2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TRANSACTIONAL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_month (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  created_by TEXT NOT NULL,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_notes TEXT,
  approval_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, year_month)
);

CREATE TABLE IF NOT EXISTS inventory_aggregates_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  inventory_month_id TEXT NOT NULL,
  aggregate_config_id TEXT NOT NULL,
  aggregate_name TEXT,
  material_type TEXT,
  location_area TEXT,
  measurement_method TEXT,
  unit TEXT,
  box_width_ft NUMERIC(12,2),
  box_height_ft NUMERIC(12,2),
  box_length_ft NUMERIC(12,2),
  calculated_volume_cy NUMERIC(12,2),
  cone_m1 NUMERIC(12,2),
  cone_m2 NUMERIC(12,2),
  cone_m3 NUMERIC(12,2),
  cone_m4 NUMERIC(12,2),
  cone_m5 NUMERIC(12,2),
  cone_m6 NUMERIC(12,2),
  cone_d1 NUMERIC(12,2),
  cone_d2 NUMERIC(12,2),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inventory_month_id, aggregate_config_id)
);

CREATE TABLE IF NOT EXISTS inventory_silos_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  inventory_month_id TEXT NOT NULL,
  silo_config_id TEXT NOT NULL,
  silo_name TEXT,
  measurement_method TEXT,
  allowed_products JSONB,
  product_id TEXT,
  product_name TEXT,
  product_in_silo TEXT,
  reading_value NUMERIC(12,2),
  reading NUMERIC(12,2),
  previous_reading NUMERIC(12,2),
  calculated_result_cy NUMERIC(12,2),
  calculated_volume NUMERIC(12,2),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inventory_month_id, silo_config_id)
);

CREATE TABLE IF NOT EXISTS inventory_additives_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  inventory_month_id TEXT NOT NULL,
  additive_config_id TEXT NOT NULL,
  additive_type TEXT,
  product_name TEXT,
  brand TEXT,
  uom TEXT,
  requires_photo BOOLEAN,
  tank_name TEXT,
  reading_uom TEXT,
  reading_value NUMERIC(12,2),
  reading NUMERIC(12,2),
  calculated_volume NUMERIC(12,2),
  calculated_gallons NUMERIC(12,2),
  conversion_table JSONB,
  quantity NUMERIC(12,2),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inventory_month_id, additive_config_id)
);

CREATE TABLE IF NOT EXISTS inventory_diesel_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  inventory_month_id TEXT NOT NULL UNIQUE,
  diesel_config_id TEXT,
  plant_id TEXT,
  unit TEXT,
  reading_uom TEXT,
  reading_inches NUMERIC(12,2),
  reading NUMERIC(12,2),
  calculated_gallons NUMERIC(12,2),
  calibration_table JSONB,
  tank_capacity_gallons NUMERIC(12,2),
  beginning_inventory NUMERIC(12,2),
  purchases_gallons NUMERIC(12,2),
  ending_inventory NUMERIC(12,2),
  consumption_gallons NUMERIC(12,2),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_products_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  inventory_month_id TEXT NOT NULL,
  product_config_id TEXT,
  producto_config_id TEXT,
  product_name TEXT,
  category TEXT,
  measure_mode TEXT,
  uom TEXT,
  requires_photo BOOLEAN,
  reading_uom TEXT,
  reading_value NUMERIC(12,2),
  calculated_quantity NUMERIC(12,2),
  calibration_table JSONB,
  tank_capacity NUMERIC(12,2),
  unit_count NUMERIC(12,2),
  unit_volume NUMERIC(12,2),
  total_volume NUMERIC(12,2),
  quantity NUMERIC(12,2),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_utilities_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  inventory_month_id TEXT NOT NULL,
  utility_config_id TEXT,
  utility_meter_config_id TEXT,
  meter_name TEXT,
  meter_number TEXT,
  utility_type TEXT,
  uom TEXT,
  provider TEXT,
  requires_photo BOOLEAN,
  previous_reading NUMERIC(12,2),
  current_reading NUMERIC(12,2),
  reading NUMERIC(12,2),
  consumption NUMERIC(12,2),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_petty_cash_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  inventory_month_id TEXT NOT NULL UNIQUE,
  petty_cash_config_id TEXT,
  plant_id TEXT,
  established_amount NUMERIC(12,2),
  currency TEXT,
  receipts NUMERIC(12,2),
  cash NUMERIC(12,2),
  total NUMERIC(12,2),
  difference NUMERIC(12,2),
  beginning_balance NUMERIC(12,2),
  ending_balance NUMERIC(12,2),
  amount NUMERIC(12,2),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_plants_active ON plants(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_plant_id ON audit_logs(plant_id);
CREATE INDEX IF NOT EXISTS idx_materiales_catalog_active ON materiales_catalog(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_procedencias_catalog_active ON procedencias_catalog(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_additives_catalog_active ON additives_catalog(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_kv_store_prefix ON kv_store(key text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_calibration_curves_plant_id ON calibration_curves(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_aggregates_plant_id ON plant_aggregates_config(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_silos_plant_id ON plant_silos_config(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_cajones_plant_id ON plant_cajones_config(plant_id);
CREATE INDEX IF NOT EXISTS idx_silo_allowed_products_silo_id ON silo_allowed_products(silo_config_id);
CREATE INDEX IF NOT EXISTS idx_plant_additives_plant_id ON plant_additives_config(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_diesel_plant_id ON plant_diesel_config(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_products_plant_id ON plant_products_config(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_utilities_plant_id ON plant_utilities_meters_config(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_petty_cash_plant_id ON plant_petty_cash_config(plant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_month_plant_id ON inventory_month(plant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_month_year_month ON inventory_month(year_month);
CREATE INDEX IF NOT EXISTS idx_inventory_month_status ON inventory_month(status);

CREATE INDEX IF NOT EXISTS idx_inv_aggregates_month_id ON inventory_aggregates_entries(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_inv_silos_month_id ON inventory_silos_entries(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_inv_additives_month_id ON inventory_additives_entries(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_inv_diesel_month_id ON inventory_diesel_entries(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_inv_products_month_id ON inventory_products_entries(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_inv_utilities_month_id ON inventory_utilities_entries(inventory_month_id);
CREATE INDEX IF NOT EXISTS idx_inv_petty_cash_month_id ON inventory_petty_cash_entries(inventory_month_id);

-- ============================================================================
-- DEFAULT DATA (PLANTS + CATALOGS)
-- ============================================================================

INSERT INTO plants (id, name, code, location, petty_cash_established, is_active)
VALUES
  ('CAROLINA',  'Carolina',   'CAROLINA',  'Puerto Rico', 1500, true),
  ('CEIBA',     'Ceiba',      'CEIBA',     'Puerto Rico', 1200, true),
  ('GUAYNABO',  'Guaynabo',   'GUAYNABO',  'Puerto Rico', 1500, true),
  ('GURABO',    'Gurabo',     'GURABO',    'Puerto Rico', 1200, true),
  ('VEGA_BAJA', 'Vega Baja',  'VEGA_BAJA', 'Puerto Rico', 1000, true),
  ('HUMACAO',   'Humacao',    'HUMACAO',   'Puerto Rico', 1000, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  location = EXCLUDED.location,
  petty_cash_established = EXCLUDED.petty_cash_established,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO materiales_catalog (nombre, clase, sort_order)
VALUES
  ('PIEDRA #67', 'PIEDRA', 1),
  ('ARENA', 'ARENA', 2),
  ('PIEDRA #8', 'PIEDRA', 3),
  ('PIEDRA #4', 'PIEDRA', 4)
ON CONFLICT (nombre, clase) DO NOTHING;

INSERT INTO procedencias_catalog (nombre, sort_order)
VALUES
  ('Cantera Norte', 1),
  ('Cantera Sur', 2),
  ('Proveedor Local', 3)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO kv_store (key, value)
VALUES ('module_config', '{"version":1,"modules":{}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- STORAGE BUCKET FOR PHOTOS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory-photos', 'inventory-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  tables_with_updated_at TEXT[] := ARRAY[
    'users','plants','audit_logs','materiales_catalog','procedencias_catalog','additives_catalog','kv_store',
    'calibration_curves','plant_aggregates_config','plant_silos_config','plant_cajones_config','plant_additives_config',
    'plant_diesel_config','plant_products_config','plant_utilities_meters_config','plant_petty_cash_config',
    'inventory_month','inventory_aggregates_entries','inventory_silos_entries','inventory_additives_entries',
    'inventory_diesel_entries','inventory_products_entries','inventory_utilities_entries','inventory_petty_cash_entries'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_updated_at LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t
    );
  END LOOP;
END $$;

COMMIT;
