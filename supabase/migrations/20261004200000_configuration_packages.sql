BEGIN;

CREATE TABLE public.configuration_import_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id text NOT NULL, plant_id text NOT NULL,
  package_digest text NOT NULL, payload jsonb NOT NULL, options jsonb NOT NULL,
  fingerprint text NOT NULL, plan jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
  consumed_at timestamptz, result jsonb
);
ALTER TABLE public.configuration_import_previews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.configuration_import_previews FROM anon,authenticated;

CREATE FUNCTION public.configuration_table_specs() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT '[
 {"table":"unit_categories","scope":"global","key":["code"]},
 {"table":"units","scope":"global","key":["code"]},
 {"table":"materiales_catalog","scope":"global","key":["nombre","clase"]},
 {"table":"procedencias_catalog","scope":"global","key":["nombre"]},
 {"table":"additives_catalog","scope":"global","key":["nombre"]},
 {"table":"material_conversion_factors","scope":"mixed","key":["plant_id","material_id","from_unit_id","to_unit_id","effective_from","effective_to"]},
 {"table":"calibration_curves","scope":"plant","key":["plant_id","curve_name"]},
 {"table":"plant_aggregates_config","scope":"plant","key":["plant_id","aggregate_name"]},
 {"table":"plant_cajones_config","scope":"plant","key":["plant_id","cajon_name"]},
 {"table":"plant_silos_config","scope":"plant","key":["plant_id","silo_name"]},
 {"table":"plant_additives_config","scope":"plant","key":["plant_id","additive_name","tank_name"]},
 {"table":"plant_diesel_config","scope":"plant","key":["plant_id"]},
 {"table":"plant_products_config","scope":"plant","key":["plant_id","product_name"]},
 {"table":"plant_utilities_meters_config","scope":"plant","key":["plant_id","meter_name"]},
 {"table":"plant_petty_cash_config","scope":"plant","key":["plant_id"]},
 {"table":"measurement_configs","scope":"mixed","key":["plant_id","section_code","inventory_type_id","material_id","equipment_id"]},
 {"table":"calibration_curve_points","scope":"relation","key":["curve_id","point_key"]},
 {"table":"silo_allowed_products","scope":"relation","key":["silo_config_id","product_name"]}
 ]'::jsonb;
$$;

CREATE FUNCTION public.configuration_serialized_row(p_row jsonb,p_fields text[]) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE field text;result jsonb:=p_row;
BEGIN
 FOREACH field IN ARRAY p_fields LOOP
  IF result->>field IS NOT NULL THEN result:=result||jsonb_build_object(field,result->>field); END IF;
 END LOOP;
 RETURN result;
END $$;

CREATE FUNCTION public.configuration_snapshot(p_plant_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE plant jsonb; spec jsonb; name text; rows jsonb; tables jsonb:='{}'; schema jsonb:='{}';numeric_fields jsonb:='{}';json_fields jsonb:='{}';numeric_names text[];json_names text[]; equipment_ids text[];
BEGIN
 SELECT to_jsonb(p) INTO plant FROM public.plants p WHERE id=p_plant_id;
 IF plant IS NULL THEN RAISE EXCEPTION 'Planta inexistente' USING ERRCODE='P0002'; END IF;
 SELECT array_agg(id) INTO equipment_ids FROM (
  SELECT id FROM plant_aggregates_config WHERE plant_id=p_plant_id UNION ALL SELECT id FROM plant_cajones_config WHERE plant_id=p_plant_id
  UNION ALL SELECT id FROM plant_silos_config WHERE plant_id=p_plant_id UNION ALL SELECT id FROM plant_additives_config WHERE plant_id=p_plant_id
  UNION ALL SELECT id FROM plant_diesel_config WHERE plant_id=p_plant_id UNION ALL SELECT id FROM plant_products_config WHERE plant_id=p_plant_id
  UNION ALL SELECT id FROM plant_utilities_meters_config WHERE plant_id=p_plant_id UNION ALL SELECT id FROM plant_petty_cash_config WHERE plant_id=p_plant_id
 ) equipment;
 FOR spec IN SELECT value FROM jsonb_array_elements(public.configuration_table_specs()) LOOP
  name:=spec->>'table';
  IF spec->>'scope'='global' THEN
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),''[]'') FROM public.%I r',name) INTO rows;
  ELSIF name='measurement_configs' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') INTO rows FROM measurement_configs r WHERE plant_id=p_plant_id OR (plant_id IS NULL AND (equipment_id IS NULL OR equipment_id=ANY(equipment_ids)));
  ELSIF spec->>'scope'='mixed' THEN
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),''[]'') FROM public.%I r WHERE plant_id=$1 OR plant_id IS NULL',name) INTO rows USING p_plant_id;
  ELSIF name='calibration_curve_points' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') INTO rows FROM calibration_curve_points r WHERE curve_id IN (SELECT id FROM calibration_curves WHERE plant_id=p_plant_id);
  ELSIF name='silo_allowed_products' THEN
   SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') INTO rows FROM silo_allowed_products r WHERE silo_config_id IN (SELECT id FROM plant_silos_config WHERE plant_id=p_plant_id);
  ELSE
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),''[]'') FROM public.%I r WHERE plant_id=$1',name) INTO rows USING p_plant_id;
  END IF;
  SELECT coalesce(array_agg(a.attname ORDER BY a.attnum),ARRAY[]::text[]) INTO numeric_names FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid WHERE a.attrelid=('public.'||name)::regclass AND a.attnum>0 AND NOT a.attisdropped AND t.typname='numeric';
  SELECT coalesce(array_agg(a.attname ORDER BY a.attnum),ARRAY[]::text[]) INTO json_names FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid WHERE a.attrelid=('public.'||name)::regclass AND a.attnum>0 AND NOT a.attisdropped AND t.typname='jsonb';
  SELECT coalesce(jsonb_agg(public.configuration_serialized_row(value,numeric_names||json_names) ORDER BY value->>'id'),'[]') INTO rows FROM jsonb_array_elements(rows);
  json_fields:=json_fields||jsonb_build_object(name,to_jsonb(json_names));
  numeric_fields:=numeric_fields||jsonb_build_object(name,to_jsonb(numeric_names));
  tables:=tables||jsonb_build_object(name,rows);
  schema:=schema||jsonb_build_object(name,(SELECT jsonb_agg(attname ORDER BY attnum) FROM pg_attribute WHERE attrelid=('public.'||name)::regclass AND attnum>0 AND NOT attisdropped));
 END LOOP;
 RETURN jsonb_build_object('plant',plant,'tables',tables,'schema',schema,'numeric_fields',numeric_fields,'json_fields',json_fields);
END $$;

CREATE FUNCTION public.configuration_identity(p_row jsonb,p_keys jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT coalesce(jsonb_agg(CASE WHEN key='point_key' THEN to_jsonb((p_row->>key)::numeric) WHEN key='tank_name' THEN to_jsonb(coalesce(p_row->>key,'')) ELSE coalesce(p_row->key,'null') END ORDER BY ord),'[]') FROM jsonb_array_elements_text(p_keys) WITH ORDINALITY f(key,ord);
$$;
CREATE FUNCTION public.configuration_values(p_row jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT p_row-'id'-'created_at'-'updated_at'; $$;

CREATE FUNCTION public.configuration_remap(p_table text,p_row jsonb,p_maps jsonb,p_target text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb:=p_row; relation record; field text; mapped text; matches text[];
BEGIN
 IF result ? 'plant_id' AND result->>'plant_id' IS NOT NULL THEN result:=result||jsonb_build_object('plant_id',p_target); END IF;
 FOR relation IN SELECT a.attname AS field,c.confrelid::regclass::text AS ref FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
  WHERE c.conrelid=('public.'||p_table)::regclass AND c.contype='f' AND array_length(c.conkey,1)=1 LOOP
  IF relation.field='plant_id' OR result->>relation.field IS NULL THEN CONTINUE; END IF;
  mapped:=p_maps->replace(relation.ref,'public.','')->>(result->>relation.field);
  IF mapped IS NULL THEN RAISE EXCEPTION 'Dependencia ausente: %.% (%)',p_table,relation.field,result->>relation.field USING ERRCODE='22023'; END IF;
  result:=result||jsonb_build_object(relation.field,mapped);
 END LOOP;
 IF p_table='silo_allowed_products' THEN
  mapped:=p_maps->'plant_silos_config'->>(result->>'silo_config_id');
  IF mapped IS NULL THEN RAISE EXCEPTION 'Silo de la relación ausente' USING ERRCODE='22023'; END IF;
  result:=result||jsonb_build_object('silo_config_id',mapped);
 END IF;
 IF result->>'catalog_additive_id' IS NOT NULL THEN
  mapped:=p_maps->'additives_catalog'->>(result->>'catalog_additive_id');
  IF mapped IS NULL THEN RAISE EXCEPTION 'Aditivo de catálogo ausente' USING ERRCODE='22023'; END IF;
  result:=result||jsonb_build_object('catalog_additive_id',mapped);
 END IF;
 -- Legacy text unit fields may contain a unit identifier instead of its code.
 FOREACH field IN ARRAY ARRAY['reading_uom','unit','uom'] LOOP
  mapped:=p_maps->'units'->>(result->>field);
  IF mapped IS NOT NULL THEN result:=result||jsonb_build_object(field,mapped); END IF;
 END LOOP;
 IF result->>'equipment_id' IS NOT NULL THEN
  SELECT array_agg(DISTINCT m.value->>(result->>'equipment_id')) FILTER(WHERE m.value ? (result->>'equipment_id')) INTO matches FROM jsonb_each(p_maps) m WHERE m.key LIKE 'plant_%_config';
  IF array_length(matches,1)>1 THEN RAISE EXCEPTION 'Identificador de equipo ambiguo' USING ERRCODE='22023'; END IF;
  IF coalesce(array_length(matches,1),0)=0 THEN RAISE EXCEPTION 'Equipo de referencia ausente: %.equipment_id (%)',p_table,result->>'equipment_id' USING ERRCODE='22023'; END IF;
  result:=result||jsonb_build_object('equipment_id',matches[1]);
 END IF;
 RETURN result;
END $$;

-- Internal engine shared by preview and execution. Never deletes configuration
-- identities or inventory rows. Callers hold locks on the full configuration set.
CREATE FUNCTION public.configuration_apply_internal(p_target text,p_payload jsonb,p_options jsonb,p_reserved_maps jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE snapshot jsonb:=public.configuration_snapshot(p_target); specs jsonb:=public.configuration_table_specs(); spec jsonb;
 name text; row jsonb; translated jsonb; candidate jsonb; candidates jsonb; maps jsonb:='{}'; table_map jsonb; used_ids text[];
 source_id text; target_id text; column_list text; assignments text; action text; global_row boolean;
 changes jsonb:='[]'; seen text[]; flag text; current_row jsonb; incoming_ids text[]; key text; plant_changes jsonb;
BEGIN
 IF jsonb_typeof(p_payload->'tables')<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p_payload->'tables'))<>jsonb_array_length(specs) THEN RAISE EXCEPTION 'Secciones de paquete incompletas' USING ERRCODE='22023'; END IF;
 -- Legacy embedded arrays are not portable relational configuration. Block a
 -- partial copy rather than silently discarding equipment known only there.
 IF (jsonb_array_length(coalesce(p_payload->'plant'->'cajones','[]'))>0 AND jsonb_array_length(p_payload->'tables'->'plant_cajones_config')=0)
 OR (jsonb_array_length(coalesce(p_payload->'plant'->'silos','[]'))>0 AND jsonb_array_length(p_payload->'tables'->'plant_silos_config')=0) THEN
  RAISE EXCEPTION 'El origen tiene equipos sólo en la configuración antigua. Normalízalos en la configuración de planta antes de copiar o restaurar.' USING ERRCODE='22023';
 END IF;
 -- Map dependency and equipment identities before translating foreign keys.
 FOR spec IN SELECT value FROM jsonb_array_elements(specs) ORDER BY CASE WHEN value->>'scope'='global' THEN 0 WHEN value->>'table'='material_conversion_factors' THEN 2 WHEN value->>'table'='measurement_configs' THEN 3 WHEN value->>'scope'='relation' THEN 4 ELSE 1 END LOOP
  name:=spec->>'table'; table_map:='{}';used_ids:=ARRAY[]::text[];
  IF jsonb_typeof(p_payload->'tables'->name)<>'array' THEN RAISE EXCEPTION 'Sección inválida: %',name USING ERRCODE='22023'; END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(p_payload->'tables'->name) LOOP
   source_id:=row->>'id'; IF source_id IS NULL OR source_id='' OR table_map ? source_id THEN RAISE EXCEPTION 'Identificador ausente o duplicado en %',name USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(row) k WHERE NOT (snapshot->'schema'->name ? k)) THEN RAISE EXCEPTION 'Campo no soportado en %',name USING ERRCODE='22023'; END IF;
   IF row ? 'plant_id' AND row->>'plant_id' IS NOT NULL AND row->>'plant_id'<>p_payload->'plant'->>'id' THEN RAISE EXCEPTION 'Configuración de otra planta' USING ERRCODE='22023'; END IF;
   IF spec->>'scope'='plant' OR spec->>'scope'='global' THEN translated:=row;
    IF translated ? 'plant_id' THEN translated:=translated||jsonb_build_object('plant_id',p_target); END IF;
   ELSE translated:=public.configuration_remap(name,row,maps,p_target); END IF;
   candidate:=NULL;
   IF coalesce((p_options->>'restore_ids')::boolean,false) AND spec->>'scope'='plant' THEN
    SELECT value INTO candidate FROM jsonb_array_elements(snapshot->'tables'->name) WHERE value->>'id'=source_id;
   END IF;
   IF candidate IS NULL THEN
    SELECT coalesce(jsonb_agg(value),'[]') INTO candidates FROM jsonb_array_elements(snapshot->'tables'->name) WHERE public.configuration_identity(value,spec->'key')=public.configuration_identity(translated,spec->'key');
    IF jsonb_array_length(candidates)>1 THEN RAISE EXCEPTION 'Coincidencia ambigua en %; corrige las reglas o factores duplicados del destino',name USING ERRCODE='22023'; END IF;
    candidate:=candidates->0;
   END IF;
   target_id:=coalesce(candidate->>'id',p_reserved_maps->name->>source_id,gen_random_uuid()::text);
   IF target_id=ANY(used_ids) THEN RAISE EXCEPTION 'Dos registros de % identifican el mismo elemento destino',name USING ERRCODE='22023'; END IF;
   used_ids:=array_append(used_ids,target_id);table_map:=table_map||jsonb_build_object(source_id,target_id);
  END LOOP;
  maps:=maps||jsonb_build_object(name,table_map);
 END LOOP;
 -- Apply in dependency order. Categories' base-unit foreign key is deferred.
 FOR spec IN SELECT value FROM jsonb_array_elements(specs) LOOP
  name:=spec->>'table';incoming_ids:=ARRAY[]::text[];
  FOR row IN SELECT value FROM jsonb_array_elements(p_payload->'tables'->name) LOOP
   target_id:=maps->name->>(row->>'id');incoming_ids:=array_append(incoming_ids,target_id);
   translated:=public.configuration_remap(name,row,maps,p_target)||jsonb_build_object('id',target_id);
   SELECT value INTO current_row FROM jsonb_array_elements(snapshot->'tables'->name) WHERE value->>'id'=target_id;
   global_row:=spec->>'scope'='global' OR (spec->>'scope'='mixed' AND translated->>'plant_id' IS NULL);
   IF global_row AND current_row IS NOT NULL AND public.configuration_values(current_row)<>public.configuration_values(translated) THEN RAISE EXCEPTION 'Dependencia compartida incompatible en %: %. No se modificó el catálogo global.',name,coalesce(row->>'code',row->>'nombre',row->>'section_code',row->>'id') USING ERRCODE='22023'; END IF;
   IF global_row AND current_row IS NULL AND NOT coalesce((p_options->>'create_dependencies')::boolean,false) THEN RAISE EXCEPTION 'Falta dependencia compartida en %: %. Autoriza su creación o configúrala primero.',name,coalesce(row->>'code',row->>'nombre',row->>'section_code',row->>'id') USING ERRCODE='22023'; END IF;
   action:=CASE WHEN current_row IS NULL THEN 'create' WHEN public.configuration_values(current_row)=public.configuration_values(translated) THEN 'reuse' ELSE 'update' END;
   changes:=changes||jsonb_build_array(jsonb_build_object('table',name,'action',action,'shared',global_row,'source_id',row->>'id','target_id',target_id,'before',public.configuration_values(current_row),'after',public.configuration_values(translated)));
   IF action='reuse' THEN CONTINUE; END IF;
   -- Reject reserved identifiers that would overwrite an unrelated existing row.
   IF current_row IS NULL THEN
    EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1',name) INTO candidate USING target_id;
    IF candidate IS NOT NULL THEN RAISE EXCEPTION 'El identificador destino ya pertenece a otro registro' USING ERRCODE='40001'; END IF;
   END IF;
   translated:=translated-'created_at'-'updated_at';
   -- JSONB is transported as exact text to preserve decimal tokens inside curves.
   FOR key IN SELECT jsonb_array_elements_text(snapshot->'json_fields'->name) LOOP
    IF translated->>key IS NOT NULL THEN translated:=translated||jsonb_build_object(key,(translated->>key)::jsonb); END IF;
   END LOOP;
   SELECT string_agg(format('%I',field_name),',' ORDER BY field_name),string_agg(format('%I=EXCLUDED.%I',field_name,field_name),',' ORDER BY field_name) FILTER(WHERE field_name<>'id') INTO column_list,assignments FROM jsonb_object_keys(translated) fields(field_name);
   EXECUTE format('INSERT INTO public.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) ON CONFLICT(id) DO UPDATE SET %s',name,column_list,column_list,name,assignments) USING translated;
  END LOOP;
  -- Points/products are authoritative relationships of imported parent rows.
  IF spec->>'scope'='relation' THEN
   key:=CASE WHEN name='calibration_curve_points' THEN 'curve_id' ELSE 'silo_config_id' END;
   seen:=ARRAY(SELECT value FROM jsonb_each_text(maps->CASE WHEN name='calibration_curve_points' THEN 'calibration_curves' ELSE 'plant_silos_config' END));
   FOR current_row IN SELECT value FROM jsonb_array_elements(snapshot->'tables'->name) WHERE value->>key=ANY(seen) AND NOT (value->>'id'=ANY(incoming_ids)) LOOP
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',name) USING current_row->>'id';
    changes:=changes||jsonb_build_array(jsonb_build_object('table',name,'action','remove_relation','target_id',current_row->>'id','before',public.configuration_values(current_row),'after',NULL));
   END LOOP;
  ELSIF spec->>'scope' IN ('plant','mixed') THEN
   flag:=CASE WHEN snapshot->'schema'->name ? 'is_active' THEN 'is_active' WHEN snapshot->'schema'->name ? 'active' THEN 'active' ELSE NULL END;
   FOR current_row IN SELECT value FROM jsonb_array_elements(snapshot->'tables'->name) WHERE value->>'plant_id'=p_target AND NOT (value->>'id'=ANY(incoming_ids)) LOOP
    action:='retain';
    IF flag IS NOT NULL AND coalesce((p_options->>'deactivate_extras')::boolean,false) AND (current_row->>flag)::boolean IS DISTINCT FROM false THEN
     EXECUTE format('UPDATE public.%I SET %I=false WHERE id=$1 AND plant_id=$2',name,flag) USING current_row->>'id',p_target; action:='deactivate';
    END IF;
    changes:=changes||jsonb_build_array(jsonb_build_object('table',name,'action',action,'target_id',current_row->>'id','before',public.configuration_values(current_row),'after',CASE WHEN action='deactivate' THEN public.configuration_values(current_row)||jsonb_build_object(flag,false) ELSE public.configuration_values(current_row) END));
   END LOOP;
  END IF;
 END LOOP;
 -- The destination identity, status, layouts and legacy embedded arrays stay local.
 plant_changes:=jsonb_build_object('has_cone_measurement',p_payload->'plant'->'has_cone_measurement','has_cajon_measurement',p_payload->'plant'->'has_cajon_measurement','petty_cash_established',p_payload->'plant'->'petty_cash_established');
 IF plant_changes<>jsonb_build_object('has_cone_measurement',snapshot->'plant'->'has_cone_measurement','has_cajon_measurement',snapshot->'plant'->'has_cajon_measurement','petty_cash_established',snapshot->'plant'->'petty_cash_established') THEN
  UPDATE plants SET has_cone_measurement=(plant_changes->>'has_cone_measurement')::boolean,has_cajon_measurement=(plant_changes->>'has_cajon_measurement')::boolean,petty_cash_established=(plant_changes->>'petty_cash_established')::numeric WHERE id=p_target;
  changes:=changes||jsonb_build_array(jsonb_build_object('table','plants','action','update','target_id',p_target,'before',snapshot->'plant','after',plant_changes));
 END IF;
 SET CONSTRAINTS ALL IMMEDIATE;
 RETURN jsonb_build_object('changes',changes,'mappings',maps,'errors','[]'::jsonb,'summary',(SELECT jsonb_object_agg(totals.action,totals.count) FROM (SELECT value->>'action' action,count(*) count FROM jsonb_array_elements(changes) GROUP BY 1) totals));
END $$;

CREATE FUNCTION public.configuration_export(p_actor_id text,p_plant_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor_id AND is_active AND role IN ('admin','super_admin')) THEN RAISE EXCEPTION 'Acceso no autorizado' USING ERRCODE='42501'; END IF;
 RETURN public.configuration_snapshot(p_plant_id);
END $$;

CREATE FUNCTION public.configuration_import(p_actor_id text,p_target text,p_payload jsonb,p_digest text,p_options jsonb DEFAULT '{}',p_preview_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.users; preview public.configuration_import_previews; snapshot jsonb; fingerprint text; plan jsonb; token uuid; applied_result jsonb; message text;
BEGIN
 SELECT * INTO actor FROM users WHERE id=p_actor_id AND is_active AND role IN ('admin','super_admin');
 IF NOT FOUND THEN RAISE EXCEPTION 'Acceso no autorizado' USING ERRCODE='42501'; END IF;
 -- Also serialize with legacy configuration endpoints which do not lock plants.
 LOCK TABLE plants,unit_categories,units,materiales_catalog,procedencias_catalog,additives_catalog,material_conversion_factors,calibration_curves,
  plant_aggregates_config,plant_cajones_config,plant_silos_config,plant_additives_config,plant_diesel_config,plant_products_config,plant_utilities_meters_config,plant_petty_cash_config,
  measurement_configs,calibration_curve_points,silo_allowed_products IN SHARE ROW EXCLUSIVE MODE;
 IF p_preview_id IS NOT NULL THEN
  SELECT * INTO preview FROM configuration_import_previews WHERE id=p_preview_id FOR UPDATE;
  IF NOT FOUND OR preview.actor_id<>actor.id OR preview.plant_id<>p_target OR preview.package_digest<>p_digest OR preview.payload<>p_payload OR preview.options<>p_options THEN RAISE EXCEPTION 'La vista previa no corresponde al archivo, opciones, usuario o destino' USING ERRCODE='22023'; END IF;
  IF preview.consumed_at IS NOT NULL THEN RETURN preview.result||jsonb_build_object('replayed',true); END IF;
  IF preview.expires_at<now() THEN RAISE EXCEPTION 'La vista previa caducó; vuelve a revisar las diferencias' USING ERRCODE='40001'; END IF;
 END IF;
 snapshot:=public.configuration_snapshot(p_target); fingerprint:=encode(digest(snapshot::text,'sha256'),'hex');
 IF p_preview_id IS NULL THEN
  BEGIN
   plan:=public.configuration_apply_internal(p_target,p_payload,p_options);
   RAISE EXCEPTION 'preview rollback' USING ERRCODE='P4004';
  EXCEPTION WHEN SQLSTATE 'P4004' THEN NULL;
   WHEN OTHERS THEN GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;plan:=jsonb_build_object('changes','[]'::jsonb,'errors',jsonb_build_array(message),'summary','{}'::jsonb);
  END;
  IF jsonb_array_length(plan->'errors')=0 THEN
   INSERT INTO configuration_import_previews(actor_id,plant_id,package_digest,payload,options,fingerprint,plan) VALUES(actor.id,p_target,p_digest,p_payload,p_options,fingerprint,plan) RETURNING id INTO token;
  END IF;
  INSERT INTO audit_logs(user_id,user_email,user_name,action,plant_id,details) VALUES(actor.id,actor.email,actor.name,'CONFIGURATION_IMPORT_PREVIEWED',p_target,jsonb_build_object('package_digest',p_digest,'source_plant',p_payload->'plant'->>'id','summary',plan->'summary','errors',plan->'errors','options',p_options));
  RETURN plan||jsonb_build_object('preview_token',token,'expires_at',now()+interval '15 minutes','destination',snapshot->'plant','fingerprint',fingerprint,
   'warnings',jsonb_build_array('No se modifican inventarios históricos. Se conservan nombre, código, ubicación, estado e imágenes de la planta destino.','Los puntos de curvas y productos permitidos de silos importados reemplazan sus relaciones anteriores. Los catálogos existentes incompatibles bloquean la importación.'));
 END IF;
 IF fingerprint<>preview.fingerprint THEN RAISE EXCEPTION 'La configuración destino o sus dependencias cambiaron; genera otra vista previa' USING ERRCODE='40001'; END IF;
 plan:=public.configuration_apply_internal(p_target,p_payload,p_options,preview.plan->'mappings');
 INSERT INTO audit_logs(user_id,user_email,user_name,action,plant_id,details) VALUES(actor.id,actor.email,actor.name,'CONFIGURATION_IMPORTED',p_target,jsonb_build_object('package_digest',p_digest,'source_plant',p_payload->'plant'->>'id','summary',plan->'summary','options',p_options,'preview_token',p_preview_id));
 applied_result:=jsonb_build_object('plant_id',p_target,'summary',plan->'summary','package_digest',p_digest,'applied_at',now(),'replayed',false);
 UPDATE configuration_import_previews SET consumed_at=now(),result=applied_result WHERE id=p_preview_id;
 RETURN applied_result;
END $$;

REVOKE ALL ON FUNCTION public.configuration_table_specs(),public.configuration_serialized_row(jsonb,text[]),public.configuration_snapshot(text),public.configuration_identity(jsonb,jsonb),public.configuration_values(jsonb),public.configuration_remap(text,jsonb,jsonb,text),public.configuration_apply_internal(text,jsonb,jsonb,jsonb),public.configuration_export(text,text),public.configuration_import(text,text,jsonb,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.configuration_export(text,text),public.configuration_import(text,text,jsonb,text,jsonb,uuid) TO service_role;
COMMIT;
