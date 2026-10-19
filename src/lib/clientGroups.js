// Live campagnes per client: recruiters call per Trello board, so the functions (campaigns) of one board share a row.
import { rnd } from './helpers.js';

/** Today's call list of campaign c: nieuw (not called yet) and contact (call again). From Trello; demo campaigns get made-up numbers. */
export function callList(c) {
  if (c.live) return { nieuw: c.live.nieuw, contact: c.live.contact };
  const cur = c.weeks[c.weeks.length - 1];
  return { nieuw: Math.floor(rnd(c.id + 'today') * (cur.leads / 4 + 1.5)) + Math.round(rnd(c.id + 'bl') * 1.4),
    contact: Math.round(rnd(c.id + 'cp') * 3) + Math.round(cur.leads / 4) };
}
/** A campaign on Pauze or stopped (halt) stays with the recruiter until all its candidates are called. */
export function recruiterSees(c) {
  if (!c.halt) return true;
  const n = callList(c);
  return n.nieuw + n.contact > 0;
}

/**
 * rows: one per function, { id, key (the board, or the client in demo), client, nieuw, contact, total, open (no
 * feedback yet this week), rank (MONITOR rank) }. Returns one group per key with the call counts added up, open: how
 * many have no feedback, firstOpen: the id of the first of those, rank: the most urgent. Most to call first, also
 * within a group.
 */
export function groupByClient(rows) {
  const byTotal = (a, b) => b.total - a.total, by = new Map();
  for (const r of rows) {
    if (!by.has(r.key)) by.set(r.key, []);
    by.get(r.key).push(r);
  }
  return [...by].map(([key, fns]) => {
    fns.sort(byTotal);
    const sum = k => fns.reduce((s, f) => s + f[k], 0), open = fns.filter(f => f.open);
    return { key, client: fns[0].client, fns, nieuw: sum('nieuw'), contact: sum('contact'), total: sum('total'),
      open: open.length, firstOpen: open.length ? open[0].id : null, rank: Math.max(...fns.map(f => f.rank)) };
  }).sort(byTotal);
}
