// The search above the list on Feedback klant and Wekelijkse feedback recruiter: on client and vacature, like Campagnes.

/** Does campaign c ({ client, vac }) match search q? Case doesn't matter; an empty search matches every campaign. */
export function matchesQ(c, q) {
  const t = (q || '').trim().toLowerCase();
  return !t || (c.client + ' ' + c.vac).toLowerCase().includes(t);
}
