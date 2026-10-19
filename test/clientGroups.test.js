// Live campagnes per client (src/lib/clientGroups.js): the functions of one Trello board in one row, with totals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByClient, callList, recruiterSees } from '../src/lib/clientGroups.js';

const fn = (id, key, nieuw, contact, o = {}) => ({ id, key, client: key, vac: id, nieuw, contact, gebeld: 0, total: nieuw + contact, open: false, rank: 0, ...o });

test('the functions of one client become one group with the call counts added up', () => {
  const g = groupByClient([fn('kok', 'Oost', 2, 1, { gebeld: 2 }), fn('bar', 'Hoek', 1, 0), fn('afwas', 'Oost', 4, 2, { gebeld: 1 })]);
  assert.deepEqual(g.map(x => x.key), ['Oost', 'Hoek'], 'most to call first');
  assert.deepEqual(g[0].fns.map(f => f.id), ['afwas', 'kok'], 'functions too');
  assert.deepEqual([g[0].nieuw, g[0].contact, g[0].total, g[0].gebeld], [6, 3, 9, 3]);
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

test('today\'s call list comes from Trello; a demo campaign gets made-up numbers that stay the same', () => {
  assert.deepEqual(callList({ id: 'k', live: { nieuw: 3, contact: 1, gebeld: 2 }, weeks: [{ leads: 9 }] }), { nieuw: 3, contact: 1, gebeld: 2 });
  assert.deepEqual(callList({ id: 'k', live: { nieuw: 3, contact: 1 }, weeks: [{ leads: 9 }] }), { nieuw: 3, contact: 1, gebeld: 0 }, 'from a snapshot without gebeld');
  const demo = { id: 'd1', weeks: [{ leads: 8 }] };
  assert.deepEqual(callList(demo), callList({ ...demo }));
  assert.deepEqual(Object.keys(callList(demo)), ['nieuw', 'contact', 'gebeld']);
});

test('a recruiter keeps a paused or stopped campaign until all its candidates are called', () => {
  const c = (halt, nieuw, contact, gebeld = 0) => ({ id: 'k', live: { nieuw, contact, gebeld }, weeks: [{ leads: 0 }], ...(halt ? { halt: { kind: halt } } : {}) });
  assert.equal(recruiterSees(c(null, 0, 0)), true, 'a running campaign always');
  assert.equal(recruiterSees(c('pauze', 2, 0)), true);
  assert.equal(recruiterSees(c('stop', 0, 1)), true, 'contact attempts count too');
  assert.equal(recruiterSees(c('pauze', 0, 0, 1)), true, 'a ‘Geen gehoor’ today is not yet called');
  assert.equal(recruiterSees(c('pauze', 0, 0)), false);
  assert.equal(recruiterSees(c('stop', 0, 0)), false);
});
