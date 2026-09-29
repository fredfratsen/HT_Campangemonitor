// Team password gate. One shared password (APP_PASSWORD) protects the whole site; after logging in, people
// pick who they are in the app, as in the design. Sessions are signed cookies, so no session store is needed.
// Changing APP_PASSWORD logs everyone out.
import crypto from 'node:crypto';
import fs from 'node:fs';

const COOKIE = 'htcm_session';
const MAX_AGE_DAYS = 30;
const sha = s => crypto.createHash('sha256').update(s).digest();

export function createAuth({ password, secret, secure }) {
  const enabled = !!password;
  const pwHash = sha(password || '');
  const sign = exp => crypto.createHmac('sha256', secret).update(`${exp}.${pwHash.toString('hex')}`).digest('base64url');

  const readCookie = req => {
    const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
    return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : '';
  };
  function valid(req) {
    if (!enabled) return true;
    const [exp, sig] = readCookie(req).split('.');
    if (!exp || !sig || !(+exp > Date.now())) return false;
    const want = Buffer.from(sign(exp)), got = Buffer.from(sig);
    return want.length === got.length && crypto.timingSafeEqual(want, got);
  }
  const cookieAttrs = maxAge => `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

  // Simple brute-force protection: max 10 failed attempts per IP per 15 minutes.
  const fails = new Map();
  const WINDOW = 15 * 60 * 1000, MAX_FAILS = 10;
  const blocked = ip => { const f = fails.get(ip); return f && Date.now() - f.since < WINDOW && f.n >= MAX_FAILS; };
  const fail = ip => {
    if (fails.size > 5000) for (const [k, f] of fails) if (Date.now() - f.since >= WINDOW) fails.delete(k);
    const f = fails.get(ip);
    if (!f || Date.now() - f.since >= WINDOW) fails.set(ip, { n: 1, since: Date.now() }); else f.n++;
  };

  const loginHtml = fs.readFileSync(new URL('./login.html', import.meta.url), 'utf8');
  const page = (msg = '') => loginHtml.replace('{{error}}', msg ? `<p class="err">${msg}</p>` : '');

  return {
    enabled,
    /** Blocks everything except the login page and its assets until logged in. */
    guard(req, res, next) {
      if (valid(req)) return next();
      if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthenticated' });
      if (req.method === 'GET' && req.accepts('html')) return res.redirect('/login');
      return res.status(401).end();
    },
    loginPage(req, res) {
      if (!enabled || valid(req)) return res.redirect('/');
      res.type('html').send(page());
    },
    login(req, res) {
      if (!enabled) return res.redirect('/');
      const ip = req.ip;
      if (blocked(ip)) return res.status(429).type('html').send(page('Te veel pogingen. Probeer het over een kwartier opnieuw.'));
      const given = sha(String((req.body && req.body.password) || ''));
      if (!crypto.timingSafeEqual(given, pwHash)) { fail(ip); return res.status(401).type('html').send(page('Onjuist wachtwoord.')); }
      fails.delete(ip);
      const exp = String(Date.now() + MAX_AGE_DAYS * 864e5);
      res.setHeader('Set-Cookie', `${COOKIE}=${exp}.${sign(exp)}; ${cookieAttrs(MAX_AGE_DAYS * 86400)}`);
      res.redirect('/');
    },
    logout(req, res) {
      res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieAttrs(0)}`);
      res.redirect('/login');
    },
  };
}
