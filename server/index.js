// Campagnemonitor web server: serves the built app, stores the shared team data and proxies Trello.
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';
import { createAuth } from './auth.js';
import { trelloRouter, trelloConfigured } from './trello.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DIST = path.join(ROOT, 'dist');

if (PROD && !process.env.APP_PASSWORD) {
  console.error('APP_PASSWORD ontbreekt. Stel een teamwachtwoord in (environment variable) en start opnieuw.');
  process.exit(1);
}
let secret = process.env.SESSION_SECRET;
if (!secret) {
  secret = crypto.randomBytes(32).toString('hex');
  if (PROD) console.warn('SESSION_SECRET ontbreekt: iedereen wordt uitgelogd bij elke herstart.');
}

const store = createStore(DATA_DIR);
const auth = createAuth({ password: process.env.APP_PASSWORD || '', secret, secure: PROD });
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

// Open without login: health check, login page and the assets it uses.
app.get('/healthz', (req, res) => res.type('text').send('ok'));
app.get('/login', auth.loginPage);
app.post('/login', express.urlencoded({ extended: false, limit: '10kb' }), auth.login);
app.post('/logout', auth.logout);
for (const p of ['/favicon.svg', '/logo.png']) app.get(p, (req, res) => res.sendFile(path.join(ROOT, 'public', p)));
app.use('/fonts', express.static(path.join(ROOT, 'public', 'fonts'), { maxAge: '365d', immutable: true }));

app.use(auth.guard);

// API
const api = express.Router();
api.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  // Reject cross-site writes: browsers always send Origin on POST.
  if (req.method !== 'GET' && req.headers.origin) {
    let host = '';
    try { host = new URL(req.headers.origin).host; } catch (e) { /* "null" or malformed */ }
    if (host !== req.headers.host) return res.status(403).json({ error: 'bad_origin' });
  }
  next();
});
api.get('/config', (req, res) => res.json({ trello: trelloConfigured(), auth: auth.enabled }));
api.get('/state', (req, res) => {
  if (req.query.rev != null && Number(req.query.rev) === store.rev) return res.json({ rev: store.rev, unchanged: true });
  res.json({ rev: store.rev, docs: store.docs });
});
api.post('/state/patch', express.json({ limit: '2mb' }), (req, res) => {
  try { res.json({ rev: store.patch(req.body && req.body.patches) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
api.use('/trello', trelloRouter());
api.use((req, res) => res.status(404).json({ error: 'not_found' }));
app.use('/api', api);

// The app itself
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, setHeaders: (res, file) => { if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
  app.get('/{*splat}', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(DIST, 'index.html')); });
} else {
  app.get('/', (req, res) => res.type('text').send('Nog geen build gevonden. Draai "npm run build" of gebruik "npm run dev".'));
}

const server = app.listen(PORT, err => {
  if (err) {
    console.error(err.code === 'EADDRINUSE'
      ? `Poort ${PORT} is al in gebruik. Draait de Campagnemonitor al in een ander terminalvenster? Stop die (Ctrl+C) of kies een andere poort met PORT=3001.`
      : `Server kon niet starten: ${err.message}`);
    process.exit(1);
  }
  console.log(`Campagnemonitor draait op http://localhost:${PORT}`);
  console.log(`  data:   ${DATA_DIR}`);
  console.log(`  login:  ${auth.enabled ? 'teamwachtwoord actief' : 'UIT (geen APP_PASSWORD gezet)'}`);
  console.log(`  trello: ${trelloConfigured() ? 'ingesteld' : 'niet ingesteld (TRELLO_KEY / TRELLO_TOKEN)'}`);
});
const shutdown = () => { store.flush(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
