ALTER TABLE public.plant_additives_config
  ADD COLUMN IF NOT EXISTS diameter numeric,
  ADD COLUMN IF NOT EXISTS length numeric,
  ADD COLUMN IF NOT EXISTS width numeric,
  ADD COLUMN IF NOT EXISTS total_height numeric,
  ADD COLUMN IF NOT EXISTS capacity numeric,
  ADD COLUMN IF NOT EXISTS dimension_unit_id text REFERENCES public.units(id),
  ADD COLUMN IF NOT EXISTS capacity_unit_id text REFERENCES public.units(id);

ALTER TABLE public.inventory_additives_entries
  ADD COLUMN IF NOT EXISTS measurement_method text,
  ADD COLUMN IF NOT EXISTS diameter numeric,
  ADD COLUMN IF NOT EXISTS length numeric,
  ADD COLUMN IF NOT EXISTS width numeric,
  ADD COLUMN IF NOT EXISTS total_height numeric,
  ADD COLUMN IF NOT EXISTS capacity numeric,
  ADD COLUMN IF NOT EXISTS dimension_unit_id text REFERENCES public.units(id),
  ADD COLUMN IF NOT EXISTS capacity_unit_id text REFERENCES public.units(id),
  ADD COLUMN IF NOT EXISTS capture_unit_id text REFERENCES public.units(id),
  ADD COLUMN IF NOT EXISTS calculation_unit_id text REFERENCES public.units(id),
  ADD COLUMN IF NOT EXISTS display_unit_id text REFERENCES public.units(id),
  ADD COLUMN IF NOT EXISTS inventory_unit_id text REFERENCES public.units(id),
  ADD COLUMN IF NOT EXISTS inventory_percentage numeric,
  ADD COLUMN IF NOT EXISTS display_volume numeric,
  ADD COLUMN IF NOT EXISTS inventory_quantity numeric;

CREATE OR REPLACE FUNCTION public.replace_plant_additives_config_atomic(
  p_plant_id text,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.plant_additives_config WHERE plant_id = p_plant_id;

  IF jsonb_array_length(COALESCE(p_rows, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.plant_additives_config (
      id, plant_id, catalog_additive_id, additive_name, additive_type, measurement_method,
      calibration_curve_name, brand, uom, requires_photo, tank_name, reading_uom,
      conversion_table, diameter, length, width, total_height, capacity,
      dimension_unit_id, capacity_unit_id, sort_order, is_active
    )
    SELECT
      COALESCE(row_data.id, gen_random_uuid()::text),
      p_plant_id,
      row_data.catalog_additive_id,
      row_data.additive_name,
      COALESCE(row_data.additive_type, 'MANUAL'),
      COALESCE(row_data.measurement_method, 'MANUAL'),
      row_data.calibration_curve_name,
      row_data.brand,
      row_data.uom,
      COALESCE(row_data.requires_photo, false),
      row_data.tank_name,
      row_data.reading_uom,
      row_data.conversion_table,
      row_data.diameter,
      row_data.length,
      row_data.width,
      row_data.total_height,
      row_data.capacity,
      row_data.dimension_unit_id,
      row_data.capacity_unit_id,
      COALESCE(row_data.sort_order, 0),
      COALESCE(row_data.is_active, true)
    FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb)) AS row_data(
      id text,
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
      diameter numeric,
      length numeric,
      width numeric,
      total_height numeric,
      capacity numeric,
      dimension_unit_id text,
      capacity_unit_id text,
      sort_order integer,
      is_active boolean
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_inventory_additives_atomic(
  p_inventory_month_id text,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.inventory_additives_entries
  WHERE inventory_month_id = p_inventory_month_id;

  IF jsonb_array_length(COALESCE(p_rows, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.inventory_additives_entries (
      id, inventory_month_id, additive_config_id, additive_type, measurement_method,
      product_name, brand, uom, requires_photo, tank_name, reading_uom,
      reading_value, reading, calculated_volume, calculated_gallons, conversion_table,
      quantity, diameter, length, width, total_height, capacity, dimension_unit_id,
      capacity_unit_id, capture_unit_id, calculation_unit_id, display_unit_id,
      inventory_unit_id, inventory_percentage, display_volume, inventory_quantity, photo_url, notes
    )
    SELECT
      COALESCE(row_data.id, gen_random_uuid()::text),
      p_inventory_month_id,
      row_data.additive_config_id,
      row_data.additive_type,
      row_data.measurement_method,
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
      row_data.diameter,
      row_data.length,
      row_data.width,
      row_data.total_height,
      row_data.capacity,
      row_data.dimension_unit_id,
      row_data.capacity_unit_id,
      row_data.capture_unit_id,
      row_data.calculation_unit_id,
      row_data.display_unit_id,
      row_data.inventory_unit_id,
      row_data.inventory_percentage,
      row_data.display_volume,
      row_data.inventory_quantity,
      row_data.photo_url,
      row_data.notes
    FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb)) AS row_data(
      id text,
      additive_config_id text,
      additive_type text,
      measurement_method text,
      product_name text,
      brand text,
      uom text,
      requires_photo boolean,
      tank_name text,
      reading_uom text,
      reading_value numeric,
      reading numeric,
      calculated_volume numeric,
      calculated_gallons numeric,
      conversion_table jsonb,
      quantity numeric,
      diameter numeric,
      length numeric,
      width numeric,
      total_height numeric,
      capacity numeric,
      dimension_unit_id text,
      capacity_unit_id text,
      capture_unit_id text,
      calculation_unit_id text,
      display_unit_id text,
      inventory_unit_id text,
      inventory_percentage numeric,
      display_volume numeric,
      inventory_quantity numeric,
      photo_url text,
      notes text
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_plant_additives_config_atomic(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_inventory_additives_atomic(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_plant_additives_config_atomic(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_inventory_additives_atomic(text, jsonb) TO service_role;
