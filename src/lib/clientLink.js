// A notification about one client (n.client) opens it under Meldingen, as clicking the client would (App.openClient).

/**
 * Where a click on client `name` goes. mine: the campaigns the recruiter sees in Live campagnes (null when not a
 * recruiter); shown: the ones Campagnes shows, Pauze included. One campaign: { open: id }. Several: the recruiter's
 * client in Live campagnes, { live: key } (as it groups them: the board, or the client in demo), or else Campagnes
 * searched on the client, { campaigns: { q, status } }, under Pauze when all wait there. null: nothing to open.
 */
export function clientTarget(name, mine, shown) {
  const of = cs => (cs || []).filter(c => c.client === name && !c.ended);
  const m = of(mine), s = of(shown);
  if (m.length === 1) return { open: m[0].id };
  if (m.length) return { live: m[0].boardId || m[0].client };
  if (s.length === 1) return { open: s[0].id };
  if (s.length) return { campaigns: { q: name, status: s.every(c => c.halt && c.halt.kind === 'pauze') ? 'pauze' : 'all' } };
  return null;
}
