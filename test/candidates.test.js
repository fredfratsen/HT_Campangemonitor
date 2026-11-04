// The ATS (server/candidates.js, lib/ats.js): leads from the intake link, what a recruiter does with a candidate, the
// four weeks of keeping the data, and the numbers the monitor gets. The routes and rights are tested in server.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCandidates, parseLead } from '../server/candidates.js';
import { atsStats, addStats, KEEP_MS } from '../src/lib/ats.js';
import { weekOf } from '../src/lib/weeks.js';

const memDocs = () => (name, initial) => ({ data: initial(), save() {}, flush() {} });
const DAY = 864e5;
const lead = { id: 'robbin', name: 'Robbin' }, kim = { id: 'r-kim', name: 'Kim' };
const priya = { full_name: 'Priya Ramdin', phone_number: '+31 6 1234 5678', email: 'Priya@Example.com', 'Hoeveel jaar ervaring heb je?': '3 jaar' };

function setup() {
  const ats = createCandidates(memDocs()), key = ats.newKey(lead, 't-b1-kok');
  return { ats, key };
}

test('a lead: Meta field names or our own, the rest become answers; a name and a way to reach them are needed', () => {
  const l = parseLead(priya);
  assert.equal(l.name, 'Priya Ramdin');
  assert.equal(l.email, 'priya@example.com');
  assert.equal(l.src, 'Meta');
  assert.deepEqual(l.answers, [['Hoeveel jaar ervaring heb je?', '3 jaar']]);
  assert.equal(parseLead({ first_name: 'Jan', last_name: 'de Vries', telefoon: '0612345678', bron: 'Website' }).name, 'Jan de Vries');
  assert.throws(() => parseLead({ phone: '0612345678' }), /Naam ontbreekt/);
  assert.throws(() => parseLead({ naam: 'Jan' }), /Telefoonnummer of e-mailadres ontbreekt/);
  assert.throws(() => parseLead({ naam: 'Jan', telefoon: '123' }), /telefoonnummer klopt niet/);
});

test('intake: a known key makes a candidate in Nieuw; the same person again within 30 days is no new one', () => {
  const { ats, key } = setup(), t = Date.now();
  assert.equal(ats.take('onbekend', priya, t), null);
  const a = ats.take(key, priya, t);
  assert.equal(a.dup, false);
  assert.equal(a.cand.stage, 'nieuw');
  assert.equal(a.cand.link, 't-b1-kok');
  const b = ats.take(key, { naam: 'P. Ramdin', telefoon: '06-12345678' }, t + DAY);
  assert.equal(b.dup, true);
  assert.equal(b.cand.id, a.cand.id);
  assert.match(b.cand.log[0].what, /Opnieuw binnengekomen/);
  assert.equal(ats.take(key, priya, t + 31 * DAY).dup, false, 'after 30 days it is a new application');
});

test('a new key replaces the old one, and the campaign stays switched since the first', () => {
  const { ats, key } = setup(), at = ats.switched()['t-b1-kok'].at;
  const key2 = ats.newKey(lead, 't-b1-kok');
  assert.equal(ats.take(key, priya), null);
  assert.ok(ats.take(key2, priya));
  assert.equal(ats.switched()['t-b1-kok'].at, at);
  assert.equal(ats.switched()['t-b1-kok'].last4, key2.slice(-4));
});

test('Geen gehoor counts an attempt but never moves the candidate, also not the third time', () => {
  const { ats, key } = setup(), id = ats.take(key, priya).cand.id;
  for (let i = 0; i < 4; i++) ats.act(kim, id, { kind: 'geenGehoor' });
  const c = ats.get(id);
  assert.equal(c.stage, 'nieuw');
  assert.equal(c.att, 4);
  assert.equal(c.canUndo, undefined);
  assert.equal(c.undo, null, 'nothing to undo: nothing moved');
  assert.deepEqual(c.calls, [weekOf(Date.now())]);
  ats.act(kim, id, { kind: 'move', to: 'nb' });
  assert.equal(ats.get(id).stage, 'nb', 'the recruiter moves them');
});

test('moves, Gesprek with a moment, rejecting with a reason from the list, and undoing the last move', () => {
  const { ats, key } = setup(), id = ats.take(key, priya).cand.id;
  ats.act(kim, id, { kind: 'tba', text: 'bel 16:00' });
  assert.equal(ats.get(id).tba.text, 'bel 16:00');
  ats.act(kim, id, { kind: 'move', to: 'gescreend' });
  assert.throws(() => ats.act(kim, id, { kind: 'move', to: 'gesprek' }), /datum en tijd/);
  ats.act(kim, id, { kind: 'move', to: 'gesprek', at: '2026-11-06T14:00' });
  assert.equal(ats.get(id).reached, 2);
  assert.throws(() => ats.act(kim, id, { kind: 'reject', reason: 'Te duur' }), /Kies een reden/);
  ats.act(kim, id, { kind: 'reject', reason: 'Afstand' });
  let c = ats.get(id);
  assert.equal(c.stage, 'afgewezen');
  assert.ok(c.endedAt);
  assert.equal(c.reached, 2, 'how far they got stays');
  ats.act(kim, id, { kind: 'undo' });
  c = ats.get(id);
  assert.equal(c.stage, 'gesprek');
  assert.equal(c.reason, null);
  assert.equal(c.endedAt, null);
  assert.throws(() => ats.act(kim, id, { kind: 'undo' }), /niets om ongedaan/);
  assert.throws(() => ats.act(kim, id, { kind: 'geenGehoor' }), /alleen bij Nieuw/);
  ats.act(kim, id, { kind: 'note', text: 'Wil graag weekenden' });
  assert.equal(ats.get(id).log[0].what, 'Notitie: Wil graag weekenden');
  assert.equal(ats.get(id).log[0].by, 'Kim');
});

test('four weeks after Afgewezen or Aangenomen, or without any action, only anonymous counts are left', () => {
  const { ats, key } = setup(), t = Date.now();
  const done = ats.take(key, priya, t).cand.id, open = ats.take(key, { naam: 'Mo', telefoon: '0687654321' }, t).cand.id;
  const busy = ats.take(key, { naam: 'Sem', email: 'sem@example.com' }, t).cand.id;
  ats.act(kim, done, { kind: 'reject', reason: 'Geen interesse' }, t + DAY);
  ats.act(kim, busy, { kind: 'note', text: 'Belt terug' }, t + 20 * DAY);
  assert.equal(ats.prune(t + KEEP_MS - 1), 0);
  assert.equal(ats.prune(t + DAY + KEEP_MS + 1), 2, 'the rejected one and the one nobody touched');
  assert.equal(ats.get(done), null);
  assert.equal(ats.get(open), null);
  assert.ok(ats.get(busy));
  assert.equal(ats.anon().length, 2);
  assert.ok(ats.anon().every(a => !('name' in a) && !('phone' in a)), 'no personal data');
  const s = atsStats(ats.all(), ats.anon(), t)['t-b1-kok'];
  assert.equal(s.weeks[weekOf(t)].nieuw, 3, 'still counted');
  assert.deepEqual(s.weeks[weekOf(t)].reasons, { 'Geen interesse': 1 });
});

test('the numbers: per week how far they got, the reasons, and today\'s call list without who was called today', () => {
  const { ats, key } = setup(), now = Date.now(), w = weekOf(now);
  const ids = ['Ann', 'Bas', 'Cas', 'Dirk', 'Eva'].map((n, i) => ats.take(key, { naam: n, telefoon: '06123456' + (10 + i) }, now).cand.id);
  ats.act(kim, ids[1], { kind: 'move', to: 'contact' }, now);
  ats.act(kim, ids[2], { kind: 'move', to: 'contact' }, now);
  ats.act(kim, ids[2], { kind: 'geenGehoor' }, now);
  ats.act(kim, ids[3], { kind: 'move', to: 'voorstel' }, now);
  ats.act(kim, ids[4], { kind: 'reject', reason: 'Afstand' }, now);
  const s = atsStats(ats.all(), [], now)['t-b1-kok'];
  assert.deepEqual(s.live, { nieuw: 1, contact: 1, gebeld: 1 });
  const t = s.weeks[w];
  assert.equal(t.nieuw, 5);
  assert.equal(t.gescreend, 1);
  assert.equal(t.voorgesteld, 1);
  assert.equal(t.gebeld, 3, 'a Geen gehoor, and two moved on from Nieuw past Contactpoging');
  assert.equal(s.minW, w);
  assert.deepEqual(atsStats(ats.all(), [], now + DAY)['t-b1-kok'].live, { nieuw: 1, contact: 2, gebeld: 0 }, 'back on the list after midnight');
});

test('Trello and ATS numbers of one campaign add up', () => {
  const t = { minW: 40, weeks: { 44: { nieuw: 2, gescreend: 1, gesprek: 0, voorgesteld: 0, geplaatst: 0, gebeld: 1, reasons: { Afstand: 1 } } }, live: { nieuw: 1, contact: 2, gebeld: 0 } };
  const a = { minW: 44, weeks: { 44: { nieuw: 3, gescreend: 0, gesprek: 0, voorgesteld: 0, geplaatst: 0, gebeld: 2, reasons: { Afstand: 1, 'No show': 1 } }, 45: { nieuw: 1, gescreend: 0, gesprek: 0, voorgesteld: 0, geplaatst: 0, gebeld: 0, reasons: {} } }, live: { nieuw: 2, contact: 0, gebeld: 1 } };
  const s = addStats(t, a);
  assert.equal(s.minW, 40);
  assert.equal(s.weeks[44].nieuw, 5);
  assert.equal(s.weeks[44].gebeld, 3);
  assert.deepEqual(s.weeks[44].reasons, { Afstand: 2, 'No show': 1 });
  assert.equal(s.weeks[45].nieuw, 1);
  assert.deepEqual(s.live, { nieuw: 3, contact: 2, gebeld: 1 });
  assert.equal(addStats(undefined, a), a);
  assert.equal(addStats(t, undefined), t);
});
