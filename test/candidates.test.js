// The ATS (server/candidates.js, lib/ats.js): leads from the intake link, what a recruiter does with a candidate, the
// four weeks of keeping the data, and the numbers the monitor gets. The routes and rights are tested in server.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCandidates, parseLead, parseDesc } from '../server/candidates.js';
import { atsStats, addStats, KEEP_MS, openQuestions } from '../src/lib/ats.js';
import { weekOf } from '../src/lib/weeks.js';

const memDocs = () => (name, initial) => ({ data: initial(), save() {}, flush() {} });
const DAY = 864e5;
const lead = { id: 'robbin', name: 'Robbin' }, kim = { id: 'r-kim', name: 'Kim' };
const priya = { full_name: 'Priya Ramdin', phone_number: '+31 6 1234 5678', email: 'Priya@Example.com', 'Hoeveel jaar ervaring heb je?': '3 jaar' };

const SCR = { talen: 'NL', ervaring: '3 jaar', situatie: 'Zoekend', beschikbaar: 'Direct', woonplaats: 'Utrecht', rijbewijs: { keuze: 'B' }, vervoer: { keuze: 'Ja' }, advies: 'Doen' };

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
  ats.act(kim, id, { kind: 'move', to: 'gescreend', screening: SCR });
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
  ats.act(kim, ids[3], { kind: 'move', to: 'voorstel', screening: SCR }, now);
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

test('a Trello description: phone, email and the other lines as answers; without such lines it is one answer', () => {
  const d = parseDesc('**Telefoonnummer:** 06 1234 5678\n**E-mail:** Sanne@Example.com\nNaam: Sanne\nErvaring: 2 jaar\n\nAangemaakt door Zapier');
  assert.deepEqual(d, { phone: '06 1234 5678', email: 'sanne@example.com', answers: [['Ervaring', '2 jaar']] });
  const loose = parseDesc('Bel haar op +31 6 2222 3333 of mail mo@gmail.com');
  assert.equal(loose.phone, '+31 6 2222 3333');
  assert.equal(loose.email, 'mo@gmail.com');
  assert.deepEqual(loose.answers, [['Beschrijving uit Trello', 'Bel haar op +31 6 2222 3333 of mail mo@gmail.com']]);
  assert.deepEqual(parseDesc(''), { phone: null, email: null, answers: [] });
});

test('Trello cards onto the board: open stages only, once, with their numbers; the cards are left out from then on', () => {
  const { ats } = setup(), now = Date.now(), at = now - 10 * DAY, w = weekOf(at);
  const card = (id, stage, list, extra = {}) => ({ card: { id, ...extra }, stage, list, at, name: `Kandidaat ${id}`, desc: `Telefoon: 06123456${id.slice(-2)}` });
  const cards = [card('c01', 'nieuw', 'Nieuwe Sollicitant | Kok', { calls: [w], geenGehoor: new Date(now).toISOString() }), card('c02', 'gesprek', 'Gesprek'),
    card('c03', 'voorgesteld', 'Voorstel'), card('c04', 'overig', 'Niet bereikbaar'), card('c05', 'afgewezen', 'Afgewezen'), card('c06', 'geplaatst', 'Aangenomen')];
  assert.equal(ats.takeTrello(kim, 't-b1-kok', 'b1', cards, now), 4);
  const got = Object.fromEntries(ats.ofLink('t-b1-kok').map(c => [c.name.slice(-3), c]));
  assert.deepEqual(Object.keys(got).sort(), ['c01', 'c02', 'c03', 'c04']);
  assert.deepEqual([got.c01.stage, got.c02.stage, got.c03.stage, got.c04.stage], ['nieuw', 'gesprek', 'voorstel', 'nb']);
  assert.equal(got.c01.at, at, 'when they applied, not when they came over');
  assert.equal(got.c01.phone, '0612345601');
  assert.equal(got.c01.src, 'Trello');
  assert.equal(got.c01.log[0].by, 'Kim');
  const s = atsStats(ats.all(), [], now)['t-b1-kok'];
  assert.equal(s.weeks[w].nieuw, 4);
  assert.equal(s.weeks[w].gesprek, 2, 'Gesprek and Voorstel got that far');
  assert.equal(s.weeks[w].gebeld, 1, 'the weeks it was called in come along');
  assert.deepEqual(s.live, { nieuw: 0, contact: 0, gebeld: 1 }, 'Geen gehoor today: off the call list');
  assert.deepEqual([...ats.fromTrello('b1')].sort(), ['c01', 'c02', 'c03', 'c04']);
  assert.equal(ats.takeTrello(kim, 't-b1-kok', 'b1', cards, now), 0, 'not twice');
  assert.equal(ats.takeTrello(kim, 't-b1-kok', 'b1', [card('c07', 'contact', 'Contactpoging'), ...cards], now), 1, 'a card that came into Trello since');
});

test('the gate: no Gescreend (or further) from a call stage without a complete screening', () => {
  const { ats, key } = setup(), c = ats.take(key, priya).cand;
  assert.throws(() => ats.act(kim, c.id, { kind: 'move', to: 'gescreend' }), /Vul eerst de screening in: Talenkennis/);
  assert.throws(() => ats.act(kim, c.id, { kind: 'move', to: 'aangenomen' }), /Vul eerst de screening in/);
  const out = ats.act(kim, c.id, { kind: 'move', to: 'gescreend', screening: SCR, contact: { name: 'Priya R. Ramdin', phone: '+31 6 1234 5678', email: 'priya@example.com' } });
  assert.equal(out.stage, 'gescreend');
  assert.ok(out.doorgezetOp);
  assert.deepEqual(out.log.slice(0, 2).map(e => e.what), ['Doorgezet naar klant', 'Naar Gescreend']);
  assert.ok(out.log.some(e => e.what === 'Naam: Priya Ramdin → Priya R. Ramdin'));
  assert.ok(out.undo, 'the move itself can be undone');
});
test('screening saves as a draft, without touching undo, one timeline line per half hour', () => {
  const { ats, key } = setup(), c = ats.take(key, priya).cand, t = Date.now();
  ats.act(kim, c.id, { kind: 'move', to: 'contact' }, t);
  ats.act(kim, c.id, { kind: 'screening', screening: { talen: 'NL' } }, t + 1000);
  const out = ats.act(kim, c.id, { kind: 'screening', screening: { talen: 'NL, EN' } }, t + 2000);
  assert.equal(out.screening.talen, 'NL, EN');
  assert.ok(out.undo, 'the move to Contactpoging can still be undone');
  assert.equal(out.log.filter(e => e.what === 'Screening bijgewerkt').length, 1);
});
test('doorzetten: a Trello card past the gate goes to the client once its screening is complete', () => {
  const { ats } = setup();
  ats.takeTrello(kim, 't-b1-kok', 'b1', [{ card: { id: 'c1' }, list: 'Gesprek', stage: 'gesprek', at: Date.now(), name: 'Jan', desc: 'Telefoon: 0612345678' }]);
  const c = ats.ofLink('t-b1-kok')[0];
  assert.equal(c.doorgezetOp, undefined);
  assert.throws(() => ats.act(kim, c.id, { kind: 'doorzetten' }), /Vul eerst de screening in/);
  ats.act(kim, c.id, { kind: 'screening', screening: SCR });
  assert.ok(ats.act(kim, c.id, { kind: 'doorzetten' }).doorgezetOp);
  assert.throws(() => ats.act(kim, c.id, { kind: 'doorzetten' }), /ligt al bij de klant/);
});
test('contact: the same checks as the intake', () => {
  const { ats, key } = setup(), c = ats.take(key, priya).cand;
  assert.throws(() => ats.act(kim, c.id, { kind: 'contact', name: '', phone: '0612345678' }), /Naam ontbreekt/);
  assert.throws(() => ats.act(kim, c.id, { kind: 'contact', name: 'P', phone: '123' }), /telefoonnummer klopt niet/);
  assert.equal(ats.act(kim, c.id, { kind: 'contact', name: 'Priya Ramdin', phone: priya.phone_number, email: 'priya@example.com' }).log[0].what, 'Gegevens gecontroleerd');
});
test('only a move through the gate hands over to the client', () => {
  const { ats, key } = setup();
  ats.takeTrello(kim, 't-b1-kok', 'b1', [{ card: { id: 'c1' }, list: 'Gescreend', stage: 'gescreend', at: Date.now(), name: 'Jan', desc: 'Telefoon: 0612345678' }]);
  const t = ats.ofLink('t-b1-kok')[0];
  assert.equal(ats.act(kim, t.id, { kind: 'move', to: 'gesprek', at: '2026-11-06T14:00' }).doorgezetOp, undefined);
  const c = ats.take(key, priya).cand;
  ats.act(kim, c.id, { kind: 'reject', reason: 'Geen reactie' });
  assert.equal(ats.act(kim, c.id, { kind: 'move', to: 'gescreend' }).doorgezetOp, undefined);
});
test('a refused move changes nothing; doorzetten needs Gescreend or further', () => {
  const { ats, key } = setup(), c = ats.take(key, priya).cand, n = c.log.length;
  assert.throws(() => ats.act(kim, c.id, { kind: 'move', to: 'gescreend', contact: { name: 'Nieuwe Naam', phone: '0612345678' } }), /Vul eerst de screening in/);
  assert.equal(c.stage, 'nieuw'); assert.equal(c.name, 'Priya Ramdin'); assert.equal(c.log.length, n);
  assert.throws(() => ats.act(kim, c.id, { kind: 'doorzetten' }), /Doorzetten kan pas vanaf Gescreend\./);
});

function atClient(ats, key) {
  const c = ats.take(key, priya).cand;
  return ats.act(kim, c.id, { kind: 'move', to: 'gescreend', screening: SCR });
}
const door = { naam: 'Anna', organisatie: 'Sojubar' };
test('the client: Geen gehoor stays put, Op gesprek / Aangenomen / Afwijzen move, each marked as the client', () => {
  const { ats, key } = setup(), c = atClient(ats, key);
  assert.equal(ats.klantAct('t-b1-kok', c.id, { kind: 'geenGehoor' }, door).stage, 'gescreend');
  assert.equal(c.klantGg, 1);
  assert.deepEqual([c.log[0].by, c.log[0].klant], ['Sojubar · Anna', true]);
  assert.equal(c.undo, null, 'any client action clears the recruiter\'s undo');
  const g = ats.klantAct('t-b1-kok', c.id, { kind: 'gesprek', at: '2026-11-12T14:00:00' }, door);
  assert.equal(g.stage, 'gesprek');
  assert.equal(g.undo, null, 'a move by the client clears the recruiter\'s undo');
  assert.equal(ats.klantAct('t-b1-kok', c.id, { kind: 'gesprek', at: '2026-11-19T14:00:00' }, door).stage, 'gesprek', 'nog een gesprek');
  assert.throws(() => ats.klantAct('t-b1-kok', c.id, { kind: 'afwijzen', reason: 'Diefstal' }, door), /Kies een reden/);
  assert.equal(ats.klantAct('t-b1-kok', c.id, { kind: 'afwijzen', reason: 'No show' }, door).reason, 'No show');
  assert.throws(() => ats.klantAct('t-b1-kok', c.id, { kind: 'gesprek', at: '2026-11-20T10:00:00' }, door), /alleen bij Gescreend of Gesprek/);
});
test('the client: a second meeting is logged as Nog een gesprek', () => {
  const { ats, key } = setup(), c = atClient(ats, key);
  ats.klantAct('t-b1-kok', c.id, { kind: 'gesprek', at: '2026-11-12T14:00:00' }, door);
  assert.match(c.log[0].what, /^Op gesprek · /);
  ats.klantAct('t-b1-kok', c.id, { kind: 'gesprek', at: '2026-11-19T14:00:00' }, door);
  assert.match(c.log[0].what, /^Nog een gesprek · /);
});
test('rename also anonymises the name on answers to client questions', () => {
  const { ats, key } = setup(), c = atClient(ats, key);
  ats.klantAct('t-b1-kok', c.id, { kind: 'vraag', text: 'Weekend?' }, door);
  ats.act({ id: 'danielle', name: 'Danielle' }, c.id, { kind: 'antwoord', vraagId: c.vragen[0].id, text: 'Ja' });
  ats.rename(new Set(['Danielle']), 'Oud-teamlid 1');
  assert.equal(c.vragen[0].antwoord.door, 'Oud-teamlid 1');
  assert.ok(c.log.every(e => e.by !== 'Danielle'));
});
test('the client only reaches visible candidates of the link it names', () => {
  const { ats, key } = setup(), c = atClient(ats, key), fresh = ats.take(key, { naam: 'Mo', telefoon: '0633334444' }).cand;
  assert.equal(ats.klantAct('t-b1-andere', c.id, { kind: 'opmerking', text: 'x' }, door), null);
  assert.equal(ats.klantAct('t-b1-kok', fresh.id, { kind: 'opmerking', text: 'x' }, door), null);
  assert.equal(ats.klantAct('t-b1-kok', 'bestaatniet', { kind: 'opmerking', text: 'x' }, door), null);
  assert.throws(() => ats.klantAct('t-b1-kok', c.id, { kind: 'opmerking', text: 'x' }, { naam: '' }), /Wie de actie deed ontbreekt/);
});
test('questions: the RM answers each once; open ones are counted', () => {
  const { ats, key } = setup(), c = atClient(ats, key);
  ats.klantAct('t-b1-kok', c.id, { kind: 'vraag', text: 'Rijbewijs?' }, door);
  ats.klantAct('t-b1-kok', c.id, { kind: 'vraag', text: 'Weekend?' }, door);
  const [q1] = c.vragen, rm = { id: 'danielle', name: 'Danielle' };
  ats.act(rm, c.id, { kind: 'antwoord', vraagId: q1.id, text: 'Ja, B' });
  assert.equal(c.undo, null, 'answering clears the undo too');
  assert.equal(openQuestions(c), 1);
  assert.deepEqual([q1.antwoord.door, q1.antwoord.tekst], ['Danielle', 'Ja, B']);
  assert.throws(() => ats.act(rm, c.id, { kind: 'antwoord', vraagId: q1.id, text: 'nog eens' }), /al beantwoord/);
  assert.throws(() => ats.act(rm, c.id, { kind: 'antwoord', vraagId: 'nee', text: 'x' }), /bestaat niet/);
});
