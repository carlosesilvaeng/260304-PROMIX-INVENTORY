import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

// Exercise the real browser API wrapper with synthetic credentials and fetch.
// No network calls or production configuration are used.
const bundled = await build({
  entryPoints: ['src/app/utils/api.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'synthetic-environment', setup(builder) {
    builder.onResolve({ filter: /^\/utils\/supabase\/info$/ }, () => ({ path: 'synthetic', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export const projectId='synthetic'; export const publicAnonKey='synthetic';", loader: 'js' }));
  } }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const storage = new Map([['promix_access_token','synthetic-user']]);
globalThis.localStorage = { getItem: key => storage.get(key) ?? null };
const snapshot = revision => ({ month: { id: 'synthetic-month' }, section_revisions: { products: revision } });
let nextResponse;
let sent;
globalThis.fetch = async (_url, options) => {
  sent = options.body ? JSON.parse(options.body) : null;
  if (nextResponse instanceof Error) throw nextResponse;
  return new Response(JSON.stringify(nextResponse), { status: nextResponse.success ? 200 : 409 });
};
const inputs = [{ product_config_id: 'synthetic-product', quantity: null }];
test('loading a snapshot must install its rows before the first manual save', async t => {
  t.mock.method(console, 'error', () => {});
  nextResponse = { success: true, data: snapshot(0) };
  const loaded = await api.getInventoryMonth('synthetic-plant','2026-10');
  const before = await api.saveProductsEntries('synthetic-month', inputs);
  assert.equal(before.success,false);
  api.acceptInventorySnapshot(loaded.data);
  nextResponse = { success:true, revision:1, data:inputs, summary:{captured_count:0,complete_count:0,pending_count:1} };
  const saved = await api.saveProductsEntries('synthetic-month', inputs);
  assert.equal(saved.success,true);assert.equal(sent.expected_revision,0);
  assert.match(sent.operation_id,/^[0-9a-f-]{36}$/);
  assert.equal(sent.entries[0].quantity,null);
  assert.match(api.inventorySaveMessage(saved),/Borrador guardado.*1 pendientes/);
});
test('report reads do not advance the revision of older unsaved editor data', async t => {
  t.mock.method(console, 'error', () => {});
  nextResponse = {success:true,data:snapshot(9)};
  await api.getInventoryMonth('synthetic-plant','2026-10');
  nextResponse = {success:false,error:'Otra sesión modificó esta sección',code:'40001'};
  const conflict = await api.saveProductsEntries('synthetic-month',[{...inputs[0],quantity:2}]);
  assert.equal(sent.expected_revision,1);assert.equal(conflict.code,'40001');
});
test('an unknown network result can be retried using the same operation', async t => {
  t.mock.method(console, 'error', () => {});
  api.acceptInventorySnapshot(snapshot(9));
  nextResponse = new Error('synthetic disconnected response');
  const failed = await api.saveProductsEntries('synthetic-month',inputs);
  assert.equal(failed.success,false);const operation = sent.operation_id;
  nextResponse = {success:true,revision:10,data:inputs};
  await api.saveProductsEntries('synthetic-month',inputs);
  assert.equal(sent.operation_id,operation);assert.equal(sent.expected_revision,9);
});
test('a different account cannot reuse the previous account revision', async t => {
  t.mock.method(console, 'error', () => {});
  storage.set('promix_access_token','another-synthetic-user');
  nextResponse = {success:true,revision:11};
  const result = await api.saveProductsEntries('synthetic-month',inputs);
  assert.equal(result.success,false);assert.match(result.error,/cargar/);
});
