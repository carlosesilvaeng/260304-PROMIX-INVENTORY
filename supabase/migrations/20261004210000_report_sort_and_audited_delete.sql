BEGIN;
CREATE OR REPLACE FUNCTION public.inventory_reports_page(p_actor_id text,p_filters jsonb DEFAULT '{}',p_offset integer DEFAULT 0,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.users; result jsonb;
BEGIN
 SELECT * INTO actor FROM public.users WHERE id=p_actor_id AND is_active;
 IF NOT FOUND OR actor.role NOT IN ('plant_manager','operations_manager','admin','super_admin') THEN RAISE EXCEPTION 'Acceso no autorizado' USING ERRCODE='42501'; END IF;
 IF p_filters ? 'activity_order' AND p_filters->>'activity_order' NOT IN ('asc','desc') THEN RAISE EXCEPTION 'Orden inválido' USING ERRCODE='22023'; END IF;
 IF p_offset<0 OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Paginación inválida' USING ERRCODE='22023'; END IF;
 IF actor.role='plant_manager' AND p_filters->>'plant_id' IS NOT NULL AND NOT COALESCE(p_filters->>'plant_id'=ANY(actor.assigned_plants),false) THEN RAISE EXCEPTION 'Planta no autorizada' USING ERRCODE='42501'; END IF;
 WITH filtered AS MATERIALIZED (
  SELECT m.*,p.name AS plant_name, greatest(m.created_at,m.updated_at,
    (SELECT max(timestamp) FROM public.audit_logs WHERE inventory_month_id=m.id),
    (SELECT max((receipt->>'saved_at')::timestamptz) FROM public.inventory_write_receipts WHERE inventory_month_id=m.id)) AS activity_at FROM public.inventory_month m JOIN public.plants p ON p.id=m.plant_id
  WHERE (actor.role<>'plant_manager' OR m.plant_id=ANY(actor.assigned_plants))
   AND (p_filters->>'plant_id' IS NULL OR m.plant_id=p_filters->>'plant_id')
   AND (p_filters->>'year_month' IS NULL OR m.year_month=p_filters->>'year_month')
   AND (p_filters->>'year' IS NULL OR left(m.year_month,4)=p_filters->>'year')
   AND (p_filters->>'month' IS NULL OR right(m.year_month,2)=p_filters->>'month')
   AND (p_filters->>'status' IS NULL OR m.status=p_filters->>'status')
   AND (p_filters->>'as_of' IS NULL OR m.created_at<=(p_filters->>'as_of')::timestamptz)
 ), paged AS (
  SELECT * FROM filtered ORDER BY CASE WHEN p_filters->>'activity_order'='asc' THEN activity_at END ASC NULLS LAST, CASE WHEN p_filters->>'activity_order'='desc' THEN activity_at END DESC NULLS LAST, year_month DESC,plant_id,id OFFSET p_offset LIMIT p_limit
 ) SELECT jsonb_build_object('reporting_version',3,
  'data',COALESCE((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('progress',public.inventory_reporting_meta(r.id)) ORDER BY CASE WHEN p_filters->>'activity_order'='asc' THEN r.activity_at END ASC NULLS LAST, CASE WHEN p_filters->>'activity_order'='desc' THEN r.activity_at END DESC NULLS LAST, r.year_month DESC,r.plant_id,r.id) FROM paged r),'[]'),
  'pagination',jsonb_build_object('offset',p_offset,'limit',p_limit,'total',(SELECT count(*) FROM filtered),'has_more',p_offset+p_limit<(SELECT count(*) FROM filtered)),
  'snapshot_id',(SELECT md5(COALESCE(string_agg(id||':'||write_revision||':'||status||':'||updated_at::text||':'||activity_at::text,',' ORDER BY year_month DESC,plant_id,id),'')) FROM filtered),
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
   AND (p_filters->>'year_month' IS NULL OR (a.details->>'year_month'=p_filters->>'year_month' OR a.inventory_month_id IN (SELECT id FROM public.inventory_month WHERE year_month=p_filters->>'year_month')))
   AND (p_filters->>'as_of' IS NULL OR a.timestamp<=(p_filters->>'as_of')::timestamptz)
 ), paged AS (SELECT * FROM filtered ORDER BY timestamp DESC,id DESC OFFSET p_offset LIMIT p_limit)
 SELECT jsonb_build_object('reporting_version',3,'data',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY timestamp DESC,id DESC) FROM paged a),'[]'),
  'pagination',jsonb_build_object('offset',p_offset,'limit',p_limit,'total',(SELECT count(*) FROM filtered),'has_more',p_offset+p_limit<(SELECT count(*) FROM filtered))) INTO result;
 RETURN result;
END $$;


-- Inventory deletion and its audit event commit together; storage is cleaned only afterwards.
CREATE OR REPLACE FUNCTION public.delete_inventory_report_guarded(
 p_actor_id text,p_month_id text,p_plant_id text,p_year_month text,p_expected_revision bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.users; m public.inventory_month; child text; n integer; counts jsonb:='{}'; urls jsonb:='[]'; found_urls jsonb; audit_id text;
BEGIN
 SELECT * INTO actor FROM public.users WHERE id=p_actor_id AND is_active;
 IF NOT FOUND OR actor.role NOT IN ('admin','super_admin') THEN RAISE EXCEPTION 'Acceso no autorizado' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.inventory_month WHERE id=p_month_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no encontrado' USING ERRCODE='P0002'; END IF;
 IF p_plant_id IS DISTINCT FROM m.plant_id OR p_year_month IS DISTINCT FROM m.year_month OR p_expected_revision IS DISTINCT FROM m.write_revision THEN
  RAISE EXCEPTION 'El inventario cambió. Actualiza y confirma nuevamente antes de eliminar.' USING ERRCODE='40001';
 END IF;
 FOREACH child IN ARRAY ARRAY['inventory_aggregates_entries','inventory_silos_entries','inventory_additives_entries','inventory_diesel_entries','inventory_products_entries','inventory_utilities_entries','inventory_petty_cash_entries'] LOOP
  EXECUTE format('SELECT count(*),coalesce(jsonb_agg(photo_url) FILTER (WHERE photo_url IS NOT NULL),''[]''::jsonb) FROM public.%I WHERE inventory_month_id=$1',child) INTO n,found_urls USING m.id;
  counts:=counts||jsonb_build_object(child,n);urls:=urls||found_urls;
  EXECUTE format('DELETE FROM public.%I WHERE inventory_month_id=$1',child) USING m.id;
 END LOOP;
 DELETE FROM public.inventory_month WHERE id=m.id;
 INSERT INTO public.audit_logs(user_id,user_email,user_name,action,plant_id,inventory_month_id,details)
 VALUES(actor.id,actor.email,actor.name,'REPORT_DELETED',m.plant_id,m.id,jsonb_build_object(
  'year_month',m.year_month,'plant_name',(SELECT name FROM public.plants WHERE id=m.plant_id),'deleted_rows_by_table',counts,
  'write_revision',m.write_revision,'storage_cleanup','Pending; reusable phase2 objects are retained')) RETURNING id INTO audit_id;
 RETURN jsonb_build_object('report',to_jsonb(m),'deleted_rows_by_table',counts,'photo_urls',urls,'audit_id',audit_id,'audit_details',(SELECT details FROM public.audit_logs WHERE id=audit_id));
END $$;
REVOKE ALL ON FUNCTION public.delete_inventory_report_guarded(text,text,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_inventory_report_guarded(text,text,text,text,bigint) TO service_role;

COMMIT;
