// Live campagnes per client (src/lib/clientGroups.js): the functions of one Trello board in one row, with totals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByClient } from '../src/lib/clientGroups.js';

const fn = (id, key, nieuw, contact, o = {}) => ({ id, key, client: key, vac: id, nieuw, contact, total: nieuw + contact, open: false, rank: 0, ...o });

test('the functions of one client become one group with the call counts added up', () => {
  const g = groupByClient([fn('kok', 'Oost', 2, 1), fn('bar', 'Hoek', 1, 0), fn('afwas', 'Oost', 4, 2)]);
  assert.deepEqual(g.map(x => x.key), ['Oost', 'Hoek'], 'most to call first');
  assert.deepEqual(g[0].fns.map(f => f.id), ['afwas', 'kok'], 'functions too');
  assert.deepEqual([g[0].nieuw, g[0].contact, g[0].total], [6, 3, 9]);
  assert.equal(g[0].client, 'Oost');
});

test('a group counts its open feedback, points at the first open function and takes the most urgent status', () => {
  const [g] = groupByClient([fn('kok', 'Oost', 1, 0, { rank: 1 }), fn('bar', 'Oost', 3, 0, { open: true }), fn('afwas', 'Oost', 2, 0, { open: true, rank: 2 })]);
  assert.equal(g.open, 2);
  assert.equal(g.firstOpen, 'bar', 'the first open one in the order shown');
  assert.equal(g.rank, 2);
  const [done] = groupByClient([fn('kok', 'Oost', 1, 0)]);
  assert.equal(done.open, 0);
  assert.equal(done.firstOpen, null);
});
