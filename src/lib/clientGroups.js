// Live campagnes per client: recruiters call per Trello board, so the functions (campaigns) of one board share a row.
import { rnd } from './helpers.js';
import { waitsForAds } from './halt.js';

/**
 * Today's call list of campaign c: nieuw (not called yet), contact (call again) and gebeld (got ‘Geen gehoor’ or a
 * ‘TBA afspraak’ today, so off the list until midnight). From Trello; demo campaigns get made-up numbers.
 */
export function callList(c) {
  if (c.live) return { nieuw: c.live.nieuw, contact: c.live.contact, gebeld: c.live.gebeld || 0 };
  const cur = c.weeks[c.weeks.length - 1];
  return { nieuw: Math.floor(rnd(c.id + 'today') * (cur.leads / 4 + 1.5)) + Math.round(rnd(c.id + 'bl') * 1.4),
    contact: Math.round(rnd(c.id + 'cp') * 3) + Math.round(cur.leads / 4), gebeld: Math.round(rnd(c.id + 'gg') * 2) };
}
/**
 * A campaign on Pauze or stopped (halt) stays with the recruiter until all its candidates are called: until nieuw plus
 * contact is 0. Cards called today (gebeld) don't keep it; one that comes back after midnight brings it back. A new one
 * that waits for its ads isn't theirs yet: they see it once it's resumed (and hear of it then, see server/announce.js).
 */
export function recruiterSees(c) {
  if (!c.halt) return true;
  if (waitsForAds(c.halt)) return false;
  const n = callList(c);
  return n.nieuw + n.contact > 0;
}

/** The orders a recruiter can pick for Live campagnes, [key, label]; the first is the default. */
export const LIVE_SORTS = [['most', 'meeste te bellen'], ['least', 'minste te bellen'], ['az', 'klant A–Z'], ['za', 'klant Z–A'],
  ['newest', 'nieuwste klant eerst'], ['oldest', 'oudste klant eerst']];

/** When Trello made the thing with this id: its first 8 hex characters are the seconds since 1970. 0 for any other id. */
export function trelloCreated(id) {
  return /^[0-9a-f]{24}$/i.test(id || '') ? parseInt(id.slice(0, 8), 16) * 1000 : 0;
}

/** Order sort (LIVE_SORTS) on rows with total and added; a tie goes A–Z on name, so rows with the same count stay put. */
function order(sort, name) {
  const abc = (a, b) => name(a).localeCompare(name(b), 'nl', { numeric: true, sensitivity: 'base' });
  const most = (a, b) => b.total - a.total, first = { most, least: (a, b) => a.total - b.total, az: abc, za: (a, b) => abc(b, a),
    newest: (a, b) => b.added - a.added, oldest: (a, b) => a.added - b.added }[sort] || most;
  return (a, b) => first(a, b) || abc(a, b);
}

/**
 * rows: one per function, { id, key (the board, or the client in demo), client, vac, nieuw, contact, gebeld, total, open
 * (no feedback yet this week), rank (MONITOR rank), added (when the client was added, 0 if unknown) }. Returns one group
 * per key with the call counts added up, open: how many have no feedback, firstOpen: the id of the first of those,
 * rank: the most urgent, added: the newest. In order sort (LIVE_SORTS, most to call first by default), also within a group.
 */
export function groupByClient(rows, sort) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.key)) by.set(r.key, []);
    by.get(r.key).push({ ...r, added: r.added || 0 });
  }
  return [...by].map(([key, fns]) => {
    fns.sort(order(sort, f => f.vac));
    const sum = k => fns.reduce((s, f) => s + f[k], 0), open = fns.filter(f => f.open);
    return { key, client: fns[0].client, fns, nieuw: sum('nieuw'), contact: sum('contact'), gebeld: sum('gebeld'), total: sum('total'),
      open: open.length, firstOpen: open.length ? open[0].id : null, rank: Math.max(...fns.map(f => f.rank)), added: Math.max(...fns.map(f => f.added)) };
  }).sort(order(sort, g => g.client));
}
