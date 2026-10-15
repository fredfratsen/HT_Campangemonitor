// The fake Trello (scripts/fake-trello.js) for trying the app locally or on the stage service: off unless
// FAKE_TRELLO=1, demo boards the monitor can count, and numbers that move so the snapshot visibly gets updated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { boardStats } from '../src/lib/boardStats.js';
import { feedbackWeek } from '../src/lib/weeks.js';

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

test('every function on every demo board has new candidates in the feedback week', async () => {
  const now = Date.now(), cur = feedbackWeek(now), boards = await json(`${T}/members/me/boards`, now);
  assert.ok(boards.length >= 4);
  let rejected = 0, interviews = 0;
  for (const b of boards) {
    const bd = await json(`${T}/boards/${b.id}`, now), s = boardStats(bd);
    for (const key of bd.labels.length ? bd.labels.map(l => l.id) : ['*']) assert.ok(s[key].weeks[cur].nieuw > 0, `${bd.name} ${key}`);
    for (const t of Object.values(s['*'].weeks)) { rejected += Object.values(t.reasons).reduce((a, n) => a + n, 0); interviews += t.gesprek; }
  }
  assert.ok(rejected > 0 && interviews > 0, 'the pipeline and rejection reasons have something to show');
  assert.equal(answer('https://example.com/x', now), null, 'other sites are left alone');
});

test('a minute later the first function has one more new candidate, in the feedback week and on the call list', async () => {
  // Minutes 10–15 of this hour: a round of 5 starts at 10, and no demo card comes in on the hour in between.
  const hour = Math.floor(Date.now() / 36e5) * 36e5, t = hour + 11 * 6e4, cur = feedbackWeek(t);
  for (const b of await json(`${T}/members/me/boards`, t)) {
    const before = await json(`${T}/boards/${b.id}`, t), key = before.labels.length ? before.labels[0].id : '*';
    const a = boardStats(before), z = boardStats(await json(`${T}/boards/${b.id}`, t + 6e4));
    assert.equal(z[key].weeks[cur].nieuw, a[key].weeks[cur].nieuw + 1, b.name);
    assert.equal(z[key].live.nieuw, a[key].live.nieuw + 1, b.name);
    for (const l of before.labels.slice(1)) assert.deepEqual(z[l.id], a[l.id], `${b.name} ${l.name} stays the same`);
  }
  const last = hour + 14 * 6e4, b0 = (await json(`${T}/members/me/boards`, last))[0].id;
  const top = boardStats(await json(`${T}/boards/${b0}`, last))['*'], reset = boardStats(await json(`${T}/boards/${b0}`, last + 6e4))['*'];
  assert.equal(reset.live.nieuw, top.live.nieuw - 4, 'after 4 extra it starts over');
});
