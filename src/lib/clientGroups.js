// Live campagnes per client: recruiters call per Trello board, so the functions (campaigns) of one board share a row.

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
