import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAppearanceHandlers, canManageAppearance, isPaletteId } from '../supabase/functions/make-server/appearance_config.ts';
let stored, writes = 0;
const store = { get: async key => { assert.equal(key, 'appearance_config'); return stored; }, set: async (key, value) => { assert.equal(key, 'appearance_config'); writes++; stored = value; } };
const handlers = createAppearanceHandlers(store);
const context = (role, body, invalid = false) => ({ get: () => role ? { id: 'actor', role } : null, req: { json: async () => { if (invalid) throw Error('Invalid JSON'); return body; } }, json: (body, status = 200) => ({ body, status }) });
assert.equal((await handlers.read(context())).status, 401);
assert.equal((await handlers.write(context(undefined, {palette:'command'}))).status, 401);
for (const role of ['plant_manager', 'operations_manager', 'unknown']) {
 assert.equal(canManageAppearance(role), false);
 assert.equal((await handlers.write(context(role, {palette:'command'}))).status, 403);
 assert.equal((await handlers.read(context(role))).body.data.palette, 'original');
}
assert.equal(writes, 0);
for (const role of ['admin', 'super_admin']) {
 assert.equal(canManageAppearance(role), true);
 for (const palette of ['command', 'original']) {
  const result = await handlers.write(context(role, {palette, lastUpdatedBy:'spoofed', modules:{}, inventories:[]}));
  assert.equal(result.status, 200);
  assert.equal(result.body.data.palette, palette);
  assert.equal(result.body.data.lastUpdatedBy, 'actor');
  assert.deepEqual(Object.keys(stored).sort(), ['lastUpdatedAt', 'lastUpdatedBy', 'palette']);
  assert.equal((await handlers.read(context('plant_manager'))).body.data.palette, palette);
 }
}
for (const body of [null, {}, {palette:'dark'}, {palette:123}]) assert.equal((await handlers.write(context('admin', body))).status, 400);
assert.equal((await handlers.write(context('admin', null, true))).status, 400);
assert.equal(writes, 4);
stored = {palette:'unsupported'};
assert.equal((await handlers.read(context('admin'))).body.data.palette, 'original');
const failing = createAppearanceHandlers({get:async()=>{throw Error();},set:async()=>{throw Error();}});
assert.equal((await failing.read(context('admin'))).status, 500);
assert.equal((await failing.write(context('admin',{palette:'command'}))).status, 500);
assert.equal(isPaletteId('command'), true);
assert.equal(isPaletteId('COMMAND'), false);
const server = await readFile(new URL('../supabase/functions/make-server/index.ts',import.meta.url),'utf8');
assert.ok(server.includes("app.use('/make-server/appearance/*', requireAuth)"));
assert.ok(server.includes("app.post('/make-server/appearance/config', appearanceHandlers.write)"));
console.log('Appearance: roles, validation, metadata, defaults, isolated storage and failures passed.');
