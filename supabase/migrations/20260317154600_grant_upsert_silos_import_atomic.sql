DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.upsert_silos_import_atomic(text, jsonb, jsonb) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.upsert_silos_import_atomic(text, jsonb, jsonb) TO service_role;
END;
$$;
