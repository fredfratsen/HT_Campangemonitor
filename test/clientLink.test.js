// A notification about one client opens it, as clicking the client would (src/lib/clientLink.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientTarget } from '../src/lib/clientLink.js';

const c = (id, client, o = {}) => ({ id, client, vac: 'Kok', ended: false, ...o });
const pauze = { kind: 'pauze', by: 'Robbin', w: 43 };

test('the recruiter: one campaign opens it, several open the client in Live campagnes', () => {
  assert.deepEqual(clientTarget('Hotel A', [c('a1', 'Hotel A'), c('b1', 'Hotel B')], []), { open: 'a1' });
  assert.deepEqual(clientTarget('Hotel A', [c('a1', 'Hotel A', { boardId: 'bA' }), c('a2', 'Hotel A', { boardId: 'bA' })], []), { live: 'bA' });
  assert.deepEqual(clientTarget('Hotel A', [c('a1', 'Hotel A'), c('a2', 'Hotel A')], []), { live: 'Hotel A' }, 'demo campaigns are grouped by client');
});

test('the marketeer: one campaign opens it, several open Campagnes filtered on the client, on Pauze when all wait', () => {
  assert.deepEqual(clientTarget('Hotel A', null, [c('a1', 'Hotel A', { halt: pauze })]), { open: 'a1' });
  assert.deepEqual(clientTarget('Hotel A', null, [c('a1', 'Hotel A', { halt: pauze }), c('a2', 'Hotel A', { halt: pauze })]), { campaigns: { q: 'Hotel A', status: 'pauze' } });
  assert.deepEqual(clientTarget('Hotel A', null, [c('a1', 'Hotel A', { halt: pauze }), c('a2', 'Hotel A')]), { campaigns: { q: 'Hotel A', status: 'all' } });
});

test('a recruiter who is not on this client goes by what they see in Campagnes', () => {
  assert.deepEqual(clientTarget('Hotel A', [c('b1', 'Hotel B')], [c('a1', 'Hotel A')]), { open: 'a1' });
});

test('nothing to open: ended, or not in your overview', () => {
  assert.equal(clientTarget('Hotel A', [c('a1', 'Hotel A', { ended: true })], []), null);
  assert.equal(clientTarget('Hotel A', null, null), null);
});
