// Read-only proxy to the Trello REST API. The API key and token stay on the server (Instellingen › Integraties,
// or environment variables), so they never reach the browser.
//
// Data minimisation: the server decides which fields are fetched, not the browser. Only list names, labels, and
// per card its list, labels and the two custom fields the monitor uses (Sollicitatiedatum, Reden afgewezen)
// come through. Candidate names, descriptions and other custom fields (phone numbers, ...) are never fetched.
import express from 'express';

const BOARD_Q = 'fields=name&lists=open&list_fields=name&labels=all&label_fields=name,color&cards=all&card_fields=idList,idLabels,closed&card_customFieldItems=true&customFields=true';
const ENDPOINTS = [
  { re: /^\/members\/me$/, q: 'fields=fullName,username' },
  { re: /^\/members\/me\/boards$/, q: 'filter=open&fields=name,dateLastActivity' },
  { re: /^\/boards\/[0-9a-f]{24}$/, q: BOARD_Q, board: true },
];
const USED_FIELDS = /reden\s*afgewezen|sollicitatiedatum/i;
const TTL = 30 * 1000; // several people opening the app at once share one Trello call

/** Keeps only the custom fields the monitor uses. */
export function minimiseBoard(body) {
  const bd = JSON.parse(body);
  const keep = (bd.customFields || []).filter(f => USED_FIELDS.test(f.name || ''));
  const ids = new Set(keep.map(f => f.id));
  bd.customFields = keep;
  for (const c of bd.cards || []) c.customFieldItems = (c.customFieldItems || []).filter(i => ids.has(i.idCustomField));
  return JSON.stringify(bd);
}

export const authHeader = creds => `OAuth oauth_consumer_key="${creds.key}", oauth_token="${creds.token}"`;

/** Checks credentials against Trello. Returns { ok, fullName, username, boards } or { ok: false, error }. */
export async function testTrello(creds) {
  try {
    const get = p => fetch(`https://api.trello.com/1${p}`, { headers: { Accept: 'application/json', Authorization: authHeader(creds) }, signal: AbortSignal.timeout(15000) });
    const r = await get('/members/me?fields=fullName,username');
    if (r.status === 401) return { ok: false, error: 'Trello weigert deze sleutel of dit token.' };
    if (!r.ok) return { ok: false, error: `Trello gaf een fout (${r.status}).` };
    const me = await r.json();
    const b = await get('/members/me/boards?filter=open&fields=name');
    const boards = b.ok ? (await b.json()).length : null;
    return { ok: true, fullName: me.fullName, username: me.username, boards };
  } catch (e) { return { ok: false, error: 'Kon Trello niet bereiken.' }; }
}

/** @param {() => ({key, token}|null)} getCreds */
export function trelloRouter(getCreds) {
  const cache = new Map();
  const router = express.Router();
  router.clearCache = () => cache.clear();
  router.use(async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    const creds = getCreds();
    if (!creds) return res.status(503).json({ error: 'trello_not_configured' });
    const ep = ENDPOINTS.find(e => e.re.test(req.path));
    if (!ep) return res.status(404).json({ error: 'not_allowed' });
    const url = `https://api.trello.com/1${req.path}?${ep.q}`;

    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < TTL) return res.type('json').send(hit.body);
    try {
      const p = hit && hit.pending ? hit.pending : fetch(url, {
        headers: { Accept: 'application/json', Authorization: authHeader(creds) },
        signal: AbortSignal.timeout(20000),
      }).then(async r => {
        const body = await r.text();
        return { status: r.status, body: r.status === 200 && ep.board ? minimiseBoard(body) : body };
      });
      cache.set(url, { ...(hit || {}), pending: p });
      const r = await p;
      if (r.status === 200) cache.set(url, { at: Date.now(), body: r.body });
      else cache.delete(url);
      if (cache.size > 500) cache.delete(cache.keys().next().value);

      if (r.status === 200) return res.type('json').send(r.body);
      if (r.status === 401) return res.status(502).json({ error: 'trello_unauthorized' });
      if (r.status === 429) return res.status(429).json({ error: 'trello_rate_limited' });
      return res.status(502).json({ error: 'trello_error', status: r.status });
    } catch (e) {
      cache.delete(url);
      return res.status(504).json({ error: 'trello_unreachable' });
    }
  });
  return router;
}
