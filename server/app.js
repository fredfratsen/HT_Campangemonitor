// Builds the Express app with all its parts. Used by server/index.js (a long-running server: Render, local
// development) and by server/netlify.js (a Netlify Function), which differ only in where documents are stored.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createStore } from './store.js';
import { createAccounts } from './accounts.js';
import { createAuth, sameOrigin } from './auth.js';
import { createSecrets } from './secrets.js';
import { createPrivacy } from './privacy.js';
import { createBlacklist } from './blacklist.js';
import { createMailer } from './mail.js';
import { trelloRouter } from './trello.js';
import { apiRouter } from './api.js';

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

/**
 * @param {object} o
 * @param o.docs        document factory (fileDocs or blobDocs from jsonfile.js)
 * @param o.audit       createAudit or createBlobAudit from audit.js
 * @param o.secretsKey  encryption keys from crypto.js
 * @param o.secure      secure (HTTPS-only) cookies
 * @param o.hosting     'render' or 'netlify': texts about where things run and where logs are
 * @param o.pollMs      how often the app checks for other people's changes
 * @param o.deferMail   send mails only at mailer.commit(), after the data was saved (Netlify; see mail.js)
 * @param o.publicDir   serve logo, favicon and fonts (a long-running server; Netlify serves them as static files)
 * @param o.distDir     serve the built app
 */
export function createServer({ docs, audit, secretsKey, secure, hosting = 'render', pollMs = 15000, deferMail = false, publicDir = null, distDir = null }) {
  // Created in this order on purpose: the team data first (see blobDocs).
  const store = createStore(docs);
  const secrets = createSecrets(docs, secretsKey);
  const accounts = createAccounts(docs, secretsKey);
  const blacklist = createBlacklist(docs);
  const privacy = createPrivacy({ accounts, store, audit, blacklist });
  const auth = createAuth({ accounts, audit, secure, hosting });
  const mailer = createMailer({ secrets, audit, deferred: deferMail });
  const trello = trelloRouter(() => secrets.get('trello'));

  const app = express();
  app.set('trust proxy', 1); // Render and Netlify sit behind a proxy
  app.disable('x-powered-by');
  app.use((req, res, next) => { for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v); next(); });
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
  app.get('/setup', auth.setupStart);
  for (const type of ['setup', 'invite']) {
    app.get(`/${type}/:token`, auth.invitePage(type));
    app.post(`/${type}/:token`, form, auth.accept(type));
  }
  app.get('/reset/:token', auth.resetPage);
  app.post('/reset/:token', form, auth.reset);
  app.post('/logout', auth.logout);
  app.get('/privacy', auth.privacy);
  if (publicDir) {
    for (const p of ['/favicon.svg', '/logo.png']) app.get(p, (req, res) => res.sendFile(path.join(publicDir, p)));
    app.use('/fonts', express.static(path.join(publicDir, 'fonts'), { maxAge: '365d', immutable: true }));
  }

  app.use(auth.guard);

  app.use('/api/trello', trello);
  app.use('/api', apiRouter({ accounts, audit, secrets, store, privacy, trello, blacklist, mailer, pollMs }));

  // The app itself
  if (distDir && fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false, setHeaders: (res, file) => { if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
    app.get('/{*splat}', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(distDir, 'index.html')); });
  } else if (distDir) {
    app.get('/', (req, res) => res.type('text').send('Nog geen build gevonden. Draai "npm run build" of gebruik "npm run dev".'));
  }

  /** Expired sessions and links, automatic anonymisation, old audit months, blacklist entries whose term ended. */
  async function housekeeping() {
    accounts.cleanup();
    await privacy.autoAnonymise();
    await audit.prune();
    for (const e of blacklist.prune()) audit.log('blacklist.expired', { details: blacklist.auditDetails(e, { status: e.status }) });
  }

  return { app, store, accounts, secrets, audit, privacy, blacklist, mailer, housekeeping };
}
