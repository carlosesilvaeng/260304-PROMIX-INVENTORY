BEGIN;

ALTER TABLE public.inventory_silos_entries
  ADD COLUMN IF NOT EXISTS presentation_sacks numeric(14,2);

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
    calculated_result_unit_id, presentation_lbs, presentation_sacks, presentation_metric_tons,
    calculation_metadata, requires_photo, photo_url, notes
  )
  SELECT
    COALESCE(r.id, gen_random_uuid()::text), p_inventory_month_id, r.silo_config_id, r.silo_name,
    r.measurement_method, r.allowed_products, r.product_id, r.product_name, r.product_in_silo,
    r.reading_uom, r.reading_value, r.reading, r.previous_reading, r.calculated_result_cy,
    r.calculated_volume, r.conversion_table, r.calculation_method, r.reading_reference,
    r.geometry_model, r.capacity_fraction, r.calculated_volume_ft3, r.calculated_result,
    r.calculated_result_unit_id, r.presentation_lbs, r.presentation_sacks, r.presentation_metric_tons,
    r.calculation_metadata, COALESCE(r.requires_photo, true), r.photo_url, r.notes
  FROM jsonb_to_recordset(v_rows) AS r(
    id text, silo_config_id text, silo_name text, measurement_method text, allowed_products jsonb,
    product_id text, product_name text, product_in_silo text, reading_uom text, reading_value numeric,
    reading numeric, previous_reading numeric, calculated_result_cy numeric, calculated_volume numeric,
    conversion_table jsonb, calculation_method text, reading_reference text, geometry_model text,
    capacity_fraction numeric, calculated_volume_ft3 numeric, calculated_result numeric,
    calculated_result_unit_id text, presentation_lbs numeric, presentation_sacks numeric,
    presentation_metric_tons numeric, calculation_metadata jsonb, requires_photo boolean,
    photo_url text, notes text
  );
END $$;

REVOKE ALL ON FUNCTION public.replace_inventory_silos_atomic(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_inventory_silos_atomic(text, jsonb) TO service_role;

COMMIT;
