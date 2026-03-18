DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.replace_plant_config_rows_atomic(text, text, jsonb) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.replace_plant_silos_config_atomic(text, jsonb, jsonb) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.replace_inventory_section_rows_atomic(text, text, jsonb) FROM PUBLIC;

  GRANT EXECUTE ON FUNCTION public.replace_plant_config_rows_atomic(text, text, jsonb) TO service_role;
  GRANT EXECUTE ON FUNCTION public.replace_plant_silos_config_atomic(text, jsonb, jsonb) TO service_role;
  GRANT EXECUTE ON FUNCTION public.replace_inventory_section_rows_atomic(text, text, jsonb) TO service_role;
END;
$$;
