CREATE TABLE IF NOT EXISTS public.additives_catalog (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre TEXT NOT NULL UNIQUE,
  marca TEXT,
  uom TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.calibration_curves
  ADD COLUMN IF NOT EXISTS reading_uom TEXT;

ALTER TABLE public.plant_additives_config
  ADD COLUMN IF NOT EXISTS catalog_additive_id TEXT;

CREATE INDEX IF NOT EXISTS idx_additives_catalog_active
  ON public.additives_catalog(is_active, sort_order);

ALTER TABLE public.additives_catalog ENABLE ROW LEVEL SECURITY;
