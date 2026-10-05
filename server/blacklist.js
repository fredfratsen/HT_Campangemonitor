// Blacklist: candidates Horeca Toppers doesn't put forward (again), with the reason. These are personal data of
// candidates, so they are kept apart from the shared team data: their own document (DATA_DIR/blacklist.json, or a
// Netlify Blob), only reachable through /api/blacklist with a blacklist right, and never part of /api/state.
//
// - With blacklist.manage you put a candidate on it directly. With only blacklist.view you propose one
//   (voordragen); someone with blacklist.manage confirms or rejects it, so a second person always looks at it.
// - Next to the name an entry needs an email address or phone number, so nobody is mixed up with a namesake.
// - Every entry ends: after the term chosen for it (BL_MONTHS), a proposal after BL_PROPOSAL_DAYS. Housekeeping
//   deletes it then (prune).
// - The audit log gets the entry id and initials, not the full name (auditDetails), so once an entry is deleted
//   the name is gone too, apart from the backups of the last 14 days.
import { randomToken } from './crypto.js';
import { BL_REASONS, BL_MONTHS, BL_DEF_MONTHS, BL_PROPOSAL_DAYS } from '../src/lib/constants.js';

export class BlacklistError extends Error {}
const fail = msg => { throw new BlacklistError(msg); };

const line = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
/** Lower case, without accents: "Zoë  de Vries" → "zoe de vries". */
export const normName = s => line(s, 200).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const normEmail = s => line(s, 200).toLowerCase();
/** Digits only, international: "06-1234 5678", "+31 6 12345678" and "0031612345678" → "31612345678". */
export function normPhone(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  return d.startsWith('00') ? d.slice(2) : d.length === 10 && d.startsWith('0') ? '31' + d.slice(1) : d;
}
/** The last 9 digits: the same for a number with or without country code or leading 0. */
const phoneKey = s => normPhone(s).slice(-9);
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const addMonths = (t, m) => { const d = new Date(t); d.setMonth(d.getMonth() + m); return d.getTime(); };
export const initials = name => line(name, 80).split(' ').filter(Boolean).map(w => w[0] + '.').join(' ');

const FIELDS = { name: 'naam', email: 'e-mailadres', phone: 'telefoonnummer', reason: 'reden', note: 'toelichting', client: 'klant', vac: 'functie', scope: 'geldt voor' };

/** Checks and tidies what someone filled in; throws a BlacklistError with a message for the app. */
function clean(b) {
  const name = line(b.name, 80), email = normEmail(b.email), phone = line(b.phone, 30), reason = line(b.reason, 100);
  const note = String(b.note ?? '').trim().slice(0, 500), client = line(b.client, 120), vac = client ? line(b.vac, 120) : '';
  const scope = b.scope === 'client' ? 'client' : 'all', digits = normPhone(phone).length;
  if (name.length < 2) fail('Vul de naam van de kandidaat in.');
  if (email && !validEmail(email)) fail('Dat e-mailadres klopt niet.');
  if (phone && (digits < 9 || digits > 15)) fail('Dat telefoonnummer klopt niet.');
  if (!email && !phone) fail('Vul ook een e-mailadres of telefoonnummer in, zodat de kandidaat niet met een naamgenoot wordt verward.');
  if (!BL_REASONS.includes(reason)) fail('Kies een reden.');
  if (reason === 'Overig' && !note) fail('Licht de reden ‘Overig’ kort toe.');
  if (scope === 'client' && !client) fail('Kies de klant waarvoor dit geldt.');
  return { name, email: email || null, phone: phone || null, reason, note, client: client || null, vac: vac || null, scope };
}
/** The term in months, or null when none was chosen. */
function term(m) {
  if (m == null || m === '') return null;
  if (!BL_MONTHS.includes(Number(m))) fail('Kies een geldige bewaartermijn.');
  return Number(m);
}
// Proposals first, then the newest.
const order = (a, b) => (a.status === b.status ? 0 : a.status === 'voorstel' ? -1 : 1) || b.addedAt - a.addedAt;

/** @param docs  document factory from jsonfile.js (files or Netlify Blobs) */
export function createBlacklist(docs) {
  const f = docs('blacklist', () => ({ entries: {} }), { mode: 0o600 });
  // Never keep a reference to the entries: on Netlify the document is loaded again for every request.
  const E = () => f.data.entries || (f.data.entries = {});
  const live = (now = Date.now()) => Object.values(E()).filter(e => e.until > now);
  const get = id => { const e = Object.prototype.hasOwnProperty.call(E(), id) ? E()[id] : null; return e && e.until > Date.now() ? e : null; };
  const mustGet = id => get(id) || fail('Deze vermelding bestaat niet (meer).');

  /** Another entry for the same person: the same email address or phone number. */
  function duplicate(v, exceptId = null) {
    const key = v.phone && phoneKey(v.phone);
    const dup = live().find(e => e.id !== exceptId && ((v.email && e.email === v.email) || (key && e.phone && phoneKey(e.phone) === key)));
    if (dup) fail(dup.status === 'voorstel' ? `${dup.name} is al voorgedragen voor de blacklist.` : `${dup.name} staat al op de blacklist.`);
  }

  /** A new entry: on the blacklist right away (direct), or a proposal that someone still has to confirm. */
  function add(actor, b, { direct }) {
    const v = clean(b), months = term(b.months) ?? BL_DEF_MONTHS, now = Date.now();
    duplicate(v);
    const e = { id: 'b-' + randomToken(9), status: direct ? 'actief' : 'voorstel', ...v, months,
      addedBy: actor.name, addedById: actor.id, addedAt: now, approvedBy: null, approvedAt: null, updatedBy: null, updatedAt: null,
      until: direct ? addMonths(now, months) : now + BL_PROPOSAL_DAYS * 864e5 };
    E()[e.id] = e; f.save();
    return e;
  }
  /** A proposal confirmed: its term starts now. */
  function approve(actor, id) {
    const e = mustGet(id), now = Date.now();
    if (e.status !== 'voorstel') fail(`${e.name} staat al op de blacklist.`);
    Object.assign(e, { status: 'actief', approvedBy: actor.name, approvedAt: now, until: addMonths(now, e.months) });
    f.save();
    return e;
  }
  /**
   * Corrects an entry. On a confirmed entry a term (months) counts from now, so it extends it; on a proposal it is
   * the term that starts once it is confirmed. Returns the entry and the names of what changed.
   */
  function update(actor, id, b) {
    const e = mustGet(id), v = clean(b), now = Date.now();
    let months = term(b.months);
    if (e.status === 'voorstel' && months === e.months) months = null;
    duplicate(v, e.id);
    const changed = Object.keys(v).filter(k => v[k] !== e[k]).map(k => FIELDS[k]);
    if (months != null) changed.push('bewaartermijn');
    if (!changed.length) return { entry: e, changed };
    Object.assign(e, v, { updatedBy: actor.name, updatedAt: now });
    if (months != null) { e.months = months; if (e.status === 'actief') e.until = addMonths(now, months); }
    f.save();
    return { entry: e, changed };
  }
  function remove(id) { const e = mustGet(id); delete E()[id]; f.save(); return e; }

  /** Entries whose name has all the words of q, or whose email address or phone number contains q. */
  function search(q) {
    const words = normName(q).split(' ').filter(Boolean), email = normEmail(q);
    const digits = String(q).replace(/\D/g, ''), tel = digits.length >= 9 ? digits.slice(-9) : digits;
    return live().filter(e => (words.length > 0 && words.every(w => normName(e.name).includes(w)))
      || (e.email && email.length >= 3 && e.email.includes(email))
      || (e.phone && tel.length >= 6 && normPhone(e.phone).includes(tel))).sort(order);
  }

  /** Deletes the entries whose term has ended, and returns them (for the audit log). */
  function prune(now = Date.now()) {
    const gone = Object.values(E()).filter(e => !(e.until > now));
    for (const e of gone) delete E()[e.id];
    if (gone.length) f.save();
    return gone;
  }
  /** Replaces a former team member's name (see privacy.anonymise). */
  function rename(names, pseudonym) {
    let hit = false;
    for (const e of Object.values(E())) for (const k of ['addedBy', 'approvedBy', 'updatedBy']) if (names.has(e[k])) { e[k] = pseudonym; hit = true; }
    if (hit) f.save();
  }

  const counts = () => { const l = live(); return { total: l.filter(e => e.status === 'actief').length, pending: l.filter(e => e.status === 'voorstel').length }; };
  /** For the audit log: no full name. */
  const auditDetails = (e, extra = {}) => ({ vermelding: e.id, kandidaat: initials(e.name), reden: e.reason, ...(e.scope === 'client' ? { alleenBij: e.client } : {}), ...extra });
  const iso = t => t ? new Date(t).toISOString() : null;
  /** Everything stored about the candidate, for an inzageverzoek. */
  const exportOf = e => ({
    toelichting: 'Alle gegevens die Horeca Toppers in de Campagnemonitor over deze kandidaat bewaart.',
    geexporteerdOp: iso(Date.now()),
    naam: e.name, eMailadres: e.email, telefoonnummer: e.phone,
    status: e.status === 'voorstel' ? 'voorgedragen, nog niet bevestigd' : 'op de blacklist',
    reden: e.reason, toelichtingOpDeReden: e.note || null,
    sollicitatieBij: e.client ? [e.client, e.vac].filter(Boolean).join(' – ') : null,
    geldtVoor: e.scope === 'client' ? `alleen ${e.client}` : 'alle klanten van Horeca Toppers',
    vastgelegdOp: iso(e.addedAt), bevestigdOp: iso(e.approvedAt), laatstGewijzigdOp: iso(e.updatedAt), bewaardTot: iso(e.until),
  });

  return { all: () => live().sort(order), get, add, approve, update, remove, search, prune, rename, counts, auditDetails, exportOf };
}
