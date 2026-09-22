-- The silo save RPC has persisted these values since 2026-07-08, but the
-- inventory table never received the corresponding columns.
ALTER TABLE public.inventory_silos_entries
  ADD COLUMN IF NOT EXISTS reading_uom text,
  ADD COLUMN IF NOT EXISTS conversion_table jsonb;
