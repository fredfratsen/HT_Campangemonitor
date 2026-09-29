// Roles, rights and who may manage whom (src/lib/permissions.js), and the per-change checks on the shared
// data (server/authorize.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rightsOf, can, manageError, overridesFor, ROLES, RIGHT_KEYS } from '../src/lib/permissions.js';
import { makeAuthorizer, NO_RIGHT } from '../server/authorize.js';
import { DEF_RULES } from '../src/lib/constants.js';

const dev = { id: 'r-tsjerk', name: 'Tsjerk', role: 'dev', recName: 'Tsjerk' };
const dev2 = { id: 'u-dev2', name: 'Dev Twee', role: 'dev' };
const lead = { id: 'robbin', name: 'Robbin', role: 'teamlead' };
const lead2 = { id: 'u-lead2', name: 'Lead Twee', role: 'teamlead' };
const mkt = { id: 'danielle', name: 'Danielle', role: 'marketeer' };
const kim = { id: 'r-kim', name: 'Kim', role: 'recruiter', recName: 'Kim' };

test('role defaults, grants and revokes', () => {
  assert.equal(rightsOf(dev).size, RIGHT_KEYS.length);
  assert.deepEqual([...rightsOf(kim)], ['feedback.own']);
  const k2 = { ...kim, grants: ['feedback.client'], revokes: ['feedback.own'] };
  assert.deepEqual([...rightsOf(k2)], ['feedback.client']);
  assert.equal(can({ ...mkt, grants: ['nonsense'] }, 'nonsense'), false);
  assert.deepEqual(overridesFor('recruiter', ['feedback.client']), { grants: ['feedback.client'], revokes: ['feedback.own'] });
});

test('who may manage whom', () => {
  assert.equal(manageError(dev, lead, { role: 'marketeer' }), '');
  assert.equal(manageError(dev, dev2, { role: 'teamlead' }), '', 'owners manage owners');
  assert.match(manageError(dev, dev), /eigen account/);
  assert.equal(manageError(lead, kim, { role: 'marketeer' }), '');
  assert.match(manageError(lead, dev), /Eigenaar/, 'admin cannot touch an owner');
  assert.match(manageError(lead, lead2), /Eigenaar/, 'admin cannot touch another admin');
  assert.match(manageError(lead, null, { role: 'teamlead' }), /niet toekennen/, 'admin cannot create admins');
  assert.match(manageError(lead, kim, { role: 'recruiter', rights: ['feedback.own', 'integrations'] }), /zelf niet/);
  assert.match(manageError(kim, mkt), /geen recht/);
  // A right the target already has may be kept by someone who lacks it.
  const kimPlus = { ...kim, grants: ['audit.view'] };
  assert.equal(manageError(lead, kimPlus, { role: 'recruiter', rights: ['feedback.own', 'audit.view'] }), '');
});

const week = (w, o = {}) => ({ w, leads: 5, q: null, rec: '', klant: '', note: '', needsAction: false, at: '', tr: { nieuw: 5 }, ...o });
const camp = (id, rec, weeks = [week(38, { q: 7, rec: 'ok' }), week(39)]) => ({ id, client: 'Klant ' + id, vac: 'Kok', rec, start: 38, ended: false, actions: [], weeks });

test('campaign feedback: own campaigns only, author stamped', () => {
  const docs = {};
  const kimAuth = makeAuthorizer(kim, docs);
  const before = camp('c1', 'Kim'), other = camp('c2', 'Robin');
  const fill = c => ({ ...c, weeks: [c.weeks[0], { ...c.weeks[1], q: 8, rec: 'Goed', recBy: 'Iemand anders' }] });
  const r = kimAuth('campaigns', 'c1', before, fill(before));
  assert.equal(r.value.weeks[1].recBy, 'Kim', 'author is the logged-in account');
  assert.equal(kimAuth('campaigns', 'c2', other, fill(other)), NO_RIGHT, 'not on someone else\'s campaign');
  assert.equal(makeAuthorizer(lead, docs)('campaigns', 'c2', other, fill(other)).value.weeks[1].recBy, 'Robbin', 'feedback.all may correct');
  const klant = { ...other, weeks: [other.weeks[0], { ...other.weeks[1], klant: 'Tevreden', klantBy: 'Danielle' }] };
  assert.equal(kimAuth('campaigns', 'c2', other, klant), NO_RIGHT);
  assert.equal(makeAuthorizer(mkt, docs)('campaigns', 'c2', other, klant), '');
});

test('campaign changes the app makes by itself are allowed for anyone', () => {
  const a = makeAuthorizer(kim, {});
  const c = camp('c2', 'Robin');
  assert.equal(a('campaigns', 'c2', c, { ...c, weeks: [...c.weeks, week(40)] }), '', 'a new empty week rolls in');
  assert.equal(a('campaigns', 'c2', c, { ...c, weeks: [...c.weeks, week(40, { q: 9 })] }), NO_RIGHT, 'but not a filled one');
  assert.equal(a('campaigns', 'c2', { ...c, rec: 'Sanne' }, { ...c, rec: 'Robin' }), '', 'old demo names are renamed');
  assert.equal(a('campaigns', 'c2', c, { ...c, rec: 'Kim' }), NO_RIGHT, 'reassigning needs "assign"');
  assert.equal(a('campaigns', 'c9', undefined, camp('c9', 'Kim')), NO_RIGHT, 'creating needs trello.link');
  assert.equal(a('campaigns', 'c2', c, undefined), NO_RIGHT, 'deleting needs dev');
  assert.equal(a('campaigns', 'c2', c, { ...c, actions: [{ id: 'a', w: 39, type: 'Budget', text: 'x' }] }), NO_RIGHT);
});

test('trello feedback (live.fb) follows the linked recruiter', () => {
  const docs = { 'live.links': { 't-1-all': { id: 't-1-all', boardId: '1', rec: 'Kim' }, 't-2-all': { id: 't-2-all', boardId: '2', rec: 'Robin' } } };
  const a = makeAuthorizer(kim, docs);
  assert.equal(a('live.fb', 't-3-all', undefined, {}), '', 'empty entry for a new campaign');
  assert.equal(a('live.fb', 't-1-all', {}, { 39: { q: 6, rec: 'x', recBy: 'Kim' } }), '');
  assert.equal(a('live.fb', 't-2-all', {}, { 39: { q: 6 } }), NO_RIGHT);
  assert.equal(a('live.fb', 't-2-all', { 39: { q: 6, leads: 4 } }, { 39: { q: 6 } }), '', 'manual count dropping out is allowed');
  assert.equal(a('live.actions', 't-1-all', undefined, []), '');
  assert.equal(a('live.actions', 't-1-all', [], [{ w: 39 }]), NO_RIGHT);
});

test('rules, seen, meta, inbox and ideas', () => {
  const a = makeAuthorizer(kim, {});
  assert.equal(a('rules', 'qRed', 4, 9), NO_RIGHT);
  assert.equal(a('rules', 'qRed', undefined, DEF_RULES.qRed), '', 'filling in a default');
  assert.equal(makeAuthorizer({ ...mkt, grants: ['rules.edit'] }, {})('rules', 'qRed', 4, 9), '', 'granted right works');
  assert.equal(a('seen', 'r-kim', {}, { last: 1 }), '');
  assert.equal(a('seen', 'robbin', {}, { last: 1 }), NO_RIGHT);
  assert.equal(a('meta', 'seeded', undefined, true), '');
  const note = { id: 1, to: 'Kim', from: 'Robbin', read: false, kind: 'reminder', title: 't' };
  assert.equal(a('inbox', '1', note, { ...note, read: true }), '', 'marking your own notification read');
  assert.equal(a('inbox', '1', { ...note, to: 'Juul' }, { ...note, to: 'Juul', read: true }), NO_RIGHT);
  assert.equal(a('inbox', '2', undefined, { ...note, id: 2 }), NO_RIGHT, 'reminders need reminders.send');
  assert.equal(makeAuthorizer(mkt, {})('inbox', '2', undefined, { ...note, id: 2 }).value.from, 'Danielle');
  const idea = { id: 5, type: 'bug', text: 'x', by: 'Robbin', status: 'opgelost', voters: ['Robbin', 'Kim'] };
  assert.deepEqual(a('ideas', '5', undefined, idea).value, { ...idea, by: 'Kim', status: 'nieuw', voters: ['Kim'] });
  const saved = { ...idea, by: 'Robbin', status: 'nieuw', voters: [] };
  assert.equal(a('ideas', '5', saved, { ...saved, voters: ['Kim'] }), '', 'your own +1');
  assert.equal(a('ideas', '5', saved, { ...saved, voters: ['Juul'] }), NO_RIGHT);
  assert.equal(a('ideas', '5', saved, { ...saved, status: 'opgelost' }), NO_RIGHT);
});

test('assignments need assign or trello.link, and are stamped', () => {
  const e = { id: 1, client: 'X', from: '', to: 'Kim', at: 1, by: 'Iemand' };
  assert.equal(makeAuthorizer(kim, {})('assignLog', '1', undefined, e), NO_RIGHT);
  assert.equal(makeAuthorizer(lead, {})('assignLog', '1', undefined, e).value.by, 'Robbin');
  assert.equal(makeAuthorizer(mkt, {})('live.mkt', 'b1', '', 'Danielle'), NO_RIGHT);
  assert.equal(makeAuthorizer(lead, {})('live.inactive', 'b1', undefined, true), '');
});

test('every role in ROLES has only known rights', () => {
  for (const r of Object.values(ROLES)) for (const k of r.rights) assert.ok(RIGHT_KEYS.includes(k), k);
});
