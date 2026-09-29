// Password hashing, TOTP codes, encryption of stored secrets and the Trello data minimisation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { hashPassword, verifyPassword, passwordProblem, base32, totpAt, verifyTotp, encrypt, decrypt } from '../server/crypto.js';
import { minimiseBoard } from '../server/trello.js';

test('passwords', async () => {
  const h = await hashPassword('een lang geheim wachtwoord');
  assert.match(h, /^scrypt\$/);
  assert.equal(await verifyPassword('een lang geheim wachtwoord', h), true);
  assert.equal(await verifyPassword('iets anders helemaal', h), false);
  assert.equal(await verifyPassword('wat dan ook', null), false, 'no stored hash never matches');
  assert.match(passwordProblem('kort'), /12 tekens/);
  assert.match(passwordProblem('aaaaaaaaaaaaaa'), /één teken/);
  assert.match(passwordProblem('robbin123456789', 'robbin@example.com'), /e-mailadres/);
  assert.equal(passwordProblem('paard batterij nietje'), '');
});

test('TOTP matches RFC 6238 test vectors', () => {
  const secret = base32(Buffer.from('12345678901234567890'));
  assert.equal(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  // RFC 6238 SHA-1 values (8 digits) truncated to 6.
  assert.equal(totpAt(secret, Math.floor(59 / 30)), '287082');
  assert.equal(totpAt(secret, Math.floor(1111111109 / 30)), '081804');
  assert.equal(totpAt(secret, Math.floor(2000000000 / 30)), '279037');
  const now = 1111111109 * 1000;
  assert.equal(verifyTotp(secret, '081804', -1, now), Math.floor(1111111109 / 30));
  assert.equal(verifyTotp(secret, '081 804', -1, now) >= 0, true, 'spaces are fine');
  assert.equal(verifyTotp(secret, '081804', Math.floor(1111111109 / 30), now), -1, 'a used code cannot be reused');
  assert.equal(verifyTotp(secret, '123456', -1, now), -1);
});

test('secrets are encrypted and tamper-proof', () => {
  const key = crypto.randomBytes(32), other = crypto.randomBytes(32);
  const box = encrypt(key, 'trello-token-123');
  assert.ok(!box.includes('trello'));
  assert.equal(decrypt(key, box), 'trello-token-123');
  assert.equal(decrypt(other, box), null, 'wrong key');
  const parts = box.split(':'); parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('A') ? 'B' : 'A');
  assert.equal(decrypt(key, parts.join(':')), null, 'tampered');
  // Setting SECRETS_KEY after running on the fallback key file: old values stay readable, new ones use the new key.
  assert.equal(decrypt([other, key], box), 'trello-token-123');
  assert.equal(decrypt(other, encrypt([other, key], 'x')), 'x');
});

test('Trello boards: only the custom fields the monitor uses come through', () => {
  const board = {
    customFields: [{ id: 'f1', name: 'Sollicitatiedatum' }, { id: 'f2', name: 'Reden afgewezen' }, { id: 'f3', name: 'Telefoonnummer' }],
    cards: [{ id: 'c1', customFieldItems: [{ idCustomField: 'f1', value: { date: 'x' } }, { idCustomField: 'f3', value: { text: '0612345678' } }] }],
  };
  const out = JSON.parse(minimiseBoard(JSON.stringify(board)));
  assert.deepEqual(out.customFields.map(f => f.name), ['Sollicitatiedatum', 'Reden afgewezen']);
  assert.deepEqual(out.cards[0].customFieldItems.map(i => i.idCustomField), ['f1']);
  assert.ok(!JSON.stringify(out).includes('0612345678'));
});
