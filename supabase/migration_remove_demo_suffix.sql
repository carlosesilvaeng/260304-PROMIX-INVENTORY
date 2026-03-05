-- ============================================================================
-- MIGRATION: REMOVE LEGACY "_02205af0" TABLE SUFFIX
-- ============================================================================
-- Run this in Supabase SQL Editor once, before deploying the updated Edge Function.
-- It preserves all existing data by renaming tables in-place.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.users_02205af0') IS NOT NULL AND to_regclass('public.users') IS NULL THEN
    ALTER TABLE public.users_02205af0 RENAME TO users;
  END IF;

  IF to_regclass('public.plants_02205af0') IS NOT NULL AND to_regclass('public.plants') IS NULL THEN
    ALTER TABLE public.plants_02205af0 RENAME TO plants;
  END IF;

  IF to_regclass('public.audit_logs_02205af0') IS NOT NULL AND to_regclass('public.audit_logs') IS NULL THEN
    ALTER TABLE public.audit_logs_02205af0 RENAME TO audit_logs;
  END IF;

  IF to_regclass('public.materiales_catalog_02205af0') IS NOT NULL AND to_regclass('public.materiales_catalog') IS NULL THEN
    ALTER TABLE public.materiales_catalog_02205af0 RENAME TO materiales_catalog;
  END IF;

  IF to_regclass('public.procedencias_catalog_02205af0') IS NOT NULL AND to_regclass('public.procedencias_catalog') IS NULL THEN
    ALTER TABLE public.procedencias_catalog_02205af0 RENAME TO procedencias_catalog;
  END IF;

  IF to_regclass('public.calibration_curves_02205af0') IS NOT NULL AND to_regclass('public.calibration_curves') IS NULL THEN
    ALTER TABLE public.calibration_curves_02205af0 RENAME TO calibration_curves;
  END IF;

  IF to_regclass('public.plant_aggregates_config_02205af0') IS NOT NULL AND to_regclass('public.plant_aggregates_config') IS NULL THEN
    ALTER TABLE public.plant_aggregates_config_02205af0 RENAME TO plant_aggregates_config;
  END IF;

  IF to_regclass('public.plant_silos_config_02205af0') IS NOT NULL AND to_regclass('public.plant_silos_config') IS NULL THEN
    ALTER TABLE public.plant_silos_config_02205af0 RENAME TO plant_silos_config;
  END IF;

  IF to_regclass('public.silo_allowed_products_02205af0') IS NOT NULL AND to_regclass('public.silo_allowed_products') IS NULL THEN
    ALTER TABLE public.silo_allowed_products_02205af0 RENAME TO silo_allowed_products;
  END IF;

  IF to_regclass('public.plant_additives_config_02205af0') IS NOT NULL AND to_regclass('public.plant_additives_config') IS NULL THEN
    ALTER TABLE public.plant_additives_config_02205af0 RENAME TO plant_additives_config;
  END IF;

  IF to_regclass('public.plant_diesel_config_02205af0') IS NOT NULL AND to_regclass('public.plant_diesel_config') IS NULL THEN
    ALTER TABLE public.plant_diesel_config_02205af0 RENAME TO plant_diesel_config;
  END IF;

  IF to_regclass('public.plant_products_config_02205af0') IS NOT NULL AND to_regclass('public.plant_products_config') IS NULL THEN
    ALTER TABLE public.plant_products_config_02205af0 RENAME TO plant_products_config;
  END IF;

  IF to_regclass('public.plant_utilities_meters_config_02205af0') IS NOT NULL AND to_regclass('public.plant_utilities_meters_config') IS NULL THEN
    ALTER TABLE public.plant_utilities_meters_config_02205af0 RENAME TO plant_utilities_meters_config;
  END IF;

  IF to_regclass('public.plant_petty_cash_config_02205af0') IS NOT NULL AND to_regclass('public.plant_petty_cash_config') IS NULL THEN
    ALTER TABLE public.plant_petty_cash_config_02205af0 RENAME TO plant_petty_cash_config;
  END IF;

  IF to_regclass('public.inventory_month_02205af0') IS NOT NULL AND to_regclass('public.inventory_month') IS NULL THEN
    ALTER TABLE public.inventory_month_02205af0 RENAME TO inventory_month;
  END IF;

  IF to_regclass('public.inventory_aggregates_entries_02205af0') IS NOT NULL AND to_regclass('public.inventory_aggregates_entries') IS NULL THEN
    ALTER TABLE public.inventory_aggregates_entries_02205af0 RENAME TO inventory_aggregates_entries;
  END IF;

  IF to_regclass('public.inventory_silos_entries_02205af0') IS NOT NULL AND to_regclass('public.inventory_silos_entries') IS NULL THEN
    ALTER TABLE public.inventory_silos_entries_02205af0 RENAME TO inventory_silos_entries;
  END IF;

  IF to_regclass('public.inventory_additives_entries_02205af0') IS NOT NULL AND to_regclass('public.inventory_additives_entries') IS NULL THEN
    ALTER TABLE public.inventory_additives_entries_02205af0 RENAME TO inventory_additives_entries;
  END IF;

  IF to_regclass('public.inventory_diesel_entries_02205af0') IS NOT NULL AND to_regclass('public.inventory_diesel_entries') IS NULL THEN
    ALTER TABLE public.inventory_diesel_entries_02205af0 RENAME TO inventory_diesel_entries;
  END IF;

  IF to_regclass('public.inventory_products_entries_02205af0') IS NOT NULL AND to_regclass('public.inventory_products_entries') IS NULL THEN
    ALTER TABLE public.inventory_products_entries_02205af0 RENAME TO inventory_products_entries;
  END IF;

  IF to_regclass('public.inventory_utilities_entries_02205af0') IS NOT NULL AND to_regclass('public.inventory_utilities_entries') IS NULL THEN
    ALTER TABLE public.inventory_utilities_entries_02205af0 RENAME TO inventory_utilities_entries;
  END IF;

  IF to_regclass('public.inventory_petty_cash_entries_02205af0') IS NOT NULL AND to_regclass('public.inventory_petty_cash_entries') IS NULL THEN
    ALTER TABLE public.inventory_petty_cash_entries_02205af0 RENAME TO inventory_petty_cash_entries;
  END IF;

  IF to_regclass('public.kv_store_02205af0') IS NOT NULL AND to_regclass('public.kv_store') IS NULL THEN
    ALTER TABLE public.kv_store_02205af0 RENAME TO kv_store;
  END IF;
END $$;

-- Keep existing module configuration key under the new name.
UPDATE public.kv_store
SET key = 'module_config'
WHERE key = 'module_config_02205af0';

COMMIT;
