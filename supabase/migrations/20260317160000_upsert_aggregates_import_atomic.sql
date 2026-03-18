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
      id,
      plant_id,
      aggregate_name,
      material_type,
      location_area,
      measurement_method,
      unit,
      box_width_ft,
      box_height_ft,
      sort_order,
      is_active
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
    DELETE FROM public.plant_cajones_config
    WHERE plant_id = p_plant_id;
  END IF;
END;
$$;
