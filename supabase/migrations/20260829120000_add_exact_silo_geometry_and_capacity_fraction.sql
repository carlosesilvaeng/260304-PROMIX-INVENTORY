BEGIN;

ALTER TABLE public.plant_silos_config
  ADD COLUMN IF NOT EXISTS geometry_model text NOT NULL DEFAULT 'LEGACY_LINEAR',
  ADD COLUMN IF NOT EXISTS capacity_fraction numeric(8,6) NOT NULL DEFAULT 1;

ALTER TABLE public.inventory_silos_entries
  ADD COLUMN IF NOT EXISTS geometry_model text,
  ADD COLUMN IF NOT EXISTS capacity_fraction numeric(8,6);

ALTER TABLE public.plant_silos_config
  DROP CONSTRAINT IF EXISTS plant_silos_config_geometry_model_check;
ALTER TABLE public.plant_silos_config
  ADD CONSTRAINT plant_silos_config_geometry_model_check
  CHECK (geometry_model IN ('LEGACY_LINEAR', 'EXACT_PIECEWISE'));

ALTER TABLE public.plant_silos_config
  DROP CONSTRAINT IF EXISTS plant_silos_config_capacity_fraction_check;
ALTER TABLE public.plant_silos_config
  ADD CONSTRAINT plant_silos_config_capacity_fraction_check
  CHECK (capacity_fraction > 0 AND capacity_fraction <= 1);

CREATE OR REPLACE FUNCTION public.replace_plant_silos_config_atomic(
  p_plant_id text, p_silos jsonb DEFAULT '[]'::jsonb, p_allowed_products jsonb DEFAULT '[]'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_silos jsonb := COALESCE(p_silos, '[]'::jsonb);
  v_allowed jsonb := COALESCE(p_allowed_products, '[]'::jsonb);
BEGIN
  IF jsonb_typeof(v_silos) <> 'array' OR jsonb_typeof(v_allowed) <> 'array' THEN
    RAISE EXCEPTION 'Invalid silo payload';
  END IF;

  DELETE FROM silo_allowed_products
  WHERE silo_config_id IN (SELECT id FROM plant_silos_config WHERE plant_id = p_plant_id);
  DELETE FROM plant_silos_config WHERE plant_id = p_plant_id;

  INSERT INTO plant_silos_config (
    id, plant_id, silo_name, measurement_method, calibration_curve_name, reading_uom, conversion_table,
    calculation_method, diameter_in, total_height_in, cone_height_in, bottom_diameter_in,
    cylinder_height_mode, slope_divisor_mode, reading_reference, geometry_model, capacity_fraction,
    calculation_unit_id, inventory_unit_id, material_conversion_factor_id, requires_photo, sort_order, is_active
  )
  SELECT
    COALESCE(r.id, gen_random_uuid()::text), p_plant_id, r.silo_name,
    COALESCE(r.measurement_method, 'SILO_LEVEL'), r.calibration_curve_name, r.reading_uom,
    r.conversion_table, COALESCE(r.calculation_method, 'CALIBRATION_CURVE'), r.diameter_in,
    r.total_height_in, r.cone_height_in, r.bottom_diameter_in,
    COALESCE(r.cylinder_height_mode, 'FULL_H'),
    COALESCE(r.slope_divisor_mode, 'SLOPE_DIVISOR_EFFECTIVE'),
    COALESCE(r.reading_reference, 'EMPTY_HEIGHT_INCHES'),
    COALESCE(r.geometry_model, 'LEGACY_LINEAR'), COALESCE(r.capacity_fraction, 1),
    COALESCE(r.calculation_unit_id, 'ft3'), r.inventory_unit_id,
    r.material_conversion_factor_id, COALESCE(r.requires_photo, true),
    COALESCE(r.sort_order, 0), COALESCE(r.is_active, true)
  FROM jsonb_to_recordset(v_silos) AS r(
    id text, silo_name text, measurement_method text, calibration_curve_name text, reading_uom text,
    conversion_table jsonb, calculation_method text, diameter_in numeric, total_height_in numeric,
    cone_height_in numeric, bottom_diameter_in numeric, cylinder_height_mode text,
    slope_divisor_mode text, reading_reference text, geometry_model text, capacity_fraction numeric,
    calculation_unit_id text, inventory_unit_id text, material_conversion_factor_id text,
    requires_photo boolean, sort_order integer, is_active boolean
  );

  INSERT INTO silo_allowed_products(silo_config_id, product_name)
  SELECT r.silo_config_id, r.product_name
  FROM jsonb_to_recordset(v_allowed) r(silo_config_id text, product_name text)
  WHERE EXISTS (
    SELECT 1 FROM plant_silos_config s
    WHERE s.id = r.silo_config_id AND s.plant_id = p_plant_id
  );
END $$;

CREATE OR REPLACE FUNCTION public.replace_inventory_silos_atomic(
  p_inventory_month_id text, p_rows jsonb DEFAULT '[]'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb := COALESCE(p_rows, '[]'::jsonb);
BEGIN
  IF jsonb_typeof(v_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  DELETE FROM inventory_silos_entries WHERE inventory_month_id = p_inventory_month_id;
  INSERT INTO inventory_silos_entries(
    id, inventory_month_id, silo_config_id, silo_name, measurement_method, allowed_products,
    product_id, product_name, product_in_silo, reading_uom, reading_value, reading, previous_reading,
    calculated_result_cy, calculated_volume, conversion_table, calculation_method, reading_reference,
    geometry_model, capacity_fraction, calculated_volume_ft3, calculated_result,
    calculated_result_unit_id, presentation_lbs, presentation_metric_tons, calculation_metadata,
    requires_photo, photo_url, notes
  )
  SELECT
    COALESCE(r.id, gen_random_uuid()::text), p_inventory_month_id, r.silo_config_id, r.silo_name,
    r.measurement_method, r.allowed_products, r.product_id, r.product_name, r.product_in_silo,
    r.reading_uom, r.reading_value, r.reading, r.previous_reading, r.calculated_result_cy,
    r.calculated_volume, r.conversion_table, r.calculation_method, r.reading_reference,
    r.geometry_model, r.capacity_fraction, r.calculated_volume_ft3, r.calculated_result,
    r.calculated_result_unit_id, r.presentation_lbs, r.presentation_metric_tons,
    r.calculation_metadata, COALESCE(r.requires_photo, true), r.photo_url, r.notes
  FROM jsonb_to_recordset(v_rows) AS r(
    id text, silo_config_id text, silo_name text, measurement_method text, allowed_products jsonb,
    product_id text, product_name text, product_in_silo text, reading_uom text, reading_value numeric,
    reading numeric, previous_reading numeric, calculated_result_cy numeric, calculated_volume numeric,
    conversion_table jsonb, calculation_method text, reading_reference text, geometry_model text,
    capacity_fraction numeric, calculated_volume_ft3 numeric, calculated_result numeric,
    calculated_result_unit_id text, presentation_lbs numeric, presentation_metric_tons numeric,
    calculation_metadata jsonb, requires_photo boolean, photo_url text, notes text
  );
END $$;

REVOKE ALL ON FUNCTION public.replace_plant_silos_config_atomic(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_plant_silos_config_atomic(text, jsonb, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.replace_inventory_silos_atomic(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_inventory_silos_atomic(text, jsonb) TO service_role;

COMMIT;
