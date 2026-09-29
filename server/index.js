// Campagnemonitor as a long-running server (Render, local development): serves the built app and keeps the
// data in files in DATA_DIR. For Netlify, see server/netlify.js.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './app.js';
import { fileDocs } from './jsonfile.js';
import { createAudit } from './audit.js';
import { loadSecretsKey } from './crypto.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const APP_URL = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

if (process.env.APP_PASSWORD) console.warn('APP_PASSWORD wordt niet meer gebruikt: iedereen logt in met een eigen account. Je kunt de variabele verwijderen.');

const docs = fileDocs(DATA_DIR);
const { app, accounts, secrets, audit, housekeeping } = createServer({
  docs, audit: createAudit(DATA_DIR), secretsKey: loadSecretsKey(DATA_DIR, PROD), secure: PROD,
  hosting: 'render', publicDir: path.join(ROOT, 'public'), distDir: path.join(ROOT, 'dist'),
});

/** Prints a link to take ownership when nobody can (first start, or OWNER_RECOVERY=1). */
function ownerLinks(recover = false) {
  for (const x of accounts.ownerAccess({ recover })) {
    const url = `${APP_URL}/${x.type}/${x.raw}`;
    const line = '─'.repeat(Math.min(100, url.length + 4));
    console.log(`\n${line}\n  ${x.type === 'setup'
      ? `Nog geen actief Dev-account. Open deze link (1 uur geldig) om het account van ${x.account.name} in te stellen:`
      : `OWNER_RECOVERY: resetlink voor ${x.account.name} (24 uur geldig; wist ook de tweestapsverificatie). Haal OWNER_RECOVERY daarna weg.`}\n  ${url}\n${line}\n`);
    audit.log(x.type === 'setup' ? 'setup.link_issued' : 'owner.recovery', { target: x.account });
  }
}
const tidy = () => housekeeping().catch(e => console.error('[onderhoud]', e));

const server = app.listen(PORT, err => {
  if (err) {
    console.error(err.code === 'EADDRINUSE'
      ? `Poort ${PORT} is al in gebruik. Draait de Campagnemonitor al in een ander terminalvenster? Stop die (Ctrl+C) of kies een andere poort met PORT=3001.`
      : `Server kon niet starten: ${err.message}`);
    process.exit(1);
  }
  const act = accounts.all().filter(a => a.status === 'active').length, inv = accounts.all().filter(a => a.status === 'invited').length;
  const tr = secrets.status('trello');
  console.log(`Campagnemonitor draait op http://localhost:${PORT}`);
  console.log(`  data:     ${DATA_DIR}`);
  console.log(`  accounts: ${act} actief, ${inv} uitgenodigd`);
  console.log(`  trello:   ${tr.state === 'set' ? `ingesteld (${tr.source === 'app' ? 'in de app' : 'environment'})` : tr.state === 'unreadable' ? 'sleutel onleesbaar (SECRETS_KEY gewijzigd?)' : 'niet ingesteld'}`);
  const lost = accounts.unreadableTotp();
  if (lost.length) console.warn(`  LET OP: de tweestapsverificatie van ${lost.join(', ')} is onleesbaar (SECRETS_KEY gewijzigd?). Zij kunnen alleen nog inloggen met een herstelcode; reset hun 2FA onder Instellingen › Leden.`);
  tidy();
  ownerLinks(process.env.OWNER_RECOVERY === '1');
  // Hourly: housekeeping, and a fresh setup link while nobody has claimed the Dev account yet.
  setInterval(() => { tidy(); ownerLinks(false); }, 36e5).unref();
});
const shutdown = () => {
  docs.flushAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
