// The portal API's allow-list (forClient) and the notice for a client's question. The routes are tested in server.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCandidates } from '../server/candidates.js';
import { forClient, questionNotice } from '../server/portaal.js';

const memDocs = () => (name, initial) => ({ data: initial(), save() {}, flush() {} });
const kim = { id: 'r-kim', name: 'Kim' };
const SCR = { talen: 'NL', ervaring: '3 jaar', situatie: 'Zoekend', beschikbaar: 'Direct', woonplaats: 'Utrecht', rijbewijs: { keuze: 'B' }, vervoer: { keuze: 'Ja' }, advies: 'Doen' };
const FORBIDDEN = ['answers', 'att', 'gg', 'tba', 'calls', 'src', 'undo', 'log', 'phone', 'name', 'link', 'stage', 'reason', 'klantAt', 'lastAt', 'endedAt', 'reached', 'bl'];
const link = { id: 't-b1-kok', boardId: 'b1', boardName: 'Sojubar', vac: 'Kok', rec: 'Kim' };

function build() {
  const ats = createCandidates(memDocs()), key = ats.newKey(kim, link.id);
  const c = ats.take(key, { full_name: 'Priya Ramdin', phone_number: '+31 6 1234 5678', email: 'priya@example.com', 'Ervaring?': '3 jaar' }).cand;
  ats.act(kim, c.id, { kind: 'geenGehoor' });
  ats.act(kim, c.id, { kind: 'move', to: 'gescreend', screening: SCR });
  ats.act(kim, c.id, { kind: 'note', text: 'belt liever na 17u' });
  ats.klantAct(link.id, c.id, { kind: 'opmerking', text: 'Leuk profiel' }, { naam: 'Anna', organisatie: 'Sojubar' });
  return { ats, c };
}

test('forClient: exactly the allowed keys, no internal field, no internal timeline line', () => {
  const { c } = build();
  const out = forClient(c);
  assert.deepEqual(Object.keys(out).sort(), ['doorgezetOp', 'email', 'fase', 'faseNaam', 'gesprek', 'id', 'klantGg', 'linkId', 'naam', 'reden', 'screening', 'telefoon', 'tijdlijn', 'vragen', 'wachtSinds'].sort());
  for (const k of FORBIDDEN) assert.equal(k in out, false, k);
  const text = JSON.stringify(out);
  for (const s of ['belt liever', 'Geen gehoor', 'Meta', 'Kim']) assert.ok(!text.includes(s), s);
  assert.deepEqual(out.tijdlijn.map(e => e.door), ['Sojubar · Anna', 'Horeca Toppers']);
  assert.equal(out.reden, null);
});

const store = { docs: { 'live.mkt': { b1: 'Danielle' } } };
test('questionNotice carries no candidate data and goes to the RM and the recruiter', () => {
  const { c } = build();
  const [p] = questionNotice(store, { all: () => [] }, link, c, Date.now());
  const items = Object.values(p.set);
  assert.deepEqual(items.map(n => n.to).sort(), ['Danielle', 'Kim']);
  assert.ok(!JSON.stringify(p).includes('Priya') && !JSON.stringify(p).includes('1234'));
  assert.equal(items[0].link, `#bord=${link.id}&k=${c.id}`);
});

test('questionNotice without an RM goes to whoever has Toewijzing beheren', () => {
  const { c } = build();
  const accounts = { all: () => [{ name: 'Lea', role: 'teamlead', status: 'active' }, { name: 'Oud', role: 'teamlead', status: 'deactivated' }, { name: 'Kim', role: 'recruiter', status: 'active' }] };
  const [p] = questionNotice({ docs: { 'live.mkt': {} } }, accounts, link, c, Date.now());
  assert.deepEqual(Object.values(p.set).map(n => n.to).sort(), ['Kim', 'Lea']);
});
