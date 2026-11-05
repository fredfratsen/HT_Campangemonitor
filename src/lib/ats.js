// The app's own candidate pipeline (ATS), for campaigns switched over from Trello in Toewijzing. Shared by the server
// (server/candidates.js keeps the candidates) and the app (the board), so both use the same stages and count the same
// way as Trello (lib/boardStats.js).
import { weekOf } from './weeks.js';

/** The columns of the board, in order. Afgewezen is a tile that opens a column of its own. */
export const STAGES = [
  ['nieuw', 'Nieuw'], ['contact', 'Contactpoging'], ['nb', 'Niet bereikbaar'], ['gescreend', 'Gescreend'],
  ['gesprek', 'Gesprek'], ['voorstel', 'Voorstel'], ['aangenomen', 'Aangenomen'], ['afgewezen', 'Afgewezen']
];
export const STAGE_KEYS = STAGES.map(s => s[0]);
export const stageName = k => (STAGES.find(s => s[0] === k) || [k, k])[1];
/** How far a stage got, as in Trello (RANK in constants.js): gescreend 1 … geplaatst 4. */
export const STAGE_RANK = { gescreend: 1, gesprek: 2, voorstel: 3, aangenomen: 4 };
/** Still to be called: Geen gehoor and TBA afspraak work here. */
export const CALL_STAGES = ['nieuw', 'contact', 'nb'];
/** Done with: the 4 weeks of keeping the data start here. */
export const END_STAGES = ['afgewezen', 'aangenomen'];
/** Geen gehoor this often, and the panel offers Naar Niet bereikbaar (the recruiter moves it, never the app). */
export const MAX_ATTEMPTS = 3;
/** How long a candidate's personal data is kept after they're done with, or after the last action in an open stage. */
export const KEEP_MS = 28 * 864e5;

const midnight = now => new Date(now).setHours(0, 0, 0, 0);
/** Got ‘Geen gehoor’ or a ‘TBA afspraak’ today: off today's call list until midnight, as in Trello. */
export const calledToday = (c, now = Date.now()) => Math.max(c.gg || 0, (c.tba && c.tba.at) || 0) >= midnight(now);

/**
 * Per switched campaign (link id) the numbers boardStats gives per Trello function: minW, weeks (new candidates by
 * the week they came in, how far they got, rejection reasons, gebeld: called that week) and live, today's call list;
 * uit (only when there is one): when a candidate last left Nieuw/Contactpoging.
 * cands: the candidates still kept; anon: what is left of the ones past their term (no live numbers).
 */
export function atsStats(cands, anon = [], now = Date.now()) {
  const out = {};
  const of = link => out[link] || (out[link] = { minW: Infinity, weeks: {}, live: { nieuw: 0, contact: 0, gebeld: 0 } });
  const week = (s, w) => s.weeks[w] || (s.weeks[w] = { nieuw: 0, gescreend: 0, gesprek: 0, voorgesteld: 0, geplaatst: 0, gebeld: 0, reasons: {} });
  const count = (link, w, reached, reason, calls) => {
    const s = of(link), t = week(s, w);
    if (w < s.minW) s.minW = w;
    t.nieuw++;
    if (reached >= 1) t.gescreend++;
    if (reached >= 2) t.gesprek++;
    if (reached >= 3) t.voorgesteld++;
    if (reached >= 4) t.geplaatst++;
    if (reason) t.reasons[reason] = (t.reasons[reason] || 0) + 1;
    for (const cw of new Set(calls || [])) week(s, cw).gebeld++;
    return s;
  };
  for (const a of anon) count(a.link, a.w, a.reached || 0, a.reason, a.calls);
  for (const c of cands) {
    const s = count(c.link, weekOf(c.at), c.reached || 0, c.stage === 'afgewezen' ? c.reason : null, c.calls);
    if (c.stage === 'nieuw' || c.stage === 'contact') s.live[calledToday(c, now) ? 'gebeld' : c.stage]++;
    if (c.uitAt > (s.uit || 0)) s.uit = c.uitAt;
  }
  return out;
}

/**
 * The numbers of a campaign from Trello (t) and from the ATS (a), added up: a switched campaign still has the Trello
 * cards from before. Either may be undefined.
 */
export function addStats(t, a) {
  if (!a) return t;
  if (!t) return a;
  const weeks = { ...t.weeks };
  for (const [w, x] of Object.entries(a.weeks)) {
    const y = weeks[w];
    if (!y) { weeks[w] = x; continue; }
    const reasons = { ...(y.reasons || {}) };
    for (const [r, n] of Object.entries(x.reasons || {})) reasons[r] = (reasons[r] || 0) + n;
    weeks[w] = { ...y, ...Object.fromEntries(['nieuw', 'gescreend', 'gesprek', 'voorgesteld', 'geplaatst', 'gebeld'].map(k => [k, (y[k] || 0) + (x[k] || 0)])), reasons };
  }
  const live = Object.fromEntries(['nieuw', 'contact', 'gebeld'].map(k => [k, ((t.live || {})[k] || 0) + (a.live[k] || 0)]));
  return { minW: Math.min(t.minW, a.minW), weeks, live };
}

/** The screening form a recruiter fills in before passing a candidate on: the fields in order, as in the Trello card. */
export const SCREENING = [
  { key: 'talen', emoji: '🗣️', label: 'Talenkennis', kind: 'text', required: true },
  { key: 'ervaring', emoji: '💼', label: 'Werkervaring / opleiding / vakkennis', kind: 'long', required: true },
  { key: 'situatie', emoji: '🏢', label: 'Huidige werkgever / situatie', kind: 'text', required: true },
  { key: 'beschikbaar', emoji: '📅', label: 'Beschikbaarheid', kind: 'text', required: true },
  { key: 'leeftijd', emoji: '🎂', label: 'Leeftijd', kind: 'age', required: false },
  { key: 'diplomas', emoji: '🎓', label: 'Diploma\'s / certificaten', kind: 'text', required: false,
    placeholder: 'Bijv. koksopleiding, SVH Leermeester, Sociale Hygiëne, HACCP, BHV, Allergenenkennis, etc.' },
  { key: 'woonplaats', emoji: '📍', label: 'Woonplaats', kind: 'text', required: true },
  { key: 'rijbewijs', emoji: '🚘', label: 'Rijbewijs', kind: 'choice', required: true, options: ['B', 'Nee', 'Anders'], other: 'Anders', otherLabel: 'Anders, namelijk' },
  { key: 'vervoer', emoji: '🚗', label: 'Eigen vervoer', kind: 'choice', required: true, options: ['Ja', 'Nee'], other: 'Nee', otherLabel: 'Reist met' },
  { key: 'extra', emoji: '📝', label: 'Extra info / motivatie', kind: 'long', required: false },
  { key: 'advies', emoji: '➡️', label: 'Advies', kind: 'long', required: true }
];

/** Only the known screening keys, each cut to its kind: one-line text, multi-line text, age 14-99 or null, choice. */
export function cleanScreening(input) {
  const i = input && typeof input === 'object' ? input : {};
  const one = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const out = {};
  for (const f of SCREENING) {
    const v = i[f.key];
    if (f.kind === 'text') out[f.key] = one(v, 200);
    else if (f.kind === 'long') out[f.key] = String(v ?? '').trim().slice(0, 1000);
    else if (f.kind === 'age') { const n = Number(v); out[f.key] = v !== '' && v != null && Number.isInteger(n) && n >= 14 && n <= 99 ? n : null; }
    else {
      const keuze = v && f.options.includes(v.keuze) ? v.keuze : '';
      out[f.key] = { keuze, tekst: keuze === f.other ? one(v.tekst, 200) : '' };
    }
  }
  return out;
}

/** The labels of the required fields still empty (a choice on its "other" option also needs its text), in form order. */
export function screeningMissing(s) {
  const x = s || {};
  return SCREENING.filter(f => {
    if (!f.required) return false;
    const v = x[f.key];
    if (f.kind !== 'choice') return !String(v ?? '').trim();
    return !v || !v.keuze || (v.keuze === f.other && !String(v.tekst ?? '').trim());
  }).map(f => f.label);
}

/** The screening as the recruiters paste it: the name, then a block "emoji label:" plus the value per field. */
export function screeningText(s, name) {
  const x = s || {};
  const blocks = SCREENING.map(f => {
    const v = x[f.key];
    let val = '';
    if (f.kind === 'choice') {
      if (v && v.keuze) {
        val = v.keuze;
        if (v.keuze === f.other) val = f.key === 'vervoer' ? `Nee → reist met: ${v.tekst || ''}` : `${f.otherLabel}: ${v.tekst || ''}`;
      }
    } else val = v == null ? '' : String(v);
    return `${f.emoji} ${f.label}:\n${val}`;
  });
  return [name, ...blocks].join('\n\n');
}

/** The stages a client sees once the recruiter passed the candidate on. */
export const CLIENT_STAGES = ['gescreend', 'gesprek', 'voorstel', 'aangenomen', 'afgewezen'];
/** Working days a client may take to react before the candidate counts as waiting too long. */
export const CLIENT_WAIT_DAYS = 3;
/** Whether the client portal shows this candidate. */
export const visibleToClient = c => !!c.doorgezetOp && CLIENT_STAGES.includes(c.stage);
/** Since when a passed-on candidate waits for the client (doorgezetOp), or null if not waiting (not gescreend, or the client reacted). */
export const waitingSince = c => (c.stage === 'gescreend' && c.doorgezetOp && !(c.klantAt >= c.doorgezetOp) ? c.doorgezetOp : null);
/** How many questions of the client the recruiter has not answered yet. */
export const openQuestions = c => (c.vragen || []).filter(q => !q.antwoord).length;
/** Mon-Fri days after the calendar day of from, up to and including the day of now. */
export function workdaysSince(from, now) {
  const d = new Date(midnight(from)), end = midnight(now);
  let n = 0;
  for (d.setDate(d.getDate() + 1); d.getTime() <= end; d.setDate(d.getDate() + 1)) if (d.getDay() % 6) n++;
  return n;
}
