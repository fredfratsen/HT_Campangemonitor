// The Trello snapshot (server/trelloSnapshot.js): what the proxy loaded last, kept for the next login so the home
// screens show numbers right away. Runs the real router and files; only Trello itself is faked.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { trelloRouter } from '../server/trello.js';
import { createTrelloSnapshot } from '../server/trelloSnapshot.js';
import { fileDocs } from '../server/jsonfile.js';
import { CUR } from '../src/lib/weeks.js';
import { board, BOARD_ID, CARD } from './trello-fixture.js';

const OTHER_BOARD = 'b0a4d0000000000000000002';
const realFetch = globalThis.fetch;
let openBoards = [{ id: BOARD_ID, name: 'Hotel Zee', dateLastActivity: new Date().toISOString() }];
globalThis.fetch = async (url, opts) => {
  const u = new URL(String(url));
  if (u.host !== 'api.trello.com') return realFetch(url, opts);
  if (u.pathname === '/1/members/me/boards') return Response.json(openBoards);
  if (u.pathname === `/1/boards/${BOARD_ID}`) return Response.json(board());
  return new Response('not found', { status: 404 });
};

const dirs = [], servers = new Set();
const close = s => new Promise(ok => { servers.delete(s); s.close(ok); s.closeAllConnections(); });
after(async () => {
  globalThis.fetch = realFetch;
  for (const s of [...servers]) await close(s); // also when a test failed halfway
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'htcm-snapshot-')); dirs.push(d); return d; };

/** The Trello proxy with a snapshot in dir, as server/app.js sets it up on Render. */
async function serve(dir) {
  const docs = fileDocs(dir), router = trelloRouter(() => ({ key: 'k', token: 't' }), { snapshot: createTrelloSnapshot(docs) });
  const server = await new Promise(ok => { const s = express().use('/api/trello', router).listen(0, () => ok(s)); });
  servers.add(server);
  const base = `http://127.0.0.1:${server.address().port}/api/trello`;
  return {
    router, get: async p => (await realFetch(base + p)).json(),
    stop: () => { docs.flushAll(); return close(server); },
  };
}

test('a board loaded through the proxy is there for the next login, also after a restart', async () => {
  const dir = tmp(), a = await serve(dir);
  assert.deepEqual((await a.get('/snapshot')).boards, {}, 'nothing before the first load');
  await a.get(`/boards/${BOARD_ID}`);
  const snap = (await a.get('/snapshot')).boards;
  assert.deepEqual(snap[BOARD_ID].stats['*'], { minW: CUR - 2, weeks: { [CUR]: { nieuw: 3 }, [CUR - 1]: { nieuw: 1 }, [CUR - 2]: { nieuw: 1 } }, live: { nieuw: 1, contact: 1, gebeld: 0 } });
  assert.ok(Math.abs(snap[BOARD_ID].at - Date.now()) < 60000, 'when it was loaded');
  await a.stop();
  const b = await serve(dir);
  assert.deepEqual((await b.get('/snapshot')).boards, snap);
  await b.stop();
});

test('the stored snapshot has no cards, pipeline or rejection reasons, and no daily backups', async () => {
  const dir = tmp(), a = await serve(dir);
  await a.get(`/boards/${BOARD_ID}`);
  await a.stop();
  const text = fs.readFileSync(path.join(dir, 'trello-snapshot.json'), 'utf8');
  assert.ok(text.includes(BOARD_ID), 'the board is in it');
  for (const id of Object.values(CARD)) assert.ok(!text.includes(id), 'no card ids');
  for (const word of ['Afstand', 'gescreend', 'gesprek', 'reasons']) assert.ok(!text.includes(word), `no ${word}`);
  assert.deepEqual(fs.readdirSync(dir).filter(f => f.startsWith('trello-snapshot.')), ['trello-snapshot.json']);
});

test('boards Trello no longer lists are dropped from the snapshot', async () => {
  const a = await serve(tmp());
  await a.get(`/boards/${BOARD_ID}`);
  openBoards = [{ id: OTHER_BOARD, name: 'Café Rood', dateLastActivity: new Date().toISOString() }];
  try { await a.get('/members/me/boards'); } finally { openBoards = [{ id: BOARD_ID, name: 'Hotel Zee', dateLastActivity: new Date().toISOString() }]; }
  assert.deepEqual((await a.get('/snapshot')).boards, {});
  await a.stop();
});

test('a new Trello key starts from an empty snapshot', async () => {
  const a = await serve(tmp());
  await a.get(`/boards/${BOARD_ID}`);
  a.router.clearCache();
  assert.deepEqual((await a.get('/snapshot')).boards, {});
  await a.stop();
});
