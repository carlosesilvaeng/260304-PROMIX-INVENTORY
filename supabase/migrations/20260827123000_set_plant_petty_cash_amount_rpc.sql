-- Atomically update a plant's Petty Cash configuration and editable inventory snapshots.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_plant_petty_cash_amount(
  p_plant_id text,
  p_amount numeric
)
RETURNS TABLE (
  plant_id text,
  config_id text,
  monthly_amount numeric,
  initial_amount numeric,
  updated_inventory_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_config_id text;
  v_updated_inventory_count bigint;
BEGIN
  IF p_plant_id IS NULL OR btrim(p_plant_id) = '' THEN
    RAISE EXCEPTION 'plant id is required';
  END IF;

  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 9999999999.99 THEN
    RAISE EXCEPTION 'petty cash amount must be between 0 and 9999999999.99';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.plants WHERE id = p_plant_id) THEN
    RAISE EXCEPTION 'plant not found: %', p_plant_id;
  END IF;

  INSERT INTO public.plant_petty_cash_config (
    plant_id,
    monthly_amount,
    initial_amount,
    is_active,
    updated_at
  )
  VALUES (
    p_plant_id,
    round(p_amount, 2),
    round(p_amount, 2),
    true,
    NOW()
  )
  ON CONFLICT (plant_id) DO UPDATE
  SET
    monthly_amount = EXCLUDED.monthly_amount,
    initial_amount = EXCLUDED.initial_amount,
    is_active = true,
    updated_at = NOW()
  RETURNING id INTO v_config_id;

  UPDATE public.plants
  SET
    petty_cash_established = round(p_amount, 2),
    updated_at = NOW()
  WHERE id = p_plant_id;

  UPDATE public.inventory_petty_cash_entries AS entry
  SET
    petty_cash_config_id = v_config_id,
    established_amount = round(p_amount, 2),
    total = COALESCE(entry.receipts, 0) + COALESCE(entry.cash, 0),
    difference = round(p_amount, 2) - (COALESCE(entry.receipts, 0) + COALESCE(entry.cash, 0)),
    amount = round(p_amount, 2),
    updated_at = NOW()
  FROM public.inventory_month AS month
  WHERE entry.inventory_month_id = month.id
    AND month.plant_id = p_plant_id
    AND month.status = 'IN_PROGRESS';

  GET DIAGNOSTICS v_updated_inventory_count = ROW_COUNT;

  RETURN QUERY
  SELECT
    p_plant_id,
    v_config_id,
    round(p_amount, 2),
    round(p_amount, 2),
    v_updated_inventory_count;
END;
$$;

REVOKE ALL ON FUNCTION public.set_plant_petty_cash_amount(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_plant_petty_cash_amount(text, numeric) TO service_role;

COMMIT;
