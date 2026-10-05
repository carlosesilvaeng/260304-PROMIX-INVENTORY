"""Test actual migrations and configuration RPCs in a NEW disposable localhost DB."""
import argparse,os,shutil,subprocess,uuid,time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--host',default='/private/tmp');parser.add_argument('--port',default='55443');args=parser.parse_args()
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
 for migration in migrations:run(file=migration)
 print(f'{len(migrations)} actual migrations applied to a disposable database.')
 run(file=root/'scripts/test-configuration-package.sql')
 # Feed a real edited workbook through the actual preview/application RPCs.
 excel_env=env.copy();excel_env.update(PROMIX_CONFIGURATION_TEST_DB=name,PGHOST=args.host,PGPORT=args.port,PROMIX_TEST_PSQL=psql)
 subprocess.run(['node','--experimental-strip-types',str(root/'scripts/test-configuration-excel-db.mjs')],cwd=root,env=excel_env,check=True)
 # Competing legacy writer commits while execute waits on the configuration lock.
 run("INSERT INTO users(id,email,name,role,is_active) VALUES('c4_race_admin','race@example.invalid','Race','admin',true); INSERT INTO plants(id,name,code) VALUES('C4_RACE','Race target','C4_RACE'); SELECT configuration_import('c4_race_admin','C4_RACE',configuration_export('c4_race_admin','C4_RACE'),'race-digest','{}');")
 writer_env=env.copy();writer_env['PGAPPNAME']='promix_c4_writer'
 writer=subprocess.Popen(common+['-d',name,'-c',"BEGIN; UPDATE plants SET petty_cash_established=20 WHERE id='C4_RACE'; SELECT pg_sleep(2); COMMIT;"],env=writer_env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 deadline=time.monotonic()+5
 while time.monotonic()<deadline:
  if 't' in run("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='promix_c4_writer' AND wait_event='PgSleep');"):break
  time.sleep(.02)
 else:raise RuntimeError('Competing writer did not start.')
 executor_env=env.copy();executor_env['PGAPPNAME']='promix_c4_executor'
 executor=subprocess.Popen(common+['-d',name,'-c',"SELECT configuration_import('c4_race_admin','C4_RACE',payload,package_digest,options,id) FROM configuration_import_previews WHERE package_digest='race-digest';"],env=executor_env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 blocked=False
 while writer.poll() is None:
  if 't' in run("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='promix_c4_executor' AND wait_event_type='Lock');"):blocked=True;break
  time.sleep(.02)
 writer_out,writer_err=writer.communicate(timeout=10);execute_out,execute_err=executor.communicate(timeout=10)
 if writer.returncode or not blocked or executor.returncode==0 or 'genera otra vista previa' not in execute_err:raise RuntimeError('Concurrent writer/import was not serialized safely: '+writer_err+execute_err)
 if 't' not in run("SELECT petty_cash_established=20 AND NOT EXISTS(SELECT 1 FROM audit_logs WHERE action='CONFIGURATION_IMPORTED' AND plant_id='C4_RACE') FROM plants WHERE id='C4_RACE';"):raise RuntimeError('Rejected concurrent import changed destination/audit.')
 print('Concurrent configuration/legacy writer test passed: execute waited, detected the committed change and applied nothing.')
 print('Configuration SQL tests passed: complete roundtrip, identity/dependency mapping, inactive rows, dry-run rollback, idempotency, audit, permissions, destination/global staleness, constraints, expiration and explicit dependency creation.')
finally:run(f'DROP DATABASE {name} WITH (FORCE)',database='postgres')
