// The JSON API behind the app. Everything here needs a session (see auth.guard); each route checks the right
// it needs on the server, whatever the app shows.
import express from 'express';
import { can, canViewAs, ROLES, manageError, rightsOf } from '../src/lib/permissions.js';
import { AccountError, TTL } from './accounts.js';
import { passwordProblem, otpauthUrl } from './crypto.js';
import { qrDataUrl } from './pages.js';
import { makeAuthorizer } from './authorize.js';
import { INTEGRATIONS } from './secrets.js';
import { testTrello } from './trello.js';

const MONTH_OPTIONS = [0, 3, 6, 12, 24];

export function apiRouter({ accounts, audit, secrets, store, privacy, trello, pollMs = 15000 }) {
  const api = express.Router();
  const json = express.json({ limit: '100kb' });
  api.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  const need = right => (req, res, next) => can(req.account, right) ? next() : res.status(403).json({ error: 'forbidden', message: 'Je hebt hier geen rechten voor.' });
  const wrap = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      if (e instanceof AccountError) return res.status(400).json({ error: 'invalid', message: e.message });
      console.error(e);
      res.status(500).json({ error: 'server_error', message: 'Er ging iets mis op de server.' });
    }
  };
  const bad = (res, message) => res.status(400).json({ error: 'invalid', message });
  const linkUrl = (req, p) => `${req.protocol}://${req.get('host')}${p}`;
  const target = req => { const a = accounts.get(req.params.id); if (!a || a.status === 'anonymised') throw new AccountError('Account niet gevonden.'); return a; };
  const download = (res, name, data) => { res.setHeader('Content-Disposition', `attachment; filename="${name}"`); res.json(data); };
  const fileName = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // ── App data ─────────────────────────────────────────────────────────
  api.get('/config', (req, res) => res.json({ trello: !!secrets.get('trello'), auth: true, pollMs }));
  // For "Bekijk als", you also get the rights of the people whose view you may open.
  api.get('/me', (req, res) => res.json({
    account: accounts.selfView(req.account),
    members: accounts.live().map(a => canViewAs(req.account, a) ? { ...accounts.directoryView(a), rights: [...rightsOf(a)] } : accounts.directoryView(a)),
  }));
  api.get('/state', (req, res) => {
    if (req.query.rev != null && Number(req.query.rev) === store.rev) return res.json({ rev: store.rev, unchanged: true });
    res.json({ rev: store.rev, docs: store.docs });
  });
  const lastDenied = new Map();
  api.post('/state/patch', express.json({ limit: '2mb' }), (req, res) => {
    let r;
    try { r = store.patch(req.body && req.body.patches, makeAuthorizer(req.account, store.docs)); }
    catch (e) { return res.status(400).json({ error: e.message }); }
    auditPatch(req.account, r.applied);
    if (r.rejected.length && Date.now() - (lastDenied.get(req.account.id) || 0) > 60000) {
      lastDenied.set(req.account.id, Date.now());
      audit.log('data.denied', { actor: req.account, details: { wijzigingen: r.rejected.slice(0, 10).map(x => `${x.doc}/${x.key}`) } });
    }
    res.json({ rev: r.rev, rejected: r.rejected.map(({ doc, key }) => ({ doc, key })) });
  });

  /** Rule and assignment changes go into the audit log. */
  function auditPatch(actor, applied) {
    const rules = applied.filter(a => a.doc === 'rules');
    if (rules.length) audit.log('data.rules', { actor, details: Object.fromEntries(rules.map(a => [a.key, { van: a.before ?? null, naar: a.after ?? null }])) });
    const boardName = id => (Object.values(store.docs['live.links'] || {}).find(l => l.boardId === id) || {}).boardName || id;
    for (const a of applied) {
      if (a.doc === 'assignLog' && a.before === undefined && a.after) audit.log('data.assign', { actor, details: { klant: a.after.client, van: a.after.from || null, naar: a.after.to } });
      else if (a.doc === 'live.inactive') audit.log('data.assign', { actor, details: { klant: boardName(a.key), naar: a.after ? 'Niet actief' : 'weer actief' } });
      else if (a.doc === 'live.mkt' || a.doc === 'mktDemo') audit.log('data.assign', { actor, details: { klant: a.doc === 'live.mkt' ? boardName(a.key) : a.key, marketeer: a.after || null } });
      else if (a.doc === 'live.links' && (a.before === undefined || a.after === undefined)) audit.log('data.trello_link', { actor, details: { bord: (a.after || a.before).boardName, functie: (a.after || a.before).vac, actie: a.after ? 'gekoppeld' : 'ontkoppeld' } });
      else if (a.doc === 'campaigns' && a.after === undefined) audit.log('data.campaign_removed', { actor, details: { campagne: `${a.before.client} – ${a.before.vac}` } });
    }
  }

  // ── My account ───────────────────────────────────────────────────────
  api.post('/me/password', json, wrap(async (req, res) => {
    const { current, next } = req.body || {};
    const problem = passwordProblem(next, req.account.email);
    if (problem) return bad(res, problem);
    await accounts.changePassword(req.account, current, next);
    const n = accounts.revokeAll(req.account.id, req.sessionId);
    audit.log('password.changed', { actor: req.account, ip: req.ip, details: { andereSessiesUitgelogd: n } });
    res.json({ ok: true, loggedOut: n });
  }));
  api.post('/me/email', json, wrap(async (req, res) => {
    const old = req.account.email;
    await accounts.changeEmail(req.account, (req.body || {}).password, (req.body || {}).email);
    audit.log('account.email', { actor: req.account, details: { van: old, naar: req.account.email } });
    res.json({ ok: true, email: req.account.email });
  }));
  api.post('/me/2fa/start', wrap(async (req, res) => {
    if (accounts.hasTotp(req.account)) return bad(res, 'Tweestapsverificatie staat al aan.');
    const secret = accounts.startTotp(req.account), otpauth = otpauthUrl(secret, req.account.email);
    res.json({ secret, otpauth, qr: qrDataUrl(otpauth) });
  }));
  api.post('/me/2fa/confirm', json, wrap(async (req, res) => {
    const codes = accounts.confirmTotp(req.account, (req.body || {}).code);
    audit.log('2fa.enabled', { actor: req.account });
    res.json({ codes });
  }));
  api.post('/me/2fa/recovery', json, wrap(async (req, res) => {
    if (!(await accounts.checkPassword(req.account.email, (req.body || {}).password))) return bad(res, 'Je wachtwoord klopt niet.');
    const codes = accounts.newRecovery(req.account);
    audit.log('2fa.recovery_new', { actor: req.account });
    res.json({ codes });
  }));
  api.post('/me/2fa/disable', json, wrap(async (req, res) => {
    await accounts.disableTotp(req.account, (req.body || {}).password);
    audit.log('2fa.disabled', { actor: req.account });
    res.json({ ok: true });
  }));
  api.get('/me/sessions', (req, res) => res.json({ sessions: accounts.sessionsOf(req.account.id, req.sessionId) }));
  api.post('/me/sessions/revoke-others', (req, res) => {
    const n = accounts.revokeAll(req.account.id, req.sessionId);
    audit.log('session.revoke_all', { actor: req.account, target: req.account, details: { aantal: n } });
    res.json({ loggedOut: n });
  });
  api.get('/me/export', wrap(async (req, res) => {
    audit.log('privacy.export', { actor: req.account, target: req.account });
    download(res, `mijn-gegevens-campagnemonitor-${new Date().toISOString().slice(0, 10)}.json`, await privacy.exportFor(req.account, req.sessionId));
  }));
  api.post('/me/view-as', json, (req, res) => {
    const id = req.body && req.body.id, t = id ? accounts.get(id) : null;
    if (id && !canViewAs(req.account, t)) return res.status(403).json({ error: 'forbidden', message: 'Je hebt hier geen rechten voor.' });
    audit.log('dev.view_as', { actor: req.account, target: t, details: t ? {} : { gestopt: true } });
    res.json({ ok: true });
  });

  // ── Members ──────────────────────────────────────────────────────────
  const members = express.Router();
  members.use(need('members.manage'));
  members.get('/', (req, res) => res.json({
    members: accounts.live().map(a => ({ ...accounts.adminView(a), openWork: privacy.openWork(a) })),
    anonymised: accounts.all().filter(a => a.status === 'anonymised').length,
    ttl: TTL,
  }));
  members.post('/', json, wrap(async (req, res) => {
    const a = accounts.invite(req.account, req.body || {});
    const raw = accounts.issueToken('invite', a.id, req.account.id);
    audit.log('member.invited', { actor: req.account, target: a, details: { rol: ROLES[a.role].label } });
    res.json({ member: accounts.adminView(a), link: linkUrl(req, `/invite/${raw}`) });
  }));
  members.patch('/:id', json, wrap(async (req, res) => {
    const b = req.body || {};
    const { account, diff } = accounts.update(req.account, req.params.id, { role: b.role, rights: b.rights, name: b.name, recName: b.recName });
    if (Object.keys(diff).length) audit.log('member.updated', { actor: req.account, target: account, details: diff });
    res.json({ member: accounts.adminView(account) });
  }));
  members.post('/:id/link', json, wrap(async (req, res) => {
    const type = (req.body || {}).type === 'reset' ? 'reset' : 'invite';
    const raw = accounts.linkFor(req.account, req.params.id, type);
    const a = accounts.get(req.params.id);
    audit.log(type === 'reset' ? 'password.reset_link' : 'member.invite_link', { actor: req.account, target: a });
    res.json({ link: linkUrl(req, `/${type}/${raw}`), expiresAt: Date.now() + TTL[type] });
  }));
  members.post('/:id/deactivate', wrap(async (req, res) => {
    const a = accounts.setStatus(req.account, req.params.id, 'deactivated');
    audit.log('member.deactivated', { actor: req.account, target: a });
    res.json({ member: accounts.adminView(a) });
  }));
  members.post('/:id/reactivate', wrap(async (req, res) => {
    const a = accounts.setStatus(req.account, req.params.id, 'active');
    audit.log('member.reactivated', { actor: req.account, target: a });
    res.json({ member: accounts.adminView(a) });
  }));
  members.delete('/:id', wrap(async (req, res) => {
    const a = accounts.removeInvited(req.account, req.params.id);
    audit.log('member.invite_withdrawn', { actor: req.account, target: a });
    res.json({ ok: true });
  }));
  members.post('/:id/reset-2fa', wrap(async (req, res) => {
    const a = accounts.resetTwoFactor(req.account, req.params.id);
    audit.log('2fa.reset', { actor: req.account, target: a });
    res.json({ member: accounts.adminView(a) });
  }));
  members.post('/:id/logout', wrap(async (req, res) => {
    const a = target(req);
    const err = manageError(req.account, a);
    if (err) return bad(res, err);
    const n = accounts.revokeAll(a.id);
    audit.log('session.revoke_all', { actor: req.account, target: a, details: { aantal: n } });
    res.json({ loggedOut: n });
  }));
  api.use('/admin/members', members);

  // ── Integrations ─────────────────────────────────────────────────────
  const integ = express.Router();
  integ.use(need('integrations'));
  integ.get('/', (req, res) => res.json({ integrations: Object.keys(INTEGRATIONS).map(secrets.status) }));
  integ.put('/:name', json, wrap(async (req, res) => {
    const name = req.params.name, values = (req.body || {}).values || {};
    const problem = secrets.problem(name, values);
    if (problem) return bad(res, problem);
    const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v).trim()]));
    let test = null;
    if (name === 'trello' && !(req.body || {}).skipTest) {
      test = await testTrello(clean);
      if (!test.ok) return res.status(400).json({ error: 'test_failed', message: test.error });
    }
    secrets.set(name, clean, req.account);
    audit.log('integration.updated', { actor: req.account, details: { integratie: INTEGRATIONS[name].label, getest: !!test } });
    res.json({ integration: secrets.status(name), test });
  }));
  integ.delete('/:name', wrap(async (req, res) => {
    if (!INTEGRATIONS[req.params.name]) return bad(res, 'Onbekende integratie.');
    secrets.remove(req.params.name);
    audit.log('integration.removed', { actor: req.account, details: { integratie: INTEGRATIONS[req.params.name].label } });
    res.json({ integration: secrets.status(req.params.name) });
  }));
  integ.post('/:name/test', wrap(async (req, res) => {
    if (req.params.name !== 'trello') return bad(res, 'Voor deze integratie is geen test.');
    const creds = secrets.get('trello');
    if (!creds) return bad(res, 'Er is nog geen sleutel ingesteld.');
    res.json({ test: await testTrello(creds) });
  }));
  api.use('/admin/integrations', integ);
  secrets.onChange(name => { if (name === 'trello') trello.clearCache(); });

  // ── Audit log ────────────────────────────────────────────────────────
  api.get('/admin/audit', need('audit.view'), wrap(async (req, res) => {
    const q = req.query;
    res.json({ entries: await audit.query({ before: q.before ? Number(q.before) : Infinity, type: String(q.type || ''), person: String(q.person || ''), limit: Math.min(200, Number(q.limit) || 100) }) });
  }));

  // ── Privacy ──────────────────────────────────────────────────────────
  const priv = express.Router();
  priv.use(need('privacy'));
  priv.get('/', (req, res) => res.json({ settings: accounts.settings, monthOptions: MONTH_OPTIONS }));
  priv.put('/', json, wrap(async (req, res) => {
    const m = Number((req.body || {}).anonymiseAfterMonths);
    if (!MONTH_OPTIONS.includes(m)) return bad(res, 'Kies een geldige termijn.');
    const before = accounts.settings.anonymiseAfterMonths;
    accounts.saveSettings({ anonymiseAfterMonths: m });
    audit.log('privacy.settings', { actor: req.account, details: { anonimiserenNaMaanden: { van: before, naar: m } } });
    res.json({ settings: accounts.settings });
  }));
  priv.get('/export/:id', wrap(async (req, res) => {
    const a = target(req);
    audit.log('privacy.export', { actor: req.account, target: a });
    download(res, `gegevens-${fileName(a.name)}-${new Date().toISOString().slice(0, 10)}.json`, await privacy.exportFor(a));
  }));
  priv.post('/anonymise/:id', wrap(async (req, res) => {
    const a = target(req);
    if (a.id === req.account.id) return bad(res, 'Je kunt je eigen account niet anonimiseren.');
    if (a.status !== 'deactivated') return bad(res, 'Deactiveer het account eerst.');
    const r = await privacy.anonymise(req.account, a);
    res.json({ ok: true, pseudonym: r.pseudonym });
  }));
  api.use('/admin/privacy', priv);

  api.use((req, res) => res.status(404).json({ error: 'not_found' }));
  return api;
}
