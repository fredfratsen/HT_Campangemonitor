// Netlify-specific checks: the function's path list, a missing SECRETS_KEY, and the Blobs documents with
// conditional writes (the building block that keeps concurrent saves from overwriting each other).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FUNCTION_PATHS, createNetlifyHandler } from '../server/netlify.js';
import { blobDocs } from '../server/jsonfile.js';
import { createBlobAudit } from '../server/audit.js';
import { FakeBlobStore } from './fake-blobs.js';

const ROOT = path.resolve(import.meta.dirname, '..');

test('the function file routes the same paths as FUNCTION_PATHS', () => {
  const src = fs.readFileSync(path.join(ROOT, 'netlify/functions/server.mjs'), 'utf8');
  const literal = src.match(/path:\s*(\[[^\]]*\])/)[1];
  assert.deepEqual(JSON.parse(literal.replace(/'/g, '"')), FUNCTION_PATHS);
});

test('without SECRETS_KEY the function explains what to set', async () => {
  const handler = createNetlifyHandler({ store: new FakeBlobStore(), env: {} });
  const api = await handler(new Request('https://x.netlify.app/api/config'));
  assert.equal(api.status, 500);
  assert.match((await api.json()).message, /SECRETS_KEY/);
  const page = await handler(new Request('https://x.netlify.app/login'));
  assert.match(await page.text(), /SECRETS_KEY/);
});

test('blob documents: conditional commit, reload in place', async () => {
  const store = new FakeBlobStore();
  const a = blobDocs(store), b = blobDocs(store);
  const da = a('doc', () => ({ n: 0 })), db = b('doc', () => ({ n: 0 }));
  const ref = da.data;
  await a.loadAll(); await b.loadAll();
  da.data.n = 1; da.save();
  assert.equal(await a.commitAll(), true, 'first write creates it');
  db.data.n = 2; db.save();
  assert.equal(await b.commitAll(), false, 'b started before a wrote: refused');
  await b.loadAll();
  assert.equal(db.data.n, 1, 'b sees a\'s write after reloading');
  db.data.n = 3; db.save();
  assert.equal(await b.commitAll(), true);
  await a.loadAll();
  assert.equal(da.data, ref, 'same object after loading');
  assert.equal(da.data.n, 3);
});

test('after a partial save, later documents merge only what this request changed', async () => {
  const store = new FakeBlobStore();
  const setup = blobDocs(store); setup('team', () => ({ rev: 0 })); setup('accounts', () => ({ sessions: {} }));
  await setup.loadAll(); await setup.commitAll();
  // Request A touches both documents; request B (another instance) writes accounts in between.
  const A = blobDocs(store), aTeam = A('team', () => ({})), aAcc = A('accounts', () => ({}));
  const B = blobDocs(store), bAcc = (B('team', () => ({})), B('accounts', () => ({})));
  await A.loadAll(); await B.loadAll();
  bAcc.data.sessions.s2 = { lastSeenAt: 2 }; bAcc.save();
  assert.equal(await B.commitAll(), true);
  aTeam.data.rev = 1; aTeam.save();
  aAcc.data.sessions.s1 = { lastSeenAt: 1 }; aAcc.save();
  assert.equal(await A.commitAll(), true, 'team written, accounts merged');
  const check = blobDocs(store), team = check('team', () => ({})), acc = check('accounts', () => ({}));
  await check.loadAll();
  assert.equal(team.data.rev, 1);
  assert.deepEqual(Object.keys(acc.data.sessions).sort(), ['s1', 's2'], 'both sessions kept');
});

test('blob audit: events from concurrent requests all end up in the log', async () => {
  const store = new FakeBlobStore(), logs = [createBlobAudit(store), createBlobAudit(store), createBlobAudit(store)];
  await Promise.all(logs.map(async (l, i) => { l.begin(); for (let j = 0; j < 5; j++) l.log('login.ok', { actor: { id: 'u' + i, name: 'U' + i } }); await l.commit(); }));
  const rows = await logs[0].query({ limit: 100 });
  assert.equal(rows.length, 15);
  await logs[0].rename('u1', 'Oud-teamlid 1');
  assert.equal((await logs[0].query({ person: 'u1' })).every(e => e.actorName === 'Oud-teamlid 1'), true);
});
