// Campagnemonitor as a Netlify Function. The same Express app as on Render (app.js), with the documents in
// Netlify Blobs instead of files.
//
// Serverless functions keep nothing between requests and can run as several instances at once, so every
// request: loads the documents fresh, runs the app, then saves the changed documents only if nobody else changed
// them in the meantime. If someone did, the request is run again on the fresh data before anything is sent back,
// so two people saving at the same moment never overwrite each other. Audit events are written after the save.
import serverless from 'serverless-http';
import { createServer } from './app.js';
import { blobDocs } from './jsonfile.js';
import { createBlobAudit } from './audit.js';
import { deriveKey } from './crypto.js';
import { page, esc } from './pages.js';

const ATTEMPTS = 6, HOUSEKEEPING_MS = 36e5;

/** Web Request → the event format serverless-http understands (API Gateway v2). */
async function toEvent(request, context) {
  const url = new URL(request.url), headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  // The public host and protocol, so same-origin checks and links match what the browser sees.
  headers.host = url.host;
  headers['x-forwarded-proto'] = url.protocol.slice(0, -1);
  const ip = context.ip || headers['x-nf-client-connection-ip'] || '';
  if (ip) headers['x-forwarded-for'] = ip;
  const body = request.method === 'GET' || request.method === 'HEAD' ? '' : Buffer.from(await request.arrayBuffer()).toString('base64');
  return {
    version: '2.0', rawPath: url.pathname, rawQueryString: url.search.slice(1), headers, body, isBase64Encoded: true,
    requestContext: { http: { method: request.method, sourceIp: ip || '0.0.0.0' } },
  };
}

/** serverless-http's result → web Response. */
function toResponse(r) {
  const h = new Headers();
  for (const [k, v] of Object.entries(r.headers || {})) {
    if (!['set-cookie', 'content-length', 'transfer-encoding'].includes(k.toLowerCase())) h.set(k, String(v));
  }
  const cookies = [...(r.cookies || [])];
  if (!cookies.length && r.headers && r.headers['set-cookie']) cookies.push(String(r.headers['set-cookie']));
  for (const c of cookies) h.append('Set-Cookie', c);
  const empty = r.statusCode === 204 || r.statusCode === 304 || !r.body;
  return new Response(empty ? null : (r.isBase64Encoded ? Buffer.from(r.body, 'base64') : r.body), { status: r.statusCode, headers: h });
}

function configError(request, text) {
  const api = new URL(request.url).pathname.startsWith('/api/');
  return api
    ? Response.json({ error: 'server_config', message: text }, { status: 500 })
    : new Response(page({ title: 'Instelling ontbreekt', body: `<div><h1>Instelling ontbreekt</h1><p>${esc(text)}</p></div>` }), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

/**
 * @param {object} o
 * @param o.store  the Netlify Blobs store, or a function returning it
 * @param o.env    environment variables (SECRETS_KEY is required)
 */
export function createNetlifyHandler({ store, env = process.env }) {
  let inst = null;
  function instance() {
    if (inst) return inst;
    const docs = blobDocs(store), audit = createBlobAudit(store);
    const s = createServer({ docs, audit, secretsKey: [deriveKey(env.SECRETS_KEY)], secure: true, hosting: 'netlify', pollMs: 60000 });
    inst = { ...s, docs, handle: serverless(s.app, { binary: false }) };
    return inst;
  }

  // One request at a time per instance: the documents are this instance's working copy. (On Netlify an instance
  // normally gets one request at a time anyway; this makes sure of it.)
  let queue = Promise.resolve();
  return function handler(request, context = {}) {
    const run = queue.then(() => handle(request, context));
    queue = run.catch(() => {});
    return run;
  };

  async function handle(request, context) {
    if (!env.SECRETS_KEY) return configError(request, 'SECRETS_KEY ontbreekt. Zet in Netlify onder Site configuration › Environment variables een lange willekeurige waarde voor SECRETS_KEY en deploy opnieuw.');
    const I = instance(), event = await toEvent(request, context);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      await I.docs.loadAll();
      I.audit.begin();
      // Housekeeping on the first request after an hour (there are no timers in a function).
      const meta = I.accounts.meta, tidy = Date.now() - (meta.lastHousekeeping || 0) > HOUSEKEEPING_MS;
      if (tidy) { meta.lastHousekeeping = Date.now(); await I.housekeeping(); }
      const res = await I.handle(event, {});
      if (await I.docs.commitAll()) {
        await I.audit.commit();
        if (tidy) await I.docs.backupAll().catch(e => console.error('[backup]', e));
        return toResponse(res);
      }
      await new Promise(ok => setTimeout(ok, 25 + Math.random() * 75 * (attempt + 1)));
    }
    return new Response('Het is even druk. Probeer het zo opnieuw.', { status: 503, headers: { 'Retry-After': '2' } });
  }
}

/** The paths the function handles; everything else is the static app. */
export const FUNCTION_PATHS = ['/api/*', '/login', '/login/*', '/logout', '/setup', '/setup/*', '/invite/*', '/reset/*', '/privacy', '/healthz'];
