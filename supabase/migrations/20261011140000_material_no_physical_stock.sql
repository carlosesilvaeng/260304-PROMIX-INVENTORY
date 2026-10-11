BEGIN;
ALTER TABLE public.inventory_aggregates_entries
  ADD COLUMN no_physical_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN no_physical_stock_by text,
  ADD COLUMN no_physical_stock_user_name text,
  ADD COLUMN no_physical_stock_at timestamptz;
ALTER TABLE public.inventory_silos_entries
  ADD COLUMN no_physical_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN no_physical_stock_by text,
  ADD COLUMN no_physical_stock_user_name text,
  ADD COLUMN no_physical_stock_at timestamptz;
ALTER TABLE public.inventory_additives_entries
  ADD COLUMN no_physical_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN no_physical_stock_by text,
  ADD COLUMN no_physical_stock_user_name text,
  ADD COLUMN no_physical_stock_at timestamptz;

-- Amend the installed guarded writer so existing authorization and product
-- declarations are preserved. All changes and audit events remain one transaction.
DO $migration$
DECLARE definition text; before_anchor text := '  IF p_section=''silos'' THEN PERFORM';
  after_anchor text := '  EXECUTE format(''SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.id)';
BEGIN
  definition := pg_get_functiondef('public.save_inventory_section_guarded(text,text,jsonb,text,bigint,uuid,text,jsonb)'::regprocedure);
  IF position(before_anchor IN definition)=0 OR position(after_anchor IN definition)=0 THEN
    RAISE EXCEPTION 'Guarded inventory writer anchors not found';
  END IF;
  definition := replace(definition,before_anchor,$block$
  IF p_section IN ('aggregates','silos','additives') THEN
    DECLARE prior_stock jsonb; next_rows jsonb := '[]'::jsonb; absent boolean; item_label text;
    BEGIN
      FOR row_data IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
        EXECUTE format('SELECT to_jsonb(e) FROM public.%I e WHERE inventory_month_id=$1 AND %I=$2',child_table,config_key)
          INTO prior_stock USING m.id,row_data->>config_key;
        absent := COALESCE((row_data->>'no_physical_stock')::boolean,false);
        row_data := row_data || jsonb_build_object('no_physical_stock',absent,
          'no_physical_stock_by',CASE WHEN NOT absent THEN NULL WHEN COALESCE((prior_stock->>'no_physical_stock')::boolean,false) THEN prior_stock->>'no_physical_stock_by' ELSE actor.id END,
          'no_physical_stock_user_name',CASE WHEN NOT absent THEN NULL WHEN COALESCE((prior_stock->>'no_physical_stock')::boolean,false) THEN prior_stock->>'no_physical_stock_user_name' ELSE actor.name END,
          'no_physical_stock_at',CASE WHEN NOT absent THEN NULL WHEN COALESCE((prior_stock->>'no_physical_stock')::boolean,false) THEN prior_stock->>'no_physical_stock_at' ELSE saved_at::text END);
        IF absent THEN
          row_data := row_data || jsonb_build_object('photo_url',NULL,'reading_value',NULL,'reading',NULL);
          IF p_section='aggregates' THEN
            row_data := row_data || jsonb_build_object('box_height_ft',NULL,'box_length_ft',NULL,
              'cone_m1',NULL,'cone_m2',NULL,'cone_m3',NULL,'cone_m4',NULL,'cone_m5',NULL,'cone_m6',NULL,'cone_d1',NULL,'cone_d2',NULL,'calculated_volume_cy',0);
          ELSIF p_section='silos' THEN
            row_data := row_data || jsonb_build_object('product_name',NULL,'product_in_silo',NULL,
              'calculated_result',0,'calculated_result_cy',0,'calculated_volume',0,'calculated_volume_ft3',0,
              'presentation_lbs',0,'presentation_sacks',0,'presentation_metric_tons',0,'calculation_metadata',jsonb_build_object('no_physical_stock',true));
          ELSE
            row_data := row_data || jsonb_build_object('quantity',CASE WHEN row_data->>'measurement_method'='MANUAL' THEN 0 ELSE NULL END,
              'calculated_volume',0,'calculated_gallons',CASE WHEN row_data->>'calculation_unit_id'='gal_us' THEN 0 ELSE NULL END,
              'display_volume',0,'inventory_quantity',0,'inventory_percentage',0);
          END IF;
        END IF;
        IF absent IS DISTINCT FROM COALESCE((prior_stock->>'no_physical_stock')::boolean,false) THEN
          item_label := COALESCE(row_data->>'aggregate_name',row_data->>'silo_name',row_data->>'tank_name',row_data->>'product_name',row_data->>config_key);
          INSERT INTO public.audit_logs(user_id,user_email,user_name,action,plant_id,inventory_month_id,timestamp,details)
          VALUES(actor.id,actor.email,actor.name,CASE WHEN absent THEN 'INVENTORY_NO_PHYSICAL_STOCK' ELSE 'INVENTORY_PHYSICAL_STOCK_RESTORED' END,
            m.plant_id,m.id,saved_at,jsonb_build_object('section',p_section,'year_month',m.year_month,'config_id',row_data->>config_key,
            'notes',item_label,'no_physical_stock',absent,'operation_id',p_operation_id,'origin','server'));
        END IF;
        next_rows := next_rows || jsonb_build_array(row_data);
      END LOOP;
      p_rows := next_rows;
    END;
  END IF;
$block$ || before_anchor);
  definition := replace(definition,after_anchor,$block$
  IF p_section IN ('aggregates','silos','additives') THEN
    -- The atomic capture functions retain their current field lists. Stamp the
    -- new columns before reading the saved rows for the receipt and snapshot.
    EXECUTE format('UPDATE public.%I e SET no_physical_stock=(r->>''no_physical_stock'')::boolean,
      no_physical_stock_by=r->>''no_physical_stock_by'',no_physical_stock_user_name=r->>''no_physical_stock_user_name'',
      no_physical_stock_at=(r->>''no_physical_stock_at'')::timestamptz
      FROM jsonb_array_elements($1) r WHERE e.inventory_month_id=$2 AND e.%I=r->>%L',child_table,config_key,config_key)
      USING p_rows,m.id;
  END IF;
$block$ || after_anchor);
  EXECUTE definition;
END $migration$;
COMMIT;
