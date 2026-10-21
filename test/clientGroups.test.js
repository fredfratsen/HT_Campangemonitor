// Live campagnes per client (src/lib/clientGroups.js): the functions of one Trello board in one row, with totals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByClient, callList, recruiterSees, trelloCreated, LIVE_SORTS } from '../src/lib/clientGroups.js';
import { startHalt } from '../src/lib/halt.js';

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

test('the recruiter picks the order: by the number to call, by name or by when the client was added', () => {
  const rows = [fn('kok', 'Oost', 2, 1, { added: 300 }), fn('bar', 'Hoek', 1, 0, { added: 100 }), fn('afwas', 'Oost', 4, 2, { added: 300 }),
    fn('chef', 'Zuid', 5, 0, { added: 200 }), fn('lunch', 'Anker', 1, 0, { added: 400 })];
  const order = sort => groupByClient(rows, sort).map(g => g.key);
  assert.deepEqual(order('most'), ['Oost', 'Zuid', 'Anker', 'Hoek'], 'a tie goes A–Z, so the order stays put');
  assert.deepEqual(order('least'), ['Anker', 'Hoek', 'Zuid', 'Oost']);
  assert.deepEqual(order('az'), ['Anker', 'Hoek', 'Oost', 'Zuid']);
  assert.deepEqual(order('za'), ['Zuid', 'Oost', 'Hoek', 'Anker']);
  assert.deepEqual(order('newest'), ['Anker', 'Oost', 'Zuid', 'Hoek']);
  assert.deepEqual(order('oldest'), ['Hoek', 'Zuid', 'Oost', 'Anker']);
  assert.deepEqual(order(undefined), order('most'), 'most to call first by default');
  assert.deepEqual(order('nonsense'), order('most'));
  assert.deepEqual(LIVE_SORTS.map(([k]) => k), ['most', 'least', 'az', 'za', 'newest', 'oldest']);
});

test('the functions of a client follow the same order, A–Z when they tie', () => {
  const rows = [fn('kok', 'Oost', 2, 1, { added: 5 }), fn('afwas', 'Oost', 4, 2, { added: 5 }), fn('bar', 'Oost', 0, 3, { added: 5 })];
  const fns = sort => groupByClient(rows, sort)[0].fns.map(f => f.id);
  assert.deepEqual(fns('most'), ['afwas', 'bar', 'kok'], 'bar and kok both 3');
  assert.deepEqual(fns('least'), ['bar', 'kok', 'afwas']);
  assert.deepEqual(fns('az'), ['afwas', 'bar', 'kok']);
  assert.deepEqual(fns('za'), ['kok', 'bar', 'afwas']);
  assert.deepEqual(fns('newest'), ['afwas', 'bar', 'kok']);
  const open = [fn('kok', 'Oost', 5, 0, { open: true }), fn('afwas', 'Oost', 1, 0, { open: true })];
  assert.equal(groupByClient(open, 'az')[0].firstOpen, 'afwas', 'the first open one in the order shown');
  assert.equal(groupByClient(open, 'most')[0].firstOpen, 'kok');
  assert.equal(groupByClient([fn('kok', 'Oost', 1, 0, { added: 5 }), fn('bar', 'Oost', 1, 0, { added: 9 })])[0].added, 9, 'a client is as new as its newest function');
});

test('a client without a known date counts as the oldest', () => {
  const g = groupByClient([fn('kok', 'Oost', 1, 0), fn('bar', 'Hoek', 1, 0, { added: 100 })], 'newest');
  assert.deepEqual(g.map(x => x.key), ['Hoek', 'Oost']);
  assert.equal(g[1].added, 0);
});

test('a Trello id holds the moment it was made; anything else gives 0', () => {
  assert.equal(trelloCreated('5f2b6a8c0000000000000000'), 0x5f2b6a8c * 1000);
  assert.equal(new Date(trelloCreated('6500000000000000000000ab')).getUTCFullYear(), 2023);
  assert.equal(trelloCreated(undefined), 0);
  assert.equal(trelloCreated('Strandtent Blue'), 0);
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

test('a new campaign waiting for its ads stays out of sight of the recruiter, candidates or not', () => {
  const c = { id: 'k', live: { nieuw: 3, contact: 1, gebeld: 0 }, weeks: [{ leads: 0 }], halt: startHalt('Robbin', 43) };
  assert.equal(recruiterSees(c), false);
  const { nieuw, ...byHand } = c.halt;
  assert.equal(recruiterSees({ ...c, halt: byHand }), true, 'paused by hand: as before');
});
