// Trello boards → campaigns. Used by the app (full boards) and the server (the snapshot for the home screens, see
// server/trelloSnapshot.js), so both count the same way.
//
// A campaign is a board ('*': linked as one campaign) or one function on it. Its numbers per week come from the
// cards by application date (Sollicitatiedatum, else when the card was made); cards in a list with 'Informatie' in
// the name don't count. Archived cards count in their week, but not on today's call list.
//
// A function is an intake list ("Nieuwe Sollicitant | Kok", see intakeName) or a label. A card counts for the intake
// list it is in or came in through (idIntake: the server adds it from Trello's history), so it keeps its function
// after moving on to Contactpoging or Gescreend; the intake list goes before its labels. Only a card without one
// follows its labels. An intake list and a label with the same name are one function, under the label's id.
import { CUR, weekOf } from './weeks.js';
import { RANK, MON_FIELDS, stageOf, intakeName, cardTs } from './constants.js';

/** How many weeks a campaign shows, up to and including the feedback week. */
export const LIVE_WEEKS = 12;
const emptyTr = () => ({ nieuw: 0, gescreend: 0, gesprek: 0, voorgesteld: 0, geplaatst: 0, reasons: {} });
const norm = s => (s || '').trim().toLowerCase();
/** The key of a Trello link (a campaign) in boardStats: its label or intake list, or '*' for the whole board. */
export const linkKey = k => k.labelId || k.listId || '*';

/** of(card): the function keys a card counts for. fns: the functions of the open intake lists, one per name. */
function functions(bd) {
  const labelOf = {}, byName = {}, key = {}, fns = [];
  for (const l of bd.labels || []) if (l.name && !labelOf[norm(l.name)]) labelOf[norm(l.name)] = l.id;
  for (const l of bd.lists || []) {
    const name = intakeName(l.name);
    if (!name) continue;
    const label = labelOf[norm(name)] || null;
    key[l.id] = byName[norm(name)] || (byName[norm(name)] = label || l.id);
    if (!l.closed && !fns.some(f => f.id === key[l.id])) fns.push({ id: key[l.id], name, labelId: label, listId: l.id });
  }
  const of = c => { const via = key[c.idList] ? c.idList : c.idIntake; return via ? [key[via] || via] : c.idLabels || []; };
  return { of, fns };
}

/**
 * The functions on a board, for Toewijzing: its open intake lists (also while still empty) and its named labels
 * that have cards, each with the number of cards (Informatie not counted).
 */
export function boardFunctions(bd) {
  const stg = {}; (bd.lists || []).forEach(l => { stg[l.id] = stageOf(l.name); });
  const { of, fns } = functions(bd), n = {};
  for (const c of bd.cards || []) if (stg[c.idList] !== 'info') for (const k of new Set(of(c))) n[k] = (n[k] || 0) + 1;
  const out = fns.map(f => ({ ...f, cards: n[f.id] || 0 }));
  for (const l of bd.labels || []) if (l.name && n[l.id] && !out.some(f => f.id === l.id)) out.push({ id: l.id, name: l.name, labelId: l.id, listId: null, cards: n[l.id] });
  return out;
}

/** How many candidates (Informatie not counted) have no function: no intake list and no label. Trello test page. */
export function withoutFunction(bd) {
  const stg = {}; (bd.lists || []).forEach(l => { stg[l.id] = stageOf(l.name); });
  const { of } = functions(bd);
  return (bd.cards || []).filter(c => stg[c.idList] !== 'info' && !of(c).length).length;
}

/**
 * Per campaign key ('*', or a function: a label or intake list id): minW, the earliest week with a card; weeks, per week the new candidates,
 * how far they got (gescreend … geplaatst) and why they were rejected; live, the open cards in Nieuw and
 * Contactpoging now. A label without cards has no key.
 */
export function boardStats(bd) {
  const stg = {}; (bd.lists || []).forEach(l => { stg[l.id] = stageOf(l.name); });
  const fnsOf = functions(bd).of;
  const cfs = bd.customFields || [], rf = cfs.find(f => /reden\s*afgewezen/i.test(f.name)), sd = cfs.find(f => /sollicitatiedatum/i.test(f.name)), ropt = {};
  ((rf && rf.options) || []).forEach(o => { ropt[o.id] = o.value && o.value.text; });
  const out = {};
  for (const c of bd.cards || []) {
    const stage = stg[c.idList];
    if (stage === 'info') continue;
    const it = c.customFieldItems || [], dv = sd && it.find(i => i.idCustomField === sd.id), rv = rf && it.find(i => i.idCustomField === rf.id);
    const w = weekOf(dv && dv.value && dv.value.date ? Date.parse(dv.value.date) : cardTs(c.id)), r = RANK[stage] || 0;
    const reason = rv ? (ropt[rv.idValue] || (rv.value && rv.value.text) || null) : null;
    for (const key of ['*', ...new Set(fnsOf(c))]) {
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

/**
 * The campaigns of the Trello links L.links: from the full board (full[boardId], boardStats) once it's loaded, until
 * then from the snapshot (quick[boardId].stats). A board in neither shows no campaign yet. A board on Niet actief
 * keeps its campaigns for the Recruitment Marketeer, without a recruiter (inactive).
 */
export function liveCampaigns(L, full, quick) {
  const ina = L.inactive || {};
  return L.links.map(k => {
    const key = linkKey(k), f = L.fb[k.id] || {}, acts = L.actions[k.id] || [];
    const c = full[k.boardId] ? liveCampaign(k, full[k.boardId][key], f, acts)
      : quick[k.boardId] ? liveCampaign(k, quick[k.boardId].stats[key], f, acts, true) : null;
    return c && ina[k.boardId] ? { ...c, rec: '', inactive: true } : c;
  }).filter(Boolean);
}
