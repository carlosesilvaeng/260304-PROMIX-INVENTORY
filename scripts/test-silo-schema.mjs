import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(new URL(name, migrationsDir), 'utf8') }));

function tableColumns(sql) {
  const create = sql.match(/CREATE TABLE IF NOT EXISTS (?:public\.)?inventory_silos_entries\s*\(([\s\S]*?)\n\);/i);
  assert.ok(create, 'inventory_silos_entries definition must exist');
  return new Set([...create[1].matchAll(/^\s+([a-z0-9_]+)\s+(?:text|numeric|jsonb|boolean|timestamp|integer)/gim)]
    .map((match) => match[1].toLowerCase()));
}

const baseline = migrations.find(({ name }) => name === '20260305054310_schema_complete.sql');
assert.ok(baseline, 'baseline migration must exist');
const migratedColumns = tableColumns(baseline.sql);

for (const { sql } of migrations) {
  for (const statement of sql.matchAll(/ALTER TABLE (?:public\.)?inventory_silos_entries\s+([\s\S]*?);/gi)) {
    for (const added of statement[1].matchAll(/ADD COLUMN(?: IF NOT EXISTS)?\s+([a-z0-9_]+)\b/gi)) {
      migratedColumns.add(added[1].toLowerCase());
    }
  }
}

const siloFunctions = migrations.flatMap(({ sql }) =>
  [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.replace_inventory_silos_atomic\s*\([\s\S]*?END\s*\$\$;/gi)]
    .map((match) => match[0]));
assert.ok(siloFunctions.length > 0, 'silo save function must exist');
const latestSave = siloFunctions.at(-1);
const insert = latestSave.match(/INSERT INTO (?:public\.)?inventory_silos_entries\s*\(([^)]+)\)/i);
assert.ok(insert, 'silo save function must insert inventory rows');
const insertedColumns = insert[1].split(',').map((name) => name.trim().toLowerCase());

for (const column of insertedColumns) {
  assert.ok(migratedColumns.has(column), `silo save inserts missing column: ${column}`);
}

for (const schemaFile of ['schema.sql', 'schema_complete.sql']) {
  const schema = readFileSync(new URL(`../supabase/${schemaFile}`, import.meta.url), 'utf8');
  const columns = tableColumns(schema);
  for (const column of insertedColumns) {
    // These files are base schemas, so later migration fields are intentionally absent.
    if (['reading_uom', 'conversion_table'].includes(column)) {
      assert.ok(columns.has(column), `${schemaFile} omits ${column}`);
    }
  }
}

console.log(`Silo schema test passed: ${insertedColumns.length} save columns exist after migrations.`);
