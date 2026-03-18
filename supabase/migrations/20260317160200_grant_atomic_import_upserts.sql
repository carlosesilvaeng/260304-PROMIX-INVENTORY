DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.upsert_aggregates_import_atomic(text, jsonb, boolean) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.upsert_products_import_atomic(text, jsonb) FROM PUBLIC;

  GRANT EXECUTE ON FUNCTION public.upsert_aggregates_import_atomic(text, jsonb, boolean) TO service_role;
  GRANT EXECUTE ON FUNCTION public.upsert_products_import_atomic(text, jsonb) TO service_role;
END;
$$;
