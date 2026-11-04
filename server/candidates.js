// The ATS: candidates of the campaigns switched over from Trello (Toewijzing › Omzetten naar ATS). These are personal
// data, so they are kept apart from the shared team data, like the blacklist: their own document
// (DATA_DIR/candidates.json), only reachable through /api/kandidaten, and never part of /api/state.
//
// - A switched campaign (a Trello link, by its id) has an intake key: Zapier posts each Meta lead to
//   /api/intake/<key>. Only its hash is kept; a new key replaces the old one.
// - Geen gehoor never moves a candidate, also not the third time: the recruiter moves them (lib/ats.js).
// - Four weeks after a candidate is done with (Afgewezen, Aangenomen), or four weeks after the last action in an open
//   stage, the personal data goes (prune). What stays is anonymous: campaign, week, how far they got, the rejection
//   reason and the weeks they were called in, so the monitor's numbers stay the same (atsStats).
import { randomToken, sha256 } from './crypto.js';
import { normEmail, normPhone } from './blacklist.js';
import { STAGE_KEYS, STAGE_RANK, CALL_STAGES, END_STAGES, KEEP_MS, stageName } from '../src/lib/ats.js';
import { REASONS } from '../src/lib/constants.js';
import { weekOf } from '../src/lib/weeks.js';

export class CandidateError extends Error {}
const fail = msg => { throw new CandidateError(msg); };

const line = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const phoneKey = s => normPhone(s).slice(-9);
/** A lead from the same phone number or email address on the same campaign within this time is the same one. */
const DUP_MS = 30 * 864e5;
const MAX_ANSWERS = 30;
const NAME_KEYS = ['naam', 'name', 'full_name', 'volledige_naam'], PHONE_KEYS = ['telefoon', 'phone', 'phone_number', 'telefoonnummer'];
const EMAIL_KEYS = ['email', 'e-mail', 'e_mail', 'emailadres'], SRC_KEYS = ['bron', 'source'], SKIP = new Set(['first_name', 'last_name', 'voornaam', 'achternaam']);
const pick = (b, keys) => { for (const k of keys) if (b[k] != null && String(b[k]).trim()) return String(b[k]); return ''; };
const DAY_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], MON = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** A lead as Zapier sends it → { name, phone, email, src, answers }. Throws when there's no name or no way to reach them. */
export function parseLead(body) {
  const b = Object.fromEntries(Object.entries(body && typeof body === 'object' ? body : {}).map(([k, v]) => [k.trim().toLowerCase(), v]));
  const name = line(pick(b, NAME_KEYS) || [b.first_name || b.voornaam, b.last_name || b.achternaam].filter(Boolean).join(' '), 80);
  const phone = line(pick(b, PHONE_KEYS), 30), email = normEmail(pick(b, EMAIL_KEYS)), src = line(pick(b, SRC_KEYS), 40) || 'Meta';
  if (!name) fail('Naam ontbreekt (veld naam, name of full_name).');
  if (!phone && !email) fail('Telefoonnummer of e-mailadres ontbreekt.');
  if (phone && normPhone(phone).length < 9) fail('Het telefoonnummer klopt niet.');
  if (email && !validEmail(email)) fail('Het e-mailadres klopt niet.');
  const used = new Set([...NAME_KEYS, ...PHONE_KEYS, ...EMAIL_KEYS, ...SRC_KEYS, ...SKIP]);
  const answers = Object.entries(body || {}).filter(([k, v]) => !used.has(k.trim().toLowerCase()) && v != null && typeof v !== 'object' && String(v).trim())
    .slice(0, MAX_ANSWERS).map(([k, v]) => [line(k.replace(/_/g, ' '), 120), line(v, 500)]);
  return { name, phone: phone || null, email: email || null, src, answers };
}

/** @param docs  document factory from jsonfile.js */
export function createCandidates(docs) {
  const f = docs('candidates', () => ({ links: {}, cands: {}, anon: [] }));
  const D = f.data;
  for (const k of ['links', 'cands']) if (!D[k]) D[k] = {};
  if (!D.anon) D.anon = [];

  /** The campaigns with an intake key: { linkId: { at, by, last4 } }. */
  const switched = () => Object.fromEntries(Object.entries(D.links).map(([id, l]) => [id, { at: l.at, by: l.by, last4: l.last4 }]));
  /** A new intake key for campaign linkId (the first one switches it over); the old key stops working. Returns the key. */
  function newKey(actor, linkId, now = Date.now()) {
    const raw = randomToken(24), was = D.links[linkId];
    D.links[linkId] = { hash: sha256(raw), last4: raw.slice(-4), at: was ? was.at : now, by: was ? was.by : actor.name, renewedAt: was ? now : null };
    f.save();
    return raw;
  }
  const linkOfKey = raw => { const h = sha256(String(raw || '')); return Object.keys(D.links).find(id => D.links[id].hash === h) || null; };

  const mustGet = id => D.cands[id] || fail('Deze kandidaat bestaat niet (meer).');
  const log = (c, by, what, now) => { c.log.unshift({ at: now, by, what }); c.lastAt = now; };
  const callWeek = (c, now) => { const w = weekOf(now); if (!c.calls.includes(w)) c.calls.push(w); };

  /** A lead for the campaign of key raw. Returns { cand, dup }, or null for an unknown key. */
  function take(raw, body, now = Date.now()) {
    const link = linkOfKey(raw);
    if (!link) return null;
    const lead = parseLead(body), tel = lead.phone && phoneKey(lead.phone);
    const dup = Object.values(D.cands).find(c => c.link === link && now - c.at < DUP_MS && ((tel && c.phone && phoneKey(c.phone) === tel) || (lead.email && c.email === lead.email)));
    if (dup) { log(dup, 'automatisch', `Opnieuw binnengekomen via ${lead.src}`, now); f.save(); return { cand: dup, dup: true }; }
    const id = 'k' + now.toString(36) + randomToken(4).replace(/[-_]/g, 'x');
    const c = D.cands[id] = { id, link, ...lead, at: now, stage: 'nieuw', reached: 0, att: 0, gg: 0, tba: null, gesprek: null, reason: null, endedAt: null,
      lastAt: now, calls: [], log: [{ at: now, by: 'automatisch', what: `Gesolliciteerd via ${lead.src}` }], undo: null };
    f.save();
    return { cand: c, dup: false };
  }

  const moveTo = (c, to, now) => {
    if (CALL_STAGES.slice(0, 2).includes(c.stage) && to !== c.stage && to !== 'nieuw' && to !== 'contact') callWeek(c, now);
    c.stage = to;
    c.reached = Math.max(c.reached || 0, STAGE_RANK[to] || 0);
    c.endedAt = END_STAGES.includes(to) ? now : null;
    if (to !== 'afgewezen') c.reason = null;
    if (to !== 'gesprek') c.gesprek = null;
  };
  const when = s => { const d = new Date(s); return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const SNAP = ['stage', 'reached', 'att', 'gg', 'tba', 'gesprek', 'reason', 'endedAt', 'calls'];

  /**
   * What a recruiter does with candidate id: { kind: 'geenGehoor' | 'tba' (text) | 'move' (to, at: for Gesprek) |
   * 'reject' (reason) | 'note' (text) | 'undo' }. A move or reject can be undone until the next action.
   */
  function act(actor, id, a = {}, now = Date.now()) {
    const c = mustGet(id), by = actor.name, before = Object.fromEntries(SNAP.map(k => [k, structuredClone(c[k])]));
    let undoable = false;
    switch (a.kind) {
      case 'geenGehoor':
        if (!CALL_STAGES.includes(c.stage)) fail('Geen gehoor kan alleen bij Nieuw, Contactpoging of Niet bereikbaar.');
        c.att = (c.att || 0) + 1; c.gg = now; callWeek(c, now);
        log(c, by, 'Geen gehoor', now);
        break;
      case 'tba': {
        const text = line(a.text, 120);
        if (!CALL_STAGES.includes(c.stage)) fail('Een TBA afspraak kan alleen bij Nieuw, Contactpoging of Niet bereikbaar.');
        c.tba = { at: now, text }; callWeek(c, now);
        log(c, by, `TBA afspraak${text ? ': ' + text : ''}`, now);
        break;
      }
      case 'move': {
        const to = a.to;
        if (!STAGE_KEYS.includes(to) || to === 'afgewezen') fail('Kies een kolom.');
        if (to === c.stage) fail(`${c.name} staat al in ${stageName(to)}.`);
        let at = null;
        if (to === 'gesprek') { at = Date.parse(a.at); if (!a.at || isNaN(at)) fail('Kies de datum en tijd van het gesprek.'); }
        moveTo(c, to, now);
        if (at) c.gesprek = at;
        log(c, by, `Naar ${stageName(to)}${at ? ` · ${when(at)}` : ''}`, now);
        undoable = true;
        break;
      }
      case 'reject':
        if (!REASONS.includes(a.reason)) fail('Kies een reden.');
        if (c.stage === 'afgewezen') fail(`${c.name} is al afgewezen.`);
        moveTo(c, 'afgewezen', now); c.reason = a.reason;
        log(c, by, `Afgewezen: ${a.reason}`, now);
        undoable = true;
        break;
      case 'note': {
        const text = line(a.text, 1000);
        if (!text) fail('Schrijf eerst een notitie.');
        log(c, by, `Notitie: ${text}`, now);
        break;
      }
      case 'undo':
        if (!c.undo) fail('Er is niets om ongedaan te maken.');
        Object.assign(c, c.undo); c.undo = null;
        log(c, by, `Ongedaan gemaakt: terug naar ${stageName(c.stage)}`, now);
        f.save();
        return c;
      default: fail('Onbekende actie.');
    }
    c.undo = undoable ? before : null;
    f.save();
    return c;
  }

  /** The candidates of campaign link, newest first. */
  const ofLink = link => Object.values(D.cands).filter(c => c.link === link).sort((a, b) => b.at - a.at);
  const all = () => Object.values(D.cands);

  /** Removes the personal data of the candidates whose term ended; keeps the anonymous counts. Returns how many. */
  function prune(now = Date.now()) {
    const gone = all().filter(c => (c.endedAt ? c.endedAt : c.lastAt) + KEEP_MS < now);
    for (const c of gone) {
      D.anon.push({ link: c.link, w: weekOf(c.at), reached: c.reached || 0, reason: c.stage === 'afgewezen' ? c.reason : null, calls: c.calls });
      delete D.cands[c.id];
    }
    if (gone.length) f.save();
    return gone.length;
  }
  /** Replaces a former team member's name in the timelines (see privacy.anonymise). */
  function rename(names, pseudonym) {
    let hit = false;
    for (const c of all()) for (const e of c.log) if (names.has(e.by)) { e.by = pseudonym; hit = true; }
    if (hit) f.save();
  }

  return { switched, newKey, linkOfKey, take, act, get: id => D.cands[id] || null, ofLink, all, anon: () => D.anon, prune, rename };
}
