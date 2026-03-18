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
      DELETE FROM public.plant_cajones_config
      WHERE plant_id = p_plant_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.plant_cajones_config (
          id,
          plant_id,
          cajon_name,
          material,
          procedencia,
          box_width_ft,
          box_height_ft,
          sort_order,
          is_active
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
      DELETE FROM public.plant_aggregates_config
      WHERE plant_id = p_plant_id;

      IF jsonb_array_length(v_rows) > 0 THEN
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
      DELETE FROM public.plant_additives_config
      WHERE plant_id = p_plant_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.plant_additives_config (
          id,
          plant_id,
          catalog_additive_id,
          additive_name,
          additive_type,
          measurement_method,
          calibration_curve_name,
          brand,
          uom,
          requires_photo,
          tank_name,
          reading_uom,
          conversion_table,
          sort_order,
          is_active
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

      DELETE FROM public.plant_diesel_config
      WHERE plant_id = p_plant_id;

      IF jsonb_array_length(v_rows) = 1 THEN
        INSERT INTO public.plant_diesel_config (
          id,
          plant_id,
          measurement_method,
          calibration_curve_name,
          reading_uom,
          tank_capacity_gallons,
          initial_inventory_gallons,
          calibration_table,
          sort_order,
          is_active
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
      DELETE FROM public.plant_products_config
      WHERE plant_id = p_plant_id;

      IF jsonb_array_length(v_rows) > 0 THEN
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
