-- ============================================================================
-- PROMIX PLANT INVENTORY SYSTEM - RLS BASELINE
-- CREADO POR CODEX 26/03/05 06:01
-- ============================================================================
-- Activa RLS en tablas de negocio y deja acceso por defecto denegado para
-- anon/authenticated en schema public. El acceso de la app ocurre por Edge
-- Functions con service_role. Incluye politicas de Storage para inventory-photos.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Enable RLS on all app tables (public schema)
-- --------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedencias_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kv_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibration_curves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_aggregates_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_silos_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.silo_allowed_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_additives_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_diesel_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_products_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_utilities_meters_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_petty_cash_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_month ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_aggregates_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_silos_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_additives_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_diesel_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_utilities_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_petty_cash_entries ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- Default deny direct table access from anon/authenticated in public schema
-- --------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- --------------------------------------------------------------------------
-- Storage policies for inventory photos (UI uploads with authenticated JWT)
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'inventory_photos_select_authenticated'
  ) THEN
    CREATE POLICY inventory_photos_select_authenticated
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'inventory-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'inventory_photos_insert_authenticated'
  ) THEN
    CREATE POLICY inventory_photos_insert_authenticated
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'inventory-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'inventory_photos_update_authenticated'
  ) THEN
    CREATE POLICY inventory_photos_update_authenticated
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'inventory-photos')
    WITH CHECK (bucket_id = 'inventory-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'inventory_photos_delete_authenticated'
  ) THEN
    CREATE POLICY inventory_photos_delete_authenticated
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'inventory-photos');
  END IF;
END
$$;

COMMIT;
