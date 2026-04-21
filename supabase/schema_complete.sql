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
-- ATOMIC WRITE HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.replace_plant_config_rows_atomic(
  p_section text,
  p_plant_id text,
  p_rows jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb := COALESCE(p_rows, '[]'::jsonb);
BEGIN
  IF p_plant_id IS NULL OR btrim(p_plant_id) = '' THEN
    RAISE EXCEPTION 'plant_id is required';
  END IF;

  IF jsonb_typeof(v_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  CASE p_section
    WHEN 'cajones' THEN
      DELETE FROM public.plant_cajones_config WHERE plant_id = p_plant_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.plant_cajones_config (
          id, plant_id, cajon_name, material, procedencia, box_width_ft, box_height_ft, sort_order, is_active
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_plant_id,
          row_data.cajon_name,
          row_data.material,
          row_data.procedencia,
          row_data.box_width_ft,
          row_data.box_height_ft,
          COALESCE(row_data.sort_order, 0),
          COALESCE(row_data.is_active, true)
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text,
          plant_id text,
          cajon_name text,
          material text,
          procedencia text,
          box_width_ft numeric,
          box_height_ft numeric,
          sort_order integer,
          is_active boolean
        );
      END IF;

    WHEN 'aggregates' THEN
      DELETE FROM public.plant_aggregates_config WHERE plant_id = p_plant_id;
      DELETE FROM public.plant_cajones_config WHERE plant_id = p_plant_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.plant_aggregates_config (
          id, plant_id, aggregate_name, material_type, location_area, measurement_method, unit,
          box_width_ft, box_height_ft, sort_order, is_active
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_plant_id,
          row_data.aggregate_name,
          row_data.material_type,
          row_data.location_area,
          row_data.measurement_method,
          COALESCE(row_data.unit, 'CUBIC_YARDS'),
          row_data.box_width_ft,
          row_data.box_height_ft,
          COALESCE(row_data.sort_order, 0),
          COALESCE(row_data.is_active, true)
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text,
          plant_id text,
          aggregate_name text,
          material_type text,
          location_area text,
          measurement_method text,
          unit text,
          box_width_ft numeric,
          box_height_ft numeric,
          sort_order integer,
          is_active boolean
        );
      END IF;

    WHEN 'additives' THEN
      DELETE FROM public.plant_additives_config WHERE plant_id = p_plant_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.plant_additives_config (
          id, plant_id, catalog_additive_id, additive_name, additive_type, measurement_method,
          calibration_curve_name, brand, uom, requires_photo, tank_name, reading_uom,
          conversion_table, sort_order, is_active
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_plant_id,
          row_data.catalog_additive_id,
          row_data.additive_name,
          COALESCE(row_data.additive_type, 'MANUAL'),
          row_data.measurement_method,
          row_data.calibration_curve_name,
          row_data.brand,
          row_data.uom,
          COALESCE(row_data.requires_photo, false),
          row_data.tank_name,
          row_data.reading_uom,
          row_data.conversion_table,
          COALESCE(row_data.sort_order, 0),
          COALESCE(row_data.is_active, true)
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text,
          plant_id text,
          catalog_additive_id text,
          additive_name text,
          additive_type text,
          measurement_method text,
          calibration_curve_name text,
          brand text,
          uom text,
          requires_photo boolean,
          tank_name text,
          reading_uom text,
          conversion_table jsonb,
          sort_order integer,
          is_active boolean
        );
      END IF;

    WHEN 'diesel' THEN
      IF jsonb_array_length(v_rows) > 1 THEN
        RAISE EXCEPTION 'diesel config supports at most one row';
      END IF;

      DELETE FROM public.plant_diesel_config WHERE plant_id = p_plant_id;

      IF jsonb_array_length(v_rows) = 1 THEN
        INSERT INTO public.plant_diesel_config (
          id, plant_id, measurement_method, calibration_curve_name, reading_uom, tank_capacity_gallons,
          initial_inventory_gallons, calibration_table, sort_order, is_active
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_plant_id,
          row_data.measurement_method,
          row_data.calibration_curve_name,
          row_data.reading_uom,
          row_data.tank_capacity_gallons,
          row_data.initial_inventory_gallons,
          row_data.calibration_table,
          COALESCE(row_data.sort_order, 0),
          COALESCE(row_data.is_active, true)
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text,
          plant_id text,
          measurement_method text,
          calibration_curve_name text,
          reading_uom text,
          tank_capacity_gallons numeric,
          initial_inventory_gallons numeric,
          calibration_table jsonb,
          sort_order integer,
          is_active boolean
        );
      END IF;

    WHEN 'products' THEN
      DELETE FROM public.plant_products_config WHERE plant_id = p_plant_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.plant_products_config (
          id, plant_id, product_name, unit, category, measure_mode, requires_photo,
          reading_uom, calibration_table, tank_capacity, unit_volume, notes, sort_order, is_active
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_plant_id,
          row_data.product_name,
          row_data.unit,
          COALESCE(row_data.category, 'OTHER'),
          COALESCE(row_data.measure_mode, 'COUNT'),
          COALESCE(row_data.requires_photo, false),
          row_data.reading_uom,
          row_data.calibration_table,
          row_data.tank_capacity,
          row_data.unit_volume,
          row_data.notes,
          COALESCE(row_data.sort_order, 0),
          COALESCE(row_data.is_active, true)
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text,
          plant_id text,
          product_name text,
          unit text,
          category text,
          measure_mode text,
          requires_photo boolean,
          reading_uom text,
          calibration_table jsonb,
          tank_capacity numeric,
          unit_volume numeric,
          notes text,
          sort_order integer,
          is_active boolean
        );
      END IF;

    ELSE
      RAISE EXCEPTION 'Unsupported plant config section: %', p_section;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_plant_silos_config_atomic(
  p_plant_id text,
  p_silos jsonb DEFAULT '[]'::jsonb,
  p_allowed_products jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_silos jsonb := COALESCE(p_silos, '[]'::jsonb);
  v_allowed_products jsonb := COALESCE(p_allowed_products, '[]'::jsonb);
BEGIN
  IF p_plant_id IS NULL OR btrim(p_plant_id) = '' THEN
    RAISE EXCEPTION 'plant_id is required';
  END IF;

  IF jsonb_typeof(v_silos) <> 'array' THEN
    RAISE EXCEPTION 'p_silos must be a JSON array';
  END IF;

  IF jsonb_typeof(v_allowed_products) <> 'array' THEN
    RAISE EXCEPTION 'p_allowed_products must be a JSON array';
  END IF;

  DELETE FROM public.silo_allowed_products
  WHERE silo_config_id IN (
    SELECT id FROM public.plant_silos_config WHERE plant_id = p_plant_id
  );

  DELETE FROM public.plant_silos_config WHERE plant_id = p_plant_id;

  IF jsonb_array_length(v_silos) > 0 THEN
    INSERT INTO public.plant_silos_config (
      id, plant_id, silo_name, measurement_method, calibration_curve_name, sort_order, is_active
    )
    SELECT
      COALESCE(row_data.id, gen_random_uuid()::text),
      p_plant_id,
      row_data.silo_name,
      row_data.measurement_method,
      row_data.calibration_curve_name,
      COALESCE(row_data.sort_order, 0),
      COALESCE(row_data.is_active, true)
    FROM jsonb_to_recordset(v_silos) AS row_data(
      id text,
      plant_id text,
      silo_name text,
      measurement_method text,
      calibration_curve_name text,
      sort_order integer,
      is_active boolean
    );
  END IF;

  IF jsonb_array_length(v_allowed_products) > 0 THEN
    INSERT INTO public.silo_allowed_products (id, silo_config_id, product_name)
    SELECT
      COALESCE(row_data.id, gen_random_uuid()::text),
      row_data.silo_config_id,
      row_data.product_name
    FROM jsonb_to_recordset(v_allowed_products) AS row_data(
      id text,
      silo_config_id text,
      product_name text
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_inventory_section_rows_atomic(
  p_section text,
  p_inventory_month_id text,
  p_rows jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb := COALESCE(p_rows, '[]'::jsonb);
BEGIN
  IF p_inventory_month_id IS NULL OR btrim(p_inventory_month_id) = '' THEN
    RAISE EXCEPTION 'inventory_month_id is required';
  END IF;

  IF jsonb_typeof(v_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  CASE p_section
    WHEN 'aggregates' THEN
      DELETE FROM public.inventory_aggregates_entries WHERE inventory_month_id = p_inventory_month_id;
      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.inventory_aggregates_entries (
          id, inventory_month_id, aggregate_config_id, aggregate_name, material_type, location_area,
          measurement_method, unit, box_width_ft, box_height_ft, box_length_ft, calculated_volume_cy,
          cone_m1, cone_m2, cone_m3, cone_m4, cone_m5, cone_m6, cone_d1, cone_d2, photo_url, notes
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_inventory_month_id,
          row_data.aggregate_config_id,
          row_data.aggregate_name,
          row_data.material_type,
          row_data.location_area,
          row_data.measurement_method,
          row_data.unit,
          row_data.box_width_ft,
          row_data.box_height_ft,
          row_data.box_length_ft,
          row_data.calculated_volume_cy,
          row_data.cone_m1,
          row_data.cone_m2,
          row_data.cone_m3,
          row_data.cone_m4,
          row_data.cone_m5,
          row_data.cone_m6,
          row_data.cone_d1,
          row_data.cone_d2,
          row_data.photo_url,
          row_data.notes
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text, inventory_month_id text, aggregate_config_id text, aggregate_name text, material_type text,
          location_area text, measurement_method text, unit text, box_width_ft numeric, box_height_ft numeric,
          box_length_ft numeric, calculated_volume_cy numeric, cone_m1 numeric, cone_m2 numeric, cone_m3 numeric,
          cone_m4 numeric, cone_m5 numeric, cone_m6 numeric, cone_d1 numeric, cone_d2 numeric, photo_url text, notes text
        );
      END IF;

    WHEN 'silos' THEN
      DELETE FROM public.inventory_silos_entries WHERE inventory_month_id = p_inventory_month_id;
      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.inventory_silos_entries (
          id, inventory_month_id, silo_config_id, silo_name, measurement_method, allowed_products,
          product_id, product_name, product_in_silo, reading_value, reading, previous_reading,
          calculated_result_cy, calculated_volume, photo_url, notes
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_inventory_month_id,
          row_data.silo_config_id,
          row_data.silo_name,
          row_data.measurement_method,
          row_data.allowed_products,
          row_data.product_id,
          row_data.product_name,
          row_data.product_in_silo,
          row_data.reading_value,
          row_data.reading,
          row_data.previous_reading,
          row_data.calculated_result_cy,
          row_data.calculated_volume,
          row_data.photo_url,
          row_data.notes
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text, inventory_month_id text, silo_config_id text, silo_name text, measurement_method text,
          allowed_products jsonb, product_id text, product_name text, product_in_silo text, reading_value numeric,
          reading numeric, previous_reading numeric, calculated_result_cy numeric, calculated_volume numeric, photo_url text, notes text
        );
      END IF;

    WHEN 'additives' THEN
      DELETE FROM public.inventory_additives_entries WHERE inventory_month_id = p_inventory_month_id;
      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.inventory_additives_entries (
          id, inventory_month_id, additive_config_id, additive_type, product_name, brand, uom, requires_photo,
          tank_name, reading_uom, reading_value, reading, calculated_volume, calculated_gallons,
          conversion_table, quantity, photo_url, notes
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_inventory_month_id,
          row_data.additive_config_id,
          row_data.additive_type,
          row_data.product_name,
          row_data.brand,
          row_data.uom,
          row_data.requires_photo,
          row_data.tank_name,
          row_data.reading_uom,
          row_data.reading_value,
          row_data.reading,
          row_data.calculated_volume,
          row_data.calculated_gallons,
          row_data.conversion_table,
          row_data.quantity,
          row_data.photo_url,
          row_data.notes
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text, inventory_month_id text, additive_config_id text, additive_type text, product_name text, brand text,
          uom text, requires_photo boolean, tank_name text, reading_uom text, reading_value numeric, reading numeric,
          calculated_volume numeric, calculated_gallons numeric, conversion_table jsonb, quantity numeric, photo_url text, notes text
        );
      END IF;

    WHEN 'diesel' THEN
      IF jsonb_array_length(v_rows) > 1 THEN
        RAISE EXCEPTION 'diesel entries support at most one row';
      END IF;
      DELETE FROM public.inventory_diesel_entries WHERE inventory_month_id = p_inventory_month_id;
      IF jsonb_array_length(v_rows) = 1 THEN
        INSERT INTO public.inventory_diesel_entries (
          id, inventory_month_id, diesel_config_id, plant_id, unit, reading_uom, reading_inches, reading,
          calculated_gallons, calibration_table, tank_capacity_gallons, beginning_inventory, purchases_gallons,
          ending_inventory, consumption_gallons, photo_url, notes
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_inventory_month_id,
          row_data.diesel_config_id,
          row_data.plant_id,
          row_data.unit,
          row_data.reading_uom,
          row_data.reading_inches,
          row_data.reading,
          row_data.calculated_gallons,
          row_data.calibration_table,
          row_data.tank_capacity_gallons,
          row_data.beginning_inventory,
          row_data.purchases_gallons,
          row_data.ending_inventory,
          row_data.consumption_gallons,
          row_data.photo_url,
          row_data.notes
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text, inventory_month_id text, diesel_config_id text, plant_id text, unit text, reading_uom text,
          reading_inches numeric, reading numeric, calculated_gallons numeric, calibration_table jsonb,
          tank_capacity_gallons numeric, beginning_inventory numeric, purchases_gallons numeric,
          ending_inventory numeric, consumption_gallons numeric, photo_url text, notes text
        );
      END IF;

    WHEN 'products' THEN
      DELETE FROM public.inventory_products_entries WHERE inventory_month_id = p_inventory_month_id;
      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.inventory_products_entries (
          id, inventory_month_id, product_config_id, producto_config_id, product_name, category, measure_mode, uom,
          requires_photo, reading_uom, reading_value, calculated_quantity, calibration_table, tank_capacity,
          unit_count, unit_volume, total_volume, quantity, photo_url, notes
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_inventory_month_id,
          row_data.product_config_id,
          row_data.producto_config_id,
          row_data.product_name,
          row_data.category,
          row_data.measure_mode,
          row_data.uom,
          row_data.requires_photo,
          row_data.reading_uom,
          row_data.reading_value,
          row_data.calculated_quantity,
          row_data.calibration_table,
          row_data.tank_capacity,
          row_data.unit_count,
          row_data.unit_volume,
          row_data.total_volume,
          row_data.quantity,
          row_data.photo_url,
          row_data.notes
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text, inventory_month_id text, product_config_id text, producto_config_id text, product_name text, category text,
          measure_mode text, uom text, requires_photo boolean, reading_uom text, reading_value numeric,
          calculated_quantity numeric, calibration_table jsonb, tank_capacity numeric, unit_count numeric,
          unit_volume numeric, total_volume numeric, quantity numeric, photo_url text, notes text
        );
      END IF;

    WHEN 'utilities' THEN
      DELETE FROM public.inventory_utilities_entries WHERE inventory_month_id = p_inventory_month_id;
      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.inventory_utilities_entries (
          id, inventory_month_id, utility_config_id, utility_meter_config_id, meter_name, meter_number,
          utility_type, uom, provider, requires_photo, previous_reading, current_reading, reading,
          consumption, photo_url, notes
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_inventory_month_id,
          row_data.utility_config_id,
          row_data.utility_meter_config_id,
          row_data.meter_name,
          row_data.meter_number,
          row_data.utility_type,
          row_data.uom,
          row_data.provider,
          row_data.requires_photo,
          row_data.previous_reading,
          row_data.current_reading,
          row_data.reading,
          row_data.consumption,
          row_data.photo_url,
          row_data.notes
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text, inventory_month_id text, utility_config_id text, utility_meter_config_id text, meter_name text,
          meter_number text, utility_type text, uom text, provider text, requires_photo boolean,
          previous_reading numeric, current_reading numeric, reading numeric, consumption numeric, photo_url text, notes text
        );
      END IF;

    WHEN 'petty-cash' THEN
      IF jsonb_array_length(v_rows) > 1 THEN
        RAISE EXCEPTION 'petty cash entries support at most one row';
      END IF;
      DELETE FROM public.inventory_petty_cash_entries WHERE inventory_month_id = p_inventory_month_id;
      IF jsonb_array_length(v_rows) = 1 THEN
        INSERT INTO public.inventory_petty_cash_entries (
          id, inventory_month_id, petty_cash_config_id, plant_id, established_amount, currency, receipts, cash,
          total, difference, beginning_balance, ending_balance, amount, photo_url, notes
        )
        SELECT
          COALESCE(row_data.id, gen_random_uuid()::text),
          p_inventory_month_id,
          row_data.petty_cash_config_id,
          row_data.plant_id,
          row_data.established_amount,
          row_data.currency,
          row_data.receipts,
          row_data.cash,
          row_data.total,
          row_data.difference,
          row_data.beginning_balance,
          row_data.ending_balance,
          row_data.amount,
          row_data.photo_url,
          row_data.notes
        FROM jsonb_to_recordset(v_rows) AS row_data(
          id text, inventory_month_id text, petty_cash_config_id text, plant_id text, established_amount numeric,
          currency text, receipts numeric, cash numeric, total numeric, difference numeric,
          beginning_balance numeric, ending_balance numeric, amount numeric, photo_url text, notes text
        );
      END IF;

    ELSE
      RAISE EXCEPTION 'Unsupported inventory section: %', p_section;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_silos_import_atomic(
  p_plant_id text,
  p_silos jsonb DEFAULT '[]'::jsonb,
  p_allowed_products jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_silos jsonb := COALESCE(p_silos, '[]'::jsonb);
  v_allowed_products jsonb := COALESCE(p_allowed_products, '[]'::jsonb);
BEGIN
  IF p_plant_id IS NULL OR btrim(p_plant_id) = '' THEN
    RAISE EXCEPTION 'plant_id is required';
  END IF;
  IF jsonb_typeof(v_silos) <> 'array' THEN
    RAISE EXCEPTION 'p_silos must be a JSON array';
  END IF;
  IF jsonb_typeof(v_allowed_products) <> 'array' THEN
    RAISE EXCEPTION 'p_allowed_products must be a JSON array';
  END IF;

  IF jsonb_array_length(v_silos) > 0 THEN
    INSERT INTO public.plant_silos_config (
      id, plant_id, silo_name, measurement_method, calibration_curve_name, sort_order, is_active
    )
    SELECT
      COALESCE(row_data.id, gen_random_uuid()::text),
      p_plant_id,
      row_data.silo_name,
      row_data.measurement_method,
      row_data.calibration_curve_name,
      COALESCE(row_data.sort_order, 0),
      COALESCE(row_data.is_active, true)
    FROM jsonb_to_recordset(v_silos) AS row_data(
      id text, plant_id text, silo_name text, measurement_method text, calibration_curve_name text, sort_order integer, is_active boolean
    )
    ON CONFLICT (id) DO UPDATE
    SET
      plant_id = EXCLUDED.plant_id,
      silo_name = EXCLUDED.silo_name,
      measurement_method = EXCLUDED.measurement_method,
      calibration_curve_name = EXCLUDED.calibration_curve_name,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active;

    DELETE FROM public.silo_allowed_products
    WHERE silo_config_id IN (
      SELECT row_data.id
      FROM jsonb_to_recordset(v_silos) AS row_data(
        id text, plant_id text, silo_name text, measurement_method text, calibration_curve_name text, sort_order integer, is_active boolean
      )
    );
  END IF;

  IF jsonb_array_length(v_allowed_products) > 0 THEN
    INSERT INTO public.silo_allowed_products (id, silo_config_id, product_name)
    SELECT
      COALESCE(row_data.id, gen_random_uuid()::text),
      row_data.silo_config_id,
      row_data.product_name
    FROM jsonb_to_recordset(v_allowed_products) AS row_data(
      id text, silo_config_id text, product_name text
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_aggregates_import_atomic(
  p_plant_id text,
  p_aggregates jsonb DEFAULT '[]'::jsonb,
  p_clear_legacy_cajones boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aggregates jsonb := COALESCE(p_aggregates, '[]'::jsonb);
BEGIN
  IF p_plant_id IS NULL OR btrim(p_plant_id) = '' THEN
    RAISE EXCEPTION 'plant_id is required';
  END IF;
  IF jsonb_typeof(v_aggregates) <> 'array' THEN
    RAISE EXCEPTION 'p_aggregates must be a JSON array';
  END IF;

  IF jsonb_array_length(v_aggregates) > 0 THEN
    INSERT INTO public.plant_aggregates_config (
      id, plant_id, aggregate_name, material_type, location_area, measurement_method, unit,
      box_width_ft, box_height_ft, sort_order, is_active
    )
    SELECT
      COALESCE(row_data.id, gen_random_uuid()::text),
      p_plant_id,
      row_data.aggregate_name,
      row_data.material_type,
      row_data.location_area,
      row_data.measurement_method,
      COALESCE(row_data.unit, 'CUBIC_YARDS'),
      row_data.box_width_ft,
      row_data.box_height_ft,
      COALESCE(row_data.sort_order, 0),
      COALESCE(row_data.is_active, true)
    FROM jsonb_to_recordset(v_aggregates) AS row_data(
      id text, plant_id text, aggregate_name text, material_type text, location_area text, measurement_method text,
      unit text, box_width_ft numeric, box_height_ft numeric, sort_order integer, is_active boolean
    )
    ON CONFLICT (id) DO UPDATE
    SET
      plant_id = EXCLUDED.plant_id,
      aggregate_name = EXCLUDED.aggregate_name,
      material_type = EXCLUDED.material_type,
      location_area = EXCLUDED.location_area,
      measurement_method = EXCLUDED.measurement_method,
      unit = EXCLUDED.unit,
      box_width_ft = EXCLUDED.box_width_ft,
      box_height_ft = EXCLUDED.box_height_ft,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active;
  END IF;

  IF p_clear_legacy_cajones THEN
    DELETE FROM public.plant_cajones_config WHERE plant_id = p_plant_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_products_import_atomic(
  p_plant_id text,
  p_products jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_products jsonb := COALESCE(p_products, '[]'::jsonb);
BEGIN
  IF p_plant_id IS NULL OR btrim(p_plant_id) = '' THEN
    RAISE EXCEPTION 'plant_id is required';
  END IF;
  IF jsonb_typeof(v_products) <> 'array' THEN
    RAISE EXCEPTION 'p_products must be a JSON array';
  END IF;

  IF jsonb_array_length(v_products) > 0 THEN
    INSERT INTO public.plant_products_config (
      id, plant_id, product_name, unit, category, measure_mode, requires_photo,
      reading_uom, calibration_table, tank_capacity, unit_volume, notes, sort_order, is_active
    )
    SELECT
      COALESCE(row_data.id, gen_random_uuid()::text),
      p_plant_id,
      row_data.product_name,
      row_data.unit,
      COALESCE(row_data.category, 'OTHER'),
      COALESCE(row_data.measure_mode, 'COUNT'),
      COALESCE(row_data.requires_photo, false),
      row_data.reading_uom,
      row_data.calibration_table,
      row_data.tank_capacity,
      row_data.unit_volume,
      row_data.notes,
      COALESCE(row_data.sort_order, 0),
      COALESCE(row_data.is_active, true)
    FROM jsonb_to_recordset(v_products) AS row_data(
      id text, plant_id text, product_name text, unit text, category text, measure_mode text, requires_photo boolean,
      reading_uom text, calibration_table jsonb, tank_capacity numeric, unit_volume numeric, notes text,
      sort_order integer, is_active boolean
    )
    ON CONFLICT (id) DO UPDATE
    SET
      plant_id = EXCLUDED.plant_id,
      product_name = EXCLUDED.product_name,
      unit = EXCLUDED.unit,
      category = EXCLUDED.category,
      measure_mode = EXCLUDED.measure_mode,
      requires_photo = EXCLUDED.requires_photo,
      reading_uom = EXCLUDED.reading_uom,
      calibration_table = EXCLUDED.calibration_table,
      tank_capacity = EXCLUDED.tank_capacity,
      unit_volume = EXCLUDED.unit_volume,
      notes = EXCLUDED.notes,
      sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active;
  END IF;
END;
$$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.replace_plant_config_rows_atomic(text, text, jsonb) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.replace_plant_silos_config_atomic(text, jsonb, jsonb) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.replace_inventory_section_rows_atomic(text, text, jsonb) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.upsert_silos_import_atomic(text, jsonb, jsonb) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.upsert_aggregates_import_atomic(text, jsonb, boolean) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.upsert_products_import_atomic(text, jsonb) FROM PUBLIC;

  GRANT EXECUTE ON FUNCTION public.replace_plant_config_rows_atomic(text, text, jsonb) TO service_role;
  GRANT EXECUTE ON FUNCTION public.replace_plant_silos_config_atomic(text, jsonb, jsonb) TO service_role;
  GRANT EXECUTE ON FUNCTION public.replace_inventory_section_rows_atomic(text, text, jsonb) TO service_role;
  GRANT EXECUTE ON FUNCTION public.upsert_silos_import_atomic(text, jsonb, jsonb) TO service_role;
  GRANT EXECUTE ON FUNCTION public.upsert_aggregates_import_atomic(text, jsonb, boolean) TO service_role;
  GRANT EXECUTE ON FUNCTION public.upsert_products_import_atomic(text, jsonb) TO service_role;
END;
$$;

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
