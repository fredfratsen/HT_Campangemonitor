// Runs the Netlify version locally, the way Netlify serves it: the function for its paths (alternating between
// two function instances that share one Blobs store, like Netlify can), static files from dist/ for the rest.
// Used by the tests; also handy to try the Netlify setup by hand:
//   SECRETS_KEY=dev PORT=8888 BLOB_FILE=/tmp/blobs.json node test/netlify-harness.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createNetlifyHandler, FUNCTION_PATHS } from '../server/netlify.js';
import { FakeBlobStore } from './fake-blobs.js';

const PORT = Number(process.env.PORT) || 8888;
const DIST = path.resolve(import.meta.dirname, '..', 'dist');
const store = new FakeBlobStore(process.env.BLOB_FILE || null);
const handlers = [createNetlifyHandler({ store }), createNetlifyHandler({ store })];
let turn = 0;

const isFunctionPath = p => FUNCTION_PATHS.some(f => f.endsWith('/*') ? p.startsWith(f.slice(0, -1)) : p === f);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!isFunctionPath(url.pathname)) {
    const file = path.join(DIST, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (k !== 'host' && k !== 'connection') headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  const request = new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  // Netlify gives the client IP as context.ip; tests pass a different one with X-Forwarded-For.
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let response;
  try { response = await handlers[turn++ % handlers.length](request, { ip }); }
  catch (e) { console.error('[harness] function error:', e); res.writeHead(500); return res.end(String(e && e.stack)); }
  const out = {};
  response.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) out['set-cookie'] = cookies;
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`Netlify-harness klaar op http://localhost:${PORT}`));
