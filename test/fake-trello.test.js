// The fake Trello (scripts/fake-trello.js) for trying the app locally or on the stage service: off unless
// FAKE_TRELLO=1, demo boards the monitor can count (functions as labels, as intake lists, or both), and numbers that
// move so the snapshot visibly gets updated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { boardStats, boardFunctions } from '../src/lib/boardStats.js';
import { feedbackWeek } from '../src/lib/weeks.js';
import { trelloRouter } from '../server/trello.js';
import { createTrelloIntake } from '../server/trelloIntake.js';
import { fileDocs } from '../server/jsonfile.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const before = globalThis.fetch;
const { answer } = await import('../scripts/fake-trello.js');
const json = async (url, now) => (await answer(url, now)).json();
const T = 'https://api.trello.com/1';

test('without FAKE_TRELLO=1 the real Trello is used', () => {
  assert.equal(globalThis.fetch, before);
});

test('with FAKE_TRELLO=1 the server talks to the fake, with keys filled in', () => {
  const env = { ...process.env, FAKE_TRELLO: '1', TRELLO_KEY: '', TRELLO_TOKEN: '' };
  const out = execFileSync(process.execPath, ['--import', './scripts/fake-trello.js', '--input-type=module', '-e',
    `const r = await fetch('${T}/members/me'); console.log((await r.json()).username, !!process.env.TRELLO_KEY && !!process.env.TRELLO_TOKEN);`],
  { cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.equal(out.trim(), 'nep-trello true');
});

test('through the proxy, every function on every demo board has new candidates in the feedback week', async () => {
  const now = Date.now(), cur = feedbackWeek(now), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'htcm-fake-'));
  globalThis.fetch = async (url, opts) => answer(url, now) || before(url, opts);
  const docs = fileDocs(dir), router = trelloRouter(() => ({ key: 'k', token: 't' }), { intake: createTrelloIntake(docs) });
  const server = await new Promise(ok => { const s = express().use(router).listen(0, () => ok(s)); });
  const get = async p => (await before(`http://127.0.0.1:${server.address().port}${p}`)).json();
  try {
    const boards = await get('/members/me/boards'), how = new Set();
    assert.ok(boards.length >= 4);
    let rejected = 0, interviews = 0;
    for (const b of boards) {
      const bd = await get(`/boards/${b.id}`), s = boardStats(bd), fns = boardFunctions(bd);
      for (const key of fns.length ? fns.map(f => f.id) : ['*']) assert.ok(s[key].weeks[cur].nieuw > 0, `${bd.name} ${key}`);
      for (const f of fns) how.add(f.listId && f.labelId ? 'beide' : f.listId ? 'kolom' : 'label');
      for (const t of Object.values(s['*'].weeks)) { rejected += Object.values(t.reasons).reduce((a, n) => a + n, 0); interviews += t.gesprek; }
    }
    assert.deepEqual([...how].sort(), ['beide', 'kolom', 'label'], 'functions as labels, as intake lists, and both');
    assert.ok(rejected > 0 && interviews > 0, 'the pipeline and rejection reasons have something to show');
  } finally {
    globalThis.fetch = before;
    await new Promise(ok => { server.close(ok); server.closeAllConnections(); });
    docs.flushAll();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(answer('https://example.com/x', now), null, 'other sites are left alone');
});

test('a minute later the first function has one more new candidate, in the feedback week and on the call list', async () => {
  // Minutes 10–15 of this hour: a round of 5 starts at 10, and no demo card comes in on the hour in between.
  const hour = Math.floor(Date.now() / 36e5) * 36e5, t = hour + 11 * 6e4, cur = feedbackWeek(t);
  for (const b of await json(`${T}/members/me/boards`, t)) {
    const bd = await json(`${T}/boards/${b.id}`, t), fns = boardFunctions(bd), key = fns.length ? fns[0].id : '*';
    const a = boardStats(bd), z = boardStats(await json(`${T}/boards/${b.id}`, t + 6e4));
    assert.equal(z[key].weeks[cur].nieuw, a[key].weeks[cur].nieuw + 1, b.name);
    assert.equal(z[key].live.nieuw, a[key].live.nieuw + 1, b.name);
    for (const f of fns.slice(1)) assert.deepEqual(z[f.id], a[f.id], `${b.name} ${f.name} stays the same`);
  }
  const last = hour + 14 * 6e4, b0 = (await json(`${T}/members/me/boards`, last))[0].id;
  const top = boardStats(await json(`${T}/boards/${b0}`, last))['*'], reset = boardStats(await json(`${T}/boards/${b0}`, last + 6e4))['*'];
  assert.equal(reset.live.nieuw, top.live.nieuw - 4, 'after 4 extra it starts over');
});
