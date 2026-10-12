import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginUpdateProtectedPhoto, updatePhotoActivity, canReloadApplication, claimAutomaticReload, fetchPublishedBuild } from '../src/app/utils/appUpdate.ts';

test('reload requires server confirmation, no active photos, completed loading and connectivity', () => {
  assert.equal(canReloadApplication(false, false, 0, true), true);
  for (const args of [[true,false,0,true],[false,true,0,true],[false,false,1,true],[false,false,0,false]]) {
    assert.equal(canReloadApplication(...args), false);
  }
});
test('overlapping photo processing blocks reload until every photo finishes', () => {
  let notifications = 0;
  const unsubscribe = updatePhotoActivity.subscribe(() => notifications++);
  const finishA = beginUpdateProtectedPhoto(), finishB = beginUpdateProtectedPhoto();
  finishA(); finishA();
  assert.equal(updatePhotoActivity.getSnapshot(), 1);
  finishB();
  assert.equal(updatePhotoActivity.getSnapshot(), 0);
  assert.equal(notifications, 4);
  unsubscribe();
});
test('a stale deployment cannot cause an automatic reload loop; a later version can reload', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(claimAutomaticReload(storage, 'old', 'new'), true);
  assert.equal(claimAutomaticReload(storage, 'old', 'new'), false);
  assert.equal(claimAutomaticReload(storage, 'old', 'newer'), true);
  assert.equal(claimAutomaticReload({getItem() { throw Error('blocked'); }}, 'old', 'new'), false);
});
test('version checks bypass cache and tolerate missing, malformed and offline responses', async () => {
  assert.equal(await fetchPublishedBuild(async (url, options) => {
    assert.match(url, /^\/app-version.json\?t=\d+$/);
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    return Response.json({ buildId: 'published-build' });
  }), 'published-build');
  for (const reply of [new Response('', {status:404}), new Response('<html>SPA fallback</html>'), Response.json({buildId:'../bad'}), Response.json({})]) {
    assert.equal(await fetchPublishedBuild(async () => reply), null);
  }
  assert.equal(await fetchPublishedBuild(async () => { throw Error('offline'); }), null);
});
