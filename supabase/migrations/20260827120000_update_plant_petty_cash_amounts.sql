-- Set the approved Petty Cash fund for every active plant.
-- Existing submitted and approved inventories retain their historical snapshot.

BEGIN;

WITH target_amounts (plant_id, amount) AS (
  VALUES
    ('CAROLINA',  300.00::numeric),
    ('CEIBA',     500.00::numeric),
    ('GUAYNABO',  500.00::numeric),
    ('GURABO',    300.00::numeric),
    ('VEGA_BAJA', 300.00::numeric),
    ('HUMACAO',   200.00::numeric)
)
INSERT INTO public.plant_petty_cash_config (
  plant_id,
  monthly_amount,
  initial_amount,
  is_active,
  updated_at
)
SELECT
  plant_id,
  amount,
  amount,
  true,
  NOW()
FROM target_amounts
ON CONFLICT (plant_id) DO UPDATE
SET
  monthly_amount = EXCLUDED.monthly_amount,
  initial_amount = EXCLUDED.initial_amount,
  is_active = true,
  updated_at = NOW();

WITH target_amounts (plant_id, amount) AS (
  VALUES
    ('CAROLINA',  300.00::numeric),
    ('CEIBA',     500.00::numeric),
    ('GUAYNABO',  500.00::numeric),
    ('GURABO',    300.00::numeric),
    ('VEGA_BAJA', 300.00::numeric),
    ('HUMACAO',   200.00::numeric)
)
UPDATE public.plants AS plant
SET
  petty_cash_established = target.amount,
  updated_at = NOW()
FROM target_amounts AS target
WHERE plant.id = target.plant_id;

WITH target_amounts (plant_id, amount) AS (
  VALUES
    ('CAROLINA',  300.00::numeric),
    ('CEIBA',     500.00::numeric),
    ('GUAYNABO',  500.00::numeric),
    ('GURABO',    300.00::numeric),
    ('VEGA_BAJA', 300.00::numeric),
    ('HUMACAO',   200.00::numeric)
)
UPDATE public.inventory_petty_cash_entries AS entry
SET
  petty_cash_config_id = config.id,
  established_amount = target.amount,
  total = COALESCE(entry.receipts, 0) + COALESCE(entry.cash, 0),
  difference = target.amount - (COALESCE(entry.receipts, 0) + COALESCE(entry.cash, 0)),
  amount = target.amount,
  updated_at = NOW()
FROM public.inventory_month AS month
JOIN target_amounts AS target
  ON target.plant_id = month.plant_id
JOIN public.plant_petty_cash_config AS config
  ON config.plant_id = target.plant_id
WHERE entry.inventory_month_id = month.id
  AND month.status = 'IN_PROGRESS';

COMMIT;
