// Fake Trello, for trying the app without a Trello account: locally (npm run dev:fake-trello) or on the stage
// service. Never in production.
//
// Load it before the server, with FAKE_TRELLO=1: node --import ./scripts/fake-trello.js server/index.js. Every call
// to api.trello.com is then answered here, with six demo clients, each with a few functions and candidates over the
// last weeks. Some clients have their functions as labels, some as intake lists ("Nieuwe Sollicitant | Kok"), one
// both; a board's history (with made-up candidate names, as Trello's has real ones) says which intake list each
// card came in through. Trello keys are filled in when none are set. Each board takes FAKE_TRELLO_DELAY ms to load (default
// 2000), so you can see the app show the snapshot first and update it after. Every minute the first function of
// each client gets one more candidate (in Nieuw, applied this week), so the numbers move: up to 4 more, then back.
//
// Without FAKE_TRELLO=1 this file does nothing, and the real Trello is used.
import { feedbackWeek, mondayOf } from '../src/lib/weeks.js';

// [name, functions, how: 'labels', 'kolommen' (intake lists) or 'beide']
const CLIENTS = [
  ['Hotel Zeezicht', ['Kok', 'Bediening', 'Receptionist'], 'labels'],
  ['Restaurant De Haven', ['Bediening', 'Afwas'], 'kolommen'],
  ['Strandpaviljoen Noord', [], 'labels'], // no functions: linked as one campaign for the whole board
  ['Grand Café Het Plein', ['Kok', 'Barista'], 'beide'],
  ['Hotel Bergzicht', ['Receptionist', 'Housekeeping'], 'labels'],
  ['Bistro Tafel 8', ['Kok', 'Sous-chef'], 'kolommen'],
];
const STAGES = ['Contactpoging', 'Gescreend', 'Gesprek', 'Voorstel', 'Aangenomen', 'Afgewezen'];
const NAMES = ['Sanne de Vries', 'Mohammed El Amrani', 'Lisa Jansen', 'Kevin Bakker', 'Anouk Visser', 'Daan Smit', 'Fatima Yilmaz', 'Tom de Boer'];
const REASONS = ['Te weinig ervaring', 'Afstand', 'Geen reactie', 'No show', 'Ander aanbod'];
const COLORS = ['green', 'blue', 'orange', 'purple'];
const MOVE = 5; // minutes in one round of extra candidates

const hex = (n, len) => n.toString(16).padStart(len, '0');
/** A Trello-style id: 4 hex characters for the kind, then a number. */
const id = (kind, n) => kind + hex(n, 20);
const boardId = b => id('fa4e', b + 1);
/** The same number in [0, 1) for the same key, so a board looks the same on every load. */
function rnd(...key) {
  let h = 2166136261;
  for (const ch of key.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 2 ** 32;
}

/**
 * Board b as the Trello API returns it for the fields server/trello.js asks for, at time `now`, with its history
 * (actions: where each card was made and where it moved, newest first).
 */
function board(b, now) {
  const [name, fns, how] = CLIENTS[b], cur = feedbackWeek(now), cols = how !== 'labels' && fns.length > 0;
  const intakeOf = fn => (cols && fn ? `Nieuwe Sollicitant | ${fn.name}` : 'Nieuw');
  const LISTS = cols ? ['Informatie voor de recruiter', ...fns.map(n => `Nieuwe Sollicitant | ${n}`), ...STAGES] : ['Nieuw', ...STAGES, 'Informatie kandidaten'];
  const L = Object.fromEntries(LISTS.map((n, i) => [n, id('1157', b * 16 + i)]));
  const ref = n => ({ id: L[n], name: n });
  const groups0 = fns.map((n, i) => ({ id: id('1abe', b * 16 + i), name: n, color: COLORS[i % COLORS.length] }));
  const labels = how === 'kolommen' ? [] : groups0;
  const sd = id('cf1d', b * 2), rf = id('cf1d', b * 2 + 1);
  const options = REASONS.map((text, i) => ({ id: id('0b70', b * 16 + i), value: { text } }));
  const cards = [], actions = [], groups = groups0.length ? groups0 : [null];
  let n = b * 1e6;
  const at = t => hex(Math.floor(t / 1000), 8) + hex(n++, 16);
  // A candidate comes in on the intake list of their function (or Nieuw) and, unless still new, moves on a few hours later.
  const card = (created, list, fn, extra = {}) => {
    const cid = at(created), from = intakeOf(fn), to = list === 'Nieuw' ? from : list, who = NAMES[n % NAMES.length];
    cards.push({ id: cid, idList: L[to], idLabels: fn && how !== 'kolommen' ? [fn.id] : [], closed: false, customFieldItems: [], ...extra });
    actions.push({ id: at(created), type: 'createCard', date: new Date(created).toISOString(), data: { card: { id: cid, name: who }, list: ref(from) } });
    const moved = Math.min(created + 3 * 36e5, (created + now) / 2);
    if (to !== from) actions.push({ id: at(moved), type: 'updateCard', date: new Date(moved).toISOString(), data: { card: { id: cid, name: who }, listBefore: ref(from), listAfter: ref(to) } });
  };

  // Candidates per function per week, from 7 weeks before the feedback week up to today. Recent ones are still in
  // Nieuw or Contactpoging; older ones got further, or were rejected (with a reason). The first one of the feedback
  // week comes in at the very start of it, so every function has new candidates there, even on Monday morning.
  for (let w = cur - 7; w <= cur; w++) for (const lb of groups) {
    const key = [b, lb ? lb.name : '*', w], recent = w >= cur, mon = mondayOf(w);
    for (let i = 0, count = 1 + Math.floor(rnd(...key) * 7); i < count; i++) {
      const created = recent && i === 0 ? mon.getTime()
        : new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + Math.floor(rnd(...key, i, 'day') * 7), 9 + Math.floor(rnd(...key, i, 'hour') * 9)).getTime();
      if (created > now) continue;
      const r = rnd(...key, i, 'list');
      const list = recent ? (r < 0.45 ? 'Nieuw' : r < 0.75 ? 'Contactpoging' : r < 0.9 ? 'Gescreend' : 'Afgewezen')
        : (r < 0.1 ? 'Contactpoging' : r < 0.35 ? 'Afgewezen' : r < 0.55 ? 'Gescreend' : r < 0.72 ? 'Gesprek' : r < 0.86 ? 'Voorstel' : 'Aangenomen');
      const reason = options[Math.floor(rnd(...key, i, 'reason') * options.length)];
      card(created, list, lb, list !== 'Afgewezen' ? {} : { closed: rnd(...key, i, 'archived') < 0.5,
        customFieldItems: [{ id: id('cf17', n), idCustomField: rf, idValue: reason.id }] });
    }
  }
  // The first function gets one more candidate per minute, in Nieuw, who applied this week, so the feedback week and
  // the call list move. At most MOVE - 1, then back to none.
  const m = mondayOf(cur), applied = new Date(m.getFullYear(), m.getMonth(), m.getDate(), 12).toISOString();
  for (let i = 0; i < Math.floor(now / 6e4) % MOVE; i++) {
    card(now - i * 6e4, 'Nieuw', groups[0], { customFieldItems: [{ id: id('cf17', n), idCustomField: sd, value: { date: applied } }] });
  }
  return { id: boardId(b), name, lists: LISTS.map(x => ({ id: L[x], name: x, closed: false })), labels, cards,
    customFields: [{ id: sd, name: 'Sollicitatiedatum', type: 'date' }, { id: rf, name: 'Reden afgewezen', type: 'list', options }],
    actions: actions.sort((x, y) => (x.id < y.id ? 1 : -1)) };
}

/** The fake's answer to a request for `url`, or null when it isn't for Trello. */
export function answer(url, now = Date.now()) {
  const u = new URL(String(url));
  if (u.host !== 'api.trello.com') return null;
  const p = u.pathname.replace(/^\/1/, '');
  if (p === '/members/me') return Response.json({ id: id('fa4e', 0), fullName: 'Nep-Trello (demo)', username: 'nep-trello' });
  // The boards change every minute (see the top of this file).
  if (p === '/members/me/boards') return Response.json(CLIENTS.map(([name], b) => ({ id: boardId(b), name, dateLastActivity: new Date(Math.floor(now / 6e4) * 6e4).toISOString() })));
  const b = CLIENTS.findIndex((_, i) => p.startsWith(`/boards/${boardId(i)}`));
  if (b < 0) return Response.json({ message: 'not found' }, { status: 404 });
  const { actions, ...bd } = board(b, now);
  if (p === `/boards/${boardId(b)}`) return Response.json(bd);
  if (p !== `/boards/${boardId(b)}/actions`) return Response.json({ message: 'not found' }, { status: 404 });
  const q = u.searchParams, since = Date.parse(q.get('since') || 0), before = q.get('before');
  return Response.json(actions.filter(a => Date.parse(a.date) >= since && (!before || a.id < before)).slice(0, Number(q.get('limit')) || 50));
}

if (process.env.FAKE_TRELLO === '1') {
  const real = globalThis.fetch, delay = Number(process.env.FAKE_TRELLO_DELAY || 2000);
  process.env.TRELLO_KEY ||= 'f'.repeat(32);
  process.env.TRELLO_TOKEN ||= 'f'.repeat(64);
  globalThis.fetch = async (url, opts) => {
    if (!answer(url)) return real(url, opts);
    if (new URL(String(url)).pathname.startsWith('/1/boards/')) await new Promise(ok => setTimeout(ok, delay));
    return answer(url);
  };
  console.warn(`[nep-trello] FAKE_TRELLO=1: Trello wordt nagebootst met ${CLIENTS.length} demoborden, ${delay} ms per bord. Niet voor productie.`);
}
