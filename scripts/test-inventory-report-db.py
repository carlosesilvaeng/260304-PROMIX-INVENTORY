"""Test actual migrations and reporting RPCs in a NEW disposable localhost DB."""
import argparse,os,shutil,subprocess,uuid
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--host',default='/private/tmp');parser.add_argument('--port',default='55443');args=parser.parse_args()
if args.host not in ('/private/tmp','/tmp','localhost','127.0.0.1'):parser.error('Only disposable local PostgreSQL is allowed.')
psql=shutil.which('psql') or '/Library/PostgreSQL/18/bin/psql'
common=[psql,'-X','-v','ON_ERROR_STOP=1','-h',args.host,'-p',args.port]
env=os.environ.copy()
for key in ('PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE','PGDATABASE','PGOPTIONS'):env.pop(key,None)
name='promix_phase3_test_'+uuid.uuid4().hex[:12]
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
 for migration in migrations:run(file=migration)
 print(f'{len(migrations)} actual migrations applied to a disposable database.')
 run(file=root/'scripts/test-inventory-report.sql')
 print('Reporting SQL assertions passed: pagination beyond 200, filtered totals, zero/partial progress, historical scope, actor visibility, origin/receipt timestamps and restricted RPC privileges.')
finally:run(f'DROP DATABASE {name} WITH (FORCE)',database='postgres')
