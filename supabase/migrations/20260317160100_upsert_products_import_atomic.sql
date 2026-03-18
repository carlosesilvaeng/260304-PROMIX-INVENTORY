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
      id,
      plant_id,
      product_name,
      unit,
      category,
      measure_mode,
      requires_photo,
      reading_uom,
      calibration_table,
      tank_capacity,
      unit_volume,
      notes,
      sort_order,
      is_active
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
