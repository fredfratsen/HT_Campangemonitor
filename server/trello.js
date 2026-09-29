// Read-only proxy to the Trello REST API. The API key and token stay on the server (environment variables),
// so they never reach the browser. Only the few GET endpoints the app needs are allowed.
import express from 'express';

const KEY = (process.env.TRELLO_KEY || '').trim();
const TOKEN = (process.env.TRELLO_TOKEN || '').trim();
export const trelloConfigured = () => !!(KEY && TOKEN);

const ALLOWED = [/^\/members\/me$/, /^\/members\/me\/boards$/, /^\/boards\/[0-9a-f]{24}$/];
const TTL = 30 * 1000; // several people opening the app at once share one Trello call
const cache = new Map();

export function trelloRouter() {
  const router = express.Router();
  router.use(async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
    if (!trelloConfigured()) return res.status(503).json({ error: 'trello_not_configured' });
    if (!ALLOWED.some(r => r.test(req.path))) return res.status(404).json({ error: 'not_allowed' });

    const qs = new URLSearchParams(req.originalUrl.split('?')[1] || '');
    qs.delete('key'); qs.delete('token');
    const url = `https://api.trello.com/1${req.path}?${qs}`;

    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < TTL) return res.type('json').send(hit.body);
    try {
      const p = hit && hit.pending ? hit.pending : fetch(url, {
        headers: { Accept: 'application/json', Authorization: `OAuth oauth_consumer_key="${KEY}", oauth_token="${TOKEN}"` },
        signal: AbortSignal.timeout(20000),
      }).then(async r => ({ status: r.status, body: await r.text() }));
      cache.set(url, { ...(hit || {}), pending: p });
      const r = await p;
      if (r.status === 200) cache.set(url, { at: Date.now(), body: r.body });
      else cache.delete(url);
      if (cache.size > 500) cache.delete(cache.keys().next().value);

      if (r.status === 200) return res.type('json').send(r.body);
      if (r.status === 401) return res.status(502).json({ error: 'trello_unauthorized' });
      if (r.status === 429) return res.status(429).json({ error: 'trello_rate_limited' });
      return res.status(502).json({ error: 'trello_error', status: r.status });
    } catch (e) {
      cache.delete(url);
      return res.status(504).json({ error: 'trello_unreachable' });
    }
  });
  return router;
}
