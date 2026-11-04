// The screening form and what a client may see (lib/ats.js): cleaning, the missing required fields, the text the
// recruiters paste, and the working days a candidate has been waiting on the client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanScreening, screeningMissing, screeningText, workdaysSince, visibleToClient, waitingSince } from '../src/lib/ats.js';

test('screeningMissing: the required fields, and Anders or Nee need their text', () => {
  assert.deepEqual(screeningMissing({}), ['Talenkennis', 'Werkervaring / opleiding / vakkennis', 'Huidige werkgever / situatie', 'Beschikbaarheid', 'Woonplaats', 'Rijbewijs', 'Eigen vervoer', 'Advies']);
  const full = cleanScreening({ talen: 'NL', ervaring: '3 jaar', situatie: 'Zoekend', beschikbaar: 'Direct', woonplaats: 'Utrecht',
    rijbewijs: { keuze: 'Anders', tekst: '' }, vervoer: { keuze: 'Nee', tekst: '' }, advies: 'Doen' });
  assert.deepEqual(screeningMissing(full), ['Rijbewijs', 'Eigen vervoer']);
  assert.deepEqual(screeningMissing({ ...full, rijbewijs: { keuze: 'B' }, vervoer: { keuze: 'Nee', tekst: 'OV' } }), []);
});
test('cleanScreening drops unknown keys and bad values', () => {
  const s = cleanScreening({ talen: '  NL   en EN ', hack: 'x', leeftijd: '120', rijbewijs: { keuze: 'C', tekst: 'x' }, vervoer: { keuze: 'Ja', tekst: 'fiets' } });
  assert.equal(s.talen, 'NL en EN');
  assert.equal(s.hack, undefined);
  assert.equal(s.leeftijd, null);
  assert.deepEqual(s.rijbewijs, { keuze: '', tekst: '' });
  assert.deepEqual(s.vervoer, { keuze: 'Ja', tekst: '' });
});
test('screeningText: the recruiters\' format, in order', () => {
  const t = screeningText(cleanScreening({ talen: 'NL', rijbewijs: { keuze: 'Anders', tekst: 'AM' }, vervoer: { keuze: 'Nee', tekst: 'OV' } }), 'Priya Ramdin');
  assert.ok(t.startsWith('Priya Ramdin\n\n🗣️ Talenkennis:\nNL\n\n💼 Werkervaring / opleiding / vakkennis:\n\n'));
  assert.match(t, /🚘 Rijbewijs:\nAnders, namelijk: AM/);
  assert.match(t, /🚗 Eigen vervoer:\nNee → reist met: OV/);
  assert.ok(t.trimEnd().endsWith('➡️ Advies:'));
});
test('workdaysSince skips weekends', () => {
  const d = s => new Date(s + 'T10:00:00').getTime();
  assert.equal(workdaysSince(d('2026-11-06'), d('2026-11-11')), 3); // vr → wo
  assert.equal(workdaysSince(d('2026-11-02'), d('2026-11-05')), 3); // ma → do
  assert.equal(workdaysSince(d('2026-11-07'), d('2026-11-09')), 1); // za → ma
  assert.equal(workdaysSince(d('2026-11-09'), d('2026-11-09')), 0);
});
test('visibleToClient and waitingSince', () => {
  const c = { stage: 'gescreend', doorgezetOp: 100 };
  assert.equal(visibleToClient(c), true);
  assert.equal(visibleToClient({ stage: 'contact', doorgezetOp: 100 }), false);
  assert.equal(visibleToClient({ stage: 'gesprek' }), false);
  assert.equal(waitingSince(c), 100);
  assert.equal(waitingSince({ ...c, klantAt: 150 }), null);
  assert.equal(waitingSince({ ...c, stage: 'gesprek' }), null);
});
