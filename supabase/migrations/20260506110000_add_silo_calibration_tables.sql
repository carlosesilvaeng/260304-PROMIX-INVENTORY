ALTER TABLE public.plant_silos_config
  ADD COLUMN IF NOT EXISTS reading_uom TEXT,
  ADD COLUMN IF NOT EXISTS conversion_table JSONB;
