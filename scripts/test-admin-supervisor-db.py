"""Test actual migrations and configuration RPCs in a NEW disposable localhost DB."""
import argparse,os,shutil,subprocess,uuid,time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--without-pending-products',action='store_true');parser.add_argument('--host',default='/private/tmp');parser.add_argument('--port',default='55443');args=parser.parse_args()
if args.host not in ('/private/tmp','/tmp','localhost','127.0.0.1'):parser.error('Only disposable local PostgreSQL is allowed.')
psql=shutil.which('psql') or '/Library/PostgreSQL/18/bin/psql'
common=[psql,'-X','-v','ON_ERROR_STOP=1','-h',args.host,'-p',args.port]
env=os.environ.copy()
for key in ('PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE','PGDATABASE','PGOPTIONS'):env.pop(key,None)
name='promix_phase4_test_'+uuid.uuid4().hex[:12]
def run(sql=None,file=None,database=name):
 command=common+['-d',database]+(['-f',str(file)] if file else ['-c',sql])
 result=subprocess.run(command,env=env,capture_output=True,text=True)
 if result.returncode:raise RuntimeError(result.stderr[-3000:])
 return result.stdout
run(f'CREATE DATABASE {name}',database='postgres')
try:
 run("""DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
 END $$;
 CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
 CREATE TABLE storage.objects(id uuid,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid,email text);CREATE TABLE auth.identities(user_id uuid);
 """)
 migrations=sorted((root/'supabase/migrations').glob('*.sql'))
 for migration in migrations:
  if args.without_pending_products and migration.name=='20261011120000_product_no_physical_stock.sql':continue
  if migration.name=='20261011130000_admin_supervisor_capability.sql':
   run("""INSERT INTO users(id,email,name,role) VALUES('legacy_sender','legacy@example.invalid','Legacy','admin');
   INSERT INTO plants(id,name,code) VALUES('LEGACY_CAP','Legacy','LEGACY_CAP');
   INSERT INTO inventory_month(id,plant_id,year_month,status,submitted_by,created_by) VALUES('legacy_known','LEGACY_CAP','2026-01','SUBMITTED','Legacy','Legacy'),('legacy_unknown','LEGACY_CAP','2026-02','SUBMITTED','Legacy','Legacy');
   INSERT INTO audit_logs(user_id,user_email,user_name,action,inventory_month_id,timestamp) VALUES('legacy_sender','legacy@example.invalid','Legacy','INVENTORY_SUBMITTED','legacy_known',now());""")
  run(file=migration)
 run("""DO $$ BEGIN
 IF (SELECT can_capture_inventory FROM users WHERE id='legacy_sender') THEN RAISE EXCEPTION 'Capability was enabled by default'; END IF;
 IF (SELECT submitted_by_user_id FROM inventory_month WHERE id='legacy_known') IS DISTINCT FROM 'legacy_sender' THEN RAISE EXCEPTION 'Known sender not backfilled'; END IF;
 IF (SELECT submitted_by_user_id FROM inventory_month WHERE id='legacy_unknown') IS NOT NULL THEN RAISE EXCEPTION 'Unknown sender incorrectly matched by name'; END IF;
 IF has_function_privilege('authenticated','public.record_inventory_capture_started(text,text,text,text)','execute') THEN RAISE EXCEPTION 'Capture audit RPC exposed directly'; END IF;
 END $$;""")
 if args.without_pending_products:run(file=root/'supabase/migrations/20261011120000_product_no_physical_stock.sql')
 run(file=root/'scripts/test-admin-supervisor.sql')
 print('Admin supervisor database tests passed: assignment, activity, revocation, capture, submission, audit and independent approval.')
finally:run(f'DROP DATABASE {name} WITH (FORCE)',database='postgres')
