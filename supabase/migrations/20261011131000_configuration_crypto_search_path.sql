BEGIN;
-- Supabase installs pgcrypto in extensions; local PostgreSQL may use public.
-- Both are trusted schemas. Keep pg_temp last for this SECURITY DEFINER RPC.
ALTER FUNCTION public.configuration_import(text,text,jsonb,text,jsonb,uuid)
 SET search_path TO public,extensions,pg_temp;
NOTIFY pgrst, 'reload schema';
COMMIT;
