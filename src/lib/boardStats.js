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
//
// On a board with open intake lists, a label is no function of its own any more: only together with an intake list
// (of its name, or one its campaign was moved to), or while it still has a campaign, until that is moved to an
// intake list or stopped. A campaign moved to an intake list (Overzetten in Toewijzing: joinList on the link) counts
// that list under its own key, so it keeps its feedback and the cards of its old label or archived list.
import { CUR, countWeek } from './weeks.js';
import { RANK, MON_FIELDS, stageOf, intakeName, cardTs } from './constants.js';
import { addStats, emptyTr, tally } from './ats.js';

/** How many weeks a campaign shows, up to and including the feedback week. */
export const LIVE_WEEKS = 12;
const norm = s => (s || '').trim().toLowerCase();
/** The key of a Trello link (a campaign) in boardStats: its label or intake list, or '*' for the whole board. */
export const linkKey = k => k.labelId || k.listId || '*';

/**
 * of(card): the function keys a card counts for. fns: the functions of the open intake lists, one per name. links:
 * the board's Trello links (campaigns), for the ones moved to an intake list and the labels that still have one.
 */
function functions(bd, links = []) {
  const labelOf = {}, isLabel = new Set(), byName = {}, key = {}, fns = [], join = {};
  for (const l of bd.labels || []) { isLabel.add(l.id); if (l.name && !labelOf[norm(l.name)]) labelOf[norm(l.name)] = l.id; }
  for (const k of links) if (k.joinList && linkKey(k) !== '*') join[k.joinList] = linkKey(k);
  for (const l of bd.lists || []) {
    const name = intakeName(l.name), n = norm(name);
    if (!name) continue;
    key[l.id] = join[l.id] || byName[n] || (byName[n] = labelOf[n] || l.id);
    if (!l.closed && !fns.some(f => f.id === key[l.id])) fns.push({ id: key[l.id], name, labelId: isLabel.has(key[l.id]) ? key[l.id] : null, listId: l.id });
  }
  const fnLabel = fns.length ? new Set([...Object.values(key), ...links.map(linkKey)]) : null;
  const of = c => { const via = key[c.idList] ? c.idList : c.idIntake; return via ? [key[via] || via] : (c.idLabels || []).filter(id => !fnLabel || fnLabel.has(id)); };
  return { of, fns };
}

/**
 * The functions on a board, for Toewijzing: its open intake lists (also while still empty) and its named labels
 * that have cards (on a board with intake lists only those that still have a campaign), each with the number of
 * cards (Informatie not counted). links: the board's Trello links.
 */
export function boardFunctions(bd, links = []) {
  const stg = {}; (bd.lists || []).forEach(l => { stg[l.id] = stageOf(l.name); });
  const { of, fns } = functions(bd, links), n = {};
  for (const c of bd.cards || []) if (stg[c.idList] !== 'info') for (const k of new Set(of(c))) n[k] = (n[k] || 0) + 1;
  const out = fns.map(f => ({ ...f, cards: n[f.id] || 0 }));
  for (const l of bd.labels || []) if (l.name && n[l.id] && !out.some(f => f.id === l.id)) out.push({ id: l.id, name: l.name, labelId: l.id, listId: null, cards: n[l.id] });
  return out;
}

/**
 * How many candidates (Informatie not counted) have no function: no intake list and no label (on a board with intake
 * lists: no intake list, and no label of one). Trello test page.
 */
export function withoutFunction(bd) {
  const stg = {}; (bd.lists || []).forEach(l => { stg[l.id] = stageOf(l.name); });
  const { of } = functions(bd);
  return (bd.cards || []).filter(c => stg[c.idList] !== 'info' && !of(c).length).length;
}

/**
 * Per campaign key ('*', or a function: a label or intake list id): minW, the earliest week with a card; weeks, per week the new candidates,
 * how far they got (gescreend … geplaatst), why they were rejected, and gebeld: the cards called that week (calls and
 * friCalls, from the server: a ‘Geen gehoor’ or ‘TBA afspraak’, or moved on from Nieuw or Contactpoging), whatever week
 * they applied in, with what happened on the Friday by time (see tally in ats.js); live, the open cards in Nieuw and
 * Contactpoging now, and gebeld: those of them that got a ‘Geen gehoor’ or ‘TBA afspraak’ today (geenGehoor, from the
 * server), which are off today's call list until midnight. A label without cards has no key.
 * links: the board's Trello links (see functions).
 */
export function boardStats(bd, now = Date.now(), links = []) {
  const stg = {}; (bd.lists || []).forEach(l => { stg[l.id] = stageOf(l.name); });
  const today = new Date(now).setHours(0, 0, 0, 0), calledToday = c => !!c.geenGehoor && Date.parse(c.geenGehoor) >= today;
  const fnsOf = functions(bd, links).of;
  const cfs = bd.customFields || [], rf = cfs.find(f => /reden\s*afgewezen/i.test(f.name)), sd = cfs.find(f => /sollicitatiedatum/i.test(f.name)), ropt = {};
  ((rf && rf.options) || []).forEach(o => { ropt[o.id] = o.value && o.value.text; });
  const out = {};
  for (const c of bd.cards || []) {
    const stage = stg[c.idList];
    if (stage === 'info') continue;
    const it = c.customFieldItems || [], dv = sd && it.find(i => i.idCustomField === sd.id), rv = rf && it.find(i => i.idCustomField === rf.id);
    const at = dv && dv.value && dv.value.date ? Date.parse(dv.value.date) : cardTs(c.id), w = countWeek(at), r = RANK[stage] || 0;
    const reason = rv ? (ropt[rv.idValue] || (rv.value && rv.value.text) || null) : null;
    for (const key of ['*', ...new Set(fnsOf(c))]) {
      const s = out[key] || (out[key] = { minW: w, weeks: {}, live: { nieuw: 0, contact: 0, gebeld: 0 } });
      tally(s, w, at, r, reason, c.calls, c.friCalls);
      if (!c.closed && (stage === 'nieuw' || stage === 'contact')) s.live[calledToday(c) ? 'gebeld' : stage]++;
    }
  }
  return out;
}

/**
 * The open cards of campaign key (as in boardStats) on board bd, Informatie not counted, as [{ card, list, stage, at }]:
 * the list's name and stage, and when the candidate applied (Sollicitatiedatum, else when the card was made). For
 * the cards a switched campaign takes over from Trello (server/candidates.js).
 */
export function cardsOf(bd, key, links = []) {
  const lists = {}; (bd.lists || []).forEach(l => { lists[l.id] = l; });
  const fnsOf = functions(bd, links).of, sd = (bd.customFields || []).find(f => /sollicitatiedatum/i.test(f.name));
  return (bd.cards || []).filter(c => !c.closed && lists[c.idList] && stageOf(lists[c.idList].name) !== 'info' && (key === '*' || fnsOf(c).includes(key))).map(c => {
    const dv = sd && (c.customFieldItems || []).find(i => i.idCustomField === sd.id), l = lists[c.idList];
    return { card: c, list: l.name, stage: stageOf(l.name), at: dv && dv.value && dv.value.date ? Date.parse(dv.value.date) : cardTs(c.id) };
  });
}

/**
 * Only what the home screens need (Weekoverzicht, Campagnes, Live campagnes): new candidates and
 * cards called per week from week `from` on (whether a week asks feedback, see checkin.js), with the times of what
 * happened on the Friday (see afterRound), and today's call list. No pipeline and no rejection reasons.
 */
export function quickStats(stats, from) {
  const out = {};
  for (const [key, s] of Object.entries(stats)) {
    const weeks = {};
    for (const [w, t] of Object.entries(s.weeks)) if (+w >= from && (t.nieuw || t.gebeld)) weeks[w] = { nieuw: t.nieuw, ...(t.gebeld ? { gebeld: t.gebeld } : {}),
      ...(t.fri ? { fri: t.fri.map(([at]) => [at]) } : {}), ...(t.friCalls ? { friCalls: t.friCalls } : {}) };
    out[key] = { minW: s.minW, weeks, live: { ...s.live } };
  }
  return out;
}

/**
 * When each recruiter did their feedback round, per week: { [rec]: { [w]: ms } }, the first time they gave feedback on
 * week w on any of their campaigns (recAt). A campaign with nothing to give that morning gets no feedback, so it goes
 * by the round of its recruiter.
 */
export function feedbackRounds(L) {
  const out = {};
  for (const k of L.links) {
    if (!k.rec) continue;
    for (const [w, e] of Object.entries(L.fb[k.id] || {})) {
      if (!e.recAt) continue;
      const r = out[k.rec] || (out[k.rec] = {});
      if (!(r[w] <= e.recAt)) r[w] = e.recAt;
    }
  }
  return out;
}

/**
 * The numbers per week (weeks, as in boardStats) once the recruiter did the round: what came in or was called on the
 * Friday of week w at or after cut(w) (see feedbackRounds) counts for the week after, like the weekend. A round
 * before that Friday moves the whole Friday. So the round is done: nothing that Friday makes the week ask feedback
 * after all. Only the weeks where something moved are new objects.
 */
export function afterRound(weeks, cut) {
  const out = { ...weeks }, own = new Set();
  const get = w => { if (!own.has(w)) { own.add(w); out[w] = { ...emptyTr(), ...out[w], reasons: { ...(out[w] || {}).reasons } }; } return out[w]; };
  for (const [key, t] of Object.entries(weeks)) {
    const w = +key, at = cut(w);
    if (at == null) continue;
    for (const [ts, r = 0, reason] of t.fri || []) {
      if (ts < at) continue;
      const a = get(w), b = get(w + 1);
      for (const [k, min] of [['nieuw', 0], ['gescreend', 1], ['gesprek', 2], ['voorgesteld', 3], ['geplaatst', 4]]) if (r >= min) { a[k]--; b[k]++; }
      if (reason) { if (!--a.reasons[reason]) delete a.reasons[reason]; b.reasons[reason] = (b.reasons[reason] || 0) + 1; }
    }
    for (const [first, last] of t.friCalls || []) {
      if (first >= at) get(w).gebeld--;
      if (last >= at) get(w + 1).gebeld++;
    }
  }
  return out;
}

/**
 * The campaign of Trello link k: its numbers s (from boardStats or quickStats; undefined for a function without
 * cards) with the team's feedback f per week and the campaign changes acts. quick: s is the snapshot, so the
 * pipeline and rejection reasons are still loading. cut: when its recruiter did the round of a week (afterRound).
 */
export function liveCampaign(k, s, f, acts, quick = false, cut = () => null) {
  const minW = s ? s.minW : CUR, start = Math.max(CUR - LIVE_WEEKS + 1, Math.min(minW, CUR)), weeks = [], ws = s ? afterRound(s.weeks, cut) : {};
  for (let w = start; w <= CUR; w++) {
    const { fri, friCalls, ...nums } = ws[w] || {}, tr = { ...emptyTr(), ...nums }, e = f[w] || {}, mon = {};
    MON_FIELDS.forEach(x => { if (e[x] !== undefined) mon[x] = e[x]; });
    weeks.push({ w, leads: e.leads ?? tr.nieuw, q: e.q ?? null, nvt: !!e.nvt, rec: e.rec || '', klant: e.klant || '', note: e.note || '', needsAction: !!e.needsAction, at: e.at || '', recAt: e.recAt, recBy: e.recBy, klantBy: e.klantBy, ...mon, tr });
  }
  return { id: k.id, boardId: k.boardId, client: k.boardName, vac: k.vac, rec: k.rec, start, ended: false, weeks, actions: acts, trello: true,
    live: s ? { gebeld: 0, ...s.live } : { nieuw: 0, contact: 0, gebeld: 0 }, ...(quick ? { quick: true } : {}), ...(k.halt ? { halt: k.halt } : {}) };
}

/**
 * The campaigns of the Trello links L.links: from the full board (full[boardId], boardStats) once it's loaded, until
 * then from the snapshot (quick[boardId].stats). A board in neither shows no campaign yet. A board on Niet actief
 * keeps its campaigns for the Recruitment Marketeer, without a recruiter (inactive).
 * ats: the campaigns switched to the app's own candidates ({ linkId: { stats } }, see lib/ats.js): their numbers are
 * added to what Trello still has of them, and they show without their board too. They get ats: true, and uit (see atsStats).
 */
export function liveCampaigns(L, full, quick, ats = {}) {
  const ina = L.inactive || {}, rounds = feedbackRounds(L);
  return L.links.map(k => {
    const key = linkKey(k), f = L.fb[k.id] || {}, acts = L.actions[k.id] || [], sw = ats[k.id], a = sw ? sw.stats || undefined : undefined;
    const t = full[k.boardId] ? full[k.boardId][key] : quick[k.boardId] ? quick[k.boardId].stats[key] : undefined, cut = w => (rounds[k.rec] || {})[w];
    let c = full[k.boardId] || quick[k.boardId] || sw ? liveCampaign(k, addStats(t, a), f, acts, !full[k.boardId] && !!quick[k.boardId], cut) : null;
    if (c && sw) c = { ...c, ats: true, ...(a && a.uit ? { uit: a.uit } : {}) };
    return c && ina[k.boardId] ? { ...c, rec: '', inactive: true } : c;
  }).filter(Boolean);
}
