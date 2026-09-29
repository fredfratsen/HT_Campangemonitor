// Keeps the shared part of the app state in sync with the server, so everyone on the team sees the same data.
//
// Every shared document is a flat map of key -> value (a campaign by id, a rule by name, ...). After each state
// change only the entries that actually changed are sent, so two people saving different campaigns at the same
// moment never overwrite each other. Other people's changes arrive by polling.
//
// The server checks every change against the rights of whoever is logged in. Changes it refuses come back as
// `rejected`: those keys are not sent again this session, and the server's version is loaded instead.
//
// Without a server (e.g. the built files opened as a static site) it falls back to this browser's localStorage.
import { DEF_RULES } from './constants.js';
import { lsGet, lsSet } from './helpers.js';

const LOCAL_KEY = 'ht-cm-shared-v1';
const POLL_MS = 15000;

const byId = arr => { const m = {}; for (const x of arr) m[String(x.id)] = x; return m; };
const tsOf = x => parseFloat(String(x.id)) || 0;

/** App state -> shared documents. A document is left out while its data isn't loaded, so it is never wiped. */
export function toDocs(st) {
  const camps = st.source === 'trello' ? st.demoCampaigns : st.campaigns;
  const L = st.live;
  return {
    campaigns: camps ? byId(camps) : undefined,
    rules: st.rules,
    trIgnored: st.trIgnored,
    mktDemo: st.mktDemo,
    'live.links': L && byId(L.links || []),
    'live.fb': L && (L.fb || {}),
    'live.actions': L && (L.actions || {}),
    'live.ignored': L && (L.ignored || {}),
    'live.inactive': L && (L.inactive || {}),
    'live.mkt': L && (L.mkt || {}),
    assignLog: st.assignLog && byId(st.assignLog),
    inbox: st.inbox && byId(st.inbox),
    ideas: st.ideas && byId(st.ideas),
    seen: st.seen,
    meta: st.meta,
  };
}

/** Shared documents -> the matching slices of app state. */
export function fromDocs(docs) {
  const d = name => docs[name] || {};
  const rules = d('rules');
  return {
    campaigns: Object.values(d('campaigns')),
    rules: { ...DEF_RULES, ...rules },
    trIgnored: d('trIgnored'),
    mktDemo: d('mktDemo'),
    live: { links: Object.values(d('live.links')), fb: d('live.fb'), actions: d('live.actions'), ignored: d('live.ignored'), inactive: d('live.inactive'), mkt: d('live.mkt') },
    assignLog: Object.values(d('assignLog')).sort((a, b) => b.at - a.at),
    inbox: Object.values(d('inbox')).sort((a, b) => tsOf(b) - tsOf(a)),
    ideas: Object.values(d('ideas')).sort((a, b) => tsOf(b) - tsOf(a)),
    seen: d('seen'),
    meta: d('meta'),
  };
}

const serialize = docs => {
  const out = {};
  for (const [name, m] of Object.entries(docs || {})) {
    out[name] = {};
    for (const [k, v] of Object.entries(m || {})) out[name][k] = JSON.stringify(v);
  }
  return out;
};
const SLICES = ['campaigns', 'demoCampaigns', 'source', 'rules', 'trIgnored', 'mktDemo', 'live', 'assignLog', 'inbox', 'ideas', 'seen', 'meta'];

class AuthLost extends Error {}

export class Sync {
  /**
   * @param {object} o
   * @param {() => object} o.getState   current app state
   * @param {(docs: object, done: () => void) => void} o.apply   put remote documents into app state, call done() once applied
   * @param {(status: 'ok'|'offline') => void} o.onStatus
   * @param {(rejected: {doc: string, key: string}[]) => void} [o.onRejected]   changes the server refused
   */
  constructor({ getState, apply, onStatus, onRejected = () => {} }) {
    this.getState = getState; this.apply = apply; this.onStatus = onStatus; this.onRejected = onRejected;
    this.mode = 'local'; this.config = { trello: false, auth: false }; this.rev = 0; this.base = {};
    this.ready = false; this.busy = false; this.again = false; this.pullSoon = false; this.failures = 0; this.lastRefs = null;
    this.blocked = new Set(); this.full = false;
  }

  async req(method, url, body) {
    const r = await fetch(url, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401) throw new AuthLost();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  authLost() { window.location.href = '/login'; }

  /** The logged-in account and the team, or null without a server. */
  async me() {
    if (this.mode !== 'server') return null;
    try { return await this.req('GET', '/api/me'); }
    catch (e) { if (e instanceof AuthLost) this.authLost(); throw e; }
  }

  /** Detects the server and loads the shared documents. */
  async start() {
    try {
      this.config = await this.req('GET', '/api/config');
      this.mode = 'server';
    } catch (e) {
      if (e instanceof AuthLost) { this.authLost(); return null; }
      this.mode = 'local';
    }
    let docs;
    if (this.mode === 'server') {
      const r = await this.req('GET', '/api/state');
      docs = r.docs; this.rev = r.rev;
    } else {
      docs = (lsGet(LOCAL_KEY, null) || {}).docs || {};
    }
    this.base = serialize(docs);
    return docs;
  }

  /** Call once the loaded documents are in app state: starts saving and polling. */
  begin() {
    this.ready = true;
    this.changed();
    if (this.mode !== 'server') return;
    this.timer = setInterval(() => { if (!document.hidden) this.pull(); }, POLL_MS);
    this.onVisible = () => { if (!document.hidden) this.pull(); };
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('focus', this.onVisible);
    this.onUnload = () => { const p = this.diff(); if (p.length && navigator.sendBeacon) navigator.sendBeacon('/api/state/patch', new Blob([JSON.stringify({ patches: p.map(({ doc, set, del }) => ({ doc, set, del })) })], { type: 'application/json' })); };
    window.addEventListener('pagehide', this.onUnload);
  }

  stop() {
    clearInterval(this.timer); clearTimeout(this.t);
    if (this.onVisible) { document.removeEventListener('visibilitychange', this.onVisible); window.removeEventListener('focus', this.onVisible); }
    if (this.onUnload) window.removeEventListener('pagehide', this.onUnload);
  }

  /** Call after every state update (componentDidUpdate). Cheap when nothing shared changed. */
  changed() {
    if (!this.ready) return;
    const st = this.getState(), refs = SLICES.map(k => st[k]);
    if (this.lastRefs && refs.every((r, i) => r === this.lastRefs[i])) return;
    this.lastRefs = refs;
    clearTimeout(this.t);
    this.t = setTimeout(() => this.flush(), 150);
  }

  diff() {
    const docs = toDocs(this.getState()), patches = [];
    for (const [name, m] of Object.entries(docs)) {
      if (!m) continue;
      const b = this.base[name] || {}, set = {}, json = {}, del = [];
      for (const k of Object.keys(m)) {
        if (this.blocked.has(name + '/' + k)) continue;
        const j = JSON.stringify(m[k]);
        if (j !== undefined && b[k] !== j) { set[k] = m[k]; json[k] = j; }
      }
      for (const k of Object.keys(b)) if (!(k in m) && !this.blocked.has(name + '/' + k)) del.push(k);
      if (del.length || Object.keys(set).length) patches.push({ doc: name, set, del, json });
    }
    return patches;
  }

  commit(patches) {
    for (const p of patches) {
      const b = this.base[p.doc] || (this.base[p.doc] = {});
      Object.assign(b, p.json);
      for (const k of p.del) delete b[k];
    }
  }

  async flush() {
    if (!this.ready) return;
    if (this.busy) { this.again = true; return; }
    const patches = this.diff();
    if (!patches.length) return;
    this.busy = true;
    try {
      if (this.mode === 'server') {
        const r = await this.req('POST', '/api/state/patch', { patches: patches.map(({ doc, set, del }) => ({ doc, set, del })) });
        // If someone else saved in between, keep the old rev so the next pull fetches their changes too.
        if (r.rev === this.rev + 1) this.rev = r.rev; else this.pullSoon = true;
        this.commit(patches);
        if (r.rejected && r.rejected.length) {
          for (const x of r.rejected) this.blocked.add(x.doc + '/' + x.key);
          this.full = true; this.pullSoon = true;
          this.onRejected(r.rejected);
        }
      } else {
        this.commit(patches);
        const docs = toDocs(this.getState()), out = {};
        for (const [k, v] of Object.entries(docs)) if (v) out[k] = v;
        lsSet(LOCAL_KEY, { docs: out });
      }
      if (this.failures) { this.failures = 0; this.onStatus('ok'); }
    } catch (e) {
      if (e instanceof AuthLost) { this.authLost(); return; }
      this.failures++;
      this.onStatus('offline');
      setTimeout(() => this.flush(), Math.min(30000, 2000 * this.failures));
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.flush(); }
      else if (this.pullSoon) { this.pullSoon = false; this.pull(); }
    }
  }

  /** Fetches other people's changes. Local unsaved edits are always pushed first. */
  async pull() {
    if (this.mode !== 'server' || !this.ready) return;
    if (this.busy) { this.pullSoon = true; return; }
    if (this.diff().length) { this.pullSoon = true; this.flush(); return; }
    try {
      const r = await this.req('GET', this.full ? '/api/state' : '/api/state?rev=' + this.rev);
      if (this.failures) { this.failures = 0; this.onStatus('ok'); }
      if (r.unchanged) return;
      if (this.busy || this.diff().length) { this.pullSoon = true; return; }
      // Only move the baseline once React has applied the new state, so a save in between can't send stale data.
      this.apply(r.docs, () => { this.base = serialize(r.docs); this.rev = r.rev; this.full = false; this.changed(); });
    } catch (e) {
      if (e instanceof AuthLost) this.authLost();
      else { this.failures++; this.onStatus('offline'); }
    }
  }
}
