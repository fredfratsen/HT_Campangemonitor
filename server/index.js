// Campagnemonitor web server: serves the built app, personal accounts and rights, the shared team data and a
// read-only Trello proxy.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';
import { createAccounts } from './accounts.js';
import { createAuth, sameOrigin } from './auth.js';
import { createAudit } from './audit.js';
import { createSecrets } from './secrets.js';
import { createPrivacy } from './privacy.js';
import { loadSecretsKey } from './crypto.js';
import { trelloRouter } from './trello.js';
import { apiRouter } from './api.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DIST = path.join(ROOT, 'dist');
const APP_URL = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

if (process.env.APP_PASSWORD) console.warn('APP_PASSWORD wordt niet meer gebruikt: iedereen logt in met een eigen account. Je kunt de variabele verwijderen.');

const secretsKey = loadSecretsKey(DATA_DIR, PROD);
const store = createStore(DATA_DIR);
const audit = createAudit(DATA_DIR);
const accounts = createAccounts(DATA_DIR, secretsKey);
const secrets = createSecrets(DATA_DIR, secretsKey);
const privacy = createPrivacy({ accounts, store, audit });
const auth = createAuth({ accounts, audit, secure: PROD });
const trello = trelloRouter(() => secrets.get('trello'));

const app = express();
app.set('trust proxy', 1); // Render (and most hosts) sit behind a proxy
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});
app.use(sameOrigin);

// Open without login: health check, login and link pages, privacy notice, and the assets they use.
const form = express.urlencoded({ extended: false, limit: '10kb' });
app.get('/healthz', (req, res) => res.type('text').send('ok'));
app.get('/login', auth.loginPage);
app.post('/login', form, auth.login);
app.get('/login/code', auth.codePage);
app.post('/login/code', form, auth.code);
app.get('/login/2fa-instellen', auth.enrollPage);
app.post('/login/2fa-instellen', form, auth.enroll);
for (const type of ['setup', 'invite']) {
  app.get(`/${type}/:token`, auth.invitePage(type));
  app.post(`/${type}/:token`, form, auth.accept(type));
}
app.get('/reset/:token', auth.resetPage);
app.post('/reset/:token', form, auth.reset);
app.post('/logout', auth.logout);
app.get('/privacy', auth.privacy);
for (const p of ['/favicon.svg', '/logo.png']) app.get(p, (req, res) => res.sendFile(path.join(ROOT, 'public', p)));
app.use('/fonts', express.static(path.join(ROOT, 'public', 'fonts'), { maxAge: '365d', immutable: true }));

app.use(auth.guard);

app.use('/api/trello', trello);
app.use('/api', apiRouter({ accounts, audit, secrets, store, privacy, trello }));

// The app itself
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, setHeaders: (res, file) => { if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
  app.get('/{*splat}', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(DIST, 'index.html')); });
} else {
  app.get('/', (req, res) => res.type('text').send('Nog geen build gevonden. Draai "npm run build" of gebruik "npm run dev".'));
}

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

function housekeeping() {
  try { accounts.cleanup(); privacy.autoAnonymise(); audit.prune(); }
  catch (e) { console.error('[onderhoud]', e); }
}

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
  housekeeping();
  ownerLinks(process.env.OWNER_RECOVERY === '1');
  // Hourly: expired sessions and links, automatic anonymisation, old audit files, and a fresh setup link while
  // nobody has claimed the Dev account yet.
  setInterval(() => { housekeeping(); ownerLinks(false); }, 36e5).unref();
});
const shutdown = () => {
  store.flush(); accounts.flush(); secrets.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
