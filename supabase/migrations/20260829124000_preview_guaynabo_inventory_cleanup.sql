DO $$
DECLARE
  v_ids text[];
  v_months integer;
  v_aggregates integer;
  v_silos integer;
  v_additives integer;
  v_diesel integer;
  v_products integer;
  v_utilities integer;
  v_petty_cash integer;
  v_photos integer;
BEGIN
  SELECT COALESCE(array_agg(id ORDER BY year_month, id), ARRAY[]::text[]), count(*)
    INTO v_ids, v_months
  FROM public.inventory_month
  WHERE plant_id = 'GUAYNABO';

  SELECT count(*), count(*) FILTER (WHERE NULLIF(photo_url, '') IS NOT NULL)
    INTO v_aggregates, v_photos
  FROM public.inventory_aggregates_entries
  WHERE inventory_month_id = ANY(v_ids);

  SELECT count(*), v_photos + count(*) FILTER (WHERE NULLIF(photo_url, '') IS NOT NULL)
    INTO v_silos, v_photos
  FROM public.inventory_silos_entries
  WHERE inventory_month_id = ANY(v_ids);

  SELECT count(*), v_photos + count(*) FILTER (WHERE NULLIF(photo_url, '') IS NOT NULL)
    INTO v_additives, v_photos
  FROM public.inventory_additives_entries
  WHERE inventory_month_id = ANY(v_ids);

  SELECT count(*), v_photos + count(*) FILTER (WHERE NULLIF(photo_url, '') IS NOT NULL)
    INTO v_diesel, v_photos
  FROM public.inventory_diesel_entries
  WHERE inventory_month_id = ANY(v_ids);

  SELECT count(*), v_photos + count(*) FILTER (WHERE NULLIF(photo_url, '') IS NOT NULL)
    INTO v_products, v_photos
  FROM public.inventory_products_entries
  WHERE inventory_month_id = ANY(v_ids);

  SELECT count(*), v_photos + count(*) FILTER (WHERE NULLIF(photo_url, '') IS NOT NULL)
    INTO v_utilities, v_photos
  FROM public.inventory_utilities_entries
  WHERE inventory_month_id = ANY(v_ids);

  SELECT count(*), v_photos + count(*) FILTER (WHERE NULLIF(photo_url, '') IS NOT NULL)
    INTO v_petty_cash, v_photos
  FROM public.inventory_petty_cash_entries
  WHERE inventory_month_id = ANY(v_ids);

  RAISE NOTICE 'GUAYNABO cleanup preview inventory_ids=%', v_ids;
  RAISE NOTICE 'GUAYNABO cleanup preview counts inventory_month=%, aggregates=%, silos=%, additives=%, diesel=%, products=%, utilities=%, petty_cash=%, photos=%',
    v_months, v_aggregates, v_silos, v_additives, v_diesel, v_products, v_utilities, v_petty_cash, v_photos;
END $$;
