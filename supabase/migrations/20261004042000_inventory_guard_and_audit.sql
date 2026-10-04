BEGIN;
ALTER TABLE public.inventory_month ADD COLUMN IF NOT EXISTS write_revision bigint NOT NULL DEFAULT 0;
CREATE TABLE public.inventory_section_state (
  inventory_month_id text NOT NULL REFERENCES public.inventory_month(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('aggregates','silos','additives','diesel','products','utilities','petty-cash')),
  revision bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (inventory_month_id, section)
);
CREATE TABLE public.inventory_write_receipts (
  inventory_month_id text NOT NULL REFERENCES public.inventory_month(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  actor_id text NOT NULL,
  section text NOT NULL,
  request_hash text NOT NULL,
  receipt jsonb NOT NULL,
  PRIMARY KEY (inventory_month_id, operation_id)
);
ALTER TABLE public.inventory_section_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_write_receipts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.inventory_section_state, public.inventory_write_receipts TO service_role;

-- Historical events are only enriched through an existing, unambiguous relation.
UPDATE public.audit_logs a SET plant_id = m.plant_id
FROM public.inventory_month m WHERE a.inventory_month_id = m.id AND a.plant_id IS NULL;

CREATE OR REPLACE FUNCTION public.inventory_authorized_actor(p_actor_id text, p_plant_id text)
RETURNS public.users LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor public.users;
BEGIN
  SELECT * INTO actor FROM public.users WHERE id = p_actor_id;
  IF NOT FOUND OR NOT COALESCE(actor.is_active,false) THEN RAISE EXCEPTION 'Usuario inactivo o inexistente' USING ERRCODE = '42501'; END IF;
  IF actor.role = 'plant_manager' AND NOT COALESCE(p_plant_id = ANY(actor.assigned_plants),false) THEN
    RAISE EXCEPTION 'No tienes acceso a esta planta' USING ERRCODE = '42501';
  END IF;
  RETURN actor;
END $$;

CREATE OR REPLACE FUNCTION public.save_inventory_section_guarded(
  p_inventory_month_id text, p_section text, p_rows jsonb, p_actor_id text,
  p_expected_revision bigint, p_operation_id uuid, p_request_hash text, p_summary jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  m public.inventory_month; actor public.users; prior public.inventory_write_receipts;
  current_revision bigint; saved_at timestamptz := clock_timestamp(); result jsonb; saved_rows jsonb;
  child_table text; audit_id text; config_table text; config_key text; row_data jsonb; allowed boolean;
BEGIN
  SELECT * INTO m FROM public.inventory_month WHERE id = p_inventory_month_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventario inexistente' USING ERRCODE = 'P0002'; END IF;
  actor := public.inventory_authorized_actor(p_actor_id, m.plant_id);
  IF actor.role NOT IN ('plant_manager','operations_manager') THEN
    RAISE EXCEPTION 'No tienes permisos para registrar mediciones' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 OR p_request_hash IS NULL THEN
    RAISE EXCEPTION 'Actualiza la aplicación antes de guardar' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO prior FROM public.inventory_write_receipts
  WHERE inventory_month_id = m.id AND operation_id = p_operation_id;
  IF FOUND THEN
    IF prior.actor_id <> actor.id OR prior.section <> p_section OR prior.request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'La operación ya se utilizó para otros datos' USING ERRCODE = '23505';
    END IF;
    RETURN prior.receipt || jsonb_build_object('already_applied', true);
  END IF;
  IF m.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'El inventario ya no permite modificaciones' USING ERRCODE = '40001'; END IF;
  child_table := CASE p_section WHEN 'aggregates' THEN 'inventory_aggregates_entries'
    WHEN 'silos' THEN 'inventory_silos_entries' WHEN 'additives' THEN 'inventory_additives_entries'
    WHEN 'diesel' THEN 'inventory_diesel_entries' WHEN 'products' THEN 'inventory_products_entries'
    WHEN 'utilities' THEN 'inventory_utilities_entries' WHEN 'petty-cash' THEN 'inventory_petty_cash_entries' END;
  IF child_table IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Sección o registros inválidos' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.inventory_section_state(inventory_month_id,section) VALUES(m.id,p_section) ON CONFLICT DO NOTHING;
  SELECT revision INTO current_revision FROM public.inventory_section_state WHERE inventory_month_id=m.id AND section=p_section;
  IF current_revision <> p_expected_revision THEN RAISE EXCEPTION 'Otra sesión modificó esta sección. Actualiza los datos antes de guardar.' USING ERRCODE = '40001'; END IF;
  -- Configuration ids and existing entry ids must belong to this plant/month.
  -- This is checked again here, independently of the Edge Function.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE r ? 'inventory_month_id' AND r->>'inventory_month_id' <> m.id) THEN
    RAISE EXCEPTION 'Inventario inconsistente' USING ERRCODE = '22023';
  END IF;
  config_table := CASE p_section WHEN 'aggregates' THEN 'plant_aggregates_config'
    WHEN 'silos' THEN 'plant_silos_config' WHEN 'additives' THEN 'plant_additives_config'
    WHEN 'diesel' THEN 'plant_diesel_config' WHEN 'products' THEN 'plant_products_config'
    WHEN 'utilities' THEN 'plant_utilities_meters_config' WHEN 'petty-cash' THEN 'plant_petty_cash_config' END;
  config_key := CASE p_section WHEN 'aggregates' THEN 'aggregate_config_id' WHEN 'silos' THEN 'silo_config_id'
    WHEN 'additives' THEN 'additive_config_id' WHEN 'diesel' THEN 'diesel_config_id' WHEN 'products' THEN 'product_config_id'
    WHEN 'utilities' THEN 'utility_meter_config_id' WHEN 'petty-cash' THEN 'petty_cash_config_id' END;
  IF p_section='aggregates' AND NOT EXISTS(SELECT 1 FROM public.plant_aggregates_config WHERE plant_id=m.plant_id AND is_active) THEN config_table := 'plant_cajones_config'; END IF;
  FOR row_data IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND plant_id=$2 AND is_active)',config_table)
      INTO allowed USING row_data->>config_key,m.plant_id;
    IF NOT allowed THEN RAISE EXCEPTION 'Configuración ajena o inactiva' USING ERRCODE='42501'; END IF;
    IF row_data->>'id' IS NOT NULL THEN
      EXECUTE format('SELECT NOT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND inventory_month_id<>$2)',child_table)
        INTO allowed USING row_data->>'id',m.id;
      IF NOT allowed THEN RAISE EXCEPTION 'Registro ajeno al inventario' USING ERRCODE='42501'; END IF;
    END IF;
  END LOOP;
  IF p_section='silos' THEN PERFORM public.replace_inventory_silos_atomic(m.id,p_rows);
  ELSIF p_section='additives' THEN PERFORM public.replace_inventory_additives_atomic(m.id,p_rows);
  ELSE PERFORM public.replace_inventory_section_rows_atomic(p_section,m.id,p_rows); END IF;
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.id), ''[]''::jsonb) FROM public.%I e WHERE inventory_month_id=$1',child_table) INTO saved_rows USING m.id;
  UPDATE public.inventory_section_state SET revision=current_revision+1 WHERE inventory_month_id=m.id AND section=p_section;
  UPDATE public.inventory_month SET write_revision=write_revision+1,updated_at=saved_at WHERE id=m.id;
  INSERT INTO public.audit_logs(user_id,user_email,user_name,action,plant_id,inventory_month_id,timestamp,details)
  VALUES(actor.id,actor.email,actor.name,'SECTION_SAVED',m.plant_id,m.id,saved_at,
    p_summary || jsonb_build_object('section',p_section,'year_month',m.year_month,'revision',current_revision+1,'operation_id',p_operation_id,'origin','server'))
  RETURNING id INTO audit_id;
  result := jsonb_build_object('revision',current_revision+1,'saved_at',saved_at,'operation_id',p_operation_id,'audit_id',audit_id,
    'summary',p_summary,'data',CASE WHEN p_section IN ('diesel','petty-cash') THEN saved_rows->0 ELSE saved_rows END);
  INSERT INTO public.inventory_write_receipts VALUES(m.id,p_operation_id,actor.id,p_section,p_request_hash,result);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.apply_inventory_workflow_guarded(
  p_inventory_month_id text, p_actor_id text, p_action text, p_expected_revision bigint,
  p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE m public.inventory_month; actor public.users; action_name text; next_status text; stamp timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO m FROM public.inventory_month WHERE id=p_inventory_month_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventario inexistente' USING ERRCODE='P0002'; END IF;
  actor := public.inventory_authorized_actor(p_actor_id,m.plant_id);
  IF p_action IN ('save_draft','submit') AND actor.role NOT IN ('plant_manager','operations_manager')
    OR p_action IN ('approve','reject') AND actor.role NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'Acción no autorizada' USING ERRCODE='42501';
  END IF;
  IF p_action='submit' AND m.status='SUBMITTED' THEN RETURN to_jsonb(m); END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0 THEN RAISE EXCEPTION 'Revisión obligatoria' USING ERRCODE='22023'; END IF;
  IF m.write_revision <> p_expected_revision THEN RAISE EXCEPTION 'El inventario cambió. Actualiza antes de continuar.' USING ERRCODE='40001'; END IF;
  IF p_action IN ('save_draft','submit') AND m.status <> 'IN_PROGRESS'
    OR p_action IN ('approve','reject') AND m.status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'Transición de estado inválida' USING ERRCODE='40001';
  END IF;
  IF p_action='reject' AND NULLIF(btrim(p_notes),'') IS NULL THEN RAISE EXCEPTION 'El motivo de rechazo es obligatorio' USING ERRCODE='22023'; END IF;
  next_status := CASE p_action WHEN 'save_draft' THEN 'IN_PROGRESS' WHEN 'submit' THEN 'SUBMITTED' WHEN 'approve' THEN 'APPROVED' WHEN 'reject' THEN 'IN_PROGRESS' END;
  IF next_status IS NULL THEN RAISE EXCEPTION 'Acción inválida' USING ERRCODE='22023'; END IF;
  UPDATE public.inventory_month SET status=next_status,updated_at=stamp,write_revision=write_revision+1,
    submitted_by=CASE WHEN p_action='submit' THEN actor.name WHEN p_action='reject' THEN NULL ELSE submitted_by END,
    submitted_at=CASE WHEN p_action='submit' THEN stamp WHEN p_action='reject' THEN NULL ELSE submitted_at END,
    approved_by=CASE WHEN p_action='approve' THEN actor.name WHEN p_action IN ('submit','reject') THEN NULL ELSE approved_by END,
    approved_at=CASE WHEN p_action='approve' THEN stamp WHEN p_action IN ('submit','reject') THEN NULL ELSE approved_at END,
    approval_notes=CASE WHEN p_action='approve' THEN p_notes WHEN p_action IN ('submit','reject') THEN NULL ELSE approval_notes END,
    rejected_by=CASE WHEN p_action='reject' THEN actor.name WHEN p_action IN ('submit','approve') THEN NULL ELSE rejected_by END,
    rejected_at=CASE WHEN p_action='reject' THEN stamp WHEN p_action IN ('submit','approve') THEN NULL ELSE rejected_at END,
    rejection_notes=CASE WHEN p_action='reject' THEN p_notes WHEN p_action IN ('submit','approve') THEN NULL ELSE rejection_notes END
  WHERE id=m.id;
  action_name := CASE p_action WHEN 'save_draft' THEN 'INVENTORY_DRAFT_SAVED' WHEN 'submit' THEN 'INVENTORY_SUBMITTED' WHEN 'approve' THEN 'INVENTORY_APPROVED' WHEN 'reject' THEN 'INVENTORY_REJECTED' END;
  INSERT INTO public.audit_logs(user_id,user_email,user_name,action,plant_id,inventory_month_id,timestamp,details)
  VALUES(actor.id,actor.email,actor.name,action_name,m.plant_id,m.id,stamp,
    jsonb_build_object('year_month',m.year_month,'from_status',m.status,'to_status',next_status,'notes',p_notes,'reason',CASE WHEN p_action='reject' THEN p_notes ELSE NULL END,'origin','server'));
  SELECT * INTO m FROM public.inventory_month WHERE id=m.id;
  RETURN to_jsonb(m);
END $$;

CREATE OR REPLACE FUNCTION public.start_inventory_guarded(p_plant_id text,p_year_month text,p_actor_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor public.users; m public.inventory_month; created boolean;
BEGIN
  actor := public.inventory_authorized_actor(p_actor_id,p_plant_id);
  IF actor.role NOT IN ('plant_manager','operations_manager') THEN RAISE EXCEPTION 'Acción no autorizada' USING ERRCODE='42501'; END IF;
  IF p_year_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.plants WHERE id=p_plant_id AND is_active) THEN RAISE EXCEPTION 'Planta no disponible' USING ERRCODE='22023'; END IF;
  INSERT INTO public.inventory_month(plant_id,year_month,created_by) VALUES(p_plant_id,p_year_month,actor.name)
  ON CONFLICT(plant_id,year_month) DO NOTHING RETURNING * INTO m;
  created := FOUND;
  IF NOT created THEN SELECT * INTO m FROM public.inventory_month WHERE plant_id=p_plant_id AND year_month=p_year_month;
  ELSE
    INSERT INTO public.audit_logs(user_id,user_email,user_name,action,plant_id,inventory_month_id,details)
    VALUES(actor.id,actor.email,actor.name,'INVENTORY_STARTED',p_plant_id,m.id,jsonb_build_object('year_month',p_year_month,'created_by',actor.name,'origin','server'));
  END IF;
  RETURN to_jsonb(m);
END $$;
CREATE OR REPLACE FUNCTION public.get_inventory_snapshot(p_month_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE m public.inventory_month; result jsonb; rows jsonb; section_name text; table_name text;
BEGIN
  SELECT * INTO m FROM public.inventory_month WHERE id=p_month_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventario inexistente' USING ERRCODE='P0002'; END IF;
  result := jsonb_build_object('month',to_jsonb(m),'section_revisions',
    COALESCE((SELECT jsonb_object_agg(section,revision) FROM public.inventory_section_state WHERE inventory_month_id=m.id),'{}'::jsonb));
  FOR section_name,table_name IN SELECT * FROM (VALUES ('agregados','inventory_aggregates_entries'),('silos','inventory_silos_entries'),
    ('aditivos','inventory_additives_entries'),('diesel','inventory_diesel_entries'),('productos','inventory_products_entries'),
    ('utilities','inventory_utilities_entries'),('pettyCash','inventory_petty_cash_entries')) AS sections(name,tbl) LOOP
    EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.id),''[]''::jsonb) FROM public.%I e WHERE inventory_month_id=$1',table_name)
      INTO rows USING m.id;
    result := result || jsonb_build_object(section_name,CASE WHEN section_name IN ('diesel','pettyCash') THEN rows->0 ELSE rows END);
  END LOOP;
  RETURN result || jsonb_build_object('meters',result->'utilities');
END $$;
REVOKE ALL ON FUNCTION public.get_inventory_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_snapshot(text) TO service_role;
CREATE OR REPLACE FUNCTION public.record_inventory_capture_started(p_month_id text,p_actor_id text,p_section text,p_occurred_at text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE m public.inventory_month; actor public.users;
BEGIN
  SELECT * INTO m FROM public.inventory_month WHERE id=p_month_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventario inexistente' USING ERRCODE='P0002'; END IF;
  actor := public.inventory_authorized_actor(p_actor_id,m.plant_id);
  IF actor.role NOT IN ('plant_manager','operations_manager') THEN RAISE EXCEPTION 'Acción no autorizada' USING ERRCODE='42501'; END IF;
  IF m.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'Inventario cerrado para captura' USING ERRCODE='40001'; END IF;
  IF p_section NOT IN ('aggregates','silos','additives','diesel','products','utilities','petty-cash') THEN RAISE EXCEPTION 'Sección inválida' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE inventory_month_id=m.id AND user_id=actor.id
    AND action='INVENTORY_CAPTURE_STARTED' AND details->>'section'=p_section) THEN
    INSERT INTO public.audit_logs(user_id,user_email,user_name,action,plant_id,inventory_month_id,details)
    VALUES(actor.id,actor.email,actor.name,'INVENTORY_CAPTURE_STARTED',m.plant_id,m.id,
      jsonb_build_object('section',p_section,'year_month',m.year_month,'origin','client','occurred_at',p_occurred_at,'server_saved',false));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_inventory_capture_started(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_inventory_capture_started(text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.inventory_authorized_actor(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_inventory_section_guarded(text,text,jsonb,text,bigint,uuid,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_inventory_workflow_guarded(text,text,text,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_inventory_guarded(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_inventory_section_guarded(text,text,jsonb,text,bigint,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_inventory_workflow_guarded(text,text,text,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_inventory_guarded(text,text,text) TO service_role;
COMMIT;
