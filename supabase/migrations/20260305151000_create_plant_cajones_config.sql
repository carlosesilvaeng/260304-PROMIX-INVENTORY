BEGIN;

CREATE TABLE IF NOT EXISTS public.plant_cajones_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plant_id TEXT NOT NULL,
  cajon_name TEXT NOT NULL,
  material TEXT,
  procedencia TEXT,
  box_width_ft NUMERIC(12,2),
  box_height_ft NUMERIC(12,2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plant_id, cajon_name)
);

CREATE INDEX IF NOT EXISTS idx_plant_cajones_plant_id
  ON public.plant_cajones_config (plant_id);

ALTER TABLE public.plant_cajones_config ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_plant_cajones_config_updated_at ON public.plant_cajones_config;
CREATE TRIGGER trg_plant_cajones_config_updated_at
BEFORE UPDATE ON public.plant_cajones_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1) Backfill from legacy JSONB plants.cajones when available
INSERT INTO public.plant_cajones_config (
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
  p.id AS plant_id,
  COALESCE(NULLIF(e.cajon->>'name', ''), 'Cajón ' || e.ord::text) AS cajon_name,
  NULLIF(e.cajon->>'material', '') AS material,
  NULLIF(e.cajon->>'procedencia', '') AS procedencia,
  NULLIF(e.cajon->>'ancho', '')::NUMERIC AS box_width_ft,
  NULLIF(e.cajon->>'alto', '')::NUMERIC AS box_height_ft,
  (e.ord - 1)::INTEGER AS sort_order,
  true AS is_active
FROM public.plants p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.cajones, '[]'::jsonb)) WITH ORDINALITY AS e(cajon, ord)
WHERE jsonb_array_length(COALESCE(p.cajones, '[]'::jsonb)) > 0
ON CONFLICT (plant_id, cajon_name) DO NOTHING;

-- 2) If a plant still has no cajones, seed defaults (3 per plant)
WITH defaults (plant_id, cajon_name, box_width_ft, box_height_ft, sort_order) AS (
  VALUES
    ('CAROLINA',  'Cajón 1', 30::numeric, 12::numeric, 0),
    ('CAROLINA',  'Cajón 2', 25::numeric, 10::numeric, 1),
    ('CAROLINA',  'Cajón 3', 35::numeric, 15::numeric, 2),
    ('CEIBA',     'Cajón 1', 28::numeric, 11::numeric, 0),
    ('CEIBA',     'Cajón 2', 32::numeric, 13::numeric, 1),
    ('CEIBA',     'Cajón 3', 26::numeric, 10::numeric, 2),
    ('GUAYNABO',  'Cajón 1', 30::numeric, 12::numeric, 0),
    ('GUAYNABO',  'Cajón 2', 28::numeric, 11::numeric, 1),
    ('GUAYNABO',  'Cajón 3', 33::numeric, 14::numeric, 2),
    ('GURABO',    'Cajón 1', 31::numeric, 12::numeric, 0),
    ('GURABO',    'Cajón 2', 27::numeric, 11::numeric, 1),
    ('GURABO',    'Cajón 3', 34::numeric, 13::numeric, 2),
    ('VEGA_BAJA', 'Cajón 1', 29::numeric, 11::numeric, 0),
    ('VEGA_BAJA', 'Cajón 2', 32::numeric, 12::numeric, 1),
    ('VEGA_BAJA', 'Cajón 3', 30::numeric, 13::numeric, 2),
    ('HUMACAO',   'Cajón 1', 28::numeric, 11::numeric, 0),
    ('HUMACAO',   'Cajón 2', 31::numeric, 12::numeric, 1),
    ('HUMACAO',   'Cajón 3', 29::numeric, 10::numeric, 2)
),
plants_without_cajones AS (
  SELECT p.id
  FROM public.plants p
  LEFT JOIN public.plant_cajones_config c
    ON c.plant_id = p.id
  GROUP BY p.id
  HAVING COUNT(c.id) = 0
)
INSERT INTO public.plant_cajones_config (
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
  d.plant_id,
  d.cajon_name,
  '' AS material,
  '' AS procedencia,
  d.box_width_ft,
  d.box_height_ft,
  d.sort_order,
  true AS is_active
FROM defaults d
JOIN plants_without_cajones p
  ON p.id = d.plant_id
ON CONFLICT (plant_id, cajon_name) DO NOTHING;

COMMIT;
