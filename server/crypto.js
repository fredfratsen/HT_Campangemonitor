// Crypto helpers, all on Node's built-in crypto: password hashing (scrypt), random tokens, TOTP two-factor codes
// (RFC 6238, the codes Google Authenticator & co. show) and AES-256-GCM encryption for stored secrets.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ── Passwords ─────────────────────────────────────────────────────────────
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const scrypt = (pw, salt, len, o) => new Promise((res, rej) => crypto.scrypt(pw, salt, len, o, (e, k) => e ? rej(e) : res(k)));

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16), key = await scrypt(String(pw).normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
const DUMMY = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
/** Checks a password. With no stored hash it still does the work, so unknown emails take as long as wrong passwords. */
export async function verifyPassword(pw, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || DUMMY).split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64');
  const got = await scrypt(String(pw).normalize('NFKC'), Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem });
  return !!stored && crypto.timingSafeEqual(got, want);
}
export function passwordProblem(pw, email = '') {
  const s = String(pw || '');
  if (s.length < 12) return 'Kies een wachtwoord van minstens 12 tekens.';
  if (s.length > 200) return 'Dat wachtwoord is te lang.';
  if (/^(.)\1+$/.test(s)) return 'Kies een wachtwoord dat niet uit één teken bestaat.';
  if (email && s.toLowerCase().includes(email.toLowerCase().split('@')[0]) && email.split('@')[0].length > 3) return 'Gebruik je e-mailadres niet in je wachtwoord.';
  return '';
}

// ── TOTP (two-factor codes) ──────────────────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function unbase32(s) {
  const clean = String(s).toUpperCase().replace(/[^A-Z2-7]/g, ''), out = [];
  let bits = 0, val = 0;
  for (const ch of clean) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export const newTotpSecret = () => base32(crypto.randomBytes(20));
export function totpAt(secret, counter) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', unbase32(secret)).update(msg).digest(), o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
/** Returns the matching time step (so it can't be reused), or -1. Allows one step of clock drift either way. */
export function verifyTotp(secret, code, lastStep = -1, now = Date.now()) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return -1;
  const step = Math.floor(now / 30000);
  for (const s of [step, step - 1, step + 1]) if (s > lastStep && safeEqual(totpAt(secret, s), c)) return s;
  return -1;
}
export const otpauthUrl = (secret, label) => `otpauth://totp/${encodeURIComponent('Campagnemonitor:' + label)}?secret=${secret}&issuer=Campagnemonitor&algorithm=SHA1&digits=6&period=30`;
/** Ten one-time recovery codes like "k7fq-2m9x-p4tz". */
export function newRecoveryCodes() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => Array.from({ length: 3 }, () => Array.from(crypto.randomBytes(4), b => abc[b % abc.length]).join('')).join('-'));
}
export const normRecovery = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ── Encryption for stored secrets ────────────────────────────────────────
/**
 * The encryption keys, newest first. The key comes from SECRETS_KEY. Without it, a random key is created once in
 * the data folder (fine for development; in production set SECRETS_KEY so the key isn't stored next to the data).
 * When both exist, the file key stays usable for decrypting, so setting SECRETS_KEY later doesn't lock anything.
 */
export function loadSecretsKey(dataDir, prod) {
  const f = path.join(dataDir, '.secrets-key');
  const derive = raw => crypto.createHash('sha256').update('htcm-secrets-v1:' + raw).digest();
  const fileKey = () => fs.existsSync(f) ? derive(fs.readFileSync(f, 'utf8').trim()) : null;
  if (process.env.SECRETS_KEY) return [derive(process.env.SECRETS_KEY), fileKey()].filter(Boolean);
  if (!fs.existsSync(f)) { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 }); }
  if (prod) console.warn('SECRETS_KEY ontbreekt: de sleutel voor opgeslagen API-sleutels en 2FA staat nu in de datamap. Zet SECRETS_KEY in de environment.');
  return [fileKey()];
}
/** Encrypts with the newest key (`keys` is one key or a list, newest first). */
export function encrypt(keys, plain) {
  const key = Array.isArray(keys) ? keys[0] : keys;
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':');
}
/** Returns the plain text, or null when no key can decrypt it (e.g. SECRETS_KEY changed). */
export function decrypt(keys, box) {
  const [v, iv, tag, ct] = String(box).split(':');
  if (v !== 'v1') return null;
  for (const key of [].concat(keys)) {
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      d.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
    } catch (e) { /* try the next key */ }
  }
  return null;
}
