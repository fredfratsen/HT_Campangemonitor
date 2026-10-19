// Read-only proxy to the Trello REST API. The API key and token stay on the server (Instellingen › Integraties,
// or environment variables), so they never reach the browser.
//
// Data minimisation: the server decides which fields are fetched, not the browser. Only list names, labels, and
// per card its list, labels and the two custom fields the monitor uses (Sollicitatiedatum, Reden afgewezen)
// come through. Candidate names, descriptions and other custom fields (phone numbers, ...) are never fetched with
// a board. A board's history (which list each card went to, and the ‘Geen gehoor’ comments, for trelloIntake.js)
// always comes with the card's title, the candidate's name: of each move only the card and list ids are kept, of a
// comment only the card id and the time, the rest (the comment's text too) is dropped right away, so the name is
// never stored or sent on.
//
// Boards (a long-running server): the last load of every board stays in memory, not on disk, with Trello's last
// activity on the board as the list of boards said *before* that load. While the list says the same, the board
// comes from memory, for at most an hour. A change during a load makes the next list say something newer, so the
// board is loaded again: never skipped, at worst loaded once more than needed. The numbers are always counted from
// the whole board, never added up, so a candidate never counts twice. refresh() is one round over the boards,
// every 5 minutes (server/index.js), so the snapshot and the intake memory keep up without anyone in the app.
import express from 'express';

const BOARD_Q = 'fields=name&lists=all&list_fields=name,closed&labels=all&label_fields=name,color&cards=all&card_fields=idList,idLabels,closed&card_customFieldItems=true&customFields=true';
const PAGE = 1000, MAX_PAGES = 20;
// Every way a card gets into a list: made there, copied, made from a checklist item, moved from another board, moved.
// And comments, for the Trello button ‘Geen gehoor’ (it comments “📵 Geen gehoor 19-10-2026 14:32”).
const HISTORY_Q = `filter=createCard,copyCard,convertToCardFromCheckItem,moveCardToBoard,updateCard:idList,commentCard&fields=date,type,data&limit=${PAGE}`;
const GEEN_GEHOOR = /geen\s*gehoor/i;
const ENDPOINTS = [
  { re: /^\/members\/me$/, q: 'fields=fullName,username' },
  { re: /^\/members\/me\/boards$/, q: 'filter=open&fields=name,dateLastActivity', boards: true },
];
const BOARDS = ENDPOINTS[1];
const BOARD_RE = /^\/boards\/([0-9a-f]{24})$/;
const USED_FIELDS = /reden\s*afgewezen|sollicitatiedatum/i;
const TTL = 30 * 1000; // several people opening the app at once share one Trello call
const FRESH = 60 * 60 * 1000; // a board Trello reports unchanged is still loaded again after an hour
const ACTIVE = 30 * 864e5; // in a round, boards quiet for longer are only loaded when linked (as the app does)
const GAP = 200; // ms between two boards loaded from Trello in a round

/** Keeps only the custom fields the monitor uses (changes bd in place). */
function minimise(bd) {
  const keep = (bd.customFields || []).filter(f => USED_FIELDS.test(f.name || ''));
  const ids = new Set(keep.map(f => f.id));
  bd.customFields = keep;
  for (const c of bd.cards || []) c.customFieldItems = (c.customFieldItems || []).filter(i => ids.has(i.idCustomField));
  return bd;
}
export const minimiseBoard = body => JSON.stringify(minimise(JSON.parse(body)));

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

/**
 * @param {() => ({key, token}|null)} getCreds
 * @param {object} [o]  only on a long-running server:
 * @param o.snapshot  createTrelloSnapshot (trelloSnapshot.js): the home-screen numbers of every board loaded
 * @param o.intake    createTrelloIntake (trelloIntake.js): the intake list every card came in through
 * @param o.linked    () => Set of the board ids linked in Toewijzing, for refresh()
 * @param o.now       the clock (tests)
 */
export function trelloRouter(getCreds, { snapshot = null, intake = null, linked = () => new Set(), now = Date.now } = {}) {
  const cache = new Map(); // url -> { at, body } or { pending }: /members/me and the list of boards
  const boards = new Map(); // board id -> { at, activity, body }: its last load
  const loading = new Map(); // board id -> the load from Trello under way
  const activity = new Map(); // board id -> Trello's last activity on it, in the latest list of boards
  let gen = 0; // a new Trello key: loads under way don't write back
  const router = express.Router();
  router.clearCache = () => {
    gen++; cache.clear(); boards.clear(); activity.clear();
    if (snapshot) snapshot.clear();
    if (intake) intake.clear();
  };
  /** What a board's numbers were at its last load, by anyone: the app shows these right after login. */
  router.get('/snapshot', (req, res) => res.json({ boards: snapshot ? snapshot.get() : {} }));

  const get = async (path, q) => {
    const r = await fetch(`https://api.trello.com/1${path}?${q}`, {
      headers: { Accept: 'application/json', Authorization: authHeader(getCreds()) },
      signal: AbortSignal.timeout(20000),
    });
    return { status: r.status, body: await r.text() };
  };
  const keep = (what, fn) => { try { fn(); } catch (e) { console.error(`[trello] ${what} niet bijgewerkt:`, e.message); } };

  /** The list of boards, fresh from Trello: remember each board's last activity, forget the boards gone. */
  const listed = body => {
    const list = JSON.parse(body);
    activity.clear();
    for (const b of list) activity.set(b.id, b.dateLastActivity);
    for (const id of boards.keys()) if (!activity.has(id)) boards.delete(id);
    if (snapshot) keep('snapshot', () => snapshot.keepOnly(list));
    if (intake) keep('kolomgeheugen', () => intake.keepOnly(list));
    return body;
  };
  /** /members/me and the list of boards, shared for TTL. */
  async function cached(path, ep) {
    const url = `${path}?${ep.q}`, hit = cache.get(url);
    if (hit && hit.body && now() - hit.at < TTL) return { status: 200, body: hit.body };
    const p = hit && hit.pending ? hit.pending : get(path, ep.q).then(r => (r.status === 200 && ep.boards ? { ...r, body: listed(r.body) } : r));
    cache.set(url, { pending: p });
    try {
      const r = await p;
      if (r.status === 200) cache.set(url, { at: now(), body: r.body }); else cache.delete(url);
      return r;
    } catch (e) { cache.delete(url); throw e; }
  }

  /**
   * The moves in a board's history since intake.since(), as [{ date, card, list }], and the ‘Geen gehoor’ comments as
   * [{ date, card, geenGehoor: true }]; null when Trello didn't give them.
   */
  async function history(id) {
    const since = encodeURIComponent(intake.since(id, now())), moves = [];
    let before = '';
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const r = await get(`/boards/${id}/actions`, `${HISTORY_Q}&since=${since}${before ? `&before=${before}` : ''}`);
        if (r.status !== 200) return null;
        const got = JSON.parse(r.body);
        // Only the ids: the card's name in a.data.card.name and a comment's text in a.data.text are dropped here.
        for (const a of got) {
          const d = a.data || {}, card = d.card && d.card.id;
          if (a.type !== 'commentCard') moves.push({ date: a.date, card, list: (d.listAfter || d.list || {}).id });
          else if (GEEN_GEHOOR.test(d.text || '')) moves.push({ date: a.date, card, geenGehoor: true });
        }
        if (got.length < PAGE) break;
        before = got[got.length - 1].id;
      }
      return moves;
    } catch (e) { return null; }
  }

  /** A board: from memory while Trello reports it unchanged, else from Trello. { status, body, fresh }. */
  function loadBoard(id) {
    const m = boards.get(id), t = now();
    if (m && (activity.has(id) ? m.activity === activity.get(id) && t - m.at < FRESH : t - m.at < TTL)) return Promise.resolve({ status: 200, body: m.body });
    if (loading.has(id)) return loading.get(id);
    const seen = activity.get(id), g = gen;
    const p = (async () => {
      const r = await get(`/boards/${id}`, BOARD_Q);
      if (r.status !== 200) return r;
      const bd = minimise(JSON.parse(r.body));
      if (intake) { const moves = await history(id); if (g === gen) keep('kolomgeheugen', () => intake.update(id, bd, moves, t)); }
      if (snapshot && g === gen) keep('snapshot', () => snapshot.board(id, bd, t));
      const body = JSON.stringify(bd);
      if (g === gen) boards.set(id, { at: t, activity: seen, body });
      return { status: 200, body, fresh: true };
    })().finally(() => loading.delete(id));
    loading.set(id, p);
    return p;
  }

  /** One round: the list of boards, then every linked or recently active board that changed (or is over an hour old). */
  let busy = false;
  router.refresh = async () => {
    if (busy || !getCreds()) return;
    busy = true;
    try {
      const r = await cached('/members/me/boards', BOARDS);
      if (r.status !== 200) return;
      const on = linked(), lim = now() - ACTIVE;
      for (const b of JSON.parse(r.body)) {
        if (!on.has(b.id) && Date.parse(b.dateLastActivity) < lim) continue;
        const x = await loadBoard(b.id);
        if (x.status === 429 || x.status === 401) return;
        if (x.fresh) await new Promise(ok => setTimeout(ok, GAP));
      }
    } catch (e) { console.error('[trello] verversen mislukt:', e.message); }
    finally { busy = false; }
  };

  router.use(async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    if (!getCreds()) return res.status(503).json({ error: 'trello_not_configured' });
    const bm = BOARD_RE.exec(req.path), ep = !bm && ENDPOINTS.find(e => e.re.test(req.path));
    if (!bm && !ep) return res.status(404).json({ error: 'not_allowed' });
    try {
      const r = bm ? await loadBoard(bm[1]) : await cached(req.path, ep);
      if (r.status === 200) return res.type('json').send(r.body);
      if (r.status === 401) return res.status(502).json({ error: 'trello_unauthorized' });
      if (r.status === 429) return res.status(429).json({ error: 'trello_rate_limited' });
      return res.status(502).json({ error: 'trello_error', status: r.status });
    } catch (e) {
      return res.status(504).json({ error: 'trello_unreachable' });
    }
  });
  return router;
}
