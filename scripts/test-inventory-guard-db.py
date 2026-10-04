"""Run actual migrations and transaction tests in a NEW disposable localhost DB.
Requires an already running local PostgreSQL server; never accepts remote hosts.
Usage: python3 scripts/test-inventory-guard-db.py --host /private/tmp --port 55441
"""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--host', default='/private/tmp')
parser.add_argument('--port', default='55441')
args = parser.parse_args()
if args.host not in ('/private/tmp', '/tmp', '127.0.0.1', 'localhost'):
    parser.error('Only an isolated local PostgreSQL server is allowed.')
psql = shutil.which('psql') or '/Library/PostgreSQL/18/bin/psql'
common = [psql, '-X', '-v', 'ON_ERROR_STOP=1', '-h', args.host, '-p', args.port]
env = os.environ.copy()
for key in ('PGPASSWORD', 'PGPASSFILE', 'PGSERVICE', 'PGSERVICEFILE', 'PGDATABASE', 'PGOPTIONS'):
    env.pop(key, None)
name = 'promix_phase1_test_' + uuid.uuid4().hex[:12]
def run(sql=None, file=None, database=name):
    command = common + ['-d', database]
    command += ['-f', str(file)] if file else ['-c', sql]
    result = subprocess.run(command, env=env, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-2500:])
    return result.stdout
run(f'CREATE DATABASE {name}', database='postgres')
try:
    run("""DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
    CREATE TABLE storage.objects(id uuid,bucket_id text,name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid,email text); CREATE TABLE auth.identities(user_id uuid);
    """)
    migrations = sorted((ROOT / 'supabase/migrations').glob('*.sql'))
    for migration in migrations:
        run(file=migration)
    print(f'{len(migrations)} actual migrations applied in disposable local database.')
    output = run(file=ROOT / 'scripts/test-inventory-guard.sql')
    print(output[-700:])
    run("""INSERT INTO plants(id,name,code) VALUES('RACE_A','Race','RACE_A');
    INSERT INTO users(id,name,email,role,assigned_plants,is_active)
      VALUES('race_operator','Race','race@example.invalid','plant_manager',ARRAY['RACE_A'],true);
    INSERT INTO plant_products_config(id,plant_id,product_name,unit,measure_mode)
      VALUES('race_product','RACE_A','P','unit','COUNT');
    SELECT start_inventory_guarded('RACE_A','2026-09','race_operator');
    """)
    month = run("SELECT id FROM inventory_month WHERE plant_id='RACE_A'", database=name).splitlines()[2].strip()
    # The first connection holds the parent lock so the second must wait and
    # then validate the new revision/status, rather than overwrite silently.
    def simultaneous(first_sql, second_sql):
        holder = subprocess.Popen(common + ['-d', name, '-c',
            f"BEGIN; SELECT id FROM inventory_month WHERE id='{month}' FOR UPDATE; "
            + first_sql + " SELECT pg_sleep(0.5); COMMIT;"], env=env,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        import time
        # Wait for the lock to be acquired, using database evidence.
        for _ in range(100):
            locked = run("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND query LIKE 'BEGIN; SELECT id%' AND wait_event='PgSleep'")
            if locked.splitlines()[2].strip() != '0':
                break
            time.sleep(0.01)
        else:
            holder.kill()
            raise RuntimeError('Concurrent fixture failed to acquire lock.')
        follower = subprocess.run(common + ['-d', name, '-c', second_sql], env=env,
            capture_output=True, text=True)
        _, holder_error = holder.communicate(timeout=10)
        assert holder.returncode == 0, holder_error
        assert follower.returncode != 0 and ('Otra sesión' in follower.stderr or 'ya no permite' in follower.stderr), follower.stderr
    save = lambda quantity: f"SELECT save_inventory_section_guarded('{month}','products','[{{\"product_config_id\":\"race_product\",\"quantity\":{quantity}}}]','race_operator',0,gen_random_uuid(),'race-{quantity}','{{}}');"
    simultaneous(save(1), save(2))
    assert float(run(f"SELECT quantity FROM inventory_products_entries WHERE inventory_month_id='{month}'").splitlines()[2].strip()) == 1
    run("SELECT start_inventory_guarded('RACE_A','2026-10','race_operator')")
    month = run("SELECT id FROM inventory_month WHERE plant_id='RACE_A' AND year_month='2026-10'").splitlines()[2].strip()
    simultaneous(f"SELECT apply_inventory_workflow_guarded('{month}','race_operator','submit',0,NULL);", save(3))
    assert run(f"SELECT count(*) FROM inventory_products_entries WHERE inventory_month_id='{month}'").splitlines()[2].strip() == '0'
    print('Two-connection races: stale section write and write after submission rejected; no overwrite.')
finally:
    run(f'DROP DATABASE {name} WITH (FORCE)', database='postgres')
