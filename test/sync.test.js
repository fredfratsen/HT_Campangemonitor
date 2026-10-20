// What of the app state is shared with the team (src/lib/sync.js: toDocs / fromDocs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDocs, fromDocs } from '../src/lib/sync.js';

test('Ermee bezig / Done on Live campagnes is shared with the team', () => {
  const e = { s: 'bezig', by: 'Kim', at: 1792502520000 };
  assert.deepEqual(fromDocs({ 'live.status': { b1: e } }).live.status, { b1: e }, 'from the server into the app');
  assert.deepEqual(fromDocs({}).live.status, {}, 'none set yet');
  assert.deepEqual(toDocs({ live: { links: [], status: { b1: e, 'Hotel A': { ...e, s: 'done' } } } })['live.status'], { b1: e, 'Hotel A': { ...e, s: 'done' } }, 'from the app to the server');
  assert.deepEqual(toDocs({ live: { links: [] } })['live.status'], {}, 'state from before this existed');
  assert.ok(!toDocs({ live: null })['live.status'], 'not loaded yet: left out, so it is never wiped');
});
