// One-off move from Netlify to Render: copies the data from Netlify Blobs into a folder in the layout the
// long-running server reads (server/index.js): campagnemonitor.json, accounts.json, secrets.json, blacklist.json
// and audit/YYYY-MM.jsonl. The daily copies under backups/ stay behind.
//
//   NETLIFY_SITE_ID=... NETLIFY_TOKEN=... SECRETS_KEY=<the value from Netlify> node scripts/export-netlify.js ./migrated
//
// NETLIFY_SITE_ID: Netlify › Site configuration › General › Site ID.
// NETLIFY_TOKEN:   a personal access token (Netlify › User settings › Applications). Delete it afterwards.
// SECRETS_KEY:     optional but recommended: checks that the 2FA secrets and integration keys decrypt with it,
//                  i.e. that the key you're about to give Render is the right one.
//
// The folder holds the team's real data (accounts, blacklist): never commit it, delete it once it's on Render.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decrypt, deriveKey } from '../server/crypto.js';

export const DOC_NAMES = ['campagnemonitor', 'accounts', 'secrets', 'blacklist'];
const PRIVATE = new Set(['accounts', 'secrets', 'blacklist']); // 0600, like jsonfile.js
const AUDIT = /^audit\/(\d{4}-\d{2})$/;

/** Copies the documents and audit months from `store` into `outDir` (must be new or empty). */
export async function exportBlobs(store, outDir) {
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) throw new Error(`${outDir} is niet leeg; kies een nieuwe map.`);
  fs.mkdirSync(path.join(outDir, 'audit'), { recursive: true });
  const read = k => store.get(k, { type: 'json', consistency: 'strong' });
  const keys = (await store.list()).blobs.map(b => b.key);

  const docs = {};
  for (const name of DOC_NAMES) {
    const data = await read(name);
    docs[name] = data || null;
    if (data) fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(data), PRIVATE.has(name) ? { mode: 0o600 } : undefined);
  }
  const audit = {};
  for (const k of keys) {
    const m = k.match(AUDIT);
    if (!m) continue;
    const rows = (await read(k)) || [];
    audit[m[1]] = rows.length;
    if (rows.length) fs.writeFileSync(path.join(outDir, 'audit', `${m[1]}.jsonl`), rows.map(e => JSON.stringify(e)).join('\n') + '\n');
  }
  const unknown = keys.filter(k => !DOC_NAMES.includes(k) && !AUDIT.test(k) && !k.startsWith('backups/'));
  return { docs, audit, unknown };
}

/** Which encrypted values can't be read with `raw` (the SECRETS_KEY value). */
export function checkKey(raw, docs) {
  const key = deriveKey(raw), bad = [];
  let checked = 0;
  for (const a of Object.values((docs.accounts && docs.accounts.accounts) || {})) {
    for (const [what, box] of [['2FA', a.totp && a.totp.secret], ['2FA (in instelling)', a.totpPending]]) {
      if (!box) continue;
      checked++;
      if (decrypt(key, box) == null) bad.push(`${what} van ${a.name}`);
    }
  }
  for (const [name, s] of Object.entries((docs.secrets && docs.secrets.integrations) || {})) {
    for (const [field, box] of Object.entries(s.values || {})) {
      checked++;
      if (decrypt(key, box) == null) bad.push(`${name}.${field}`);
    }
  }
  return { checked, bad };
}

async function main() {
  const outDir = path.resolve(process.argv[2] || 'migrated');
  const { NETLIFY_SITE_ID: siteID, NETLIFY_TOKEN: token, SECRETS_KEY } = process.env;
  if (!siteID || !token) {
    console.error('Zet NETLIFY_SITE_ID en NETLIFY_TOKEN (zie bovenaan dit script).');
    process.exit(1);
  }
  const { getStore } = await import('@netlify/blobs');
  // Same store and region as netlify/functions/server.mjs.
  const store = getStore({ name: 'campagnemonitor', siteID, token, region: 'eu-central-1' });
  const { docs, audit, unknown } = await exportBlobs(store, outDir);

  if (!docs.campagnemonitor && !docs.accounts) {
    console.error('Geen data gevonden. Klopt de Site ID, en is dit de site waar de Campagnemonitor draait?');
    process.exit(1);
  }
  const accounts = Object.values((docs.accounts && docs.accounts.accounts) || {});
  console.log(`Geëxporteerd naar ${outDir}`);
  for (const name of DOC_NAMES) console.log(`  ${name}.json`.padEnd(26) + (docs[name] ? 'ok' : 'ontbrak (wordt bij de start nieuw aangemaakt)'));
  console.log(`  teamdata: rev ${docs.campagnemonitor ? docs.campagnemonitor.rev : '-'}`);
  console.log(`  accounts: ${accounts.filter(a => a.status === 'active').length} actief, ${accounts.filter(a => a.status === 'invited').length} uitgenodigd`);
  console.log(`  audit:    ${Object.keys(audit).length} maanden, ${Object.values(audit).reduce((s, n) => s + n, 0)} regels`);
  if (unknown.length) console.warn(`  LET OP, niet meegenomen (onbekende sleutels): ${unknown.join(', ')}`);

  if (!SECRETS_KEY) {
    console.warn('\nSECRETS_KEY niet gezet: de sleutel is niet gecontroleerd. Zet dezelfde waarde als in Netlify en draai opnieuw (in een lege map).');
    return;
  }
  const { checked, bad } = checkKey(SECRETS_KEY, docs);
  if (bad.length) {
    console.error(`\nSECRETS_KEY past NIET: ${bad.length} van ${checked} versleutelde waarden onleesbaar (${bad.join(', ')}).`);
    console.error('Gebruik exact de waarde uit Netlify › Environment variables, anders werken 2FA en de integraties niet op Render.');
    process.exit(2);
  }
  console.log(`\nSECRETS_KEY past: ${checked} versleutelde waarden leesbaar. Zet precies deze waarde op Render.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message || e); process.exit(1); });
}
