// The Netlify → Render export: data written by the Netlify code (Blobs) must load in the Render code (files),
// including the encrypted 2FA secrets and integration keys, and the audit log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { blobDocs, fileDocs } from '../server/jsonfile.js';
import { createStore } from '../server/store.js';
import { createAccounts } from '../server/accounts.js';
import { createSecrets } from '../server/secrets.js';
import { createBlacklist } from '../server/blacklist.js';
import { createAudit, createBlobAudit } from '../server/audit.js';
import { deriveKey, encrypt, decrypt } from '../server/crypto.js';
import { exportBlobs, checkKey } from '../scripts/export-netlify.js';
import { FakeBlobStore } from './fake-blobs.js';

const RAW = 'netlify-secrets-key';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'htcm-export-'));

/** A store filled the way the Netlify function fills it. */
async function netlifyData() {
  const store = new FakeBlobStore(), key = [deriveKey(RAW)];
  const docs = blobDocs(store);
  const team = createStore(docs), accounts = createAccounts(docs, key), secrets = createSecrets(docs, key);
  createBlacklist(docs);
  await docs.loadAll();
  team.patch([{ doc: 'campaigns', set: { c1: { name: 'Kok Utrecht' } } }, { doc: 'rules', set: { r1: { min: 3 } } }]);
  const owner = accounts.all()[0];
  owner.status = 'active';
  owner.totp = { secret: encrypt(key, 'JBSWY3DPEHPK3PXP'), enabledAt: 1, lastStep: -1, recovery: [] };
  secrets.set('trello', { key: 'a'.repeat(32), token: 'b'.repeat(64) }, { name: 'Test' });
  assert.equal(await docs.commitAll(), true);

  const audit = createBlobAudit(store);
  audit.begin(); audit.log('login.ok', { actor: owner }); audit.log('member.updated', { actor: owner, target: owner }); await audit.commit();
  await store.setJSON('backups/campagnemonitor/2026-10-11', { rev: 0, docs: {} });
  return { store, rev: team.rev, owner };
}

test('export: Netlify Blobs data loads in the Render server, with the same SECRETS_KEY', async () => {
  const { store, rev, owner } = await netlifyData();
  const dir = tmp();
  const res = await exportBlobs(store, dir);
  assert.deepEqual(res.unknown, []);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['accounts.json', 'audit', 'blacklist.json', 'campagnemonitor.json', 'secrets.json']);

  // What server/index.js does at startup.
  const key = [deriveKey(RAW)], docs = fileDocs(dir);
  const team = createStore(docs), accounts = createAccounts(docs, key), secrets = createSecrets(docs, key);
  assert.equal(team.rev, rev);
  assert.equal(team.docs.campaigns.c1.name, 'Kok Utrecht');
  assert.deepEqual(accounts.unreadableTotp(), []);
  assert.equal(decrypt(key, accounts.get(owner.id).totp.secret), 'JBSWY3DPEHPK3PXP');
  const tr = secrets.status('trello');
  assert.equal(tr.state, 'set');
  assert.equal(tr.source, 'app');
  const events = await createAudit(dir).query();
  assert.deepEqual(events.map(e => e.type), ['member.updated', 'login.ok']);
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dir, 'secrets.json')).mode & 0o777, 0o600);
});

test('export: the key check catches a wrong SECRETS_KEY', async () => {
  const { store } = await netlifyData();
  const { docs } = await exportBlobs(store, tmp());
  assert.deepEqual(checkKey(RAW, docs), { checked: 3, bad: [] });
  assert.equal(checkKey('a-new-random-key', docs).bad.length, 3);
});

test('export: refuses a folder that already has data in it', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'accounts.json'), '{}');
  await assert.rejects(exportBlobs(new FakeBlobStore(), dir), /niet leeg/);
});
