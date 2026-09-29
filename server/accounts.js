// Personal accounts: who can log in, with which role and rights, plus their sessions and one-time links
// (setup, invites, password resets). Stored as the "accounts" document (a JSON file, or a Netlify Blob; see
// jsonfile.js). Passwords are scrypt hashes; two-factor secrets are encrypted; sessions and links are stored as
// SHA-256 hashes, so a copy of the data can't be used to log in.
//
// Logins that are between the password and the two-factor step, and the failed-attempt counters, are kept here
// too (not in server memory), so on Netlify any instance can handle the next request.
import {
  sha256, randomToken, hashPassword, verifyPassword, encrypt, decrypt, newTotpSecret, verifyTotp,
  newRecoveryCodes, normRecovery,
} from './crypto.js';
import { ROLES, levelOf, rightsOf, manageError, overridesFor } from '../src/lib/permissions.js';

export const SESSION_DAYS = 30;
export const TTL = { invite: 7 * 864e5, reset: 864e5, setup: 36e5 };
const MAX_SESSIONS = 20, PENDING_MS = 10 * 60 * 1000, FAIL_WINDOW = 15 * 60 * 1000, MAX_FAILS = 10;

// The team as it was hard-coded before accounts existed. Same ids, so earlier data ("seen", notifications)
// stays linked. Everyone starts as "invited": a link from Instellingen › Leden lets them set a password.
const SEED = [
  { id: 'r-tsjerk', name: 'Tsjerk', role: 'dev', recName: 'Tsjerk' },
  { id: 'robbin', name: 'Robbin', role: 'teamlead' },
  { id: 'danielle', name: 'Danielle', role: 'marketeer' },
  { id: 'molina', name: 'Molina', role: 'marketeer' },
  { id: 'mare', name: 'Mare', role: 'marketeer' },
  { id: 'r-robin', name: 'Robin', role: 'recruiter', recName: 'Robin' },
  { id: 'r-kim', name: 'Kim', role: 'recruiter', recName: 'Kim' },
  { id: 'r-juul', name: 'Juul', role: 'recruiter', recName: 'Juul' },
];

export const twoFactorRequired = a => ['owner', 'admin'].includes(levelOf(a));
export const normEmail = e => String(e || '').trim().toLowerCase();
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 60);

export class AccountError extends Error {}
const fail = msg => { throw new AccountError(msg); };

/** @param docs  document factory from jsonfile.js (files or Netlify Blobs) */
export function createAccounts(docs, secretsKey) {
  const f = docs('accounts', () => {
    const now = Date.now(), accounts = {};
    for (const s of SEED) accounts[s.id] = blank({ ...s, createdAt: now, createdBy: null });
    return { accounts, sessions: {}, tokens: {}, settings: { anonymiseAfterMonths: 12 } };
  }, { mode: 0o600 });
  const db = f.data;
  if (f.isNew && f.file) console.log(`[accounts] nieuw accountbestand met ${SEED.length} teamleden: ${f.file}`);
  const save = () => f.save();
  const bag = k => db[k] || (db[k] = {});

  function blank(o) {
    return { id: o.id, name: o.name, email: o.email || null, role: o.role, recName: o.recName || null, grants: [], revokes: [], status: 'invited',
      pw: null, totp: null, createdAt: o.createdAt, createdBy: o.createdBy, joinedAt: null, lastLoginAt: null, deactivatedAt: null };
  }

  const all = () => Object.values(db.accounts);
  const get = id => db.accounts[id] || null;
  const byEmail = email => all().find(a => a.email && a.email === normEmail(email) && a.status !== 'anonymised') || null;
  const live = () => all().filter(a => a.status !== 'anonymised');
  const activeOwners = () => all().filter(a => a.status === 'active' && levelOf(a) === 'owner');

  // ── Views ────────────────────────────────────────────────────────────
  /** What everyone in the team may see (names for dropdowns, who is a recruiter). */
  const directoryView = a => ({ id: a.id, name: a.name, role: a.role, recName: a.recName, status: a.status });
  /** What the account holder sees about themself. */
  const selfView = a => ({ ...directoryView(a), email: a.email, grants: a.grants, revokes: a.revokes, level: levelOf(a), rights: [...rightsOf(a)],
    twoFactor: !!(a.totp && a.totp.enabledAt), twoFactorRequired: twoFactorRequired(a), recoveryLeft: a.totp ? (a.totp.recovery || []).length : 0,
    joinedAt: a.joinedAt, lastLoginAt: a.lastLoginAt, pwChangedAt: a.pwChangedAt || null });
  /** What member managers see. */
  const adminView = a => ({ ...selfView(a), createdAt: a.createdAt, deactivatedAt: a.deactivatedAt, anonymisedAt: a.anonymisedAt || null,
    hasOpenInvite: Object.values(db.tokens).some(t => t.accountId === a.id && t.type !== 'reset' && t.expiresAt > Date.now()) });

  // ── Uniqueness ───────────────────────────────────────────────────────
  function checkUnique(id, { name, email, recName }) {
    for (const o of live()) {
      if (o.id === id) continue;
      if (name && o.name.toLowerCase() === name.toLowerCase()) fail(`Er is al een account met de naam ${name}.`);
      if (email && o.email === email) fail('Dat e-mailadres is al in gebruik.');
      if (recName && o.recName && o.recName.toLowerCase() === recName.toLowerCase()) fail(`De recruiternaam ${recName} is al gekoppeld aan ${o.name}.`);
    }
  }

  // ── One-time links ───────────────────────────────────────────────────
  /** A new one-time link. Earlier links of the same type for this account stop working, unless `keep` (max 3). */
  function issueToken(type, accountId, createdBy = null, { keep = false } = {}) {
    const same = Object.entries(db.tokens).filter(([, t]) => t.accountId === accountId && t.type === type).sort((a, b) => a[1].createdAt - b[1].createdAt);
    for (const [h] of keep ? same.slice(0, Math.max(0, same.length - 2)) : same) delete db.tokens[h];
    const raw = randomToken();
    db.tokens[sha256(raw)] = { type, accountId, createdAt: Date.now(), expiresAt: Date.now() + TTL[type], createdBy };
    save();
    return raw;
  }
  /** The link's account if it is valid; types: array of accepted types. */
  function peekToken(raw, types) {
    const t = db.tokens[sha256(String(raw || ''))];
    if (!t || !types.includes(t.type) || t.expiresAt < Date.now()) return null;
    const a = get(t.accountId);
    if (!a || a.status === 'anonymised' || a.status === 'deactivated') return null;
    return { token: t, account: a };
  }
  const dropToken = raw => { delete db.tokens[sha256(String(raw || ''))]; save(); };
  const dropTokensOf = id => { for (const [h, t] of Object.entries(db.tokens)) if (t.accountId === id) delete db.tokens[h]; };

  /** Invite or setup link used: set email + password, account becomes active. */
  async function acceptInvite(raw, { email, password }) {
    const p = peekToken(raw, ['invite', 'setup']);
    if (!p) fail('Deze link is verlopen of al gebruikt. Vraag om een nieuwe.');
    const a = p.account, em = normEmail(email);
    if (a.status !== 'invited') fail('Dit account is al actief. Log in met je e-mailadres.');
    if (!validEmail(em)) fail('Vul een geldig e-mailadres in.');
    checkUnique(a.id, { email: em });
    a.email = em; a.pw = await hashPassword(password); a.pwChangedAt = Date.now();
    a.status = 'active'; a.joinedAt = Date.now();
    dropToken(raw); save();
    return a;
  }
  async function resetPassword(raw, password) {
    const p = peekToken(raw, ['reset']);
    if (!p) fail('Deze link is verlopen of al gebruikt. Vraag om een nieuwe.');
    const a = p.account;
    a.pw = await hashPassword(password); a.pwChangedAt = Date.now();
    if (p.token.clear2fa) a.totp = null;
    if (a.email) clearFails('acct:' + a.email);
    dropToken(raw); revokeAll(a.id); save();
    return a;
  }

  // ── Login ────────────────────────────────────────────────────────────
  async function checkPassword(email, password) {
    const a = byEmail(email);
    const ok = await verifyPassword(password, a && a.status === 'active' ? a.pw : null);
    return ok ? a : null;
  }
  async function changePassword(a, current, next) {
    if (!(await verifyPassword(current, a.pw))) fail('Je huidige wachtwoord klopt niet.');
    a.pw = await hashPassword(next); a.pwChangedAt = Date.now(); save();
  }
  async function changeEmail(a, password, email) {
    if (!(await verifyPassword(password, a.pw))) fail('Je wachtwoord klopt niet.');
    const em = normEmail(email);
    if (!validEmail(em)) fail('Vul een geldig e-mailadres in.');
    checkUnique(a.id, { email: em });
    a.email = em; save();
  }

  // ── Two-factor ───────────────────────────────────────────────────────
  const hasTotp = a => !!(a.totp && a.totp.enabledAt);
  /** Starts enrolment (or continues one that was started); returns the secret. It is only switched on by confirmTotp. */
  function startTotp(a) {
    const prev = a.totpPending && decrypt(secretsKey, a.totpPending);
    if (prev) return prev;
    const secret = newTotpSecret();
    a.totpPending = encrypt(secretsKey, secret); save();
    return secret;
  }
  function confirmTotp(a, code) {
    const secret = a.totpPending && decrypt(secretsKey, a.totpPending);
    if (!secret) fail('Start het instellen van tweestapsverificatie opnieuw.');
    const step = verifyTotp(secret, code);
    if (step < 0) fail('Die code klopt niet. Controleer de tijd op je telefoon en probeer de nieuwe code.');
    const codes = newRecoveryCodes();
    a.totp = { secret: encrypt(secretsKey, secret), enabledAt: Date.now(), lastStep: step, recovery: codes.map(c => sha256(normRecovery(c))) };
    delete a.totpPending; save();
    return codes;
  }
  /** Checks a 6-digit code or a recovery code. Returns 'totp', 'recovery' or ''. */
  function checkSecondFactor(a, code) {
    if (!hasTotp(a)) return '';
    const secret = decrypt(secretsKey, a.totp.secret);
    const c = String(code || '').trim();
    if (secret && /^\d{3}\s?\d{3}$/.test(c)) {
      const step = verifyTotp(secret, c, a.totp.lastStep ?? -1);
      if (step >= 0) { a.totp.lastStep = step; save(); return 'totp'; }
      return '';
    }
    const h = sha256(normRecovery(c)), i = (a.totp.recovery || []).indexOf(h);
    if (normRecovery(c).length >= 12 && i >= 0) { a.totp.recovery.splice(i, 1); save(); return 'recovery'; }
    return '';
  }
  function newRecovery(a) {
    if (!hasTotp(a)) fail('Tweestapsverificatie staat niet aan.');
    const codes = newRecoveryCodes();
    a.totp.recovery = codes.map(c => sha256(normRecovery(c))); save();
    return codes;
  }
  async function disableTotp(a, password) {
    if (twoFactorRequired(a)) fail('Voor jouw rol is tweestapsverificatie verplicht.');
    if (!(await verifyPassword(password, a.pw))) fail('Je wachtwoord klopt niet.');
    a.totp = null; delete a.totpPending; save();
  }

  // ── Sessions ─────────────────────────────────────────────────────────
  function createSession(a, ua = '') {
    const raw = randomToken(), now = Date.now();
    db.sessions[sha256(raw)] = { accountId: a.id, createdAt: now, lastSeenAt: now, expiresAt: now + SESSION_DAYS * 864e5, ua: String(ua).slice(0, 160) };
    const mine = Object.entries(db.sessions).filter(([, s]) => s.accountId === a.id).sort((x, y) => x[1].lastSeenAt - y[1].lastSeenAt);
    for (const [h] of mine.slice(0, Math.max(0, mine.length - MAX_SESSIONS))) delete db.sessions[h];
    a.lastLoginAt = now; save();
    return raw;
  }
  /** { id, session, account } for a valid session cookie, else null. */
  function sessionFor(raw) {
    if (!raw) return null;
    const id = sha256(raw), s = db.sessions[id];
    if (!s) return null;
    const a = get(s.accountId);
    if (s.expiresAt < Date.now() || !a || a.status !== 'active') { delete db.sessions[id]; save(); return null; }
    if (Date.now() - s.lastSeenAt > 5 * 60000) { s.lastSeenAt = Date.now(); save(); }
    return { id, session: s, account: a };
  }
  const endSession = raw => { if (raw) { delete db.sessions[sha256(raw)]; save(); } };
  function revokeAll(accountId, exceptId = null) {
    let n = 0;
    for (const [h, s] of Object.entries(db.sessions)) if (s.accountId === accountId && h !== exceptId) { delete db.sessions[h]; n++; }
    save();
    return n;
  }
  const sessionsOf = (accountId, currentId) => Object.entries(db.sessions).filter(([, s]) => s.accountId === accountId)
    .sort((x, y) => y[1].lastSeenAt - x[1].lastSeenAt).map(([h, s]) => ({ current: h === currentId, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, ua: s.ua }));

  // ── Managing members ─────────────────────────────────────────────────
  function invite(actor, { name, role, email, recName }) {
    const n = cleanName(name), em = email ? normEmail(email) : null, rn = recName ? cleanName(recName) : null;
    if (!n) fail('Vul een naam in.');
    if (em && !validEmail(em)) fail('Vul een geldig e-mailadres in, of laat het leeg.');
    const err = manageError(actor, null, { role });
    if (err) fail(err);
    checkUnique(null, { name: n, email: em, recName: rn });
    const id = 'u-' + randomToken(6).replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8);
    const a = blank({ id, name: n, email: em, role, recName: rn, createdAt: Date.now(), createdBy: actor.id });
    db.accounts[id] = a; save();
    return a;
  }

  /** Change role, rights, name or recruiter name. Returns a list of what changed (for the audit log). */
  function update(actor, id, changes) {
    const a = get(id);
    if (!a || a.status === 'anonymised') fail('Account niet gevonden.');
    const role = changes.role ?? a.role;
    if (!ROLES[role]) fail('Onbekende rol.');
    const rights = changes.rights ? changes.rights : [...rightsOf({ ...a, role, grants: role === a.role ? a.grants : [], revokes: role === a.role ? a.revokes : [] })];
    const err = manageError(actor, a, { role, rights });
    if (err) fail(err);
    const name = changes.name != null ? cleanName(changes.name) : a.name;
    const recName = changes.recName !== undefined ? (changes.recName ? cleanName(changes.recName) : null) : a.recName;
    if (!name) fail('Vul een naam in.');
    checkUnique(a.id, { name, recName });
    if (levelOf(a) === 'owner' && ROLES[role].level !== 'owner' && a.status === 'active' && activeOwners().length <= 1) fail('Er moet minstens één actieve Dev (Eigenaar) blijven.');

    const before = { role: a.role, rights: [...rightsOf(a)].sort(), name: a.name, recName: a.recName };
    const o = overridesFor(role, rights);
    Object.assign(a, { role, grants: o.grants, revokes: o.revokes, name, recName });
    const after = { role: a.role, rights: [...rightsOf(a)].sort(), name: a.name, recName: a.recName };
    const diff = {};
    for (const k of Object.keys(before)) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) diff[k] = k === 'rights'
      ? { added: after.rights.filter(r => !before.rights.includes(r)), removed: before.rights.filter(r => !after.rights.includes(r)) }
      : { from: before[k], to: after[k] };
    // Promoted to a role that needs two-factor without having it: log out, so the next login sets it up.
    if (diff.role && twoFactorRequired(a) && !hasTotp(a)) revokeAll(a.id);
    save();
    return { account: a, diff };
  }

  function setStatus(actor, id, status) {
    const a = get(id);
    if (!a || a.status === 'anonymised') fail('Account niet gevonden.');
    const err = manageError(actor, a);
    if (err) fail(err);
    if (status === 'deactivated') {
      if (levelOf(a) === 'owner' && a.status === 'active' && activeOwners().length <= 1) fail('Er moet minstens één actieve Dev (Eigenaar) blijven.');
      a.status = 'deactivated'; a.deactivatedAt = Date.now(); revokeAll(a.id); dropTokensOf(a.id);
    } else if (status === 'active') {
      if (a.status !== 'deactivated') fail('Dit account is niet gedeactiveerd.');
      a.status = a.pw ? 'active' : 'invited'; a.deactivatedAt = null;
    }
    save();
    return a;
  }

  /** Deletes an invited account that never logged in (withdrawing the invite). */
  function removeInvited(actor, id) {
    const a = get(id);
    if (!a) fail('Account niet gevonden.');
    const err = manageError(actor, a);
    if (err) fail(err);
    if (a.status !== 'invited' || a.joinedAt) fail('Alleen uitnodigingen die nog niet zijn gebruikt kun je verwijderen. Deactiveer het account anders.');
    dropTokensOf(a.id); delete db.accounts[id]; save();
    return a;
  }

  function linkFor(actor, id, type) {
    const a = get(id);
    if (!a || a.status === 'anonymised' || a.status === 'deactivated') fail('Account niet gevonden of gedeactiveerd.');
    const err = manageError(actor, a);
    if (err) fail(err);
    if (type === 'invite' && a.status !== 'invited') fail('Dit account is al actief. Maak een wachtwoord-resetlink.');
    if (type === 'reset' && a.status !== 'active') fail('Dit account heeft nog geen wachtwoord. Maak een uitnodigingslink.');
    return issueToken(type, a.id, actor.id);
  }

  function resetTwoFactor(actor, id) {
    const a = get(id);
    if (!a) fail('Account niet gevonden.');
    const err = manageError(actor, a);
    if (err) fail(err);
    a.totp = null; delete a.totpPending; revokeAll(a.id); save();
    return a;
  }

  /** Strips personal data from an account. The shared data is handled by privacy.js. */
  function anonymise(a, pseudonym) {
    Object.assign(a, { name: pseudonym, email: null, pw: null, totp: null, recName: a.recName ? pseudonym : null, status: 'anonymised', anonymisedAt: Date.now(), grants: [], revokes: [] });
    delete a.totpPending;
    revokeAll(a.id); dropTokensOf(a.id); save();
  }

  // ── Logins between password and two-factor ───────────────────────────
  function startPending(account, stage) {
    const raw = randomToken();
    bag('pending')[sha256(raw)] = { accountId: account.id, stage, expires: Date.now() + PENDING_MS, attempts: 0 };
    save();
    return raw;
  }
  /** { key, stage, attempts, account } for a valid pending login, else null. */
  function getPending(raw) {
    if (!raw) return null;
    const key = sha256(raw), p = bag('pending')[key];
    if (!p || p.expires < Date.now()) return null;
    const account = get(p.accountId);
    return account && account.status === 'active' ? { key, stage: p.stage, attempts: p.attempts, account } : null;
  }
  const pendingAttempt = key => { const p = bag('pending')[key]; if (p) { p.attempts++; save(); } };
  const dropPending = key => { if (key && bag('pending')[key]) { delete db.pending[key]; save(); } };

  // ── Failed attempts (brute-force protection) ─────────────────────────
  // Keyed by a hash of "ip:1.2.3.4" or "acct:email", so no IP addresses are stored.
  const fk = k => sha256('fail:' + k);
  const blocked = k => { const x = bag('fails')[fk(k)]; return !!x && Date.now() - x.since < FAIL_WINDOW && x.n >= MAX_FAILS; };
  /** Counts a failure; returns true when this key is now blocked. */
  function failed(k) {
    const F = bag('fails'), h = fk(k), x = F[h];
    if (!x || Date.now() - x.since >= FAIL_WINDOW) F[h] = { n: 1, since: Date.now() }; else x.n++;
    save();
    return blocked(k);
  }
  const clearFails = k => { const h = fk(k); if (bag('fails')[h]) { delete db.fails[h]; save(); } };

  // ── Housekeeping ─────────────────────────────────────────────────────
  /** Names of accounts whose two-factor secret can't be decrypted (SECRETS_KEY changed). */
  const unreadableTotp = () => all().filter(a => a.totp && a.totp.secret && !decrypt(secretsKey, a.totp.secret)).map(a => a.name);
  function cleanup() {
    const now = Date.now();
    for (const [h, s] of Object.entries(db.sessions)) if (s.expiresAt < now) delete db.sessions[h];
    for (const [h, t] of Object.entries(db.tokens)) if (t.expiresAt < now) delete db.tokens[h];
    for (const [h, p] of Object.entries(bag('pending'))) if (p.expires < now) delete db.pending[h];
    for (const [h, x] of Object.entries(bag('fails'))) if (now - x.since >= FAIL_WINDOW) delete db.fails[h];
    save();
  }

  /**
   * Makes sure someone can take ownership: if there is no active Dev with a password, returns a fresh setup
   * link for the first Dev account (creating one if needed). With `recover`, returns reset links (which also
   * clear two-factor) for the active Devs, for when the owner is locked out.
   */
  function ownerAccess({ recover = false, keep = false } = {}) {
    if (recover && activeOwners().length) {
      return activeOwners().map(a => {
        const raw = issueToken('reset', a.id, null, { keep });
        db.tokens[sha256(raw)].clear2fa = true; save();
        return { account: a, type: 'reset', raw };
      });
    }
    if (activeOwners().length) return [];
    let a = all().find(x => x.role === 'dev' && x.status === 'invited');
    if (!a) {
      a = blank({ id: 'u-dev', name: 'Dev', role: 'dev', createdAt: Date.now(), createdBy: null });
      if (db.accounts[a.id]) a.id = 'u-dev-' + randomToken(4).toLowerCase();
      db.accounts[a.id] = a;
    }
    return [{ account: a, type: 'setup', raw: issueToken('setup', a.id, null, { keep }) }];
  }
  /**
   * The /setup page: makes a setup (or, with OWNER_RECOVERY, reset) link and returns it for the server log.
   * At most one per minute, so the page can't be used to flood the log or push out a link that was just made.
   */
  function requestOwnerLinks({ recover = false } = {}) {
    const meta = bag('meta'), kind = recover ? 'reset' : 'setup', last = meta.lastOwnerLink || (meta.lastOwnerLink = {});
    if (!recover && activeOwners().length) return { state: 'owner-exists', links: [] };
    if (last[kind] && Date.now() - last[kind] < 60000) return { state: 'throttled', links: [] };
    const links = ownerAccess({ recover, keep: true });
    if (!links.length) return { state: 'owner-exists', links: [] };
    last[kind] = Date.now(); save();
    return { state: 'issued', links };
  }

  return {
    all, get, byEmail, live, directoryView, selfView, adminView,
    issueToken, peekToken, acceptInvite, resetPassword,
    checkPassword, changePassword, changeEmail,
    hasTotp, startTotp, confirmTotp, checkSecondFactor, newRecovery, disableTotp,
    createSession, sessionFor, endSession, revokeAll, sessionsOf,
    invite, update, setStatus, removeInvited, linkFor, resetTwoFactor, anonymise,
    startPending, getPending, pendingAttempt, dropPending, blocked, failed, clearFails,
    cleanup, ownerAccess, requestOwnerLinks, unreadableTotp,
    get meta() { return bag('meta'); },
    get settings() { return db.settings; },
    saveSettings(s) { Object.assign(db.settings, s); save(); },
    flush: f.flush,
  };
}
