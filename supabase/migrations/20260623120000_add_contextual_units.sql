BEGIN;

CREATE TABLE IF NOT EXISTS unit_categories (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  base_unit_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES unit_categories(id),
  code TEXT NOT NULL UNIQUE,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  symbol TEXT NOT NULL,
  measurement_system TEXT NOT NULL CHECK (measurement_system IN ('metric', 'imperial', 'us_customary', 'operational')),
  factor_to_base NUMERIC(24,12) NOT NULL CHECK (factor_to_base > 0),
  decimal_precision INTEGER NOT NULL DEFAULT 2,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE unit_categories
  ADD CONSTRAINT unit_categories_base_unit_fk
  FOREIGN KEY (base_unit_id) REFERENCES units(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS material_conversion_factors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  material_id TEXT REFERENCES materiales_catalog(id),
  plant_id TEXT REFERENCES plants(id),
  from_unit_id TEXT NOT NULL REFERENCES units(id),
  to_unit_id TEXT NOT NULL REFERENCES units(id),
  factor NUMERIC(24,12) NOT NULL CHECK (factor > 0),
  factor_source TEXT,
  effective_from DATE,
  effective_to DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_material_conversion_factors_lookup
  ON material_conversion_factors(material_id, plant_id, from_unit_id, to_unit_id)
  WHERE active = true;

ALTER TABLE calibration_curves
  ADD COLUMN IF NOT EXISTS equipment_id TEXT,
  ADD COLUMN IF NOT EXISTS material_id TEXT REFERENCES materiales_catalog(id),
  ADD COLUMN IF NOT EXISTS input_unit_id TEXT REFERENCES units(id),
  ADD COLUMN IF NOT EXISTS output_unit_id TEXT REFERENCES units(id),
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'table_interpolation'
    CHECK (method IN ('table_interpolation', 'linear', 'polynomial'));

CREATE TABLE IF NOT EXISTS measurement_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT REFERENCES plants(id),
  section_code TEXT,
  inventory_type_id TEXT,
  material_id TEXT REFERENCES materiales_catalog(id),
  equipment_id TEXT,
  capture_unit_id TEXT NOT NULL REFERENCES units(id),
  calculation_unit_id TEXT NOT NULL REFERENCES units(id),
  display_unit_id TEXT NOT NULL REFERENCES units(id),
  inventory_unit_id TEXT NOT NULL REFERENCES units(id),
  material_conversion_factor_id TEXT REFERENCES material_conversion_factors(id),
  calibration_curve_id TEXT REFERENCES calibration_curves(id),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_measurement_configs_resolution
  ON measurement_configs(plant_id, section_code, inventory_type_id, material_id, equipment_id)
  WHERE active = true;

INSERT INTO unit_categories (id, code, name_es, name_en, base_unit_id, sort_order, active)
VALUES
  ('length', 'length', 'Longitud', 'Length', 'm', 10, true),
  ('area', 'area', 'Área', 'Area', 'm2', 20, true),
  ('volume', 'volume', 'Volumen', 'Volume', 'm3', 30, true),
  ('mass', 'mass', 'Masa/Peso', 'Mass/Weight', 'lb', 40, true),
  ('capacity', 'capacity', 'Capacidad líquida', 'Liquid capacity', 'gal_us', 50, true),
  ('count', 'count', 'Conteo', 'Count', 'unit', 60, true),
  ('operational', 'operational', 'Referencia operativa', 'Operational reference', 'trip_truck', 70, true)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name_es = EXCLUDED.name_es,
  name_en = EXCLUDED.name_en,
  base_unit_id = EXCLUDED.base_unit_id,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO units (id, category_id, code, name_es, name_en, symbol, measurement_system, factor_to_base, decimal_precision, sort_order, active)
VALUES
  ('m', 'length', 'm', 'metro', 'meter', 'm', 'metric', 1, 3, 10, true),
  ('ft', 'length', 'ft', 'pie', 'foot', 'ft', 'imperial', 0.3048, 3, 20, true),
  ('in', 'length', 'in', 'pulgada', 'inch', 'in', 'imperial', 0.0254, 3, 30, true),
  ('cm', 'length', 'cm', 'centímetro', 'centimeter', 'cm', 'metric', 0.01, 2, 40, true),
  ('m2', 'area', 'm2', 'metro cuadrado', 'square meter', 'm²', 'metric', 1, 3, 10, true),
  ('ft2', 'area', 'ft2', 'pie cuadrado', 'square foot', 'ft²', 'imperial', 0.09290304, 3, 20, true),
  ('m3', 'volume', 'm3', 'metro cúbico', 'cubic meter', 'm³', 'metric', 1, 3, 10, true),
  ('ft3', 'volume', 'ft3', 'pie cúbico', 'cubic foot', 'ft³', 'imperial', 0.028316846592, 3, 20, true),
  ('lb', 'mass', 'lb', 'libra', 'pound', 'lb', 'us_customary', 1, 2, 10, true),
  ('kg', 'mass', 'kg', 'kilogramo', 'kilogram', 'kg', 'metric', 2.2046226218, 3, 20, true),
  ('short_ton', 'mass', 'short_ton', 'tonelada corta', 'short ton', 'ton corta', 'us_customary', 2000, 3, 30, true),
  ('metric_ton', 'mass', 'metric_ton', 'tonelada métrica', 'metric ton', 't', 'metric', 2204.6226218, 3, 40, true),
  ('gal_us', 'capacity', 'gal_us', 'galón US', 'US gallon', 'gal', 'us_customary', 1, 2, 10, true),
  ('liter', 'capacity', 'liter', 'litro', 'liter', 'L', 'metric', 0.264172052358, 2, 20, true),
  ('unit', 'count', 'unit', 'unidad', 'unit', 'un', 'operational', 1, 0, 10, true),
  ('sack', 'count', 'sack', 'saco', 'sack', 'saco', 'operational', 1, 0, 20, true),
  ('trip_truck', 'operational', 'trip_truck', 'viaje/camión', 'trip/truck', 'viaje', 'operational', 1, 0, 10, true)
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  code = EXCLUDED.code,
  name_es = EXCLUDED.name_es,
  name_en = EXCLUDED.name_en,
  symbol = EXCLUDED.symbol,
  measurement_system = EXCLUDED.measurement_system,
  factor_to_base = EXCLUDED.factor_to_base,
  decimal_precision = EXCLUDED.decimal_precision,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO measurement_configs (
  id, plant_id, section_code, inventory_type_id, material_id, equipment_id,
  capture_unit_id, calculation_unit_id, display_unit_id, inventory_unit_id,
  material_conversion_factor_id, calibration_curve_id, active, sort_order
)
VALUES
  ('default_aggregates', NULL, 'aggregates', NULL, NULL, NULL, 'ft', 'ft3', 'ft3', 'ft3', NULL, NULL, true, 10),
  ('default_silos', NULL, 'silos', NULL, NULL, NULL, 'in', 'gal_us', 'gal_us', 'gal_us', NULL, NULL, true, 20),
  ('default_additives', NULL, 'additives', NULL, NULL, NULL, 'in', 'gal_us', 'gal_us', 'gal_us', NULL, NULL, true, 30),
  ('default_diesel', NULL, 'diesel', NULL, NULL, NULL, 'in', 'gal_us', 'gal_us', 'gal_us', NULL, NULL, true, 40),
  ('default_products', NULL, 'products', NULL, NULL, NULL, 'unit', 'unit', 'unit', 'unit', NULL, NULL, true, 50),
  ('default_utilities', NULL, 'utilities', NULL, NULL, NULL, 'unit', 'unit', 'unit', 'unit', NULL, NULL, true, 60)
ON CONFLICT (id) DO UPDATE SET
  capture_unit_id = EXCLUDED.capture_unit_id,
  calculation_unit_id = EXCLUDED.calculation_unit_id,
  display_unit_id = EXCLUDED.display_unit_id,
  inventory_unit_id = EXCLUDED.inventory_unit_id,
  active = EXCLUDED.active,
  updated_at = NOW();

CREATE TRIGGER update_unit_categories_updated_at
  BEFORE UPDATE ON unit_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_material_conversion_factors_updated_at
  BEFORE UPDATE ON material_conversion_factors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_measurement_configs_updated_at
  BEFORE UPDATE ON measurement_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
