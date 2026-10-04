BEGIN;
CREATE FUNCTION pg_temp.verify(condition boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT COALESCE(condition,false) THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
INSERT INTO plants(id,name,code) VALUES('R3_A','Reporting A','R3_A'),('R3_B','Reporting B','R3_B');
INSERT INTO users(id,name,email,role,assigned_plants,is_active) VALUES
 ('r3_manager','Manager','r3manager@example.invalid','plant_manager',ARRAY['R3_A'],true),
 ('r3_other','Other','r3other@example.invalid','plant_manager',ARRAY['R3_B'],true),
 ('r3_operations','Operations','r3operations@example.invalid','operations_manager',ARRAY[]::text[],true),
 ('r3_admin','Admin','r3admin@example.invalid','admin',ARRAY[]::text[],true),
 ('r3_super','Super','r3super@example.invalid','super_admin',ARRAY[]::text[],true),
 ('r3_inactive','Inactive','r3inactive@example.invalid','admin',ARRAY[]::text[],false);
INSERT INTO plant_products_config(id,plant_id,product_name,unit,measure_mode) VALUES('r3_p1','R3_A','P1','unit','COUNT'),('r3_p2','R3_A','P2','unit','COUNT');
SELECT start_inventory_guarded('R3_A',to_char(date '2000-01-01'+n*interval '1 month','YYYY-MM'),'r3_manager') FROM generate_series(0,249)n;
SELECT start_inventory_guarded('R3_B','2020-10','r3_other');
DO $$ DECLARE page jsonb; second jsonb; mid text; receipt jsonb; report jsonb; previous jsonb; timeline jsonb; old_snapshot jsonb; BEGIN
 page:=inventory_reports_page('r3_manager','{}',0,100);
 PERFORM pg_temp.verify((page->'pagination'->>'total')::integer=250 AND jsonb_array_length(page->'data')=100,'250 inventories, first page bounded and total complete');
 second:=inventory_reports_page('r3_manager','{}',200,100);
 PERFORM pg_temp.verify(jsonb_array_length(second->'data')=50 AND NOT (second->'pagination'->>'has_more')::boolean,'last page has all records beyond 200');
 PERFORM pg_temp.verify(page->>'snapshot_id'=second->>'snapshot_id','stable dataset fingerprint across pages');
 PERFORM pg_temp.verify((inventory_reports_page('r3_operations','{}',0,100)->'pagination'->>'total')::integer>=251,'operations role can see global inventories');
 PERFORM pg_temp.verify((inventory_reports_page('r3_manager','{"year":"2020","month":"10","status":"IN_PROGRESS"}',0,50)->'pagination'->>'total')::integer=1,'year/month/status applied on server');
 SELECT id INTO mid FROM inventory_month WHERE plant_id='R3_A' AND year_month='2020-10';
 PERFORM pg_temp.verify((inventory_reporting_meta(mid)->>'saved_count')::integer=0 AND (inventory_reporting_meta(mid)->>'captured_count')::integer=0,'creation and prefill do not count as capture');
 PERFORM pg_temp.verify((inventory_reporting_meta(mid)->>'pending_count')::integer=2,'unsaved configured products remain pending');
 receipt:=save_inventory_section_guarded(mid,'products','[{"product_config_id":"r3_p1","quantity":0,"uom":"unit"}]','r3_manager',0,gen_random_uuid(),'r3hash',
 '{"captured_count":1,"complete_count":1,"pending_count":0,"configured_count":2,"configured_sections":{"aggregates":0,"silos":0,"additives":0,"diesel":0,"products":2,"utilities":0,"petty-cash":0},"client_occurred_at":"2020-10-01T10:00:00Z","client_capture_started_at":"2020-10-01T09:59:00Z","reporting_metadata":[{"config_id":"r3_p1","uom":"unit"}]}');
 report:=inventory_report_snapshot('r3_manager',mid);
 PERFORM pg_temp.verify((report->'progress'->>'captured_count')::integer=1 AND (report->'progress'->>'complete_count')::integer=1 AND (report->'progress'->>'pending_count')::integer=1,'partial saved zero is captured; missing configured row is pending');
 PERFORM pg_temp.verify((report->'productos'->0->>'quantity')::numeric=0 AND report->'progress'->>'last_save_received_at'=receipt->>'saved_at','detail values and server receipt timestamps agree');
 PERFORM pg_temp.verify((report->'progress'->>'first_capture_received_at')::timestamptz=(receipt->>'saved_at')::timestamptz,'confirmed captured save supplies first received activity when device event is absent');
 PERFORM pg_temp.verify(report->'progress'->>'first_capture_client_at'='2020-10-01T09:59:00Z','offline origin time retained separately from server receipt');
 PERFORM pg_temp.verify(report->'previous'->'month'->>'year_month'='2020-09','comparison uses immediately previous period in same plant');
 old_snapshot:=report->'productos';
 UPDATE inventory_month SET status='APPROVED' WHERE id=mid;
 UPDATE plant_products_config SET unit='gal',product_name='Changed name' WHERE id='r3_p1';
 INSERT INTO plant_products_config(id,plant_id,product_name,unit,measure_mode) VALUES('r3_p3','R3_A','New later','gal','COUNT');
 report:=inventory_report_snapshot('r3_manager',mid);
 PERFORM pg_temp.verify(report->'productos'=old_snapshot AND (report->'progress'->>'pending_count')::integer=1,'approved history and saved scope unaffected by configuration changes');
 PERFORM pg_temp.verify(page->>'snapshot_id'<>inventory_reports_page('r3_manager','{}',0,100)->>'snapshot_id','changes invalidate pagination fingerprint');
 PERFORM pg_temp.verify((inventory_reports_page('r3_manager','{"status":"APPROVED"}',0,50)->'totals'->>'approved')::integer=1,'filtered KPIs refer to entire set');
 INSERT INTO audit_logs(user_id,user_email,action,plant_id,inventory_month_id) VALUES('r3_super','r3super@example.invalid','INVENTORY_APPROVED','R3_A',mid);
 timeline:=inventory_audit_page('r3_admin',jsonb_build_object('inventory_month_id',mid),0,100);
 PERFORM pg_temp.verify(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(timeline->'data') e WHERE e->>'user_id'='r3_super'),'admin cannot see super admin events, exclusion before total');
 PERFORM pg_temp.verify((timeline->'pagination'->>'total')::integer=jsonb_array_length(timeline->'data'),'timeline total respects visibility');
 timeline:=inventory_audit_page('r3_super',jsonb_build_object('inventory_month_id',mid),0,100);
 PERFORM pg_temp.verify(EXISTS(SELECT 1 FROM jsonb_array_elements(timeline->'data') e WHERE e->>'user_id'='r3_super'),'super admin sees own events');
 PERFORM pg_temp.verify((inventory_audit_page('r3_manager','{"year_month":"2020-10"}',0,50)->'pagination'->>'total')::integer=3,'period filter narrows plant manager event history');
 BEGIN PERFORM inventory_reports_page('r3_manager','{"plant_id":"R3_B"}',0,50);RAISE EXCEPTION 'forbidden query accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM inventory_report_snapshot('r3_other',mid);RAISE EXCEPTION 'forbidden detail accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM inventory_audit_page('r3_other',jsonb_build_object('inventory_month_id',mid),0,50);RAISE EXCEPTION 'forbidden timeline accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM inventory_reports_page('r3_inactive','{}',0,50);RAISE EXCEPTION 'inactive user accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM inventory_reports_page('r3_manager','{}',0,101);RAISE EXCEPTION 'invalid limit accepted';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 PERFORM pg_temp.verify(NOT has_function_privilege('authenticated','inventory_reports_page(text,jsonb,integer,integer)','EXECUTE') AND NOT has_function_privilege('anon','inventory_report_snapshot(text,text)','EXECUTE'),'report RPCs executable only through authenticated server');
END $$;
-- Sorting must apply before pagination. Deletion must roll back if audit fails.
INSERT INTO plants(id,name,code) VALUES('R3_SORT','Sorting','R3_SORT');
INSERT INTO inventory_month(id,plant_id,year_month,created_by,created_at,updated_at) VALUES
 ('r3_old','R3_SORT','2026-08','r3_manager','2026-08-01','2026-08-02'),
 ('r3_new','R3_SORT','2026-09','r3_manager','2026-09-01','2026-09-02');
INSERT INTO plant_products_config(id,plant_id,product_name,unit,measure_mode) VALUES('r3_sort_product','R3_SORT','Sort Product','unit','COUNT');
INSERT INTO inventory_products_entries(id,inventory_month_id,product_config_id,quantity,uom) VALUES('r3_old_product','r3_old','r3_sort_product',1,'unit'),('r3_new_product','r3_new','r3_sort_product',2,'unit');
DO $$ DECLARE page jsonb; receipt jsonb; BEGIN
 page:=inventory_reports_page('r3_admin','{"plant_id":"R3_SORT","activity_order":"asc"}',0,1);
 PERFORM pg_temp.verify(page->'data'->0->>'id'='r3_old','ascending activity order before pagination');
 page:=inventory_reports_page('r3_admin','{"plant_id":"R3_SORT","activity_order":"desc"}',0,1);
 PERFORM pg_temp.verify(page->'data'->0->>'id'='r3_new','descending activity order before pagination');
 page:=inventory_reports_page('r3_admin','{"plant_id":"R3_SORT","activity_order":"desc"}',1,1);
 PERFORM pg_temp.verify(page->'data'->0->>'id'='r3_old','next activity page has the remaining row');
 INSERT INTO audit_logs(user_id,user_email,action,plant_id,inventory_month_id,timestamp) VALUES('r3_admin','r3admin@example.invalid','SECTION_SAVED','R3_SORT','r3_old','2026-10-01');
 PERFORM pg_temp.verify(inventory_reports_page('r3_admin','{"plant_id":"R3_SORT","activity_order":"desc"}',0,1)->'data'->0->>'id'='r3_old','latest received event outranks month creation');
 PERFORM pg_temp.verify(page->>'snapshot_id'<>inventory_reports_page('r3_admin','{"plant_id":"R3_SORT","activity_order":"desc"}',0,1)->>'snapshot_id','activity changes invalidate pagination fingerprint');
 BEGIN PERFORM delete_inventory_report_guarded('r3_manager','r3_old','R3_SORT','2026-08',0); RAISE EXCEPTION 'manager deletion accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM delete_inventory_report_guarded('r3_admin','r3_old','R3_SORT','2026-08',1); RAISE EXCEPTION 'stale deletion accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM pg_temp.verify(EXISTS(SELECT 1 FROM inventory_month WHERE id='r3_old'),'rejected deletion leaves inventory intact');
 receipt:=delete_inventory_report_guarded('r3_admin','r3_old','R3_SORT','2026-08',0);
 PERFORM pg_temp.verify(NOT EXISTS(SELECT 1 FROM inventory_month WHERE id='r3_old'),'confirmed administrator deletion removes month');
 PERFORM pg_temp.verify(NOT EXISTS(SELECT 1 FROM inventory_products_entries WHERE id='r3_old_product'),'confirmed deletion removes child rows');
 PERFORM pg_temp.verify(EXISTS(SELECT 1 FROM audit_logs WHERE id=receipt->>'audit_id' AND action='REPORT_DELETED' AND user_id='r3_admin' AND details->>'year_month'='2026-08'),'deletion audit keeps actor and period after month removed');
 page:=inventory_audit_page('r3_admin','{"year_month":"2026-08","plant_id":"R3_SORT"}',0,50);
 PERFORM pg_temp.verify(page->'data'->0->>'action'='REPORT_DELETED','deleted inventory event remains visible under period filter');
 PERFORM pg_temp.verify(NOT has_function_privilege('authenticated','delete_inventory_report_guarded(text,text,text,text,bigint)','EXECUTE'),'deletion RPC restricted to server');
END $$;
CREATE FUNCTION pg_temp.fail_deletion_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='REPORT_DELETED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER test_report_audit_failure BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_deletion_audit();
DO $$ BEGIN
 BEGIN PERFORM delete_inventory_report_guarded('r3_admin','r3_new','R3_SORT','2026-09',0); RAISE EXCEPTION 'audit failure ignored'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'synthetic audit failure' THEN RAISE; END IF; END;
 PERFORM pg_temp.verify(EXISTS(SELECT 1 FROM inventory_month WHERE id='r3_new'),'audit failure rolls back inventory deletion');
 PERFORM pg_temp.verify(EXISTS(SELECT 1 FROM inventory_products_entries WHERE id='r3_new_product'),'audit failure rolls back child deletion');
END $$;
DROP TRIGGER test_report_audit_failure ON public.audit_logs;

ROLLBACK;
SELECT 'Reporting SQL assertions passed; fixtures rolled back.';
