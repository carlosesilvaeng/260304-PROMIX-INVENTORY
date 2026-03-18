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
      DELETE FROM public.inventory_aggregates_entries
      WHERE inventory_month_id = p_inventory_month_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.inventory_aggregates_entries (
          id,
          inventory_month_id,
          aggregate_config_id,
          aggregate_name,
          material_type,
          location_area,
          measurement_method,
          unit,
          box_width_ft,
          box_height_ft,
          box_length_ft,
          calculated_volume_cy,
          cone_m1,
          cone_m2,
          cone_m3,
          cone_m4,
          cone_m5,
          cone_m6,
          cone_d1,
          cone_d2,
          photo_url,
          notes
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
          id text,
          inventory_month_id text,
          aggregate_config_id text,
          aggregate_name text,
          material_type text,
          location_area text,
          measurement_method text,
          unit text,
          box_width_ft numeric,
          box_height_ft numeric,
          box_length_ft numeric,
          calculated_volume_cy numeric,
          cone_m1 numeric,
          cone_m2 numeric,
          cone_m3 numeric,
          cone_m4 numeric,
          cone_m5 numeric,
          cone_m6 numeric,
          cone_d1 numeric,
          cone_d2 numeric,
          photo_url text,
          notes text
        );
      END IF;

    WHEN 'silos' THEN
      DELETE FROM public.inventory_silos_entries
      WHERE inventory_month_id = p_inventory_month_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.inventory_silos_entries (
          id,
          inventory_month_id,
          silo_config_id,
          silo_name,
          measurement_method,
          allowed_products,
          product_id,
          product_name,
          product_in_silo,
          reading_value,
          reading,
          previous_reading,
          calculated_result_cy,
          calculated_volume,
          photo_url,
          notes
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
          id text,
          inventory_month_id text,
          silo_config_id text,
          silo_name text,
          measurement_method text,
          allowed_products jsonb,
          product_id text,
          product_name text,
          product_in_silo text,
          reading_value numeric,
          reading numeric,
          previous_reading numeric,
          calculated_result_cy numeric,
          calculated_volume numeric,
          photo_url text,
          notes text
        );
      END IF;

    WHEN 'additives' THEN
      DELETE FROM public.inventory_additives_entries
      WHERE inventory_month_id = p_inventory_month_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.inventory_additives_entries (
          id,
          inventory_month_id,
          additive_config_id,
          additive_type,
          product_name,
          brand,
          uom,
          requires_photo,
          tank_name,
          reading_uom,
          reading_value,
          reading,
          calculated_volume,
          calculated_gallons,
          conversion_table,
          quantity,
          photo_url,
          notes
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
          id text,
          inventory_month_id text,
          additive_config_id text,
          additive_type text,
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
          photo_url text,
          notes text
        );
      END IF;

    WHEN 'diesel' THEN
      IF jsonb_array_length(v_rows) > 1 THEN
        RAISE EXCEPTION 'diesel entries support at most one row';
      END IF;

      DELETE FROM public.inventory_diesel_entries
      WHERE inventory_month_id = p_inventory_month_id;

      IF jsonb_array_length(v_rows) = 1 THEN
        INSERT INTO public.inventory_diesel_entries (
          id,
          inventory_month_id,
          diesel_config_id,
          plant_id,
          unit,
          reading_uom,
          reading_inches,
          reading,
          calculated_gallons,
          calibration_table,
          tank_capacity_gallons,
          beginning_inventory,
          purchases_gallons,
          ending_inventory,
          consumption_gallons,
          photo_url,
          notes
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
          id text,
          inventory_month_id text,
          diesel_config_id text,
          plant_id text,
          unit text,
          reading_uom text,
          reading_inches numeric,
          reading numeric,
          calculated_gallons numeric,
          calibration_table jsonb,
          tank_capacity_gallons numeric,
          beginning_inventory numeric,
          purchases_gallons numeric,
          ending_inventory numeric,
          consumption_gallons numeric,
          photo_url text,
          notes text
        );
      END IF;

    WHEN 'products' THEN
      DELETE FROM public.inventory_products_entries
      WHERE inventory_month_id = p_inventory_month_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.inventory_products_entries (
          id,
          inventory_month_id,
          product_config_id,
          producto_config_id,
          product_name,
          category,
          measure_mode,
          uom,
          requires_photo,
          reading_uom,
          reading_value,
          calculated_quantity,
          calibration_table,
          tank_capacity,
          unit_count,
          unit_volume,
          total_volume,
          quantity,
          photo_url,
          notes
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
          id text,
          inventory_month_id text,
          product_config_id text,
          producto_config_id text,
          product_name text,
          category text,
          measure_mode text,
          uom text,
          requires_photo boolean,
          reading_uom text,
          reading_value numeric,
          calculated_quantity numeric,
          calibration_table jsonb,
          tank_capacity numeric,
          unit_count numeric,
          unit_volume numeric,
          total_volume numeric,
          quantity numeric,
          photo_url text,
          notes text
        );
      END IF;

    WHEN 'utilities' THEN
      DELETE FROM public.inventory_utilities_entries
      WHERE inventory_month_id = p_inventory_month_id;

      IF jsonb_array_length(v_rows) > 0 THEN
        INSERT INTO public.inventory_utilities_entries (
          id,
          inventory_month_id,
          utility_config_id,
          utility_meter_config_id,
          meter_name,
          meter_number,
          utility_type,
          uom,
          provider,
          requires_photo,
          previous_reading,
          current_reading,
          reading,
          consumption,
          photo_url,
          notes
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
          id text,
          inventory_month_id text,
          utility_config_id text,
          utility_meter_config_id text,
          meter_name text,
          meter_number text,
          utility_type text,
          uom text,
          provider text,
          requires_photo boolean,
          previous_reading numeric,
          current_reading numeric,
          reading numeric,
          consumption numeric,
          photo_url text,
          notes text
        );
      END IF;

    WHEN 'petty-cash' THEN
      IF jsonb_array_length(v_rows) > 1 THEN
        RAISE EXCEPTION 'petty cash entries support at most one row';
      END IF;

      DELETE FROM public.inventory_petty_cash_entries
      WHERE inventory_month_id = p_inventory_month_id;

      IF jsonb_array_length(v_rows) = 1 THEN
        INSERT INTO public.inventory_petty_cash_entries (
          id,
          inventory_month_id,
          petty_cash_config_id,
          plant_id,
          established_amount,
          currency,
          receipts,
          cash,
          total,
          difference,
          beginning_balance,
          ending_balance,
          amount,
          photo_url,
          notes
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
          id text,
          inventory_month_id text,
          petty_cash_config_id text,
          plant_id text,
          established_amount numeric,
          currency text,
          receipts numeric,
          cash numeric,
          total numeric,
          difference numeric,
          beginning_balance numeric,
          ending_balance numeric,
          amount numeric,
          photo_url text,
          notes text
        );
      END IF;

    ELSE
      RAISE EXCEPTION 'Unsupported inventory section: %', p_section;
  END CASE;
END;
$$;
