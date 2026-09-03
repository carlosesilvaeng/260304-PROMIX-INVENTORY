-- A plant can hold the same additive in separately identified totes or tanks.
-- Existing unnamed containers keep their previous uniqueness guarantee.
ALTER TABLE public.plant_additives_config
  DROP CONSTRAINT IF EXISTS plant_additives_config_plant_id_additive_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS plant_additives_config_container_key
  ON public.plant_additives_config (plant_id, additive_name, COALESCE(tank_name, ''));
