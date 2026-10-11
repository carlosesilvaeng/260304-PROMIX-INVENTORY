BEGIN;
ALTER TABLE public.inventory_products_entries
  ADD COLUMN no_physical_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN no_physical_stock_by text,
  ADD COLUMN no_physical_stock_user_name text,
  ADD COLUMN no_physical_stock_at timestamptz;
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
          notes,
          no_physical_stock,
          no_physical_stock_by,
          no_physical_stock_user_name,
          no_physical_stock_at
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
          row_data.notes,
          COALESCE(row_data.no_physical_stock, false),
          row_data.no_physical_stock_by,
          row_data.no_physical_stock_user_name,
          row_data.no_physical_stock_at
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
          notes text,
          no_physical_stock boolean,
          no_physical_stock_by text,
          no_physical_stock_user_name text,
          no_physical_stock_at timestamptz
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

CREATE OR REPLACE FUNCTION public.save_inventory_section_guarded(
  p_inventory_month_id text, p_section text, p_rows jsonb, p_actor_id text,
  p_expected_revision bigint, p_operation_id uuid, p_request_hash text, p_summary jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  m public.inventory_month; actor public.users; prior public.inventory_write_receipts;
  current_revision bigint; saved_at timestamptz := clock_timestamp(); result jsonb; saved_rows jsonb;
  child_table text; audit_id text; config_table text; config_key text; row_data jsonb; allowed boolean; old_product public.inventory_products_entries; enriched_rows jsonb;
BEGIN
  SELECT * INTO m FROM public.inventory_month WHERE id = p_inventory_month_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventario inexistente' USING ERRCODE = 'P0002'; END IF;
  actor := public.inventory_authorized_actor(p_actor_id, m.plant_id);
  IF actor.role NOT IN ('plant_manager','operations_manager') THEN
    RAISE EXCEPTION 'No tienes permisos para registrar mediciones' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 OR p_request_hash IS NULL THEN
    RAISE EXCEPTION 'Actualiza la aplicación antes de guardar' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO prior FROM public.inventory_write_receipts
  WHERE inventory_month_id = m.id AND operation_id = p_operation_id;
  IF FOUND THEN
    IF prior.actor_id <> actor.id OR prior.section <> p_section OR prior.request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'La operación ya se utilizó para otros datos' USING ERRCODE = '23505';
    END IF;
    RETURN prior.receipt || jsonb_build_object('already_applied', true);
  END IF;
  IF m.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'El inventario ya no permite modificaciones' USING ERRCODE = '40001'; END IF;
  child_table := CASE p_section WHEN 'aggregates' THEN 'inventory_aggregates_entries'
    WHEN 'silos' THEN 'inventory_silos_entries' WHEN 'additives' THEN 'inventory_additives_entries'
    WHEN 'diesel' THEN 'inventory_diesel_entries' WHEN 'products' THEN 'inventory_products_entries'
    WHEN 'utilities' THEN 'inventory_utilities_entries' WHEN 'petty-cash' THEN 'inventory_petty_cash_entries' END;
  IF child_table IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Sección o registros inválidos' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.inventory_section_state(inventory_month_id,section) VALUES(m.id,p_section) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM public.inventory_section_state WHERE inventory_month_id=m.id AND section=p_section;
  IF current_revision <> p_expected_revision THEN RAISE EXCEPTION 'Otra sesión modificó esta sección. Actualiza los datos antes de guardar.' USING ERRCODE = '40001'; END IF;
  -- Configuration ids and existing entry ids must belong to this plant/month.
  -- This is checked again here, independently of the Edge Function.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE r ? 'inventory_month_id' AND r->>'inventory_month_id' <> m.id) THEN
    RAISE EXCEPTION 'Inventario inconsistente' USING ERRCODE = '22023';
  END IF;
  config_table := CASE p_section WHEN 'aggregates' THEN 'plant_aggregates_config'
    WHEN 'silos' THEN 'plant_silos_config' WHEN 'additives' THEN 'plant_additives_config'
    WHEN 'diesel' THEN 'plant_diesel_config' WHEN 'products' THEN 'plant_products_config'
    WHEN 'utilities' THEN 'plant_utilities_meters_config' WHEN 'petty-cash' THEN 'plant_petty_cash_config' END;
  config_key := CASE p_section WHEN 'aggregates' THEN 'aggregate_config_id' WHEN 'silos' THEN 'silo_config_id'
    WHEN 'additives' THEN 'additive_config_id' WHEN 'diesel' THEN 'diesel_config_id' WHEN 'products' THEN 'product_config_id'
    WHEN 'utilities' THEN 'utility_meter_config_id' WHEN 'petty-cash' THEN 'petty_cash_config_id' END;
  IF p_section='aggregates' AND NOT EXISTS(SELECT 1 FROM public.plant_aggregates_config WHERE plant_id=m.plant_id AND is_active) THEN config_table := 'plant_cajones_config'; END IF;
  FOR row_data IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND plant_id=$2 AND is_active)',config_table)
      INTO allowed USING row_data->>config_key,m.plant_id;
    IF NOT allowed THEN RAISE EXCEPTION 'Configuración ajena o inactiva' USING ERRCODE='42501'; END IF;
    IF row_data->>'id' IS NOT NULL THEN
      EXECUTE format('SELECT NOT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND inventory_month_id<>$2)',child_table)
        INTO allowed USING row_data->>'id',m.id;
      IF NOT allowed THEN RAISE EXCEPTION 'Registro ajeno al inventario' USING ERRCODE='42501'; END IF;
    END IF;
  END LOOP;
  -- Stamp declarations from the authenticated actor and database clock, never the client.
  IF p_section='products' THEN
    enriched_rows := '[]'::jsonb;
    FOR row_data IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
      SELECT * INTO old_product FROM public.inventory_products_entries
        WHERE inventory_month_id=m.id AND product_config_id=row_data->>'product_config_id';
      IF COALESCE((row_data->>'no_physical_stock')::boolean,false) THEN
        row_data := row_data || jsonb_build_object('no_physical_stock_by',
          CASE WHEN old_product.no_physical_stock THEN old_product.no_physical_stock_by ELSE actor.id END,
          'no_physical_stock_user_name',CASE WHEN old_product.no_physical_stock THEN old_product.no_physical_stock_user_name ELSE actor.name END,
          'no_physical_stock_at',CASE WHEN old_product.no_physical_stock THEN old_product.no_physical_stock_at ELSE saved_at END,
          'quantity',0,'reading_value',NULL,'photo_url',NULL,
          'unit_count',CASE WHEN row_data->>'measure_mode' IN ('DRUM','PAIL') THEN 0 ELSE NULL END,
          'total_volume',CASE WHEN row_data->>'measure_mode' IN ('DRUM','PAIL') THEN 0 ELSE NULL END,
          'calculated_quantity',CASE WHEN row_data->>'measure_mode'='TANK_READING' THEN 0 ELSE NULL END);
      ELSE
        row_data := row_data || jsonb_build_object('no_physical_stock',false,'no_physical_stock_by',NULL,
          'no_physical_stock_user_name',NULL,'no_physical_stock_at',NULL);
      END IF;
      IF COALESCE(old_product.no_physical_stock,false) IS DISTINCT FROM (row_data->>'no_physical_stock')::boolean THEN
        INSERT INTO public.audit_logs(user_id,user_email,user_name,action,plant_id,inventory_month_id,timestamp,details)
        VALUES(actor.id,actor.email,actor.name,
          CASE WHEN (row_data->>'no_physical_stock')::boolean THEN 'PRODUCT_NO_PHYSICAL_STOCK' ELSE 'PRODUCT_PHYSICAL_STOCK_RESTORED' END,
          m.plant_id,m.id,saved_at,jsonb_build_object('section','products','year_month',m.year_month,
          'product_config_id',row_data->>'product_config_id','notes',row_data->>'product_name',
          'no_physical_stock',(row_data->>'no_physical_stock')::boolean,'operation_id',p_operation_id,'origin','server'));
      END IF;
      enriched_rows := enriched_rows || jsonb_build_array(row_data);
    END LOOP;
    p_rows := enriched_rows;
  END IF;
  IF p_section='silos' THEN PERFORM public.replace_inventory_silos_atomic(m.id,p_rows);
  ELSIF p_section='additives' THEN PERFORM public.replace_inventory_additives_atomic(m.id,p_rows);
  ELSE PERFORM public.replace_inventory_section_rows_atomic(p_section,m.id,p_rows); END IF;
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.id), ''[]''::jsonb) FROM public.%I e WHERE inventory_month_id=$1',child_table) INTO saved_rows USING m.id;
  UPDATE public.inventory_section_state SET revision=current_revision+1 WHERE inventory_month_id=m.id AND section=p_section;
  UPDATE public.inventory_month SET write_revision=write_revision+1,updated_at=saved_at WHERE id=m.id;
  INSERT INTO public.audit_logs(user_id,user_email,user_name,action,plant_id,inventory_month_id,timestamp,details)
  VALUES(actor.id,actor.email,actor.name,'SECTION_SAVED',m.plant_id,m.id,saved_at,
    p_summary || jsonb_build_object('section',p_section,'year_month',m.year_month,'revision',current_revision+1,'operation_id',p_operation_id,'origin','server'))
  RETURNING id INTO audit_id;
  result := jsonb_build_object('revision',current_revision+1,'saved_at',saved_at,'operation_id',p_operation_id,'audit_id',audit_id,
    'summary',p_summary,'data',CASE WHEN p_section IN ('diesel','petty-cash') THEN saved_rows->0 ELSE saved_rows END);
  INSERT INTO public.inventory_write_receipts VALUES(m.id,p_operation_id,actor.id,p_section,p_request_hash,result);
  RETURN result;
END $$;


-- Preserve the optional admin capture capability if this older migration is
-- deployed after the capability migration. Standalone product deployments work too.
DO $$
BEGIN
 IF to_regprocedure('public.inventory_can_capture(public.users,text)') IS NOT NULL THEN
  EXECUTE replace(pg_get_functiondef('public.save_inventory_section_guarded(text,text,jsonb,text,bigint,uuid,text,jsonb)'::regprocedure),
   'actor.role NOT IN (''plant_manager'',''operations_manager'')',
   'NOT public.inventory_can_capture(actor,m.plant_id)');
 END IF;
END $$;

COMMIT;
