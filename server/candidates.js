// The ATS: candidates of the campaigns switched over from Trello (Toewijzing › Omzetten naar ATS). These are personal
// data, so they are kept apart from the shared team data, like the blacklist: their own document
// (DATA_DIR/candidates.json), only reachable through /api/kandidaten, and never part of /api/state.
//
// - A switched campaign (a Trello link, by its id) has an intake key: Zapier posts each Meta lead to
//   /api/intake/<key>. Only its hash is kept; a new key replaces the old one.
// - The open cards a switched campaign still has in Trello come over too (takeTrello): name and description are read
//   from Trello for those cards only. The cards stay in Trello, but the app leaves them out of its numbers from then
//   on (fromTrello, by card id), so nobody counts twice.
// - Geen gehoor never moves a candidate, also not the third time: the recruiter moves them (lib/ats.js).
// - Four weeks after a candidate is done with (Afgewezen, Aangenomen), or four weeks after the last action in an open
//   stage, the personal data goes (prune). What stays is anonymous: campaign, week, how far they got, the rejection
//   reason and the weeks they were called in, so the monitor's numbers stay the same (atsStats).
import { randomToken, sha256 } from './crypto.js';
import { normEmail, normPhone } from './blacklist.js';
import { visibleToClient, STAGE_KEYS, STAGE_RANK, CALL_STAGES, END_STAGES, KEEP_MS, stageName, cleanScreening, screeningMissing } from '../src/lib/ats.js';
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

/** The name, phone and email a recruiter or the intake gives → the cleaned values. Throws when they don't hold up. */
function checkContact({ name, phone, email }) {
  name = line(name, 80); phone = line(phone, 30); email = normEmail(email);
  if (!name) fail('Naam ontbreekt (veld naam, name of full_name).');
  if (!phone && !email) fail('Telefoonnummer of e-mailadres ontbreekt.');
  if (phone && normPhone(phone).length < 9) fail('Het telefoonnummer klopt niet.');
  if (email && !validEmail(email)) fail('Het e-mailadres klopt niet.');
  return { name, phone: phone || null, email: email || null };
}

/** A lead as Zapier sends it → { name, phone, email, src, answers }. Throws when there's no name or no way to reach them. */
export function parseLead(body) {
  const b = Object.fromEntries(Object.entries(body && typeof body === 'object' ? body : {}).map(([k, v]) => [k.trim().toLowerCase(), v]));
  const name = line(pick(b, NAME_KEYS) || [b.first_name || b.voornaam, b.last_name || b.achternaam].filter(Boolean).join(' '), 80);
  const src = line(pick(b, SRC_KEYS), 40) || 'Meta';
  const { phone, email } = checkContact({ name, phone: pick(b, PHONE_KEYS), email: pick(b, EMAIL_KEYS) });
  const used = new Set([...NAME_KEYS, ...PHONE_KEYS, ...EMAIL_KEYS, ...SRC_KEYS, ...SKIP]);
  const answers = Object.entries(body || {}).filter(([k, v]) => !used.has(k.trim().toLowerCase()) && v != null && typeof v !== 'object' && String(v).trim())
    .slice(0, MAX_ANSWERS).map(([k, v]) => [line(k.replace(/_/g, ' '), 120), line(v, 500)]);
  return { name, phone, email, src, answers };
}

/**
 * The description of a Trello card (as Zapier wrote it, lines like "Telefoon: 06…") → { phone, email, answers }.
 * Markdown is dropped; a description without such lines is kept as one answer.
 */
export function parseDesc(desc) {
  const text = String(desc || '').replace(/[*_`>#]/g, ''), answers = [];
  let phone = '', email = '';
  for (const raw of text.split('\n')) {
    const m = /^\s*[-•]?\s*([^:]{1,80}):\s*(.+)$/.exec(raw);
    if (!m) continue;
    const k = m[1].trim(), v = line(m[2], 500);
    if (/tel|phone|mobiel|gsm/i.test(k) && !phone && normPhone(v).length >= 9) phone = v;
    else if (/mail/i.test(k) && !email && validEmail(normEmail(v))) email = normEmail(v);
    else if (!/^(naam|name|full name|volledige naam|voornaam|achternaam)$/i.test(k) && answers.length < MAX_ANSWERS) answers.push([line(k, 120), v]);
  }
  if (!email) { const m = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i.exec(text); if (m) email = normEmail(m[0]); }
  if (!phone) { const m = /(?:\+|\b0)[\d\s()-]{8,16}\d/.exec(text); if (m && normPhone(m[0]).length >= 9) phone = line(m[0], 30); }
  if (!answers.length && text.trim()) answers.push(['Beschrijving uit Trello', line(text, 1000)]);
  return { phone: phone ? line(phone, 30) : null, email: email || null, answers };
}
/** Trello's stages (stageOf in constants.js) → the board's columns; Afgewezen and Aangenomen stay in Trello. */
const FROM_TRELLO = { nieuw: 'nieuw', contact: 'contact', gescreend: 'gescreend', gesprek: 'gesprek', voorgesteld: 'voorstel' };
export const trelloStage = (stage, list) => FROM_TRELLO[stage] || (stage === 'overig' && /bereikbaar/i.test(list) ? 'nb' : null);

/** @param docs  document factory from jsonfile.js */
export function createCandidates(docs) {
  const f = docs('candidates', () => ({ links: {}, cands: {}, anon: [], trello: {} }));
  const D = f.data;
  for (const k of ['links', 'cands', 'trello']) if (!D[k]) D[k] = {};
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
  const log = (c, by, what, now, extra) => { c.log.unshift({ at: now, by, what, ...extra }); c.lastAt = now; };
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

  /** The Trello cards taken over on board boardId: from then on the app leaves them out of Trello's numbers. */
  const fromTrello = boardId => new Set(D.trello[boardId] || []);
  /**
   * Takes over the open Trello cards of campaign link on board boardId: [{ card, list, stage, at, name, desc }] (see
   * cardsOf in lib/boardStats.js). They keep when they applied, how far they got and the weeks they were called in,
   * so the numbers stay the same. A card already taken over isn't added again. Returns how many were added.
   */
  function takeTrello(actor, link, boardId, cards, now = Date.now()) {
    const done = fromTrello(boardId);
    let n = 0;
    for (const x of cards) {
      const stage = trelloStage(x.stage, x.list);
      if (!stage || done.has(x.card.id)) continue;
      done.add(x.card.id);
      const name = line(x.name, 80) || 'Naam onbekend', { phone, email, answers } = parseDesc(x.desc);
      const at = isNaN(x.at) ? now : x.at, gg = Date.parse(x.card.geenGehoor) || 0, id = 'k' + now.toString(36) + randomToken(4).replace(/[-_]/g, 'x');
      D.cands[id] = { id, link, name, phone, email, src: 'Trello', answers, at, stage, reached: STAGE_RANK[stage] || 0, att: 0, gg, tba: null, gesprek: null,
        reason: null, endedAt: null, lastAt: now, calls: [...(x.card.calls || [])], undo: null,
        log: [{ at: now, by: actor.name, what: `Overgehaald uit Trello (${line(x.list, 60)})` }, { at, by: 'automatisch', what: 'Gesolliciteerd (Trello)' }] };
      n++;
    }
    D.trello[boardId] = [...done];
    f.save();
    return n;
  }

  const moveTo = (c, to, now) => {
    // uitAt: when it left Nieuw/Contactpoging, so a paused board stays with its recruiter until midnight (recruiterSees)
    if (CALL_STAGES.slice(0, 2).includes(c.stage) && to !== c.stage && to !== 'nieuw' && to !== 'contact') { callWeek(c, now); c.uitAt = now; }
    c.stage = to;
    c.reached = Math.max(c.reached || 0, STAGE_RANK[to] || 0);
    c.endedAt = END_STAGES.includes(to) ? now : null;
    if (to !== 'afgewezen') c.reason = null;
    if (to !== 'gesprek') c.gesprek = null;
  };
  const when = s => { const d = new Date(s); return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  /** Screening draft: one timeline line per half hour from the same person. */
  const setScreening = (c, by, input, now) => {
    c.screening = cleanScreening(input);
    const top = c.log[0];
    if (top && top.what === 'Screening bijgewerkt' && top.by === by && now - top.at < 30 * 60e3) c.lastAt = now;
    else log(c, by, 'Screening bijgewerkt', now);
  };
  const setContact = (c, by, v, now) => {
    const ch = [['Naam', c.name, v.name, 'name'], ['Telefoon', c.phone, v.phone, 'phone'], ['E-mail', c.email, v.email, 'email']].filter(x => (x[1] || '') !== (x[2] || ''));
    for (const x of ch) c[x[3]] = x[2];
    log(c, by, ch.length ? ch.map(x => `${x[0]}: ${x[1] || '–'} → ${x[2] || '–'}`).join('; ') : 'Gegevens gecontroleerd', now);
  };
  const needScreening = s => { const m = screeningMissing(s); if (m.length) fail(`Vul eerst de screening in: ${m.join(', ')}.`); };
  const SNAP = ['stage', 'reached', 'att', 'gg', 'tba', 'gesprek', 'reason', 'endedAt', 'calls', 'uitAt'];

  /**
   * What a recruiter does with candidate id: { kind: 'geenGehoor' | 'tba' (text) | 'move' (to, at: for Gesprek) |
   * 'reject' (reason) | 'note' (text) | 'screening' | 'contact' | 'doorzetten' | 'undo' }. A move or reject can be undone until the next action.
   */
  function act(actor, id, a = {}, now = Date.now()) {
    const c = mustGet(id), by = actor.name, before = Object.fromEntries(SNAP.map(k => [k, structuredClone(c[k])]));
    let undoable = false, keepUndo = false;
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
        // Checked before anything changes, so a refused move leaves the card as it was
        const contact = a.contact && checkContact(a.contact), screening = a.screening && cleanScreening(a.screening);
        const gated = STAGE_RANK[to] >= 1 && CALL_STAGES.includes(c.stage);
        if (gated) needScreening(screening || c.screening);
        let at = null;
        if (to === 'gesprek') { at = Date.parse(a.at); if (!a.at || isNaN(at)) fail('Kies de datum en tijd van het gesprek.'); }
        if (contact) setContact(c, by, contact, now);
        if (screening) setScreening(c, by, screening, now);
        moveTo(c, to, now);
        if (at) c.gesprek = at;
        log(c, by, `Naar ${stageName(to)}${at ? ` · ${when(at)}` : ''}`, now);
        if (gated && !c.doorgezetOp) { c.doorgezetOp = now; log(c, by, 'Doorgezet naar klant', now); }
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
      case 'screening':
        setScreening(c, by, a.screening, now); keepUndo = true;
        break;
      case 'contact':
        setContact(c, by, checkContact(a), now); keepUndo = true;
        break;
      case 'doorzetten':
        if (!(STAGE_RANK[c.stage] >= 1)) fail('Doorzetten kan pas vanaf Gescreend.');
        if (c.doorgezetOp) fail(`${c.name} ligt al bij de klant.`);
        needScreening(c.screening);
        c.doorgezetOp = now; log(c, by, 'Doorgezet naar klant', now); keepUndo = true;
        break;
      case 'antwoord': {
        const text = line(a.text, 1000), q = (c.vragen || []).find(x => x.id === a.vraagId);
        if (!q) fail('Deze vraag bestaat niet (meer).');
        if (q.antwoord) fail('Deze vraag is al beantwoord.');
        if (!text) fail('Schrijf eerst een antwoord.');
        q.antwoord = { at: now, door: by, tekst: text };
        log(c, by, `Antwoord aan klant: ${text}`, now); // clears the undo: it would revert the recruiter's move under an open question
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
    if (!keepUndo) c.undo = undoable ? before : null;
    f.save();
    return c;
  }

  /**
   * What the client does with a candidate handed over (see visibleToClient), through the portal of campaign linkId:
   * { kind: 'geenGehoor' | 'gesprek' (at) | 'aangenomen' | 'afwijzen' (reason) | 'opmerking' (text) | 'vraag' (text) },
   * door = { naam, organisatie }. Returns null when the candidate isn't there for this client. Not undoable.
   */
  function klantAct(linkId, id, a = {}, door = {}, now = Date.now()) {
    const c = D.cands[id];
    if (!c || c.link !== linkId || !visibleToClient(c)) return null;
    const naam = line(door.naam, 80), org = line(door.organisatie, 80);
    if (!naam || !org) fail('Wie de actie deed ontbreekt.');
    const by = `${org} · ${naam}`, say = what => log(c, by, what, now, { klant: true });
    const text = () => { const t = line(a.text, 1000); if (!t) fail('Schrijf eerst een tekst.'); return t; };
    switch (a.kind) {
      case 'geenGehoor':
        c.klantGg = (c.klantGg || 0) + 1; say('Gebeld, geen gehoor');
        break;
      case 'gesprek': {
        if (!['gescreend', 'gesprek'].includes(c.stage)) fail('Een gesprek plannen kan alleen bij Gescreend of Gesprek.');
        const at = Date.parse(a.at);
        if (!a.at || isNaN(at)) fail('Kies de datum en tijd van het gesprek.');
        const again = c.stage === 'gesprek';
        moveTo(c, 'gesprek', now); c.gesprek = at; c.undo = null;
        say(`${again ? 'Nog een gesprek' : 'Op gesprek'} · ${when(at)}`);
        break;
      }
      case 'aangenomen':
        if (['aangenomen', 'afgewezen'].includes(c.stage)) fail(`${c.name} is al afgerond.`);
        moveTo(c, 'aangenomen', now); c.undo = null;
        say('Aangenomen');
        break;
      case 'afwijzen':
        if (!REASONS.includes(a.reason)) fail('Kies een reden.');
        if (c.stage === 'afgewezen') fail(`${c.name} is al afgewezen.`);
        moveTo(c, 'afgewezen', now); c.reason = a.reason; c.undo = null;
        say(`Afgewezen: ${a.reason}`);
        break;
      case 'opmerking':
        say(`Opmerking: ${text()}`);
        break;
      case 'vraag': {
        const tekst = text();
        (c.vragen ||= []).push({ id: 'v' + now.toString(36) + randomToken(3), at: now, door: by, tekst, antwoord: null });
        say(`Vraag: ${tekst}`);
        break;
      }
      default: fail('Onbekende actie.');
    }
    c.undo = null; // any client action: an undo would revert the recruiter's earlier move
    c.klantAt = now;
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
    for (const c of all()) {
      for (const e of c.log) if (names.has(e.by)) { e.by = pseudonym; hit = true; }
      for (const q of c.vragen || []) if (q.antwoord && names.has(q.antwoord.door)) { q.antwoord.door = pseudonym; hit = true; }
    }
    if (hit) f.save();
  }

  return { switched, newKey, linkOfKey, take, fromTrello, takeTrello, act, klantAct, get: id => D.cands[id] || null, ofLink, all, anon: () => D.anon, prune, rename };
}
