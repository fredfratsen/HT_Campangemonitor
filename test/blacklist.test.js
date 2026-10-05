// The blacklist (server/blacklist.js): what an entry needs, proposals, search, terms and expiry. The routes and
// rights around it are tested end to end in server.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlacklist, normPhone, initials } from '../server/blacklist.js';

/** In-memory documents with the interface of jsonfile.js. */
const memDocs = () => (name, initial) => ({ data: initial(), save() {}, flush() {} });
const DAY = 864e5;
const lead = { id: 'robbin', name: 'Robbin' }, kim = { id: 'r-kim', name: 'Kim' };
const jan = { name: 'Jan  de Vries', phone: '06-1234 5678', reason: 'No-show bij gesprek of proefdag' };
const zoe = { name: 'Zoë Bakker', email: 'Zoe@Example.com ', reason: 'Ongepast of agressief gedrag' };

test('phone numbers and initials', () => {
  for (const p of ['06-1234 5678', '+31 6 12345678', '0031612345678', '31612345678']) assert.equal(normPhone(p), '31612345678', p);
  assert.equal(initials('Jan  de Vries'), 'J. d. V.');
});

test('a manager adds directly, anyone else proposes; the term starts once confirmed', () => {
  const bl = createBlacklist(memDocs());
  const e = bl.add(lead, jan, { direct: true });
  assert.equal(e.status, 'actief');
  assert.equal(e.name, 'Jan de Vries');
  assert.equal(e.months, 12);
  assert.ok(e.until > Date.now() + 360 * DAY && e.until < Date.now() + 370 * DAY);
  const p = bl.add(kim, { ...zoe, months: 6 }, { direct: false });
  assert.equal(p.status, 'voorstel');
  assert.equal(p.email, 'zoe@example.com');
  assert.ok(p.until < Date.now() + 31 * DAY, 'a proposal lapses after 30 days');
  assert.deepEqual(bl.counts(), { total: 1, pending: 1 });
  const ok = bl.approve(lead, p.id);
  assert.equal(ok.approvedBy, 'Robbin');
  assert.ok(ok.until > Date.now() + 170 * DAY, 'six months from confirming');
  assert.throws(() => bl.approve(lead, p.id), /staat al op de blacklist/);
});

test('what an entry needs', () => {
  const bl = createBlacklist(memDocs()), add = b => () => bl.add(lead, { ...jan, ...b }, { direct: true });
  assert.throws(add({ name: ' ' }), /naam/);
  assert.throws(add({ phone: '' }), /e-mailadres of telefoonnummer/, 'never on a name alone');
  assert.throws(add({ phone: '123' }), /telefoonnummer klopt niet/);
  assert.throws(add({ email: 'geen-mail' }), /e-mailadres klopt niet/);
  assert.throws(add({ reason: 'Diefstal' }), /Kies een reden/, 'only reasons from the list');
  assert.throws(add({ reason: 'Overig' }), /Overig/, 'Overig needs a note');
  assert.throws(add({ scope: 'client' }), /klant/, 'only for one client needs that client');
  assert.throws(add({ months: 36 }), /termijn/);
  assert.equal(add({ reason: 'Overig', note: 'Vertrok halverwege de proefdag' })().note, 'Vertrok halverwege de proefdag');
  assert.throws(add({ name: 'Iemand Anders', phone: '+31 6 1234 5678' }), /Jan de Vries staat al op de blacklist/, 'the same phone number, written differently');
});

test('search: a name in any order and without accents, an email address, a phone number in any format', () => {
  const bl = createBlacklist(memDocs());
  bl.add(lead, jan, { direct: true });
  bl.add(kim, zoe, { direct: false });
  const names = q => bl.search(q).map(e => e.name);
  assert.deepEqual(names('vries jan'), ['Jan de Vries']);
  assert.deepEqual(names('zoe'), ['Zoë Bakker']);
  assert.deepEqual(names('ZOE@example'), ['Zoë Bakker']);
  for (const q of ['+31612345678', '0612345678', '12345678']) assert.deepEqual(names(q), ['Jan de Vries'], q);
  assert.deepEqual(names('Pietersen'), []);
});

test('correcting, extending, expiring, and a former team member renamed', () => {
  const bl = createBlacklist(memDocs());
  const e = bl.add(lead, jan, { direct: true }), fix = { ...jan, reason: 'Niet verschenen na plaatsing', client: 'Hotel X', vac: 'Kok', scope: 'client' };
  const r = bl.update(kim, e.id, { ...fix, months: 24 });
  assert.deepEqual(r.changed, ['reden', 'klant', 'functie', 'geldt voor', 'bewaartermijn']);
  assert.equal(r.entry.updatedBy, 'Kim');
  assert.ok(r.entry.until > Date.now() + 720 * DAY, 'extended: 24 months from now');
  assert.deepEqual(bl.update(kim, e.id, fix).changed, [], 'nothing changed');
  assert.deepEqual(bl.auditDetails(e), { vermelding: e.id, kandidaat: 'J. d. V.', reden: 'Niet verschenen na plaatsing', alleenBij: 'Hotel X' }, 'no full name in the audit log');

  const p = bl.add(kim, zoe, { direct: false });
  assert.deepEqual(bl.prune(Date.now() + 31 * DAY).map(x => x.id), [p.id], 'the proposal lapses, the entry stays');
  assert.equal(bl.get(p.id), null);
  bl.rename(new Set(['Robbin']), 'Oud-teamlid 1');
  assert.equal(bl.get(e.id).addedBy, 'Oud-teamlid 1');
  assert.deepEqual(bl.prune(Date.now() + 25 * 31 * DAY).map(x => x.id), [e.id]);
  assert.deepEqual(bl.all(), []);
});
