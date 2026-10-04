-- Synthetic tests only. Run via test-inventory-guard-db.py against its temporary local DB.
BEGIN;
INSERT INTO plants(id,name,code) VALUES('PHASE1_A','A','PHASE1_A'),('PHASE1_B','B','PHASE1_B');
INSERT INTO users(id,name,email,role,assigned_plants,is_active) VALUES
 ('phase1_operator','Operator','phase1-operator@example.invalid','plant_manager',ARRAY['PHASE1_A'],true),
 ('phase1_admin','Admin','phase1-admin@example.invalid','admin','{}',true),
 ('phase1_inactive','Inactive','phase1-inactive@example.invalid','plant_manager',ARRAY['PHASE1_A'],false);
INSERT INTO plant_products_config(id,plant_id,product_name,unit,measure_mode) VALUES('phase1_product','PHASE1_A','P','unit','COUNT'),('phase1_other','PHASE1_B','Other','unit','COUNT');
SELECT start_inventory_guarded('PHASE1_A','2026-09','phase1_operator');
DO $$
DECLARE m text; first jsonb; retry jsonb; op uuid := gen_random_uuid(); before_revision bigint; snapshot jsonb;
BEGIN
 SELECT id INTO m FROM inventory_month WHERE plant_id='PHASE1_A' AND year_month='2026-09';
 PERFORM start_inventory_guarded('PHASE1_A','2026-09','phase1_operator');
 IF (SELECT count(*) FROM audit_logs WHERE inventory_month_id=m AND action='INVENTORY_STARTED') <> 1 THEN RAISE EXCEPTION 'duplicate start event'; END IF;
 PERFORM record_inventory_capture_started(m,'phase1_operator','products','2026-10-03T00:00:00Z');
 PERFORM record_inventory_capture_started(m,'phase1_operator','products','2026-10-03T00:00:01Z');
 IF (SELECT count(*) FROM audit_logs WHERE inventory_month_id=m AND action='INVENTORY_CAPTURE_STARTED')<>1 THEN RAISE EXCEPTION 'duplicate activity'; END IF;
 first := save_inventory_section_guarded(m,'products','[{"product_config_id":"phase1_product","quantity":null}]','phase1_operator',0,op,'first','{"captured_count":0,"complete_count":0,"pending_count":1}');
 IF first->>'revision' <> '1' OR first->'data'->0->'quantity' <> 'null'::jsonb THEN RAISE EXCEPTION 'partial draft was not preserved'; END IF;
 retry := save_inventory_section_guarded(m,'products','[{"product_config_id":"phase1_product","quantity":null}]','phase1_operator',0,op,'first','{}');
 IF retry->>'already_applied' <> 'true' OR retry->'data' <> first->'data' THEN RAISE EXCEPTION 'retry changed committed data'; END IF;
 IF (SELECT count(*) FROM audit_logs WHERE inventory_month_id=m AND action='SECTION_SAVED')<>1 THEN RAISE EXCEPTION 'retry duplicated audit'; END IF;
 IF EXISTS(SELECT 1 FROM audit_logs WHERE inventory_month_id=m AND plant_id IS NULL) THEN RAISE EXCEPTION 'missing plant'; END IF;
 BEGIN
  PERFORM save_inventory_section_guarded(m,'products','[]','phase1_operator',0,gen_random_uuid(),'stale','{}');
  RAISE EXCEPTION 'stale write accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM save_inventory_section_guarded(m,'products','[]','phase1_operator',1,op,'different','{}');
  RAISE EXCEPTION 'operation reused';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM save_inventory_section_guarded(m,'products','[]','phase1_admin',1,gen_random_uuid(),'admin','{}');
  RAISE EXCEPTION 'admin write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM save_inventory_section_guarded(m,'products','[]','phase1_inactive',1,gen_random_uuid(),'inactive','{}');
  RAISE EXCEPTION 'inactive write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM save_inventory_section_guarded(m,'products','[{"product_config_id":"phase1_other","quantity":0}]','phase1_operator',1,gen_random_uuid(),'foreign','{}');
  RAISE EXCEPTION 'foreign config accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 snapshot := get_inventory_snapshot(m);
 IF snapshot->'section_revisions'->>'products'<>'1' OR jsonb_array_length(snapshot->'productos')<>1 THEN RAISE EXCEPTION 'snapshot inconsistent'; END IF;
 SELECT write_revision INTO before_revision FROM inventory_month WHERE id=m;
 PERFORM apply_inventory_workflow_guarded(m,'phase1_operator','submit',before_revision,NULL);
 BEGIN
  PERFORM save_inventory_section_guarded(m,'products','[]','phase1_operator',1,gen_random_uuid(),'locked','{}');
  RAISE EXCEPTION 'submitted write accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 SELECT write_revision INTO before_revision FROM inventory_month WHERE id=m;
 BEGIN
  PERFORM apply_inventory_workflow_guarded(m,'phase1_operator','approve',before_revision,NULL);
  RAISE EXCEPTION 'operator approval accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM apply_inventory_workflow_guarded(m,'phase1_admin','approve',before_revision,NULL);
 BEGIN
  PERFORM save_inventory_section_guarded(m,'products','[]','phase1_operator',1,gen_random_uuid(),'approved','{}');
  RAISE EXCEPTION 'approved write accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
-- An audit failure must roll back the entry, revision and receipt together.
SELECT start_inventory_guarded('PHASE1_A','2026-10','phase1_operator');
CREATE FUNCTION phase1_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('SECTION_SAVED','INVENTORY_SUBMITTED') THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER phase1_fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION phase1_fail_audit();
DO $$
DECLARE m text;
BEGIN
 SELECT id INTO m FROM inventory_month WHERE plant_id='PHASE1_A' AND year_month='2026-10';
 BEGIN
  PERFORM save_inventory_section_guarded(m,'products','[{"product_config_id":"phase1_product","quantity":0}]','phase1_operator',0,gen_random_uuid(),'audit-fails','{}');
  RAISE EXCEPTION 'audit failure was ignored';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'synthetic audit failure' THEN RAISE; END IF;
 END;
 IF EXISTS(SELECT 1 FROM inventory_products_entries WHERE inventory_month_id=m) OR EXISTS(SELECT 1 FROM inventory_write_receipts WHERE inventory_month_id=m)
  OR (SELECT write_revision FROM inventory_month WHERE id=m)<>0 THEN RAISE EXCEPTION 'audit failure left partial changes'; END IF;
 BEGIN
  PERFORM apply_inventory_workflow_guarded(m,'phase1_operator','submit',0,NULL);
  RAISE EXCEPTION 'workflow audit failure was ignored';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'synthetic audit failure' THEN RAISE; END IF;
 END;
 IF (SELECT status FROM inventory_month WHERE id=m)<>'IN_PROGRESS' OR (SELECT write_revision FROM inventory_month WHERE id=m)<>0 THEN
  RAISE EXCEPTION 'workflow audit failure left partial changes';
 END IF;
 IF has_function_privilege('anon','save_inventory_section_guarded(text,text,jsonb,text,bigint,uuid,text,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','apply_inventory_workflow_guarded(text,text,text,bigint,text)','EXECUTE') THEN
  RAISE EXCEPTION 'guarded service functions exposed to browser roles';
 END IF;
END $$;
DROP TRIGGER phase1_fail_audit ON audit_logs;
-- Validate partial persistence through each real section replacement function.
INSERT INTO plant_aggregates_config(id,plant_id,aggregate_name,measurement_method) VALUES('partial_box','PHASE1_A','Box','BOX');
INSERT INTO plant_silos_config(id,plant_id,silo_name,measurement_method) VALUES('partial_silo','PHASE1_A','Silo','SILO_LEVEL');
INSERT INTO plant_additives_config(id,plant_id,additive_name,measurement_method) VALUES('partial_additive','PHASE1_A','Additive','MANUAL');
INSERT INTO plant_diesel_config(id,plant_id,measurement_method) VALUES('partial_diesel','PHASE1_A','CURVE');
INSERT INTO plant_utilities_meters_config(id,plant_id,meter_name,meter_type,unit) VALUES('partial_meter','PHASE1_A','Meter','utility','kWh');
INSERT INTO plant_petty_cash_config(id,plant_id,monthly_amount) VALUES('partial_cash','PHASE1_A',100);
DO $$
DECLARE m text; section_name text; rows_data jsonb; reply jsonb; snap jsonb;
BEGIN
 SELECT id INTO m FROM inventory_month WHERE plant_id='PHASE1_A' AND year_month='2026-10';
 FOR section_name, rows_data IN SELECT * FROM (VALUES
  ('aggregates','[{"aggregate_config_id":"partial_box","measurement_method":"BOX","box_length_ft":null,"calculated_volume_cy":null}]'::jsonb),
  ('silos','[{"silo_config_id":"partial_silo","reading_value":null,"calculated_result_cy":null}]'::jsonb),
  ('additives','[{"additive_config_id":"partial_additive","quantity":null,"calculated_volume":null}]'::jsonb),
  ('diesel','[{"diesel_config_id":"partial_diesel","purchases_gallons":null,"reading_inches":null,"consumption_gallons":null}]'::jsonb),
  ('products','[{"product_config_id":"phase1_product","quantity":null}]'::jsonb),
  ('utilities','[{"utility_meter_config_id":"partial_meter","current_reading":null,"consumption":null,"requires_photo":true}]'::jsonb),
  ('petty-cash','[{"petty_cash_config_id":"partial_cash","receipts":0,"cash":null,"total":null}]'::jsonb)
 ) AS fixtures(section,rows) LOOP
  reply := save_inventory_section_guarded(m,section_name,rows_data,'phase1_operator',0,gen_random_uuid(),'partial-'||section_name,'{}');
  IF reply->>'revision'<>'1' THEN RAISE EXCEPTION 'partial section revision failed: %',section_name; END IF;
 END LOOP;
 snap := get_inventory_snapshot(m);
 IF snap->'agregados'->0->'box_length_ft'<>'null'::jsonb OR snap->'silos'->0->'reading_value'<>'null'::jsonb
  OR snap->'aditivos'->0->'quantity'<>'null'::jsonb OR snap->'diesel'->'purchases_gallons'<>'null'::jsonb
  OR snap->'productos'->0->'quantity'<>'null'::jsonb OR snap->'utilities'->0->'current_reading'<>'null'::jsonb
  OR snap->'pettyCash'->'cash'<>'null'::jsonb OR (snap->'pettyCash'->>'receipts')::numeric<>0 THEN
  RAISE EXCEPTION 'partial snapshot replaced missing inputs or explicit zero';
 END IF;
END $$;
SELECT 'guarded transactions, partial drafts, permissions, idempotency, snapshot and audit rollback: passed' AS result;
ROLLBACK;
