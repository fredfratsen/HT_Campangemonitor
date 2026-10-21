// A new campaign waits on Pauze for its ads; its recruiter hears of it only when it's resumed (server/announce.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { announceResumed } from '../server/announce.js';
import { startHalt } from '../src/lib/halt.js';

const NOW = 1761040000000;
const link = (id, vac, o = {}) => ({ id, boardId: 'b1', boardName: 'Hotel A', labelId: 'l-' + id, vac, rec: 'Kim', ...o });
const waiting = l => ({ ...l, halt: startHalt('Robbin', 43) });
/** applied for resuming links ls, with docs as they are afterwards (others: the board's other links). */
const resume = (ls, others = []) => ({
  applied: ls.map(l => ({ doc: 'live.links', key: l.id, before: waiting(l), after: l })),
  docs: { 'live.links': Object.fromEntries([...ls, ...others].map(l => [l.id, l])) }
});
const run = ({ applied, docs }) => announceResumed(applied, docs, 'Danielle', NOW);
const valuesOf = (ps, doc) => ps.filter(p => p.doc === doc).flatMap(p => Object.values(p.set));

test('the first campaign of a client that goes live: Nieuw bedrijf for the recruiter, also in Live campagnes', () => {
  const ps = run(resume([link('kok', 'Kok')], [waiting(link('bar', 'Bediening'))]));
  const [e] = valuesOf(ps, 'assignLog'), [n] = valuesOf(ps, 'inbox');
  assert.deepEqual({ ...e, id: 0 }, { id: 0, mode: 'trello', client: 'Hotel A', from: '', to: 'Kim', at: NOW, by: 'Danielle' }, 'another function still waiting does not count');
  assert.deepEqual({ ...n, id: 0, at: '' }, { id: 0, to: 'Kim', from: 'Danielle', at: '', read: false, kind: 'assign', title: 'Nieuw bedrijf voor jou: Hotel A', items: ['De ads voor Kok staan live'] });
  assert.equal(typeof n.at, 'string');
  assert.equal(String(e.id), Object.keys(ps.find(p => p.doc === 'assignLog').set)[0], 'stored under its id');
});

test('a client the recruiter already calls for: Nieuwe functie, only in Meldingen', () => {
  const ps = run(resume([link('kok', 'Kok')], [link('bar', 'Bediening')]));
  assert.deepEqual(valuesOf(ps, 'assignLog'), []);
  assert.deepEqual(valuesOf(ps, 'inbox').map(n => [n.to, n.title, n.items]), [['Kim', 'Nieuwe functie bij Hotel A', ['Kok']]]);
});

test('several functions at once: one notification', () => {
  const ps = run(resume([link('kok', 'Kok'), link('bar', 'Bediening')]));
  assert.equal(valuesOf(ps, 'assignLog').length, 1);
  assert.deepEqual(valuesOf(ps, 'inbox').map(n => n.items), [['De ads voor Kok en Bediening staan live']]);
});

test('nothing to announce: paused by hand, stopped, Niet actief, a new link, another doc', () => {
  const kok = link('kok', 'Kok'), byHand = { ...kok, halt: { kind: 'pauze', by: 'Danielle', w: 43 } };
  const none = applied => assert.deepEqual(announceResumed(applied, { 'live.links': {} }, 'Danielle', NOW), []);
  none([{ doc: 'live.links', key: 'kok', before: byHand, after: kok }]);
  none([{ doc: 'live.links', key: 'kok', before: waiting(kok), after: { ...kok, halt: { kind: 'stop', w: 43 } } }]);
  none([{ doc: 'live.links', key: 'kok', before: waiting({ ...kok, rec: '' }), after: { ...kok, rec: '' } }]);
  none([{ doc: 'live.links', key: 'kok', before: undefined, after: waiting(kok) }]);
  none([{ doc: 'live.links', key: 'kok', before: waiting(kok), after: undefined }]);
  none([{ doc: 'rules', key: 'qRed', before: 4, after: 5 }]);
});

test('demo campaigns: per client, on the demo log', () => {
  const c = { id: 'c1', client: 'Hotel B', vac: 'Kok', rec: 'Kim', ended: false, weeks: [] };
  const old = { ...c, id: 'c0', vac: 'Afwas', ended: true };
  const ps = announceResumed([{ doc: 'campaigns', key: 'c1', before: waiting(c), after: c }], { campaigns: { c1: c, c0: old } }, 'Danielle', NOW);
  assert.deepEqual(valuesOf(ps, 'assignLog').map(e => [e.mode, e.client, e.to]), [['demo', 'Hotel B', 'Kim']], 'an ended campaign does not count');
  assert.equal(valuesOf(ps, 'inbox')[0].title, 'Nieuw bedrijf voor jou: Hotel B');
});
