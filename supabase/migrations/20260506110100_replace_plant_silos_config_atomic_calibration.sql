CREATE OR REPLACE FUNCTION public.replace_plant_silos_config_atomic(
  p_plant_id text,
  p_silos jsonb DEFAULT '[]'::jsonb,
  p_allowed_products jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $replace_plant_silos_config_atomic$
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
      id, plant_id, silo_name, measurement_method, calibration_curve_name,
      reading_uom, conversion_table, sort_order, is_active
    )
    SELECT
      COALESCE(row_data.id, gen_random_uuid()::text),
      p_plant_id,
      row_data.silo_name,
      row_data.measurement_method,
      row_data.calibration_curve_name,
      row_data.reading_uom,
      row_data.conversion_table,
      COALESCE(row_data.sort_order, 0),
      COALESCE(row_data.is_active, true)
    FROM jsonb_to_recordset(v_silos) AS row_data(
      id text,
      plant_id text,
      silo_name text,
      measurement_method text,
      calibration_curve_name text,
      reading_uom text,
      conversion_table jsonb,
      sort_order integer,
      is_active boolean
    );
  END IF;

  IF jsonb_array_length(v_allowed_products) > 0 THEN
    INSERT INTO public.silo_allowed_products (
      silo_config_id, product_name
    )
    SELECT
      row_data.silo_config_id,
      row_data.product_name
    FROM jsonb_to_recordset(v_allowed_products) AS row_data(
      silo_config_id text,
      product_name text
    )
    WHERE EXISTS (
      SELECT 1
      FROM public.plant_silos_config s
      WHERE s.id = row_data.silo_config_id
        AND s.plant_id = p_plant_id
    );
  END IF;
END;
$replace_plant_silos_config_atomic$;
