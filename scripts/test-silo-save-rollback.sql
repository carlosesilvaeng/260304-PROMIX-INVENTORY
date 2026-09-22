-- Run with: supabase db query --linked --file scripts/test-silo-save-rollback.sql
-- Uses a unique synthetic month and rolls back every test row before returning.
DO $test$
DECLARE
  test_month text := 'codex-silo-test-' || gen_random_uuid()::text;
  test_silo text := 'codex-silo-' || gen_random_uuid()::text;
  saved_row public.inventory_silos_entries%ROWTYPE;
BEGIN
  BEGIN
    PERFORM public.replace_inventory_silos_atomic(test_month, jsonb_build_array(
      jsonb_build_object(
        'silo_config_id', test_silo,
        'silo_name', 'Schema regression test',
        'reading_uom', 'in',
        'reading_value', 42.5,
        'calculated_result', 125,
        'calculated_result_unit_id', 'sack',
        'conversion_table', jsonb_build_object('0', 0, '100', 200),
        'photo_url', 'https://example.invalid/silo-test.jpg'
      )
    ));

    SELECT * INTO STRICT saved_row
    FROM public.inventory_silos_entries
    WHERE inventory_month_id = test_month;

    IF saved_row.reading_uom IS DISTINCT FROM 'in'
      OR saved_row.reading_value IS DISTINCT FROM 42.5
      OR saved_row.calculated_result IS DISTINCT FROM 125
      OR saved_row.calculated_result_unit_id IS DISTINCT FROM 'sack'
      OR saved_row.conversion_table IS DISTINCT FROM '{"0": 0, "100": 200}'::jsonb
      OR saved_row.photo_url IS DISTINCT FROM 'https://example.invalid/silo-test.jpg'
    THEN
      RAISE EXCEPTION 'Silo save did not preserve all fields';
    END IF;

    BEGIN
      PERFORM public.replace_inventory_silos_atomic(test_month, jsonb_build_array(
        jsonb_build_object('silo_config_id', test_silo),
        jsonb_build_object('silo_config_id', test_silo)
      ));
      RAISE EXCEPTION 'Expected duplicate silo save to fail';
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;

    IF (SELECT count(*) FROM public.inventory_silos_entries
        WHERE inventory_month_id = test_month) <> 1 THEN
      RAISE EXCEPTION 'Failed save removed the preceding silo entry';
    END IF;

    RAISE EXCEPTION SQLSTATE 'PT001' USING MESSAGE = 'Rollback synthetic test data';
  EXCEPTION WHEN SQLSTATE 'PT001' THEN
    IF EXISTS (SELECT 1 FROM public.inventory_silos_entries
               WHERE inventory_month_id = test_month) THEN
      RAISE EXCEPTION 'Synthetic silo test data was not rolled back';
    END IF;
  END;
END;
$test$;
