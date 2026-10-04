BEGIN;
CREATE INDEX IF NOT EXISTS inventory_reporting_period_idx ON public.inventory_month(year_month DESC, plant_id, id);
CREATE INDEX IF NOT EXISTS inventory_reporting_audit_idx ON public.audit_logs(inventory_month_id, timestamp DESC, id);
CREATE INDEX IF NOT EXISTS inventory_reporting_receipt_idx ON public.inventory_write_receipts(inventory_month_id, section, ((receipt->>'revision')));

-- Counts are evidence from guarded writes, never inferred from prefilled rows.
-- Current configuration is used only to identify pending work in open months.
CREATE OR REPLACE FUNCTION public.inventory_reporting_meta(p_month_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m public.inventory_month; code text; child text; config text; saved integer; expected integer;
  last_receipt jsonb; manifest jsonb; counts jsonb := '[]'; captured integer; completed integer; pending integer;
BEGIN
 SELECT * INTO m FROM public.inventory_month WHERE id=p_month_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inventario inexistente' USING ERRCODE='P0002'; END IF;
 SELECT receipt->'summary'->'configured_sections' INTO manifest FROM public.inventory_write_receipts WHERE inventory_month_id=m.id AND receipt->'summary' ? 'configured_sections' ORDER BY receipt->>'saved_at' DESC LIMIT 1;
 FOR code,child,config IN SELECT * FROM (VALUES
  ('aggregates','inventory_aggregates_entries','plant_aggregates_config'),
  ('silos','inventory_silos_entries','plant_silos_config'),
  ('additives','inventory_additives_entries','plant_additives_config'),
  ('diesel','inventory_diesel_entries','plant_diesel_config'),
  ('products','inventory_products_entries','plant_products_config'),
  ('utilities','inventory_utilities_entries','plant_utilities_meters_config'),
  ('petty-cash','inventory_petty_cash_entries','plant_petty_cash_config')) sections LOOP
   EXECUTE format('SELECT count(*) FROM public.%I WHERE inventory_month_id=$1',child) INTO saved USING m.id;
   SELECT r.receipt INTO last_receipt FROM public.inventory_write_receipts r
    WHERE r.inventory_month_id=m.id AND r.section=code ORDER BY (r.receipt->>'revision')::bigint DESC LIMIT 1;
   captured := CASE WHEN last_receipt->'summary' ? 'captured_count' THEN (last_receipt->'summary'->>'captured_count')::integer WHEN saved=0 THEN 0 ELSE NULL END;
   completed := CASE WHEN last_receipt->'summary' ? 'complete_count' THEN (last_receipt->'summary'->>'complete_count')::integer WHEN saved=0 THEN 0 ELSE NULL END;
   IF m.status='IN_PROGRESS' THEN
    EXECUTE format('SELECT count(*) FROM public.%I WHERE plant_id=$1 AND is_active IS DISTINCT FROM false',config) INTO expected USING m.plant_id;
    IF code='aggregates' AND expected=0 THEN SELECT count(*) INTO expected FROM public.plant_cajones_config WHERE plant_id=m.plant_id AND is_active IS DISTINCT FROM false; END IF;
    expected := greatest(expected,saved);
   ELSE
    expected := CASE WHEN manifest ? code THEN (manifest->>code)::integer WHEN last_receipt->'summary' ? 'configured_count' THEN (last_receipt->'summary'->>'configured_count')::integer
      WHEN last_receipt->'summary' ? 'pending_count' THEN completed + (last_receipt->'summary'->>'pending_count')::integer ELSE NULL END;
   END IF;
   pending := CASE WHEN completed IS NOT NULL AND expected IS NOT NULL THEN greatest(expected-completed,0) ELSE NULL END;
   counts := counts || jsonb_build_array(jsonb_build_object('section',code,'saved_count',saved,'configured_count',expected,
    'captured_count',captured,'complete_count',completed,'pending_count',pending,
    'source',CASE WHEN last_receipt IS NOT NULL THEN 'receipt' WHEN saved=0 THEN 'none' ELSE 'legacy' END,
    'revision',last_receipt->'revision','saved_at',last_receipt->>'saved_at','reporting_metadata',last_receipt->'summary'->'reporting_metadata'));
 END LOOP;
 RETURN jsonb_build_object('sections',counts,
  'saved_count',(SELECT sum((s->>'saved_count')::integer) FROM jsonb_array_elements(counts) s),
  'captured_count',(SELECT CASE WHEN count(*) FILTER(WHERE s->>'captured_count' IS NULL)>0 THEN NULL ELSE sum((s->>'captured_count')::integer) END FROM jsonb_array_elements(counts) s),
  'complete_count',(SELECT CASE WHEN count(*) FILTER(WHERE s->>'complete_count' IS NULL)>0 THEN NULL ELSE sum((s->>'complete_count')::integer) END FROM jsonb_array_elements(counts) s),
  'pending_count',(SELECT CASE WHEN count(*) FILTER(WHERE s->>'pending_count' IS NULL)>0 THEN NULL ELSE sum((s->>'pending_count')::integer) END FROM jsonb_array_elements(counts) s),
  'first_capture_received_at',least((SELECT min(timestamp) FROM public.audit_logs WHERE inventory_month_id=m.id AND action='INVENTORY_CAPTURE_STARTED'),(SELECT min((receipt->>'saved_at')::timestamptz) FROM public.inventory_write_receipts WHERE inventory_month_id=m.id AND COALESCE((receipt->'summary'->>'captured_count')::integer,0)>0)),
  'first_capture_client_at',(SELECT min(receipt->'summary'->>'client_capture_started_at') FROM public.inventory_write_receipts WHERE inventory_month_id=m.id),
  'last_save_received_at',(SELECT max(receipt->>'saved_at') FROM public.inventory_write_receipts WHERE inventory_month_id=m.id),
  'scope',CASE WHEN m.status='IN_PROGRESS' THEN 'current_configuration' ELSE 'saved_history' END);
END $$;

CREATE OR REPLACE FUNCTION public.inventory_reports_page(p_actor_id text,p_filters jsonb DEFAULT '{}',p_offset integer DEFAULT 0,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.users; result jsonb;
BEGIN
 SELECT * INTO actor FROM public.users WHERE id=p_actor_id AND is_active;
 IF NOT FOUND OR actor.role NOT IN ('plant_manager','operations_manager','admin','super_admin') THEN RAISE EXCEPTION 'Acceso no autorizado' USING ERRCODE='42501'; END IF;
 IF p_offset<0 OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Paginación inválida' USING ERRCODE='22023'; END IF;
 IF actor.role='plant_manager' AND p_filters->>'plant_id' IS NOT NULL AND NOT COALESCE(p_filters->>'plant_id'=ANY(actor.assigned_plants),false) THEN RAISE EXCEPTION 'Planta no autorizada' USING ERRCODE='42501'; END IF;
 WITH filtered AS MATERIALIZED (
  SELECT m.*,p.name AS plant_name FROM public.inventory_month m JOIN public.plants p ON p.id=m.plant_id
  WHERE (actor.role<>'plant_manager' OR m.plant_id=ANY(actor.assigned_plants))
   AND (p_filters->>'plant_id' IS NULL OR m.plant_id=p_filters->>'plant_id')
   AND (p_filters->>'year_month' IS NULL OR m.year_month=p_filters->>'year_month')
   AND (p_filters->>'year' IS NULL OR left(m.year_month,4)=p_filters->>'year')
   AND (p_filters->>'month' IS NULL OR right(m.year_month,2)=p_filters->>'month')
   AND (p_filters->>'status' IS NULL OR m.status=p_filters->>'status')
   AND (p_filters->>'as_of' IS NULL OR m.created_at<=(p_filters->>'as_of')::timestamptz)
 ), paged AS (
  SELECT * FROM filtered ORDER BY year_month DESC,plant_id,id OFFSET p_offset LIMIT p_limit
 ) SELECT jsonb_build_object('reporting_version',3,
  'data',COALESCE((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('progress',public.inventory_reporting_meta(r.id)) ORDER BY r.year_month DESC,r.plant_id,r.id) FROM paged r),'[]'),
  'pagination',jsonb_build_object('offset',p_offset,'limit',p_limit,'total',(SELECT count(*) FROM filtered),'has_more',p_offset+p_limit<(SELECT count(*) FROM filtered)),
  'snapshot_id',(SELECT md5(COALESCE(string_agg(id||':'||write_revision||':'||status||':'||updated_at::text,',' ORDER BY year_month DESC,plant_id,id),'')) FROM filtered),
  'totals',jsonb_build_object('total',(SELECT count(*) FROM filtered),
   'approved',(SELECT count(*) FROM filtered WHERE status='APPROVED'),
   'submitted',(SELECT count(*) FROM filtered WHERE status='SUBMITTED'),
   'in_progress',(SELECT count(*) FROM filtered WHERE status='IN_PROGRESS'),
   'this_year',(SELECT count(*) FROM filtered WHERE left(year_month,4)=to_char(current_date,'YYYY')),
   'with_confirmed_capture',(SELECT count(*) FROM filtered m WHERE EXISTS(SELECT 1 FROM public.inventory_write_receipts r WHERE r.inventory_month_id=m.id AND COALESCE((r.receipt->'summary'->>'captured_count')::integer,0)>0))),
  'years',COALESCE((SELECT jsonb_agg(y ORDER BY y DESC) FROM (SELECT DISTINCT left(year_month,4) y FROM public.inventory_month WHERE actor.role<>'plant_manager' OR plant_id=ANY(actor.assigned_plants)) years),'[]')) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.inventory_audit_page(p_actor_id text,p_filters jsonb DEFAULT '{}',p_offset integer DEFAULT 0,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.users; result jsonb;
BEGIN
 SELECT * INTO actor FROM public.users WHERE id=p_actor_id AND is_active;
 IF NOT FOUND OR actor.role NOT IN ('plant_manager','operations_manager','admin','super_admin') THEN RAISE EXCEPTION 'Acceso no autorizado' USING ERRCODE='42501'; END IF;
 IF p_offset<0 OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Paginación inválida' USING ERRCODE='22023'; END IF;
 IF actor.role='plant_manager' AND p_filters->>'plant_id' IS NOT NULL AND NOT COALESCE(p_filters->>'plant_id'=ANY(actor.assigned_plants),false) THEN RAISE EXCEPTION 'Planta no autorizada' USING ERRCODE='42501'; END IF;
 IF p_filters->>'inventory_month_id' IS NOT NULL THEN PERFORM public.inventory_authorized_actor(actor.id,(SELECT plant_id FROM public.inventory_month WHERE id=p_filters->>'inventory_month_id')); END IF;
 WITH filtered AS MATERIALIZED (
  SELECT a.* FROM public.audit_logs a
  WHERE (actor.role<>'plant_manager' OR a.plant_id=ANY(actor.assigned_plants) OR (a.action='USER_LOGIN' AND a.user_id=actor.id))
   AND (actor.role<>'admin' OR NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=a.user_id AND u.role='super_admin'))
   AND (p_filters->>'plant_id' IS NULL OR a.plant_id=p_filters->>'plant_id')
   AND (p_filters->>'user_id' IS NULL OR a.user_id=p_filters->>'user_id')
   AND (p_filters->>'inventory_month_id' IS NULL OR a.inventory_month_id=p_filters->>'inventory_month_id')
   AND (p_filters->>'year_month' IS NULL OR a.inventory_month_id IN (SELECT id FROM public.inventory_month WHERE year_month=p_filters->>'year_month'))
   AND (p_filters->>'as_of' IS NULL OR a.timestamp<=(p_filters->>'as_of')::timestamptz)
 ), paged AS (SELECT * FROM filtered ORDER BY timestamp DESC,id DESC OFFSET p_offset LIMIT p_limit)
 SELECT jsonb_build_object('reporting_version',3,'data',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY timestamp DESC,id DESC) FROM paged a),'[]'),
  'pagination',jsonb_build_object('offset',p_offset,'limit',p_limit,'total',(SELECT count(*) FROM filtered),'has_more',p_offset+p_limit<(SELECT count(*) FROM filtered))) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.inventory_report_snapshot(p_actor_id text,p_month_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m public.inventory_month; actor public.users; previous_id text; previous_snapshot jsonb;
BEGIN
 SELECT * INTO m FROM public.inventory_month WHERE id=p_month_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inventario inexistente' USING ERRCODE='P0002'; END IF;
 actor := public.inventory_authorized_actor(p_actor_id,m.plant_id);
 IF actor.role NOT IN ('plant_manager','operations_manager','admin','super_admin') THEN RAISE EXCEPTION 'Acceso no autorizado' USING ERRCODE='42501'; END IF;
 SELECT id INTO previous_id FROM public.inventory_month WHERE plant_id=m.plant_id AND year_month=to_char(to_date(m.year_month||'-01','YYYY-MM-DD')-interval '1 month','YYYY-MM');
 IF previous_id IS NOT NULL THEN previous_snapshot := public.get_inventory_snapshot(previous_id)||jsonb_build_object('progress',public.inventory_reporting_meta(previous_id)); END IF;
 RETURN public.get_inventory_snapshot(m.id)||jsonb_build_object('progress',public.inventory_reporting_meta(m.id),'previous',previous_snapshot,
  'plant_name',(SELECT name FROM public.plants WHERE id=m.plant_id),'reporting_version',3);
END $$;

REVOKE ALL ON FUNCTION public.inventory_reporting_meta(text),public.inventory_reports_page(text,jsonb,integer,integer),public.inventory_audit_page(text,jsonb,integer,integer),public.inventory_report_snapshot(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_reporting_meta(text),public.inventory_reports_page(text,jsonb,integer,integer),public.inventory_audit_page(text,jsonb,integer,integer),public.inventory_report_snapshot(text,text) TO service_role;
COMMIT;
