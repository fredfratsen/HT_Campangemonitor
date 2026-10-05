// API keys for the services the app talks to, managed in the app (Instellingen › Integraties) instead of only
// through environment variables. Values are encrypted on disk (AES-256-GCM, see crypto.js) and never sent to
// the browser: the app only sees whether a key is set, its last 4 characters, and who changed it when. Fields
// with plain: true (a mail server's address, say) are shown in full.
// Environment variables still work as a fallback, so existing setups keep running.
import { encrypt, decrypt } from './crypto.js';

export const INTEGRATIONS = {
  trello: {
    label: 'Trello',
    desc: 'Leest klantborden, kandidaatkaarten en afwijsredenen (alleen lezen).',
    fields: [
      { key: 'key', label: 'API-sleutel', env: 'TRELLO_KEY', pattern: /^[0-9a-f]{32}$/i, hint: '32 tekens, van trello.com/power-ups/admin' },
      { key: 'token', label: 'Token', env: 'TRELLO_TOKEN', pattern: /^[A-Za-z0-9]{64,}$/, hint: 'Token met alleen leesrechten (scope=read)' },
    ],
  },
  smtp: {
    label: 'E-mail (SMTP)',
    desc: 'Verstuurt e-mail vanuit de app: nu nog alleen nieuwe bugs en ideeën naar de ontwikkelaar.',
    fields: [
      { key: 'host', label: 'Mailserver', env: 'SMTP_HOST', plain: true, pattern: /^[a-z0-9.-]+$/i, hint: 'Bijvoorbeeld smtp-relay.brevo.com' },
      { key: 'port', label: 'Poort', env: 'SMTP_PORT', plain: true, pattern: /^\d{2,5}$/, hint: '587 (STARTTLS) of 465 (SSL)' },
      { key: 'user', label: 'Gebruikersnaam', env: 'SMTP_USER', plain: true, hint: 'De login van de mailserver' },
      { key: 'pass', label: 'Wachtwoord', env: 'SMTP_PASS', hint: 'Het wachtwoord, de SMTP-sleutel of het app-wachtwoord' },
      { key: 'from', label: 'Afzender', env: 'SMTP_FROM', plain: true, pattern: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/, hint: 'Het adres waar de mail vandaan komt; je mailserver moet het accepteren' },
    ],
  },
};

/** @param docs  document factory from jsonfile.js (files or Netlify Blobs) */
export function createSecrets(docs, key) {
  const f = docs('secrets', () => ({ integrations: {} }), { mode: 0o600 });
  const listeners = new Set();

  /** Plain values for server use: stored in the app first, else environment variables. */
  function get(name) {
    const def = INTEGRATIONS[name], saved = f.data.integrations[name];
    if (saved) {
      const out = {};
      for (const fd of def.fields) out[fd.key] = decrypt(key, saved.values[fd.key]);
      if (Object.values(out).every(v => v)) return out;
      return null;
    }
    const env = {};
    for (const fd of def.fields) env[fd.key] = (process.env[fd.env] || '').trim();
    return Object.values(env).every(v => v) ? env : null;
  }

  /** What the app may see. */
  function status(name) {
    const def = INTEGRATIONS[name], saved = f.data.integrations[name];
    const base = { name, label: def.label, desc: def.desc, fields: def.fields.map(fd => ({ key: fd.key, label: fd.label, hint: fd.hint, env: fd.env, plain: !!fd.plain })) };
    const mask = (fd, v) => fd.plain ? v : '••••' + v.slice(-4);
    if (saved) {
      const vals = def.fields.map(fd => decrypt(key, saved.values[fd.key]));
      if (vals.some(v => v == null)) return { ...base, state: 'unreadable', source: 'app', updatedAt: saved.updatedAt, updatedBy: saved.updatedBy };
      return { ...base, state: 'set', source: 'app', updatedAt: saved.updatedAt, updatedBy: saved.updatedBy, masked: Object.fromEntries(def.fields.map((fd, i) => [fd.key, mask(fd, vals[i])])) };
    }
    const env = get(name);
    if (env) return { ...base, state: 'set', source: 'env', masked: Object.fromEntries(def.fields.map(fd => [fd.key, mask(fd, env[fd.key])])) };
    return { ...base, state: 'missing', source: null };
  }

  /** Validates new values; returns '' or a problem. */
  function problem(name, values) {
    const def = INTEGRATIONS[name];
    if (!def) return 'Onbekende integratie.';
    for (const fd of def.fields) {
      const v = String((values || {})[fd.key] || '').trim();
      if (!v) return `Vul ${fd.label} in.`;
      if (fd.pattern && !fd.pattern.test(v)) return `${fd.label} ziet er niet goed uit (${fd.hint}).`;
    }
    return '';
  }

  function set(name, values, actor) {
    const def = INTEGRATIONS[name];
    f.data.integrations[name] = { values: Object.fromEntries(def.fields.map(fd => [fd.key, encrypt(key, String(values[fd.key]).trim())])), updatedAt: Date.now(), updatedBy: actor.name };
    f.save(); f.flush();
    for (const fn of listeners) fn(name);
  }
  function remove(name) {
    delete f.data.integrations[name];
    f.save(); f.flush();
    for (const fn of listeners) fn(name);
  }

  return { get, status, problem, set, remove, onChange: fn => listeners.add(fn), flush: f.flush };
}
