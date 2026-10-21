// A new campaign waits on Pauze for its ads (src/lib/halt.js), out of sight of its recruiter. When it's resumed, the
// server tells the recruiter, as Toewijzing does for other campaigns (logAssigns in App.jsx): whoever resumes it (a
// Recruitment Marketeer) may not send assignment notifications themselves.
import { waitsForAds } from '../src/lib/halt.js';
import { stamp } from '../src/lib/weeks.js';

const names = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} en ${a[a.length - 1]}` : a.join('');
// Per doc: the log's mode, the client's name, and what ties a client's campaigns together.
const KINDS = {
  'live.links': { mode: 'trello', client: l => l.boardName, key: l => l.boardId },
  campaigns: { mode: 'demo', client: c => c.client, key: c => c.client }
};

/**
 * Patches for the store that announce the campaigns resumed in applied ([{ doc, key, before, after }], as
 * store.patch returns them) to their recruiters. docs: as they are after applying; by: who resumed them. A client
 * the recruiter had no other campaign of is a new one: "Nieuw bedrijf voor jou" in Meldingen, and an assignLog entry
 * for Live campagnes. Otherwise it's a new function, only in Meldingen. One notification per client.
 */
export function announceResumed(applied, docs, by, now = Date.now()) {
  const groups = new Map();
  for (const a of applied) {
    const K = KINDS[a.doc];
    if (!K || !a.before || !a.after || !waitsForAds(a.before.halt) || a.after.halt || !a.after.rec) continue;
    const g = `${a.doc}|${K.key(a.after)}|${a.after.rec}`;
    if (!groups.has(g)) groups.set(g, { K, doc: a.doc, rec: a.after.rec, any: a.after, keys: new Set(), fns: [] });
    groups.get(g).keys.add(a.key);
    groups.get(g).fns.push(a.after.vac);
  }
  const log = {}, inbox = {};
  for (const { K, doc, rec, any, keys, fns } of groups.values()) {
    const client = K.client(any);
    const known = Object.entries(docs[doc] || {}).some(([k, c]) => !keys.has(k) && c && !c.ended && c.rec === rec && K.key(c) === K.key(any) && !waitsForAds(c.halt));
    const id = String(now + Math.random());
    if (!known) log[id] = { id: Number(id), mode: K.mode, client, from: '', to: rec, at: now, by };
    inbox[id] = { id: Number(id), to: rec, from: by, at: stamp(), read: false, kind: 'assign',
      ...(known ? { title: `${fns.length === 1 ? 'Nieuwe functie' : 'Nieuwe functies'} bij ${client}`, items: fns }
        : { title: `Nieuw bedrijf voor jou: ${client}`, items: [`De ads voor ${names(fns)} staan live`] }) };
  }
  return [...(Object.keys(log).length ? [{ doc: 'assignLog', set: log }] : []), ...(Object.keys(inbox).length ? [{ doc: 'inbox', set: inbox }] : [])];
}
