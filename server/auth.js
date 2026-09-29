// Logging in with a personal account: email + password, then a code from an authenticator app when two-factor
// is on (required for Dev and Teamlead). Sessions are random ids in an HttpOnly cookie, stored server-side as
// hashes, so logging out, deactivating an account or resetting a password takes effect immediately.
// Also serves the one-time link pages: first setup, invites and password resets.
import { sha256, randomToken, passwordProblem, otpauthUrl } from './crypto.js';
import { SESSION_DAYS, twoFactorRequired, normEmail, AccountError } from './accounts.js';
import { loginPage, codePage, enrollPage, recoveryPage, invitePage, resetPage, messagePage, privacyPage } from './pages.js';

const SID = 'htcm_sid', PENDING = 'htcm_pending', LEGACY = 'htcm_session';
const WINDOW = 15 * 60 * 1000, MAX_FAILS = 10, PENDING_MS = 10 * 60 * 1000;

export function createAuth({ accounts, audit, secure }) {
  const cookieAttrs = maxAge => `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  const readCookie = (req, name) => {
    const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
  };
  const setCookies = (res, list) => res.setHeader('Set-Cookie', list);

  // Brute-force protection: per IP address and per account, max 10 failures per 15 minutes.
  const fails = new Map();
  const blocked = k => { const f = fails.get(k); return f && Date.now() - f.since < WINDOW && f.n >= MAX_FAILS; };
  const fail = k => {
    if (fails.size > 5000) for (const [x, f] of fails) if (Date.now() - f.since >= WINDOW) fails.delete(x);
    const f = fails.get(k);
    if (!f || Date.now() - f.since >= WINDOW) fails.set(k, { n: 1, since: Date.now() }); else f.n++;
    return blocked(k);
  };
  const TOO_MANY = 'Te veel pogingen. Probeer het over een kwartier opnieuw.';

  // Between password and two-factor: a short-lived "pending" login, kept in memory.
  const pending = new Map();
  function startPending(res, account, stage, extraCookies = []) {
    for (const [k, p] of pending) if (p.expires < Date.now()) pending.delete(k);
    const raw = randomToken();
    pending.set(sha256(raw), { accountId: account.id, stage, expires: Date.now() + PENDING_MS, attempts: 0 });
    setCookies(res, [...extraCookies, `${PENDING}=${raw}; ${cookieAttrs(PENDING_MS / 1000)}`]);
  }
  function getPending(req) {
    const raw = readCookie(req, PENDING), p = raw && pending.get(sha256(raw));
    if (!p || p.expires < Date.now()) return null;
    const account = accounts.get(p.accountId);
    return account && account.status === 'active' ? { ...p, key: sha256(raw), account, ref: p } : null;
  }

  function finishLogin(req, res, account, { redirect = '/', extra = [] } = {}) {
    const raw = accounts.createSession(account, req.headers['user-agent']);
    const pk = readCookie(req, PENDING); if (pk) pending.delete(sha256(pk));
    audit.log('login.ok', { actor: account, ip: req.ip });
    setCookies(res, [`${SID}=${raw}; ${cookieAttrs(SESSION_DAYS * 86400)}`, `${PENDING}=; ${cookieAttrs(0)}`, `${LEGACY}=; ${cookieAttrs(0)}`, ...extra]);
    if (redirect) res.redirect(redirect);
  }
  /** After a correct password (or a new account): straight in, or on to the two-factor step. */
  function afterPassword(req, res, account) {
    if (accounts.hasTotp(account)) { startPending(res, account, 'code'); return res.redirect('/login/code'); }
    if (twoFactorRequired(account)) { startPending(res, account, 'enroll'); return res.redirect('/login/2fa-instellen'); }
    finishLogin(req, res, account);
  }

  const current = req => accounts.sessionFor(readCookie(req, SID));
  const html = (res, status, body) => res.status(status).type('html').send(body);
  const form = req => req.body || {};

  return {
    current,
    /** Everything behind this needs a session; sets req.account and req.sessionId. */
    guard(req, res, next) {
      const s = current(req);
      if (s) { req.account = s.account; req.sessionId = s.id; return next(); }
      if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthenticated' });
      if (req.method === 'GET' && req.accepts('html')) return res.redirect('/login');
      return res.status(401).end();
    },

    loginPage(req, res) {
      if (current(req)) return res.redirect('/');
      html(res, 200, loginPage({ ok: req.query.ok === 'reset' ? 'Je wachtwoord is gewijzigd. Log in met je nieuwe wachtwoord.' : '' }));
    },
    async login(req, res) {
      const email = normEmail(form(req).email), ip = req.ip;
      if (blocked(ip) || blocked('acct:' + email)) return html(res, 429, loginPage({ error: TOO_MANY, email }));
      const account = await accounts.checkPassword(email, String(form(req).password || ''));
      if (!account) {
        const known = accounts.byEmail(email);
        audit.log('login.fail', { target: known || null, ip, details: known ? {} : { reden: 'onbekend e-mailadres' } });
        if (fail(ip)) audit.log('login.locked', { ip, details: { reden: 'te veel pogingen vanaf dit IP-adres' } });
        if (known && fail('acct:' + email)) audit.log('login.locked', { target: known, ip, details: { reden: 'te veel pogingen voor dit account' } });
        return html(res, 401, loginPage({ error: 'E-mailadres of wachtwoord klopt niet.', email }));
      }
      fails.delete('acct:' + email);
      afterPassword(req, res, account);
    },

    codePage(req, res) {
      const p = getPending(req);
      if (!p || p.stage !== 'code') return res.redirect('/login');
      html(res, 200, codePage());
    },
    code(req, res) {
      const p = getPending(req);
      if (!p || p.stage !== 'code') return res.redirect('/login');
      if (blocked(req.ip) || p.ref.attempts >= 5) { pending.delete(p.key); return html(res, 429, loginPage({ error: TOO_MANY })); }
      const kind = accounts.checkSecondFactor(p.account, form(req).code);
      if (!kind) {
        p.ref.attempts++; fail(req.ip);
        audit.log('login.2fa_fail', { target: p.account, ip: req.ip });
        return html(res, 401, codePage({ error: 'Die code klopt niet. Wacht op de volgende code en probeer het opnieuw.' }));
      }
      if (kind === 'recovery') audit.log('2fa.recovery_used', { actor: p.account, ip: req.ip, details: { over: (p.account.totp.recovery || []).length } });
      finishLogin(req, res, p.account);
    },

    enrollPage(req, res) {
      const p = getPending(req);
      if (!p || p.stage !== 'enroll') return res.redirect('/login');
      const secret = accounts.startTotp(p.account);
      html(res, 200, enrollPage({ secret, otpauth: otpauthUrl(secret, p.account.email), name: p.account.name }));
    },
    enroll(req, res) {
      const p = getPending(req);
      if (!p || p.stage !== 'enroll') return res.redirect('/login');
      let codes;
      try { codes = accounts.confirmTotp(p.account, form(req).code); }
      catch (e) {
        if (!(e instanceof AccountError)) throw e;
        p.ref.attempts++;
        if (p.ref.attempts >= 8) { pending.delete(p.key); return res.redirect('/login'); }
        const secret = accounts.startTotp(p.account);
        return html(res, 400, enrollPage({ error: e.message, secret, otpauth: otpauthUrl(secret, p.account.email), name: p.account.name }));
      }
      audit.log('2fa.enabled', { actor: p.account });
      finishLogin(req, res, p.account, { redirect: null });
      html(res, 200, recoveryPage({ codes }));
    },

    // First setup (setup link) and invites use the same page.
    invitePage(type) {
      return (req, res) => {
        const p = accounts.peekToken(req.params.token, type === 'setup' ? ['setup'] : ['invite']);
        if (!p) return html(res, 410, messagePage({ title: 'Link verlopen', text: 'Deze link is verlopen of al gebruikt. Vraag je teamlead om een nieuwe.' }));
        html(res, 200, invitePage({ account: p.account, setup: type === 'setup', action: req.originalUrl }));
      };
    },
    accept(type) {
      return async (req, res) => {
        const p = accounts.peekToken(req.params.token, type === 'setup' ? ['setup'] : ['invite']);
        if (!p) return html(res, 410, messagePage({ title: 'Link verlopen', text: 'Deze link is verlopen of al gebruikt. Vraag je teamlead om een nieuwe.' }));
        const { email, password, password2 } = form(req);
        const again = error => html(res, 400, invitePage({ error, account: p.account, email, setup: type === 'setup', action: req.originalUrl }));
        if (blocked(req.ip)) return again(TOO_MANY);
        if (password !== password2) return again('De wachtwoorden zijn niet hetzelfde.');
        const problem = passwordProblem(password, email);
        if (problem) return again(problem);
        let account;
        try { account = await accounts.acceptInvite(req.params.token, { email, password }); }
        catch (e) { if (e instanceof AccountError) { fail(req.ip); return again(e.message); } throw e; }
        audit.log('member.joined', { actor: account, ip: req.ip, details: { via: type === 'setup' ? 'setuplink' : 'uitnodiging' } });
        afterPassword(req, res, account);
      };
    },

    resetPage(req, res) {
      const p = accounts.peekToken(req.params.token, ['reset']);
      if (!p) return html(res, 410, messagePage({ title: 'Link verlopen', text: 'Deze resetlink is verlopen of al gebruikt. Vraag je teamlead om een nieuwe.' }));
      html(res, 200, resetPage({ account: p.account, action: req.originalUrl }));
    },
    async reset(req, res) {
      const p = accounts.peekToken(req.params.token, ['reset']);
      if (!p) return html(res, 410, messagePage({ title: 'Link verlopen', text: 'Deze resetlink is verlopen of al gebruikt. Vraag je teamlead om een nieuwe.' }));
      const { password, password2 } = form(req);
      const again = error => html(res, 400, resetPage({ error, account: p.account, action: req.originalUrl }));
      if (password !== password2) return again('De wachtwoorden zijn niet hetzelfde.');
      const problem = passwordProblem(password, p.account.email);
      if (problem) return again(problem);
      const cleared = !!p.token.clear2fa;
      const account = await accounts.resetPassword(req.params.token, password);
      audit.log('password.reset', { actor: account, ip: req.ip, details: cleared ? { tweestapsverificatieGewist: true } : {} });
      res.redirect('/login?ok=reset');
    },

    logout(req, res) {
      const s = current(req);
      if (s) { audit.log('logout', { actor: s.account }); accounts.endSession(readCookie(req, SID)); }
      const pk = readCookie(req, PENDING); if (pk) pending.delete(sha256(pk));
      setCookies(res, [`${SID}=; ${cookieAttrs(0)}`, `${PENDING}=; ${cookieAttrs(0)}`, `${LEGACY}=; ${cookieAttrs(0)}`]);
      res.redirect('/login');
    },

    privacy(req, res) { html(res, 200, privacyPage({ back: current(req) ? '/' : '/login' })); },
  };
}

/** Rejects cross-site form posts and API writes: browsers always send Origin on POST. */
export function sameOrigin(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || !req.headers.origin) return next();
  let host = '';
  try { host = new URL(req.headers.origin).host; } catch (e) { /* "null" or malformed */ }
  if (host === req.headers.host) return next();
  if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'bad_origin' });
  return res.status(403).type('text').send('Verzoek geweigerd.');
}
