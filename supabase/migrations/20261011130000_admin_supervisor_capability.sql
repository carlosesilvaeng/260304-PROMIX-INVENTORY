BEGIN;
ALTER TABLE public.users ADD COLUMN can_capture_inventory boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD CONSTRAINT users_capture_admin_only CHECK (NOT can_capture_inventory OR role IN ('admin','super_admin'));
ALTER TABLE public.inventory_month ADD COLUMN submitted_by_user_id text;
-- Use the recorded account ID, never a display-name match. Unknown legacy senders remain blocked.
UPDATE public.inventory_month m SET submitted_by_user_id=(
 SELECT a.user_id FROM public.audit_logs a WHERE a.inventory_month_id=m.id
 AND a.action='INVENTORY_SUBMITTED' ORDER BY a.timestamp DESC,a.id DESC LIMIT 1
) WHERE m.status='SUBMITTED' AND m.submitted_by_user_id IS NULL;

CREATE OR REPLACE FUNCTION public.inventory_can_capture(actor public.users,p_plant_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE(actor.is_active,false)
 AND (actor.role IN ('plant_manager','operations_manager') OR (actor.role IN ('admin','super_admin') AND actor.can_capture_inventory))
 AND (actor.role='operations_manager' OR COALESCE(p_plant_id=ANY(actor.assigned_plants),false))
 AND EXISTS(SELECT 1 FROM public.plants WHERE id=p_plant_id AND is_active);
$$;
REVOKE ALL ON FUNCTION public.inventory_can_capture(public.users,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_can_capture(public.users,text) TO service_role;

-- Amend only the authorization guard in each installed function. Preserve other
-- feature changes, including product capture behavior, regardless of deployment order.
DO $$
DECLARE signature text; definition text; replacement text;
BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'public.save_inventory_section_guarded(text,text,jsonb,text,bigint,uuid,text,jsonb)',
  'public.start_inventory_guarded(text,text,text)',
  'public.record_inventory_capture_started(text,text,text,text)'
 ] LOOP
  definition:=pg_get_functiondef(signature::regprocedure);
  replacement:=CASE WHEN signature LIKE '%start_inventory%' THEN 'NOT public.inventory_can_capture(actor,p_plant_id)' ELSE 'NOT public.inventory_can_capture(actor,m.plant_id)' END;
  IF position('actor.role NOT IN (''plant_manager'',''operations_manager'')' IN definition)=0 THEN
   RAISE EXCEPTION 'Authorization guard not found in %',signature;
  END IF;
  EXECUTE replace(definition,'actor.role NOT IN (''plant_manager'',''operations_manager'')',replacement);
 END LOOP;
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
  IF p_action IN ('save_draft','submit') AND NOT public.inventory_can_capture(actor,m.plant_id)
    OR p_action IN ('approve','reject') AND actor.role NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'Acción no autorizada' USING ERRCODE='42501';
  END IF;
  IF p_action='approve' AND (m.submitted_by_user_id IS NULL OR m.submitted_by_user_id=actor.id) THEN
    RAISE EXCEPTION 'Otra persona debe aprobar el inventario; el remitente debe estar identificado' USING ERRCODE='42501';
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
    submitted_by_user_id=CASE WHEN p_action='submit' THEN actor.id WHEN p_action='reject' THEN NULL ELSE submitted_by_user_id END,
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

REVOKE ALL ON FUNCTION public.record_inventory_capture_started(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_inventory_capture_started(text,text,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
