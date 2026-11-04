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
 * the week they came in, how far they got, rejection reasons, gebeld: called that week) and live, today's call list.
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
