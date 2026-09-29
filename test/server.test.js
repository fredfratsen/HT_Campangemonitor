// End-to-end over HTTP, for both ways the app runs:
// - "server": the long-running server (server/index.js, data in files), as on Render and locally;
// - "netlify": the Netlify Function (server/netlify.js, data in Blobs), via test/netlify-harness.js, which
//   alternates between two function instances so every step also proves nothing depends on server memory.
// Walks through setup, two-factor, invites, rights, lockout, password reset, deactivation and owner recovery.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { totpAt } from '../server/crypto.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const freePort = () => new Promise(res => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const code = secret => totpAt(secret, Math.floor(Date.now() / 30000));
const secretOf = html => html.match(/class="code">([A-Z2-7 ]+)</)[1].replace(/ /g, '');
const errOf = html => (html.match(/class="err">([^<]+)/) || [])[1];

for (const mode of ['server', 'netlify']) describe(mode, () => {
  const DATA = fs.mkdtempSync(path.join(os.tmpdir(), `htcm-test-${mode}-`));
  let PORT, BASE, proc, out = '';

  async function startServer(env = {}) {
    out = '';
    const script = mode === 'server' ? 'server/index.js' : 'test/netlify-harness.js';
    proc = spawn(process.execPath, [script], { cwd: ROOT, env: {
      ...process.env, PORT: String(PORT), NODE_ENV: 'test', ...(mode === 'server'
        ? { DATA_DIR: DATA, APP_URL: BASE }
        : { BLOB_FILE: path.join(DATA, 'blobs.json'), SECRETS_KEY: 'test-secrets-key' }), ...env } });
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', d => { out += d; });
    for (let i = 0; i < 100 && !/draait op|klaar op/.test(out); i++) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 100));
  }
  const stopServer = () => new Promise(res => { proc.once('exit', res); proc.kill('SIGTERM'); });

  /** A browser-like client with its own cookies. */
  function client(extraHeaders = {}) {
    const jar = {};
    const cookie = () => Object.entries(jar).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('; ');
    async function req(method, p, body, { json = false, origin = BASE } = {}) {
      const headers = { cookie: cookie(), origin, ...extraHeaders };
      let b;
      if (body && json) { headers['content-type'] = 'application/json'; b = JSON.stringify(body); }
      else if (body) { headers['content-type'] = 'application/x-www-form-urlencoded'; b = new URLSearchParams(body).toString(); }
      const r = await fetch(BASE + p, { method, headers, body: b, redirect: 'manual' });
      for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      const text = await r.text();
      let data = null; try { data = JSON.parse(text); } catch (e) { /* html */ }
      return { status: r.status, loc: r.headers.get('location'), text, data, headers: r.headers };
    }
    return { req, get: p => req('GET', p), form: (p, b) => req('POST', p, b), api: (m, p, b) => req(m, p, b || {}, { json: true }) };
  }
  /** On the server the link is printed at startup; on Netlify, opening /setup writes it to the function log. */
  async function ownerLink(kind) {
    if (mode === 'netlify') assert.match((await client().get('/setup')).text, /serverlog/);
    const m = out.match(new RegExp(`/${kind}/[\\w-]+`));
    assert.ok(m, `a ${kind} link in the log:\n${out}`);
    return m[0];
  }

  const S = {}; // shared between steps
  before(async () => { PORT = await freePort(); BASE = `http://localhost:${PORT}`; await startServer(); });
  after(async () => { await stopServer(); fs.rmSync(DATA, { recursive: true, force: true }); });

  test('a one-time setup link sets up the Dev account', async () => {
    S.setup = await ownerLink('setup');
    const dev = client();
    assert.equal((await dev.get('/api/me')).status, 401);
    assert.match((await dev.get(S.setup)).text, /Dev-account instellen/);
    const r = await dev.form(S.setup, { email: 'Dev@Example.com', password: 'een lang geheim wachtwoord', password2: 'een lang geheim wachtwoord' });
    assert.equal(r.loc, '/login/2fa-instellen', 'Dev must set up two-factor before getting in');
    assert.equal((await dev.get('/api/me')).status, 401);
    const page = await dev.get('/login/2fa-instellen');
    S.devSecret = secretOf(page.text);
    const done = await dev.form('/login/2fa-instellen', { code: code(S.devSecret) });
    S.devCodes = [...done.text.matchAll(/<span>([a-z0-9-]{14})<\/span>/g)].map(x => x[1]);
    assert.equal(S.devCodes.length, 10);
    const me = (await dev.get('/api/me')).data.account;
    assert.equal(me.email, 'dev@example.com');
    assert.equal(me.role, 'dev');
    assert.equal(me.twoFactor, true);
    assert.equal((await client().get(S.setup)).status, 410, 'setup link is single-use');
    if (mode === 'netlify') assert.match((await client().get('/setup')).text, /al een actief Dev-account/);
    assert.equal((await dev.get('/api/config')).data.pollMs, mode === 'netlify' ? 60000 : 15000);
    S.dev = dev;
  });

  test('invite → recruiter logs in without two-factor, server enforces rights', async () => {
    const r = await S.dev.api('POST', '/api/admin/members', { name: 'Test Recruiter', role: 'recruiter', recName: 'Tessa' });
    assert.equal(r.status, 200, r.text);
    S.recId = r.data.member.id;
    const rec = client(), link = new URL(r.data.link).pathname;
    const ok = await rec.form(link, { email: 'tessa@example.com', password: 'de recruiter haar wachtwoord', password2: 'de recruiter haar wachtwoord' });
    assert.equal(ok.loc, '/');
    assert.deepEqual((await rec.get('/api/me')).data.account.rights, ['feedback.own']);
    const p = await rec.api('POST', '/api/state/patch', { patches: [{ doc: 'rules', set: { qRed: 9 } }, { doc: 'seen', set: { [S.recId]: { last: 1 } } }] });
    assert.deepEqual(p.data.rejected, [{ doc: 'rules', key: 'qRed' }]);
    assert.equal((await rec.get('/api/admin/members')).status, 403);
    assert.equal((await rec.get('/api/admin/audit')).status, 403);
    S.rec = rec;
  });

  test('people saving at the same moment don\'t overwrite each other', async () => {
    const n = 16, sends = [];
    for (let i = 0; i < n; i++) sends.push((i % 2 ? S.dev : S.rec).api('POST', '/api/state/patch', { patches: [{ doc: 'ideas', set: { ['c' + i]: { id: 'c' + i, type: 'idee', text: 'tegelijk ' + i, status: 'nieuw', voters: [] } } }] }));
    const res = await Promise.all(sends);
    assert.ok(res.every(r => r.status === 200), res.map(r => r.status).join());
    const ideas = (await S.dev.get('/api/state')).data.docs.ideas;
    for (let i = 0; i < n; i++) assert.equal((ideas['c' + i] || {}).text, 'tegelijk ' + i, `idea ${i} missing; responses: ${JSON.stringify(res.map(r => r.data))}; stored: ${Object.keys(ideas).join(',')}`);
    assert.equal(ideas.c1.by, 'Tsjerk', 'author filled in by the server');
  });

  test('cross-site requests are refused', async () => {
    const r = await S.dev.req('POST', '/api/state/patch', { patches: [] }, { json: true, origin: 'https://evil.example' });
    assert.equal(r.status, 403);
    const f = await client().req('POST', '/login', { email: 'dev@example.com', password: 'x' }, { origin: 'https://evil.example' });
    assert.equal(f.status, 403);
  });

  test('login: wrong password, two-factor code, recovery code, lockout', async () => {
    const c = client();
    assert.equal((await c.form('/login', { email: 'dev@example.com', password: 'fout fout fout' })).status, 401);
    const r = await c.form('/login', { email: 'DEV@example.com', password: 'een lang geheim wachtwoord' });
    assert.equal(r.loc, '/login/code');
    assert.equal((await c.get('/api/me')).status, 401, 'no session before the code');
    assert.equal((await c.form('/login/code', { code: '000000' })).status, 401);
    assert.equal((await c.form('/login/code', { code: S.devCodes[0] })).loc, '/');
    assert.equal((await c.get('/api/me')).status, 200);
    const again = client();
    await again.form('/login', { email: 'dev@example.com', password: 'een lang geheim wachtwoord' });
    assert.equal((await again.form('/login/code', { code: S.devCodes[0] })).status, 401, 'recovery codes work once');

    const t = client({ 'x-forwarded-for': '203.0.113.9' }); // its own IP address, so the lockout doesn't block the other tests
    for (let i = 0; i < 10; i++) await t.form('/login', { email: 'tessa@example.com', password: 'fout ' + i });
    const locked = await t.form('/login', { email: 'tessa@example.com', password: 'de recruiter haar wachtwoord' });
    assert.equal(locked.status, 429, 'locked after 10 failures');
    const other = await client().form('/login', { email: 'tessa@example.com', password: 'de recruiter haar wachtwoord' });
    assert.equal(other.status, 429, 'the account stays locked from another IP address');
  });

  test('reset link sets a new password and logs out everywhere', async () => {
    const r = await S.dev.api('POST', `/api/admin/members/${S.recId}/link`, { type: 'reset' });
    const link = new URL(r.data.link).pathname, c = client();
    assert.match(errOf((await c.form(link, { password: 'nieuw wachtwoord 1', password2: 'anders' })).text), /niet hetzelfde/);
    assert.equal((await c.form(link, { password: 'een nieuw wachtwoord voor haar', password2: 'een nieuw wachtwoord voor haar' })).loc, '/login?ok=reset');
    assert.equal((await S.rec.get('/api/me')).status, 401, 'old session is gone');
    assert.equal((await c.get(link)).status, 410, 'reset link is single-use');
  });

  test('deactivating logs out; audit log records it; export works', async () => {
    // Lockouts and pending logins are stored, so they survive a restart; the reset link above cleared Tessa's.
    await stopServer(); await startServer();
    const dev = client();
    await dev.form('/login', { email: 'dev@example.com', password: 'een lang geheim wachtwoord' });
    await new Promise(r => setTimeout(r, 30000 - (Date.now() % 30000) + 200)); // next time step: codes can't be reused
    assert.equal((await dev.form('/login/code', { code: code(S.devSecret) })).loc, '/');
    const rec = client();
    assert.equal((await rec.form('/login', { email: 'tessa@example.com', password: 'een nieuw wachtwoord voor haar' })).loc, '/');
    assert.equal((await dev.api('POST', `/api/admin/members/${S.recId}/deactivate`)).status, 200);
    assert.equal((await rec.get('/api/me')).status, 401);
    assert.equal((await rec.form('/login', { email: 'tessa@example.com', password: 'een nieuw wachtwoord voor haar' })).status, 401);
    const audit = (await dev.get('/api/admin/audit?limit=200')).data.entries.map(e => e.type);
    for (const t of ['setup.link_issued', 'member.joined', '2fa.enabled', 'login.fail', 'login.locked', '2fa.recovery_used', 'member.invited', 'password.reset', 'member.deactivated', 'data.denied']) assert.ok(audit.includes(t), t);
    const ex = await dev.get(`/api/admin/privacy/export/${S.recId}`);
    assert.equal(ex.data.account.name, 'Test Recruiter');
    assert.equal((await dev.api('POST', `/api/admin/privacy/anonymise/${S.recId}`)).data.pseudonym, 'Oud-teamlid 1');
    const after = (await dev.get('/api/admin/audit?limit=200')).data.entries;
    assert.ok(!JSON.stringify(after).includes('Test Recruiter'), 'the name is gone from the audit log too');
    S.dev = dev;
  });

  test('the last Dev cannot be removed, and OWNER_RECOVERY gives a way back in', async () => {
    const r = await S.dev.api('POST', '/api/admin/members/r-tsjerk/deactivate');
    assert.match(r.data.message, /eigen account/);
    await stopServer();
    await startServer({ OWNER_RECOVERY: '1' });
    const link = await ownerLink('reset');
    const c = client();
    await c.form(link, { password: 'een compleet nieuw wachtwoord', password2: 'een compleet nieuw wachtwoord' });
    const login = await c.form('/login', { email: 'dev@example.com', password: 'een compleet nieuw wachtwoord' });
    assert.equal(login.loc, '/login/2fa-instellen', 'two-factor was cleared and must be set up again');
  });
});
