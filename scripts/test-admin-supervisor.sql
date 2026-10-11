BEGIN;
INSERT INTO public.plants(id,name,code,is_active) VALUES ('CAP_A','Assigned','CAP_A',true),('CAP_B','Other','CAP_B',true),('CAP_OFF','Inactive','CAP_OFF',false);
INSERT INTO public.users(id,email,name,role,assigned_plants,can_capture_inventory) VALUES
 ('cap_admin','cap-admin@example.invalid','Same name','admin',ARRAY['CAP_A','CAP_OFF'],true),
 ('cap_reviewer','cap-reviewer@example.invalid','Same name','admin','{}',false),
 ('cap_operator','cap-operator@example.invalid','Operator','plant_manager',ARRAY['CAP_A'],false),
 ('cap_global','cap-global@example.invalid','Global','operations_manager','{}',false);
DO $$
DECLARE month_id text; result jsonb;
BEGIN
 PERFORM start_inventory_guarded('CAP_A','2026-10','cap_admin');
 SELECT id INTO month_id FROM inventory_month WHERE plant_id='CAP_A' AND year_month='2026-10';
 PERFORM save_inventory_section_guarded(month_id,'products','[]','cap_admin',0,gen_random_uuid(),'cap-test','{}');
 PERFORM record_inventory_capture_started(month_id,'cap_admin','products','2026-10-11T10:00:00Z');
 BEGIN PERFORM start_inventory_guarded('CAP_B','2026-10','cap_admin'); RAISE EXCEPTION 'Unassigned capture succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM start_inventory_guarded('CAP_OFF','2026-10','cap_admin'); RAISE EXCEPTION 'Inactive plant capture succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM start_inventory_guarded('CAP_A','2026-10','cap_reviewer'); RAISE EXCEPTION 'Unflagged admin capture succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE users SET can_capture_inventory=false WHERE id='cap_admin';
 BEGIN PERFORM save_inventory_section_guarded(month_id,'products','[]','cap_admin',1,gen_random_uuid(),'cap-test-2','{}'); RAISE EXCEPTION 'Revoked writer succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM record_inventory_capture_started(month_id,'cap_admin','products','2026-10-11T10:00:00Z'); RAISE EXCEPTION 'Revoked activity succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE users SET can_capture_inventory=true WHERE id='cap_admin';
 SELECT apply_inventory_workflow_guarded(month_id,'cap_admin','submit',write_revision,NULL) INTO result FROM inventory_month WHERE id=month_id;
 IF result->>'submitted_by_user_id'<>'cap_admin' THEN RAISE EXCEPTION 'Sender identity missing'; END IF;
 BEGIN PERFORM apply_inventory_workflow_guarded(month_id,'cap_admin','approve',(result->>'write_revision')::bigint,NULL); RAISE EXCEPTION 'Self approval succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM apply_inventory_workflow_guarded(month_id,'cap_reviewer','approve',(result->>'write_revision')::bigint,NULL);
 IF NOT EXISTS(SELECT 1 FROM inventory_month WHERE id=month_id AND status='APPROVED') THEN RAISE EXCEPTION 'Independent approval failed'; END IF;
 PERFORM start_inventory_guarded('CAP_A','2026-09','cap_operator');
 PERFORM start_inventory_guarded('CAP_B','2026-09','cap_global');
 PERFORM start_inventory_guarded('CAP_A','2026-08','cap_admin');
 SELECT id INTO month_id FROM inventory_month WHERE plant_id='CAP_A' AND year_month='2026-08';
 UPDATE inventory_month SET status='SUBMITTED',submitted_by_user_id=NULL WHERE id=month_id;
 BEGIN PERFORM apply_inventory_workflow_guarded(month_id,'cap_reviewer','approve',0,NULL); RAISE EXCEPTION 'Unknown sender approval succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM audit_logs WHERE action='INVENTORY_SUBMITTED' AND user_id='cap_admin') THEN RAISE EXCEPTION 'Audit identity missing'; END IF;
END $$;
ROLLBACK;
