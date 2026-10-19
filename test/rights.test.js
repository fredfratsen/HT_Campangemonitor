// Roles, rights and who may manage whom (src/lib/permissions.js), and the per-change checks on the shared
// data (server/authorize.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rightsOf, can, canViewAs, manageError, overridesFor, visibleCampaigns, ROLES, RIGHT_KEYS } from '../src/lib/permissions.js';
import { makeAuthorizer, NO_RIGHT, REMINDED } from '../server/authorize.js';
import { DEF_RULES } from '../src/lib/constants.js';
import { feedbackWeek, wl } from '../src/lib/weeks.js';

const dev = { id: 'r-tsjerk', name: 'Tsjerk', role: 'dev', recName: 'Tsjerk' };
const dev2 = { id: 'u-dev2', name: 'Dev Twee', role: 'dev' };
const lead = { id: 'robbin', name: 'Robbin', role: 'teamlead' };
const lead2 = { id: 'u-lead2', name: 'Lead Twee', role: 'teamlead' };
const mkt = { id: 'danielle', name: 'Danielle', role: 'marketeer' };
const kim = { id: 'r-kim', name: 'Kim', role: 'recruiter', recName: 'Kim' };
const am = { id: 'u-am', name: 'Anouk', role: 'accountmanager' };

test('role defaults, grants and revokes', () => {
  assert.equal(rightsOf(dev).size, RIGHT_KEYS.length);
  assert.deepEqual([...rightsOf(kim)], ['feedback.own', 'blacklist.view']);
  const k2 = { ...kim, grants: ['feedback.client'], revokes: ['feedback.own'] };
  assert.deepEqual([...rightsOf(k2)], ['blacklist.view', 'feedback.client']);
  assert.equal(can({ ...mkt, grants: ['nonsense'] }, 'nonsense'), false);
  assert.deepEqual(overridesFor('recruiter', ['feedback.client', 'blacklist.view']), { grants: ['feedback.client'], revokes: ['feedback.own'] });
});

test('blacklist: recruiters look candidates up and propose them, the teamlead decides', () => {
  assert.ok(can(kim, 'blacklist.view') && !can(kim, 'blacklist.manage'));
  assert.ok(can(lead, 'blacklist.view') && can(lead, 'blacklist.manage'));
  for (const who of [mkt, am]) assert.ok(!can(who, 'blacklist.view') && !can(who, 'blacklist.manage'), who.role);
  assert.equal(manageError(lead, kim, { role: 'recruiter', rights: ['feedback.own', 'blacklist.view', 'blacklist.manage'] }), '', 'a teamlead can let a recruiter decide too');
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

test('Bekijk als: recruiters and marketeers see each other, a recruiter never a marketeer', () => {
  const juul = { id: 'r-juul', name: 'Juul', role: 'recruiter', recName: 'Juul' }, mare = { id: 'mare', name: 'Mare', role: 'marketeer' };
  assert.equal(canViewAs(kim, juul), true);
  assert.equal(canViewAs(kim, mkt), false);
  assert.equal(canViewAs({ ...kim, grants: ['campaigns.all'] }, mkt), false, 'not even with extra rights');
  assert.equal(canViewAs(mkt, kim), true);
  assert.equal(canViewAs(mkt, mare), true);
  for (const t of [dev, lead, am]) { assert.equal(canViewAs(kim, t), false); assert.equal(canViewAs(mkt, t), false); }
  assert.equal(canViewAs(lead, kim), false, 'teamlead: not part of this');
  assert.equal(canViewAs(am, kim), false);
  assert.equal(canViewAs(kim, kim), false, 'not yourself');
  assert.equal(canViewAs(dev, mkt), true, 'Dev sees everyone');
  assert.equal(canViewAs(dev, lead), true);
});

const week = (w, o = {}) =>({ w, leads: 5, q: null, rec: '', klant: '', note: '', needsAction: false, at: '', tr: { nieuw: 5 }, ...o });
// This week and last week: recruiter feedback on older weeks has expired.
const W = feedbackWeek();
const camp = (id, rec, weeks = [week(W - 1, { q: 7, rec: 'ok' }), week(W)]) => ({ id, client: 'Klant ' + id, vac: 'Kok', rec, start: W - 1, ended: false, actions: [], weeks });

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

test('recruiter feedback on an expired week is refused; catching up on last week is fine', () => {
  const docs = { 'live.links': { 't-1-all': { id: 't-1-all', boardId: '1', rec: 'Kim' } } };
  const c = camp('c1', 'Kim', [week(W - 2), week(W - 1), week(W)]), gone = `De feedback voor week ${wl(W - 2)} is vervallen.`;
  const fill = i => ({ ...c, weeks: c.weeks.map((w, j) => j === i ? { ...w, q: 6, rec: 'x' } : w) });
  const a = makeAuthorizer(kim, docs);
  assert.equal(a('campaigns', 'c1', c, fill(2)), '', 'this week');
  assert.equal(a('campaigns', 'c1', c, fill(1)), '', 'last week');
  assert.equal(a('campaigns', 'c1', c, fill(0)), gone, 'two weeks ago');
  assert.equal(makeAuthorizer(lead, docs)('campaigns', 'c1', c, fill(0)), gone, 'not even with feedback.all');
  assert.equal(makeAuthorizer(dev, docs)('campaigns', 'c1', c, fill(0)), '', 'the Dev can');
  assert.equal(makeAuthorizer(mkt, docs)('campaigns', 'c1', c, { ...c, weeks: [{ ...c.weeks[0], klant: 'x' }, ...c.weeks.slice(1)] }), '', 'client feedback is not the recruiter\'s');
  assert.equal(a('live.fb', 't-1-all', {}, { [W - 1]: { q: 6 } }), '', 'Trello mode: last week');
  assert.equal(a('live.fb', 't-1-all', {}, { [W - 2]: { q: 6 } }), gone, 'Trello mode: two weeks ago');
  assert.equal(a('live.fb', 't-1-all', { [W - 2]: { q: 6, leads: 4 } }, { [W - 2]: { q: 6 } }), '', 'a manual count still drops out by itself');
});

test('campaign changes the app makes by itself are allowed for anyone', () => {
  const a = makeAuthorizer(kim, {});
  const c = camp('c2', 'Robin');
  assert.equal(a('campaigns', 'c2', c, { ...c, weeks: [...c.weeks, week(W + 1)] }), '', 'a new empty week rolls in');
  assert.equal(a('campaigns', 'c2', c, { ...c, weeks: [...c.weeks, week(W + 1, { q: 9 })] }), NO_RIGHT, 'but not a filled one');
  assert.equal(a('campaigns', 'c2', { ...c, rec: 'Sanne' }, { ...c, rec: 'Robin' }), '', 'old demo names are renamed');
  assert.equal(a('campaigns', 'c2', c, { ...c, rec: 'Kim' }), NO_RIGHT, 'reassigning needs "assign"');
  assert.equal(a('campaigns', 'c9', undefined, camp('c9', 'Kim')), NO_RIGHT, 'creating needs assign');
  assert.equal(a('campaigns', 'c2', c, undefined), NO_RIGHT, 'deleting needs dev');
  assert.equal(a('campaigns', 'c2', c, { ...c, actions: [{ id: 'a', w: 39, type: 'Budget', text: 'x' }] }), NO_RIGHT);
});

test('trello feedback (live.fb) follows the linked recruiter', () => {
  const docs = { 'live.links': { 't-1-all': { id: 't-1-all', boardId: '1', rec: 'Kim' }, 't-2-all': { id: 't-2-all', boardId: '2', rec: 'Robin' } } };
  const a = makeAuthorizer(kim, docs);
  assert.equal(a('live.fb', 't-3-all', undefined, {}), '', 'empty entry for a new campaign');
  assert.equal(a('live.fb', 't-1-all', {}, { [W]: { q: 6, rec: 'x', recBy: 'Kim' } }), '');
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

test('ideas: only the Dev sorts them into a group (prio) and deletes them; the teamlead still sets the status', () => {
  const idea = { id: 5, type: 'bug', text: 'x', by: 'Kim', status: 'nieuw', voters: [] };
  const D = makeAuthorizer(dev, {}), L = makeAuthorizer(lead, {}), K = makeAuthorizer(kim, {});
  assert.equal(K('ideas', '5', undefined, { ...idea, prio: 'p1' }).value.prio, undefined, 'a new report comes in unsorted');
  assert.equal(L('ideas', '5', undefined, { ...idea, by: 'Robbin', prio: 'p1' }).value.prio, undefined, 'also from a teamlead');
  assert.equal(D('ideas', '5', undefined, { ...idea, by: 'Tsjerk', prio: 'p1' }), '', 'the Dev may file their own straight away');
  assert.equal(L('ideas', '5', idea, { ...idea, prio: 'p1' }), NO_RIGHT);
  assert.equal(D('ideas', '5', idea, { ...idea, prio: 'p1' }), '');
  assert.equal(D('ideas', '5', { ...idea, prio: 'p1' }, idea), '', 'back to Ongesorteerd');
  assert.equal(L('ideas', '5', idea, { ...idea, status: 'opgepakt' }), '', 'status: ideas.manage');
  assert.equal(L('ideas', '5', idea, undefined), NO_RIGHT, 'deleting: dev');
  assert.equal(D('ideas', '5', idea, undefined), '');
});

test('assignments need assign or trello.link, and are stamped', () => {
  const e = { id: 1, client: 'X', from: '', to: 'Kim', at: 1, by: 'Iemand' };
  assert.equal(makeAuthorizer(kim, {})('assignLog', '1', undefined, e), NO_RIGHT);
  assert.equal(makeAuthorizer(lead, {})('assignLog', '1', undefined, e).value.by, 'Robbin');
  assert.equal(makeAuthorizer(mkt, {})('live.mkt', 'b1', '', 'Danielle'), NO_RIGHT);
  assert.equal(makeAuthorizer(lead, {})('live.inactive', 'b1', undefined, true), '');
});

test('Toewijzing alone links new clients and sets boards to Geen klant', () => {
  const assigner = makeAuthorizer({ ...mkt, grants: ['assign'] }, {}), plain = makeAuthorizer(mkt, {});
  for (const [doc, key, after] of [['live.links', 't-b1-all', { id: 't-b1-all', boardId: 'b1', rec: 'Kim' }], ['live.ignored', 'b1', true], ['trIgnored', 'Hotel X', true], ['campaigns', 'n1', camp('n1', 'Kim')]]) {
    assert.equal(assigner(doc, key, undefined, after), '', doc);
    assert.equal(plain(doc, key, undefined, after), NO_RIGHT, doc);
  }
});

test('account manager sees campaigns but changes nothing', () => {
  assert.deepEqual([...rightsOf(am)].sort(), ['campaigns.all', 'questions.ask']);
  assert.equal(manageError(lead, null, { role: 'accountmanager' }), '', 'a teamlead can invite account managers');
  const a = makeAuthorizer(am, { 'live.links': { 't-1-all': { id: 't-1-all', boardId: '1', rec: 'Kim' } } });
  const c = camp('c1', 'Kim');
  assert.equal(a('campaigns', 'c1', c, { ...c, weeks: [c.weeks[0], { ...c.weeks[1], q: 8, rec: 'x' }] }), NO_RIGHT, 'no recruiter feedback');
  assert.equal(a('campaigns', 'c1', c, { ...c, weeks: [c.weeks[0], { ...c.weeks[1], klant: 'x' }] }), NO_RIGHT, 'no client feedback');
  assert.equal(a('campaigns', 'c1', c, { ...c, actions: [{ id: 'a', w: 39, type: 'Budget', text: 'x' }] }), NO_RIGHT, 'no campaign changes');
  assert.equal(a('campaigns', 'c1', c, { ...c, rec: 'Juul' }), NO_RIGHT, 'no assigning');
  assert.equal(a('live.fb', 't-1-all', {}, { 39: { klant: 'x' } }), NO_RIGHT);
  assert.equal(a('live.actions', 't-1-all', [], [{ w: 39 }]), NO_RIGHT);
  assert.equal(a('live.mkt', '1', '', 'Anouk'), NO_RIGHT);
  assert.equal(a('rules', 'qRed', 4, 9), NO_RIGHT);
  assert.equal(a('inbox', '1', undefined, { id: 1, to: 'Kim', from: 'Anouk', kind: 'reminder', title: 't' }), NO_RIGHT, 'no reminders');
});

test('Recruitment Marketeers see their own clients; Dev, Teamlead and Account Manager see all', () => {
  assert.ok(can(mkt, 'campaigns.own') && !can(mkt, 'campaigns.all'));
  for (const who of [dev, lead, am]) assert.ok(can(who, 'campaigns.all'), who.role);
  const cs = [{ id: 'a', client: 'Hotel A' }, { id: 'b', client: 'Hotel B' }, { id: 'c', client: 'Hotel C' }];
  const mktOf = c => ({ 'Hotel A': 'Danielle', 'Hotel B': 'Mare' })[c.client] || '';
  const sees = a => visibleCampaigns(cs, { name: a.name, rights: rightsOf(a) }, mktOf).map(c => c.id);
  assert.deepEqual(sees(mkt), ['a'], 'not another marketeer’s client, nor one without a marketeer');
  assert.deepEqual(sees({ ...mkt, grants: ['campaigns.all'] }), ['a', 'b', 'c'], 'a marketeer covering for a colleague');
  for (const who of [dev, lead, am]) assert.deepEqual(sees(who), ['a', 'b', 'c'], who.role);
  assert.deepEqual(sees({ ...kim, grants: ['feedback.client'] }), ['a', 'b', 'c'], 'without either right nothing changes');
});

test('questions go out with questions.ask; answers only to a question sent to you', () => {
  const q = { id: 1, to: 'Danielle', from: 'Anouk', at: 'x', read: false, kind: 'question', campaign: 'c1', title: 'Vraag over X', items: ['Hoe gaat het?'] };
  assert.equal(makeAuthorizer(am, {})('inbox', '1', undefined, q), '');
  assert.equal(makeAuthorizer(am, {})('inbox', '1', undefined, { ...q, from: 'Iemand' }).value.from, 'Anouk', 'author is stamped');
  assert.equal(makeAuthorizer(mkt, {})('inbox', '1', undefined, q), NO_RIGHT, 'marketeers have no questions.ask by default');
  const docs = { inbox: { 1: q } };
  const ans = { id: 2, to: 'Anouk', from: 'Danielle', at: 'x', read: false, kind: 'answer', re: 1, campaign: 'c1', title: 'Antwoord over X', items: ['Goed'] };
  assert.equal(makeAuthorizer(mkt, docs)('inbox', '2', undefined, ans), '', 'the addressee may answer');
  assert.equal(makeAuthorizer(kim, docs)('inbox', '2', undefined, ans), NO_RIGHT, 'not a question to Kim');
  assert.equal(makeAuthorizer(mkt, docs)('inbox', '2', undefined, { ...ans, to: 'Robbin' }), NO_RIGHT, 'only back to the asker');
  assert.equal(makeAuthorizer(mkt, docs)('inbox', '2', undefined, { ...ans, re: 99 }), NO_RIGHT, 'the question must exist');
  assert.equal(makeAuthorizer(mkt, docs)('inbox', '1', q, { ...q, read: true, answered: true }), '', 'marking it read and answered');
  assert.equal(makeAuthorizer(mkt, docs)('inbox', '1', q, { ...q, items: ['anders'] }), NO_RIGHT);
});

test('monitor status and the update for the recruiter need campaigns.monitor, author stamped', () => {
  const c = camp('c1', 'Kim');
  const set = o => ({ ...c, weeks: [c.weeks[0], { ...c.weeks[1], ...o }] });
  const r = makeAuthorizer(mkt, {})('campaigns', 'c1', c, set({ mon: 'check', monBy: 'Iemand', monSig: ['missing'], upd: 'Nieuwe advertentie', updBy: 'Iemand' }));
  assert.equal(r.value.weeks[1].monBy, 'Danielle');
  assert.equal(r.value.weeks[1].updBy, 'Danielle');
  assert.equal(makeAuthorizer(lead, {})('campaigns', 'c1', c, set({ mon: 'klant', monBy: 'Robbin' })), '', 'teamlead has it');
  for (const who of [kim, am]) {
    assert.equal(makeAuthorizer(who, {})('campaigns', 'c1', c, set({ mon: 'check' })), NO_RIGHT);
    assert.equal(makeAuthorizer(who, {})('campaigns', 'c1', c, set({ upd: 'x' })), NO_RIGHT);
  }
  assert.equal(makeAuthorizer(kim, {})('campaigns', 'c1', c, { ...c, weeks: [...c.weeks, week(40, { mon: 'klant' })] }), NO_RIGHT, 'not hidden in a new week');
  const docs = { 'live.links': { 't-1-all': { id: 't-1-all', boardId: '1', rec: 'Kim' } } };
  assert.equal(makeAuthorizer(mkt, docs)('live.fb', 't-1-all', {}, { 40: { mon: 'check', monBy: 'Danielle' } }), '', 'Trello mode too');
  assert.equal(makeAuthorizer(kim, docs)('live.fb', 't-1-all', {}, { 40: { upd: 'x' } }), NO_RIGHT);
  const note = { id: 9, to: 'Kim', from: 'Danielle', read: false, kind: 'update', campaign: 'c1', title: 'Update over Klant c1 – Kok', items: ['x'] };
  assert.equal(makeAuthorizer(mkt, {})('inbox', '9', undefined, note), '', 'and lets the recruiter know');
  assert.equal(makeAuthorizer(am, {})('inbox', '9', undefined, { ...note, from: 'Anouk' }), NO_RIGHT);
});

test('a recruiter gets at most one reminder per 48 hours', () => {
  const now = Date.now(), rem = (id, to, o = {}) => ({ id, to, from: 'Danielle', read: false, kind: 'reminder', title: 't', items: [], ...o });
  const fresh = makeAuthorizer(mkt, {})('inbox', 'n1', undefined, rem('n1', 'Kim', { ts: 1 }));
  assert.ok(Math.abs(fresh.value.ts - now) < 5000, 'sent time comes from the server clock');
  const docs = { inbox: { old: rem('old', 'Kim', { ts: now - 47 * 36e5 }), juul: rem('juul', 'Juul', { ts: now - 49 * 36e5 }), legacy: rem(`${now - 36e5}Robin`, 'Robin') } };
  const a = makeAuthorizer(mkt, docs);
  assert.equal(a('inbox', 'n2', undefined, rem('n2', 'Kim')), REMINDED);
  assert.equal(a('inbox', 'n3', undefined, rem('n3', 'Juul')).value.to, 'Juul', 'more than 48 hours ago');
  assert.equal(a('inbox', 'n4', undefined, rem('n4', 'Robin')), REMINDED, 'older reminders: time from the id');
  assert.equal(a('inbox', 'n5', undefined, rem('n5', 'Tsjerk')).value.to, 'Tsjerk');
});

test('pausing and stopping campaigns: Recruitment Marketeers and teamleads, not recruiters or account managers', () => {
  for (const who of [mkt, lead, dev]) assert.ok(can(who, 'campaigns.pause'), who.role);
  for (const who of [kim, am]) assert.ok(!can(who, 'campaigns.pause'), who.role);
});

test('Trello: a marketeer pauses, resumes and stops campaigns of their own clients; only Toewijzing brings a stopped one back', () => {
  const link = { id: 't-b1-kok', boardId: 'b1', boardName: 'Hotel A', labelId: 'l1', vac: 'Kok', rec: 'Kim' };
  const other = { ...link, id: 't-b2-kok', boardId: 'b2', boardName: 'Hotel B' };
  const docs = { 'live.mkt': { b1: 'Danielle', b2: 'Mare' } }, M = makeAuthorizer(mkt, docs);
  const halt = (k, kind, by = 'Iemand') => ({ ...k, halt: { kind, by, w: W } });
  assert.equal(M('live.links', link.id, link, halt(link, 'pauze')).value.halt.by, 'Danielle', 'author stamped');
  assert.equal(M('live.links', link.id, halt(link, 'pauze', 'Danielle'), link), '', 'resuming');
  assert.equal(M('live.links', link.id, halt(link, 'pauze', 'Danielle'), halt(link, 'stop')).value.halt.kind, 'stop', 'stopping a paused one');
  assert.equal(M('live.links', link.id, link, halt(link, 'stop')).value.halt.by, 'Danielle');
  assert.equal(M('live.links', link.id, halt(link, 'stop', 'Danielle'), link), NO_RIGHT, 'a stopped campaign stays stopped');
  assert.equal(M('live.links', link.id, halt(link, 'stop', 'Danielle'), halt(link, 'pauze')), NO_RIGHT);
  assert.equal(M('live.links', link.id, link, { ...link, halt: { kind: 'weg', w: W } }), NO_RIGHT, 'only Pauze and Gestopt');
  assert.equal(M('live.links', other.id, other, halt(other, 'pauze')), NO_RIGHT, 'not another marketeer’s client');
  assert.equal(M('live.links', link.id, link, { ...link, rec: 'Juul' }), NO_RIGHT, 'nothing else about the link');
  assert.equal(M('live.links', link.id, link, { ...halt(link, 'pauze'), rec: 'Juul' }), NO_RIGHT, 'not even along with a pause');
  assert.equal(M('live.links', link.id, link, undefined), NO_RIGHT, 'no unlinking');
  assert.equal(makeAuthorizer({ ...mkt, grants: ['campaigns.all'] }, docs)('live.links', other.id, other, halt(other, 'pauze')).value.halt.by, 'Danielle', 'covering for a colleague');
  assert.equal(makeAuthorizer({ ...mkt, revokes: ['campaigns.pause'] }, docs)('live.links', link.id, link, halt(link, 'pauze')), NO_RIGHT);
  for (const who of [kim, am]) assert.equal(makeAuthorizer(who, docs)('live.links', link.id, link, halt(link, 'pauze')), NO_RIGHT, who.role);
  const L = makeAuthorizer(lead, docs);
  assert.equal(L('live.links', link.id, halt(link, 'stop', 'Danielle'), link), '', 'the teamlead activates it again');
  assert.equal(L('live.links', other.id, other, halt(other, 'stop')).value.halt.by, 'Robbin', 'and stops any campaign, stamped');
  assert.equal(L('live.links', link.id, link, { ...link, rec: 'Juul' }), '', 'other link changes as before');
  const stopped = halt(link, 'stop', 'Danielle');
  assert.equal(L('live.links', link.id, stopped, { ...stopped, rec: 'Juul' }), '', 'a new recruiter leaves who stopped it');
  assert.equal(makeAuthorizer({ ...mkt, grants: ['trello.link'] }, docs)('live.links', link.id, stopped, { ...stopped, rec: 'Juul' }), '', 'also for Trello-koppeling alone');
});

test('demo campaigns: the same rules, on the campaign itself', () => {
  const c = { ...camp('c1', 'Kim'), client: 'Hotel A' }, b = { ...c, id: 'c2', client: 'Hotel B' }, z = { ...c, id: 'c3', client: 'Hotel Z' };
  const docs = { mktDemo: { 'Hotel A': 'Danielle', 'Hotel B': 'Mare' } }, M = makeAuthorizer(mkt, docs);
  const halt = (x, kind) => ({ ...x, halt: { kind, by: 'Iemand', w: W } });
  assert.equal(M('campaigns', 'c1', c, halt(c, 'pauze')).value.halt.by, 'Danielle');
  assert.equal(M('campaigns', 'c1', halt(c, 'pauze'), c), '', 'resuming');
  assert.equal(M('campaigns', 'c1', halt(c, 'stop'), c), NO_RIGHT, 'a stopped campaign stays stopped');
  assert.equal(M('campaigns', 'c2', b, halt(b, 'pauze')), NO_RIGHT, 'not another marketeer’s client');
  assert.equal(M('campaigns', 'c3', z, halt(z, 'pauze')).value.halt.by, 'Danielle', 'the app picks a marketeer at random for a demo client without one');
  const both = M('campaigns', 'c1', c, { ...halt(c, 'pauze'), weeks: [c.weeks[0], { ...c.weeks[1], klant: 'Stopt even', klantBy: 'Iemand' }] });
  assert.equal(both.value.halt.by, 'Danielle', 'stamped along with client feedback');
  assert.equal(both.value.weeks[1].klantBy, 'Danielle');
  assert.equal(makeAuthorizer(kim, docs)('campaigns', 'c1', c, halt(c, 'pauze')), NO_RIGHT);
  assert.equal(makeAuthorizer(lead, docs)('campaigns', 'c1', halt(c, 'stop'), c), '', 'the teamlead activates it again');
});

test('every role in ROLES has only known rights', () => {
  for (const r of Object.values(ROLES)) for (const k of r.rights) assert.ok(RIGHT_KEYS.includes(k), k);
});
