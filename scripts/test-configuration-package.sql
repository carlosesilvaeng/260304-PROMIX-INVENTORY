BEGIN;
CREATE FUNCTION pg_temp.verify(condition boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(condition,false) THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
INSERT INTO users(id,name,email,role,is_active) VALUES('c4_admin','Admin','c4admin@example.invalid','admin',true),('c4_other','Admin 2','c4other@example.invalid','admin',true),('c4_inactive','Inactive','c4inactive@example.invalid','admin',false),('c4_manager','Operator','c4manager@example.invalid','plant_manager',true);
INSERT INTO plants(id,name,code,petty_cash_established) VALUES('C4_A','Source','C4_A',100),('C4_B','Destination','C4_B',50),('C4_C','Retention','C4_C',25),('C4_D','Rollback','C4_D',10);
INSERT INTO materiales_catalog(id,nombre,clase,is_active) VALUES('c4_material','Material phase 4','CEMENT',false);
INSERT INTO procedencias_catalog(id,nombre,is_active) VALUES('c4_origin','Origin phase 4',false);
INSERT INTO additives_catalog(id,nombre,marca,uom,is_active) VALUES('c4_additive','Additive phase 4','Brand','gal_us',false);
INSERT INTO material_conversion_factors(id,plant_id,material_id,from_unit_id,to_unit_id,factor) VALUES('c4_factor','C4_A','c4_material','ft3','lb',123.123456789012);
INSERT INTO calibration_curves(id,plant_id,curve_name,measurement_type,data_points,input_unit_id,output_unit_id,equipment_id) VALUES('c4_curve','C4_A','PHASE4','SILO_LEVEL','{"0":0,"10":100.12345678901234567890}','in','gal_us','c4_silo');
INSERT INTO calibration_curve_points(id,curve_id,point_key,point_value,available_gallons,consumed_gallons,percentage,status) VALUES('c4_pt0','c4_curve',0,0,0,100,0,'EMPTY'),('c4_pt10','c4_curve',10,100,100,0,100,'FULL');
INSERT INTO plant_aggregates_config(id,plant_id,aggregate_name,measurement_method,unit,box_width_ft,box_height_ft) VALUES('c4_aggregate','C4_A','Box phase 4','BOX','ft3',2,3);
INSERT INTO plant_cajones_config(id,plant_id,cajon_name,material,procedencia,box_width_ft,box_height_ft,is_active) VALUES('c4_box','C4_A','Legacy box','Material phase 4','Origin phase 4',2,3,false);
INSERT INTO plant_silos_config(id,plant_id,silo_name,measurement_method,calibration_curve_name,calculation_method,diameter_in,total_height_in,cone_height_in,material_conversion_factor_id,inventory_unit_id) VALUES('c4_silo','C4_A','Silo phase 4','SILO_LEVEL','PHASE4','GEOMETRIC_CYLINDER_CONE',100,200,20,'c4_factor','lb');
INSERT INTO silo_allowed_products(id,silo_config_id,product_name) VALUES('c4_allowed','c4_silo','Material phase 4');
INSERT INTO plant_additives_config(id,plant_id,additive_name,measurement_method,catalog_additive_id,tank_name,uom,requires_photo) VALUES('c4_additive_cfg','C4_A','Additive phase 4','MANUAL','c4_additive','Container 1','gal_us',true),('c4_additive_cfg2','C4_A','Additive phase 4','MANUAL','c4_additive','Container 2','gal_us',false);
INSERT INTO plant_diesel_config(id,plant_id,measurement_method,initial_inventory_gallons,tank_capacity_gallons,is_active) VALUES('c4_diesel','C4_A','TANK_LEVEL',0,100,false);
INSERT INTO plant_products_config(id,plant_id,product_name,unit,measure_mode,unit_volume,requires_photo,is_active) VALUES('c4_product','C4_A','Drum phase 4','gal_us','DRUM',55,true,false);
INSERT INTO plant_utilities_meters_config(id,plant_id,meter_name,meter_type,unit) VALUES('c4_meter','C4_A','Water phase 4','WATER','gal_us');
INSERT INTO plant_petty_cash_config(id,plant_id,monthly_amount,initial_amount) VALUES('c4_cash','C4_A',100,100);
INSERT INTO measurement_configs(id,plant_id,section_code,equipment_id,capture_unit_id,calculation_unit_id,display_unit_id,inventory_unit_id,material_conversion_factor_id,calibration_curve_id,active) VALUES('c4_rule','C4_A','silos','c4_silo','in','ft3','lb','lb','c4_factor','c4_curve',false);
INSERT INTO plant_products_config(id,plant_id,product_name,unit) VALUES('c4_extra','C4_C','Keep extra','unit');
INSERT INTO inventory_month(id,plant_id,year_month,status,created_by) VALUES('c4_history','C4_C','2026-09','APPROVED','c4_manager');
INSERT INTO inventory_products_entries(id,inventory_month_id,product_config_id,product_name,quantity,uom) VALUES('c4_saved','c4_history','c4_extra','Keep extra',0,'unit');
CREATE FUNCTION pg_temp.reject_configuration_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.action='CONFIGURATION_IMPORTED' AND NEW.plant_id='C4_D' THEN RAISE EXCEPTION 'synthetic audit unavailable' USING ERRCODE='P4005'; END IF;
 RETURN NEW; END $$;
DO $$ DECLARE payload jsonb; snapshot jsonb; plan jsonb; result jsonb; opts jsonb:='{"create_dependencies":false,"deactivate_extras":false,"restore_ids":false}'; spec jsonb; row jsonb; copied jsonb; name text; new_id text; history jsonb; changed jsonb; candidate jsonb; before_state jsonb; token uuid;
BEGIN
 payload:=configuration_export('c4_admin','C4_A');
 PERFORM pg_temp.verify(jsonb_array_length(payload->'tables'->'plant_diesel_config')=1 AND NOT (payload->'tables'->'plant_diesel_config'->0->>'is_active')::boolean,'inactive diesel exported');
 PERFORM pg_temp.verify(jsonb_array_length(payload->'tables'->'calibration_curve_points')=2 AND payload->'tables'->'calibration_curve_points'->0 ? 'consumed_gallons','complete calibration points exported');
 PERFORM pg_temp.verify(payload->'tables'->'material_conversion_factors'->0->>'factor'='123.123456789012','NUMERIC decimals serialized without JavaScript precision loss');
 BEGIN PERFORM configuration_export('c4_manager','C4_A');RAISE EXCEPTION 'operator export allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM configuration_import('c4_inactive','C4_B',payload,'digest',opts);RAISE EXCEPTION 'inactive import allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 before_state:=configuration_snapshot('C4_B');
 plan:=configuration_import('c4_admin','C4_B',payload,'digest',opts);
 PERFORM pg_temp.verify(jsonb_array_length(plan->'errors')=0,coalesce((plan->'errors')::text,'valid preview'));
 PERFORM pg_temp.verify(plan->>'preview_token' IS NOT NULL AND configuration_snapshot('C4_B')=before_state,'preview validates writes but rolls all of them back');
 result:=configuration_import('c4_admin','C4_B',payload,'digest',opts,(plan->>'preview_token')::uuid);
 PERFORM pg_temp.verify(result->>'plant_id'='C4_B','copy applied');
 PERFORM pg_temp.verify((configuration_import('c4_admin','C4_B',payload,'digest',opts,(plan->>'preview_token')::uuid)->>'replayed')::boolean,'lost response can replay without new writes');
 snapshot:=configuration_export('c4_admin','C4_B');
 FOR spec IN SELECT value FROM jsonb_array_elements(configuration_table_specs()) LOOP
  name:=spec->>'table';
  FOR row IN SELECT value FROM jsonb_array_elements(payload->'tables'->name) LOOP
   new_id:=plan->'mappings'->name->>(row->>'id');
   SELECT value INTO copied FROM jsonb_array_elements(snapshot->'tables'->name) WHERE value->>'id'=new_id;
   PERFORM pg_temp.verify(configuration_values(copied)=configuration_values(configuration_remap(name,row,plan->'mappings','C4_B')),'roundtrip equivalent: '||name);
   IF spec->>'scope'<>'global' AND row->>'plant_id' IS NOT NULL THEN PERFORM pg_temp.verify(new_id<>row->>'id','copy maps identifier: '||name);END IF;
  END LOOP;
 END LOOP;
 PERFORM pg_temp.verify((SELECT p.name='Destination' AND p.code='C4_B' AND p.petty_cash_established=100 FROM plants p WHERE p.id='C4_B'),'destination identity retained and operational amount copied');
 PERFORM pg_temp.verify((SELECT count(*) FROM audit_logs WHERE action='CONFIGURATION_IMPORTED' AND plant_id='C4_B')=1,'one transactional success audit despite replay');
 BEGIN PERFORM configuration_import('c4_other','C4_B',payload,'digest',opts,(plan->>'preview_token')::uuid);RAISE EXCEPTION 'actor mismatch allowed';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 BEGIN PERFORM configuration_import('c4_admin','C4_B',payload,'changed digest',opts,(plan->>'preview_token')::uuid);RAISE EXCEPTION 'digest mismatch allowed';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 PERFORM pg_temp.verify(configuration_export('c4_admin','C4_A')=payload,'copy leaves origin unchanged');
 -- Restoring in the same environment/plant preserves equipment identity across renames.
 UPDATE plant_products_config SET product_name='Renamed after backup' WHERE id='c4_product';
 plan:=configuration_import('c4_admin','C4_A',payload,'local-restore',opts||'{"restore_ids":true}');
 PERFORM pg_temp.verify(plan->'mappings'->'plant_products_config'->>'c4_product'='c4_product','same-plant restore keeps existing authorized identity');
 PERFORM configuration_import('c4_admin','C4_A',payload,'local-restore',opts||'{"restore_ids":true}',(plan->>'preview_token')::uuid);
 PERFORM pg_temp.verify((SELECT product_name='Drum phase 4' FROM plant_products_config WHERE id='c4_product'),'same-plant restoration reverses rename without duplicate');
 -- Historical rows and destination extras are preserved, optional deactivation only.
 SELECT to_jsonb(r) INTO history FROM inventory_products_entries r WHERE id='c4_saved';
 plan:=configuration_import('c4_admin','C4_C',payload,'digest',opts);
 PERFORM configuration_import('c4_admin','C4_C',payload,'digest',opts,(plan->>'preview_token')::uuid);
 PERFORM pg_temp.verify((SELECT is_active FROM plant_products_config WHERE id='c4_extra'),'extras retained by default');
 opts:=opts||'{"deactivate_extras":true}';
 plan:=configuration_import('c4_admin','C4_C',payload,'digest',opts);
 PERFORM pg_temp.verify((plan->'summary'->>'deactivate')::integer=1,'deactivation shown in preview');
 PERFORM configuration_import('c4_admin','C4_C',payload,'digest',opts,(plan->>'preview_token')::uuid);
 PERFORM pg_temp.verify((SELECT NOT is_active FROM plant_products_config WHERE id='c4_extra') AND (SELECT to_jsonb(r)=history FROM inventory_products_entries r WHERE id='c4_saved'),'deactivate does not delete history or its configuration identity');
 opts:=opts||'{"deactivate_extras":false}';
 plan:=configuration_import('c4_admin','C4_D',payload,'digest',opts);token:=(plan->>'preview_token')::uuid;
 UPDATE plants SET petty_cash_established=12 WHERE id='C4_D';
 BEGIN PERFORM configuration_import('c4_admin','C4_D',payload,'digest',opts,token);RAISE EXCEPTION 'stale target allowed';EXCEPTION WHEN serialization_failure THEN NULL;END;
 plan:=configuration_import('c4_admin','C4_D',payload,'digest',opts);token:=(plan->>'preview_token')::uuid;
 UPDATE units SET decimal_precision=decimal_precision+1 WHERE id='m';
 BEGIN PERFORM configuration_import('c4_admin','C4_D',payload,'digest',opts,token);RAISE EXCEPTION 'stale dependency allowed';EXCEPTION WHEN serialization_failure THEN NULL;END;
 changed:=configuration_import('c4_admin','C4_D',payload,'digest',opts);
 PERFORM pg_temp.verify(jsonb_array_length(changed->'errors')=1 AND changed->>'preview_token' IS NULL,'incompatible global definitions block preview');
 UPDATE units SET decimal_precision=decimal_precision-1 WHERE id='m';
 changed:=jsonb_set(payload,'{tables,plant_silos_config,0,cylinder_height_mode}','"INVALID"');
 before_state:=configuration_snapshot('C4_D');plan:=configuration_import('c4_admin','C4_D',changed,'bad',opts);
 PERFORM pg_temp.verify(jsonb_array_length(plan->'errors')=1 AND configuration_snapshot('C4_D')=before_state,'real database constraints checked in preview with full rollback');
 plan:=configuration_import('c4_admin','C4_D',payload,'digest',opts);token:=(plan->>'preview_token')::uuid;
 UPDATE configuration_import_previews SET expires_at=now()-interval '1 minute' WHERE id=token;
 BEGIN PERFORM configuration_import('c4_admin','C4_D',payload,'digest',opts,token);RAISE EXCEPTION 'expired preview allowed';EXCEPTION WHEN serialization_failure THEN NULL;END;
 -- A success audit failure must roll back every configuration write and token.
 plan:=configuration_import('c4_admin','C4_D',payload,'atomic',opts);token:=(plan->>'preview_token')::uuid;
 before_state:=configuration_snapshot('C4_D');
 CREATE TRIGGER reject_config_test BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_configuration_audit();
 BEGIN PERFORM configuration_import('c4_admin','C4_D',payload,'atomic',opts,token);RAISE EXCEPTION 'audit failure was ignored';EXCEPTION WHEN SQLSTATE 'P4005' THEN NULL;END;
 PERFORM pg_temp.verify(configuration_snapshot('C4_D')=before_state AND (SELECT consumed_at IS NULL FROM configuration_import_previews WHERE id=token),'configuration, audit and receipt remain atomic');
 DROP TRIGGER reject_config_test ON audit_logs;
 changed:=jsonb_set(payload,'{tables,measurement_configs,0,equipment_id}','"equipment-outside-package"');
 plan:=configuration_import('c4_admin','C4_D',changed,'missing-equipment',opts);
 PERFORM pg_temp.verify(jsonb_array_length(plan->'errors')=1 AND plan->>'preview_token' IS NULL,'unresolved equipment reference blocks copy');
 changed:=jsonb_set(jsonb_set(payload,'{plant,silos}','[{"id":"legacy"}]'),'{tables,plant_silos_config}','[]');
 plan:=configuration_import('c4_admin','C4_D',changed,'legacy-only',opts);
 PERFORM pg_temp.verify(jsonb_array_length(plan->'errors')=1 AND plan->>'preview_token' IS NULL,'legacy-only source cannot silently produce a partial restore');
 -- Missing shared catalog row is created only with an explicit option.
 changed:=jsonb_set(payload,'{tables,materiales_catalog}',(payload->'tables'->'materiales_catalog')||jsonb_build_array(jsonb_build_object('id','external-material','nombre','Missing external material','clase','EXTERNAL','sort_order',0,'is_active',true)));
 plan:=configuration_import('c4_admin','C4_D',changed,'new dependency',opts);
 PERFORM pg_temp.verify(jsonb_array_length(plan->'errors')=1,'new shared dependency needs explicit authorization');
 opts:=opts||'{"create_dependencies":true}';plan:=configuration_import('c4_admin','C4_D',changed,'new dependency',opts);
 PERFORM pg_temp.verify(jsonb_array_length(plan->'errors')=0 AND NOT EXISTS(SELECT 1 FROM materiales_catalog WHERE nombre='Missing external material'),'authorized dependency creation remains dry during preview');
 PERFORM configuration_import('c4_admin','C4_D',changed,'new dependency',opts,(plan->>'preview_token')::uuid);
 PERFORM pg_temp.verify(EXISTS(SELECT 1 FROM materiales_catalog WHERE nombre='Missing external material' AND id<>'external-material'),'new dependency created with mapped identifier');
 PERFORM pg_temp.verify(NOT has_function_privilege('authenticated','configuration_import(text,text,jsonb,text,jsonb,uuid)','EXECUTE') AND NOT has_function_privilege('anon','configuration_snapshot(text)','EXECUTE'),'only server can execute configuration RPCs');
END $$;
-- Simulate a package exported from another environment with different global IDs.
INSERT INTO plants(id,name,code) VALUES('C4_E','Other environment destination','C4_E');
DO $$ DECLARE payload jsonb:=configuration_export('c4_admin','C4_A'); foreign_maps jsonb:='{}'; spec jsonb; table_map jsonb; name text; rows jsonb; row jsonb; plan jsonb; snapshot jsonb; copied jsonb; new_id text;
BEGIN
 FOR spec IN SELECT value FROM jsonb_array_elements(configuration_table_specs()) LOOP
  name:=spec->>'table';table_map:='{}';
  FOR row IN SELECT value FROM jsonb_array_elements(payload->'tables'->name) LOOP
   table_map:=table_map||jsonb_build_object(row->>'id',CASE WHEN spec->>'scope'='global' THEN 'external-'||(row->>'id') ELSE row->>'id' END);
  END LOOP;
  foreign_maps:=foreign_maps||jsonb_build_object(name,table_map);
 END LOOP;
 FOR spec IN SELECT value FROM jsonb_array_elements(configuration_table_specs()) LOOP
  name:=spec->>'table';rows:='[]';
  FOR row IN SELECT value FROM jsonb_array_elements(payload->'tables'->name) LOOP
   rows:=rows||jsonb_build_array(configuration_remap(name,row,foreign_maps,'C4_A')||jsonb_build_object('id',foreign_maps->name->>(row->>'id')));
  END LOOP;
  payload:=jsonb_set(payload,ARRAY['tables',name],rows);
 END LOOP;
 plan:=configuration_import('c4_admin','C4_E',payload,'foreign-environment','{"restore_ids":false}');
 PERFORM pg_temp.verify(jsonb_array_length(plan->'errors')=0,'foreign catalog IDs reuse identical local definitions and translate every dependency');
 PERFORM configuration_import('c4_admin','C4_E',payload,'foreign-environment','{"restore_ids":false}',(plan->>'preview_token')::uuid);
 snapshot:=configuration_export('c4_admin','C4_E');
 FOR spec IN SELECT value FROM jsonb_array_elements(configuration_table_specs()) LOOP
  name:=spec->>'table';
  FOR row IN SELECT value FROM jsonb_array_elements(payload->'tables'->name) LOOP
   new_id:=plan->'mappings'->name->>(row->>'id');SELECT value INTO copied FROM jsonb_array_elements(snapshot->'tables'->name) WHERE value->>'id'=new_id;
   PERFORM pg_temp.verify(configuration_values(copied)=configuration_values(configuration_remap(name,row,plan->'mappings','C4_E')),'foreign-environment roundtrip: '||name);
  END LOOP;
 END LOOP;
END $$;
ROLLBACK;
