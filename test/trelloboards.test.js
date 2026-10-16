// The Trello proxy's memory (server/trello.js, server/trelloIntake.js): the intake list every card came in through,
// read from Trello's history, so a candidate keeps their function after moving on; and the boards it loaded, so an
// unchanged board costs no Trello call and a round every 5 minutes keeps the numbers up to date. Runs the real
// router and files; only Trello itself is faked, with a history that has candidate names in it, as Trello's does.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { trelloRouter } from '../server/trello.js';
import { createTrelloSnapshot } from '../server/trelloSnapshot.js';
import { createTrelloIntake } from '../server/trelloIntake.js';
import { fileDocs } from '../server/jsonfile.js';
import { feedbackWeek, mondayOf } from '../src/lib/weeks.js';

const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const realFetch = globalThis.fetch;
const hex = (n, len) => n.toString(16).padStart(len, '0');
const iso = t => new Date(t).toISOString();
let clock, seq = 0, boards, calls, beforeBoard;
/** A Trello id made at time t: the first 8 hex characters are the time in seconds. */
const newId = (t = clock) => hex(Math.floor(t / 1000), 8) + hex(++seq, 16);
beforeEach(() => { clock = Date.now(); boards = []; calls = []; beforeBoard = null; });

/** A board with intake lists for Kok and Bediening, then Contactpoging and Gescreend, last active at `activity`. */
function fakeBoard(name, activity = clock - 7 * DAY) {
  const lists = { kok: 'Nieuwe Sollicitant | Kok', bed: 'Nieuwe Sollicitant | Bediening', contact: 'Contactpoging', gescreend: 'Gescreend' };
  return { id: newId(), name, activity: iso(activity), cards: [], actions: [], names: {}, down: false,
    lists: Object.fromEntries(Object.entries(lists).map(([k, n]) => [k, { id: newId(), name: n }])) };
}
const touch = (b, t) => { b.activity = iso(Math.max(Date.parse(b.activity), t)); };
const ref = (b, list) => ({ id: list.id, name: list.name });
/** A candidate comes in on list `to` at time t; Trello logs it with the card's name. */
function arrive(b, to, t = clock, name = 'Jan Jansen') {
  const id = newId(t);
  b.cards.push({ id, idList: b.lists[to].id }); b.names[id] = name;
  b.actions.push({ id: newId(t), type: 'createCard', date: iso(t), data: { card: { id, name, idShort: b.cards.length }, list: ref(b, b.lists[to]), board: { id: b.id, name: b.name } } });
  touch(b, t);
  return id;
}
/** The card moves to list `to` at time t. */
function move(b, id, to, t = clock) {
  const c = b.cards.find(x => x.id === id), from = Object.values(b.lists).find(l => l.id === c.idList);
  c.idList = b.lists[to].id;
  b.actions.push({ id: newId(t), type: 'updateCard', date: iso(t), data: { card: { id, name: b.names[id], idList: c.idList }, old: { idList: from.id },
    listBefore: ref(b, from), listAfter: ref(b, b.lists[to]), board: { id: b.id, name: b.name } } });
  touch(b, t);
}

globalThis.fetch = async (url, opts) => {
  const u = new URL(String(url));
  if (u.host !== 'api.trello.com') return realFetch(url, opts);
  calls.push(u.pathname + u.search);
  const p = u.pathname.replace(/^\/1/, ''), q = u.searchParams;
  if (p === '/members/me/boards') return Response.json(boards.map(b => ({ id: b.id, name: b.name, dateLastActivity: b.activity })));
  const m = /^\/boards\/([0-9a-f]{24})(\/actions)?$/.exec(p), b = m && boards.find(x => x.id === m[1]);
  if (!b) return new Response('not found', { status: 404 });
  if (m[2]) {
    if (b.down) return new Response('{"message":"error"}', { status: 500 });
    const since = Date.parse(q.get('since')), before = q.get('before');
    return Response.json(b.actions.filter(a => Date.parse(a.date) >= since && (!before || a.id < before))
      .sort((x, y) => (x.id < y.id ? 1 : -1)).slice(0, +q.get('limit')));
  }
  if (beforeBoard) beforeBoard(b);
  return Response.json({ id: b.id, name: b.name, lists: Object.values(b.lists).map(l => ({ ...l, closed: false })), labels: [], customFields: [],
    cards: b.cards.map(c => ({ ...c, idLabels: [], closed: false, customFieldItems: [] })) });
};

const dirs = [], servers = new Set();
const close = s => new Promise(ok => { servers.delete(s); s.close(ok); s.closeAllConnections(); });
after(async () => {
  globalThis.fetch = realFetch;
  for (const s of [...servers]) await close(s);
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'htcm-boards-')); dirs.push(d); return d; };

/** The Trello proxy with its memory in dir, as server/app.js sets it up on Render, on the fake clock. */
async function serve(dir, { linked = new Set(), creds = { key: 'k', token: 't' } } = {}) {
  const docs = fileDocs(dir);
  const router = trelloRouter(() => creds, { snapshot: createTrelloSnapshot(docs), intake: createTrelloIntake(docs), linked: () => linked, now: () => clock });
  const server = await new Promise(ok => { const s = express().use('/api/trello', router).listen(0, () => ok(s)); });
  servers.add(server);
  const base = `http://127.0.0.1:${server.address().port}/api/trello`;
  return {
    router, text: async p => (await realFetch(base + p)).text(), get: async p => (await realFetch(base + p)).json(),
    /** What the app does: the list of boards, then a board. */
    load: async b => { await realFetch(base + '/members/me/boards'); return (await realFetch(base + `/boards/${b.id}`)).json(); },
    stop: () => { docs.flushAll(); return close(server); },
  };
}
const intakeOf = bd => Object.fromEntries(bd.cards.map(c => [c.id, c.idIntake]));
const boardCalls = () => calls.filter(c => /^\/1\/boards\/[0-9a-f]{24}\?/.test(c)).map(c => c.slice(10, 34));
const sinceOf = call => Date.parse(new URL('https://x' + call).searchParams.get('since'));

// ── Which intake list a card came in through ────────────────────────────

test('a candidate keeps the function of the intake list they came in through after moving on', async () => {
  const b = fakeBoard('Hotel Zee'); boards = [b];
  const jan = arrive(b, 'kok', clock - 3 * DAY); move(b, jan, 'contact', clock - 2 * DAY);
  const piet = arrive(b, 'bed', clock - DAY); move(b, piet, 'gescreend', clock - HOUR);
  const a = await serve(tmp());
  assert.deepEqual(intakeOf(await a.load(b)), { [jan]: b.lists.kok.id, [piet]: b.lists.bed.id });
  const stats = (await a.get('/snapshot')).boards[b.id].stats;
  assert.deepEqual(stats[b.lists.kok.id].live, { nieuw: 0, contact: 1 }, 'the snapshot counts Jan for Kok');
  await a.stop();
});

test('candidate names from Trello\'s history never reach the browser or a file', async () => {
  const b = fakeBoard('Hotel Zee'); boards = [b];
  const c = arrive(b, 'kok', clock - DAY, 'Fatima de Boer'); move(b, c, 'contact', clock - HOUR);
  const dir = tmp(), a = await serve(dir);
  await a.get('/members/me/boards');
  const body = await a.text(`/boards/${b.id}`);
  assert.ok(body.includes(b.lists.kok.id), 'the intake list is sent');
  assert.ok(!body.includes('Fatima'), 'the name is not');
  await a.stop();
  assert.ok(fs.readFileSync(path.join(dir, 'trello-intake.json'), 'utf8').includes(c), 'the memory has the card');
  for (const f of fs.readdirSync(dir)) assert.ok(!fs.readFileSync(path.join(dir, f), 'utf8').includes('Fatima'), f);
});

test('the first load reads the history of the weeks the monitor shows, later loads only what is new', async () => {
  const b = fakeBoard('Hotel Zee'); boards = [b];
  arrive(b, 'kok', clock - DAY);
  const a = await serve(tmp());
  await a.load(b);
  const first = calls.filter(c => c.includes('/actions'));
  assert.equal(first.length, 1);
  assert.equal(sinceOf(first[0]), mondayOf(feedbackWeek(clock) - 11).getTime());
  calls = []; arrive(b, 'bed'); clock += 5 * MIN;
  await a.load(b);
  const next = calls.filter(c => c.includes('/actions'));
  assert.equal(next.length, 1);
  assert.ok(sinceOf(next[0]) > clock - 2 * DAY, 'from the newest move read (a day ago), not the weeks again');
  await a.stop();
});

test('a move Trello shows late, a little older than the newest one read, is still picked up', async () => {
  const b = fakeBoard('Hotel Zee'); boards = [b];
  arrive(b, 'kok', clock - 10 * MIN);
  const a = await serve(tmp());
  await a.load(b);
  // After that load, Trello shows a candidate who came in on Bediening 12 minutes ago and moved on a minute later.
  const piet = arrive(b, 'bed', clock - 12 * MIN); move(b, piet, 'gescreend', clock - 11 * MIN);
  touch(b, clock); clock += MIN;
  assert.equal(intakeOf(await a.load(b))[piet], b.lists.bed.id);
  await a.stop();
});

test('a candidate moved from one intake list to another keeps the last one', async () => {
  const b = fakeBoard('Hotel Zee'); boards = [b];
  const sara = arrive(b, 'kok', clock - 3 * MIN); move(b, sara, 'bed', clock - 2 * MIN); move(b, sara, 'contact', clock - MIN);
  const a = await serve(tmp());
  assert.equal(intakeOf(await a.load(b))[sara], b.lists.bed.id);
  await a.stop();
});

test('a busy board\'s history is read page by page', async () => {
  const b = fakeBoard('Hotel Zee'); boards = [b];
  const ids = [];
  for (let i = 0; i < 700; i++) { const id = arrive(b, 'bed', clock - DAY + i * 1000); move(b, id, 'contact', clock - HOUR + i * 1000); ids.push(id); }
  const a = await serve(tmp());
  const got = intakeOf(await a.load(b));
  assert.ok(ids.every(id => got[id] === b.lists.bed.id), 'all 700 candidates, from 1400 moves');
  await a.stop();
});

test('when the history can\'t be read, the board still loads with what is remembered, and catches up later', async () => {
  const b = fakeBoard('Hotel Zee'); boards = [b];
  const jan = arrive(b, 'kok', clock - HOUR); move(b, jan, 'contact', clock - 30 * MIN);
  const a = await serve(tmp());
  await a.load(b);
  b.down = true;
  const sara = arrive(b, 'kok'); move(b, sara, 'contact', clock + MIN); const piet = arrive(b, 'bed', clock + MIN);
  clock += 5 * MIN;
  const down = intakeOf(await a.load(b));
  assert.equal(down[jan], b.lists.kok.id, 'remembered');
  assert.equal(down[piet], b.lists.bed.id, 'still in its intake list');
  assert.equal(down[sara], undefined, 'moved on while the history was down');
  b.down = false; touch(b, clock); clock += 5 * MIN;
  assert.equal(intakeOf(await a.load(b))[sara], b.lists.kok.id, 'read once the history is back');
  await a.stop();
});

test('when the very first history read fails, the next load still reads the weeks the monitor shows', async () => {
  const b = fakeBoard('Hotel Zee'); boards = [b];
  const jan = arrive(b, 'kok', clock - 3 * DAY); move(b, jan, 'contact', clock - 2 * DAY);
  const a = await serve(tmp());
  b.down = true;
  assert.equal(intakeOf(await a.load(b))[jan], undefined);
  b.down = false; touch(b, clock); clock += 5 * MIN;
  assert.equal(intakeOf(await a.load(b))[jan], b.lists.kok.id);
  await a.stop();
});

test('cards gone from a board are forgotten, and a new Trello key forgets everything', async () => {
  const b = fakeBoard('Hotel Zee'); boards = [b];
  const jan = arrive(b, 'kok', clock - HOUR), piet = arrive(b, 'bed', clock - HOUR);
  const dir = tmp(), file = path.join(dir, 'trello-intake.json');
  let a = await serve(dir);
  await a.load(b);
  b.cards = b.cards.filter(c => c.id !== jan); touch(b, clock); clock += MIN;
  await a.load(b);
  await a.stop();
  assert.ok(!fs.readFileSync(file, 'utf8').includes(jan));
  assert.ok(fs.readFileSync(file, 'utf8').includes(piet));
  a = await serve(dir);
  a.router.clearCache();
  await a.stop();
  assert.ok(!fs.readFileSync(file, 'utf8').includes(b.id));
});

// ── Loading boards: from memory when unchanged, and every 5 minutes ──────

test('a board Trello reports unchanged comes from memory; a changed one, or one loaded over an hour ago, from Trello', async () => {
  const b = fakeBoard('Hotel Zee'); boards = [b];
  arrive(b, 'kok', clock - HOUR);
  const a = await serve(tmp());
  await a.load(b);
  assert.equal(boardCalls().length, 1);
  clock += 5 * MIN;
  assert.equal((await a.load(b)).cards.length, 1);
  assert.equal(boardCalls().length, 1, 'unchanged: no Trello call');
  arrive(b, 'bed'); clock += 5 * MIN;
  assert.equal((await a.load(b)).cards.length, 2);
  assert.equal(boardCalls().length, 2, 'changed');
  clock += HOUR;
  await a.load(b);
  assert.equal(boardCalls().length, 3, 'an hour later');
  await a.stop();
});

test('every round the server loads the boards that changed: linked ones, and ones active in the last 30 days', async () => {
  const linked = fakeBoard('Gekoppeld, lang stil', clock - 60 * DAY), active = fakeBoard('Actief', clock - HOUR), quiet = fakeBoard('Lang stil', clock - 60 * DAY);
  boards = [linked, active, quiet];
  const a = await serve(tmp(), { linked: new Set([linked.id]) });
  await a.router.refresh();
  assert.deepEqual(boardCalls(), [linked.id, active.id]);
  calls = []; clock += 5 * MIN;
  await a.router.refresh();
  assert.deepEqual(boardCalls(), [], 'nothing changed');
  arrive(active, 'kok'); clock += 5 * MIN;
  await a.router.refresh();
  assert.deepEqual(boardCalls(), [active.id]);
  assert.deepEqual((await a.get('/snapshot')).boards[active.id].stats[active.lists.kok.id].live, { nieuw: 1, contact: 0 }, 'in the numbers without anyone opening the app');
  await a.stop();
});

test('without Trello keys a round does nothing', async () => {
  boards = [fakeBoard('Hotel Zee')];
  const a = await serve(tmp(), { creds: null });
  await a.router.refresh();
  assert.deepEqual(calls, []);
  await a.stop();
});

test('a candidate who comes in on a board this round already loaded counts in the next round, once', async () => {
  const b1 = fakeBoard('Eerste'), b2 = fakeBoard('Tweede'); boards = [b1, b2];
  arrive(b1, 'kok', clock - HOUR); arrive(b2, 'kok', clock - HOUR);
  const a = await serve(tmp());
  beforeBoard = b => { if (b === b2) { beforeBoard = null; arrive(b1, 'kok'); } };
  await a.router.refresh();
  assert.equal((await a.get('/snapshot')).boards[b1.id].stats[b1.lists.kok.id].live.nieuw, 1, 'not in this round');
  clock += 5 * MIN;
  await a.router.refresh();
  assert.equal((await a.get('/snapshot')).boards[b1.id].stats[b1.lists.kok.id].live.nieuw, 2);
  await a.stop();
});

test('a candidate who comes in on a board later in the same round counts once', async () => {
  const b1 = fakeBoard('Eerste'), b2 = fakeBoard('Tweede'); boards = [b1, b2];
  arrive(b1, 'kok', clock - HOUR); arrive(b2, 'kok', clock - HOUR);
  const a = await serve(tmp());
  beforeBoard = b => { if (b === b2) { beforeBoard = null; arrive(b2, 'kok'); } };
  await a.router.refresh();
  const nieuw = async () => (await a.get('/snapshot')).boards[b2.id].stats[b2.lists.kok.id].live.nieuw;
  assert.equal(await nieuw(), 2, 'in this round');
  clock += 5 * MIN;
  await a.router.refresh();
  assert.equal(await nieuw(), 2, 'and still once in the next');
  await a.stop();
});
