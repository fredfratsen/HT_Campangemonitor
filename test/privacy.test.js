// The personal data export (server/privacy.js): only real data, never the demo data the app ships with. The routes
// around it are tested end to end in server.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivacy } from '../server/privacy.js';

const kim = { id: 'r-kim', name: 'Kim', recName: 'Kim' };
const accounts = { selfView: a => ({ id: a.id, name: a.name }), sessionsOf: () => [] };
const audit = { query: async () => [] };

test('the export leaves out the demo campaigns, demo marketeers and demo assignments', async () => {
  const docs = {
    // Demo data: a demo recruiter with the same name as a real team member.
    campaigns: { c1: { id: 'c1', client: 'Café Rood', vac: 'Kok', rec: 'Kim', weeks: [{ w: 39, q: 7, rec: 'Goed', recBy: 'Kim', klant: 'Tevreden', klantBy: 'Kim', mon: 'check', monBy: 'Kim' }] } },
    mktDemo: { 'Café Rood': 'Kim' },
    assignLog: { 1: { id: 1, mode: 'demo', client: 'Café Rood', from: '', to: 'Kim', by: 'Robbin' }, 2: { id: 2, mode: 'trello', client: 'Hotel Zee', from: '', to: 'Kim', by: 'Robbin' } },
    // Real data from Trello.
    'live.links': { l1: { boardId: 'b1', boardName: 'Hotel Zee', vac: 'Receptionist', rec: 'Kim' } },
    'live.fb': { l1: { 40: { q: 8, rec: 'Prima', recBy: 'Kim' } } },
    'live.mkt': { b1: 'Kim' },
  };
  const ex = await createPrivacy({ accounts, store: { docs }, audit }).exportFor(kim);
  assert.deepEqual(ex.campagnesAlsRecruiter, [{ bron: 'trello', campagne: 'Hotel Zee – Receptionist' }]);
  assert.deepEqual(ex.klantenAlsMarketeer, ['Hotel Zee']);
  assert.deepEqual(ex.recruiterfeedback.map(f => f.campagne), ['Hotel Zee – Receptionist']);
  assert.deepEqual(ex.klantfeedback, []);
  assert.deepEqual(ex.monitorstatusEnUpdates, []);
  assert.deepEqual(ex.toewijzingen.map(e => e.id), [2]);
  assert.ok(!JSON.stringify(ex).includes('Café Rood'), 'nothing from the demo data');
});
