// Trello boards → campaigns. Used by the app (full boards) and the server (the snapshot for the home screens, see
// server/trelloSnapshot.js), so both count the same way.
//
// A campaign is a board ('*': linked as one campaign) or one label on it (a function). Its numbers per week come
// from the cards by application date (Sollicitatiedatum, else when the card was made); cards in a list with
// 'Informatie' in the name don't count. Archived cards count in their week, but not on today's call list.
import { CUR, weekOf } from './weeks.js';
import { RANK, MON_FIELDS, stageOf, cardTs } from './constants.js';

/** How many weeks a campaign shows, up to and including the feedback week. */
export const LIVE_WEEKS = 12;
const emptyTr = () => ({ nieuw: 0, gescreend: 0, gesprek: 0, voorgesteld: 0, geplaatst: 0, reasons: {} });

/**
 * Per campaign key ('*' or a label id): minW, the earliest week with a card; weeks, per week the new candidates,
 * how far they got (gescreend … geplaatst) and why they were rejected; live, the open cards in Nieuw and
 * Contactpoging now. A label without cards has no key.
 */
export function boardStats(bd) {
  const stg = {}; (bd.lists || []).forEach(l => { stg[l.id] = stageOf(l.name); });
  const cfs = bd.customFields || [], rf = cfs.find(f => /reden\s*afgewezen/i.test(f.name)), sd = cfs.find(f => /sollicitatiedatum/i.test(f.name)), ropt = {};
  ((rf && rf.options) || []).forEach(o => { ropt[o.id] = o.value && o.value.text; });
  const out = {};
  for (const c of bd.cards || []) {
    const stage = stg[c.idList];
    if (stage === 'info') continue;
    const it = c.customFieldItems || [], dv = sd && it.find(i => i.idCustomField === sd.id), rv = rf && it.find(i => i.idCustomField === rf.id);
    const w = weekOf(dv && dv.value && dv.value.date ? Date.parse(dv.value.date) : cardTs(c.id)), r = RANK[stage] || 0;
    const reason = rv ? (ropt[rv.idValue] || (rv.value && rv.value.text) || null) : null;
    for (const key of ['*', ...new Set(c.idLabels || [])]) {
      const s = out[key] || (out[key] = { minW: w, weeks: {}, live: { nieuw: 0, contact: 0 } });
      if (w < s.minW) s.minW = w;
      const t = s.weeks[w] || (s.weeks[w] = emptyTr());
      t.nieuw++;
      if (r >= 1) t.gescreend++;
      if (r >= 2) t.gesprek++;
      if (r >= 3) t.voorgesteld++;
      if (r >= 4) t.geplaatst++;
      if (reason) t.reasons[reason] = (t.reasons[reason] || 0) + 1;
      if (!c.closed && (stage === 'nieuw' || stage === 'contact')) s.live[stage]++;
    }
  }
  return out;
}

/**
 * Only what the home screens need (Weekoverzicht, Campagnes, Mijn campagnes, Live campagnes): new candidates per
 * week from week `from` on, and today's call list. No pipeline and no rejection reasons.
 */
export function quickStats(stats, from) {
  const out = {};
  for (const [key, s] of Object.entries(stats)) {
    const weeks = {};
    for (const [w, t] of Object.entries(s.weeks)) if (+w >= from && t.nieuw) weeks[w] = { nieuw: t.nieuw };
    out[key] = { minW: s.minW, weeks, live: { ...s.live } };
  }
  return out;
}

/**
 * The campaign of Trello link k: its numbers s (from boardStats or quickStats; undefined for a function without
 * cards) with the team's feedback f per week and the campaign changes acts. quick: s is the snapshot, so the
 * pipeline and rejection reasons are still loading.
 */
export function liveCampaign(k, s, f, acts, quick = false) {
  const minW = s ? s.minW : CUR, start = Math.max(CUR - LIVE_WEEKS + 1, Math.min(minW, CUR)), weeks = [];
  for (let w = start; w <= CUR; w++) {
    const tr = { ...emptyTr(), ...(s && s.weeks[w]) }, e = f[w] || {}, mon = {};
    MON_FIELDS.forEach(x => { if (e[x] !== undefined) mon[x] = e[x]; });
    weeks.push({ w, leads: e.leads ?? tr.nieuw, q: e.q ?? null, rec: e.rec || '', klant: e.klant || '', note: e.note || '', needsAction: !!e.needsAction, at: e.at || '', recBy: e.recBy, klantBy: e.klantBy, ...mon, tr });
  }
  return { id: k.id, boardId: k.boardId, client: k.boardName, vac: k.vac, rec: k.rec, start, ended: false, weeks, actions: acts, trello: true,
    live: s ? { ...s.live } : { nieuw: 0, contact: 0 }, ...(quick ? { quick: true } : {}) };
}
