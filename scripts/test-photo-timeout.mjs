import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withTimeout } from '../src/app/utils/withTimeout.ts';

test('a stalled photo upload releases the caller and aborts its request', async () => {
  let signal;
  await assert.rejects(withTimeout((s) => {
    signal = s;
    return new Promise(() => {});
  }, 10, 'retry photo'), /retry photo/);
  assert.equal(signal.aborted, true);
});

test('a successful request is not aborted after its deadline', async () => {
  let signal;
  const result = await withTimeout(async (s) => { signal = s; return 'photo-url'; }, 10);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(result, 'photo-url');
  assert.equal(signal.aborted, false);
});

test('read failures remain actionable and a retry can succeed', async () => {
  await assert.rejects(withTimeout(async () => { throw new Error('unreadable image'); }, 10), /unreadable image/);
  assert.equal(await withTimeout(async () => 'retry succeeded', 10), 'retry succeeded');
});

test('timeout also covers a stalled response body', async () => {
  await assert.rejects(withTimeout(async () => {
    const response = { json: () => new Promise(() => {}) };
    return response.json();
  }, 10), /tardó demasiado/);
});
