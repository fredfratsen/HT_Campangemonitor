// Audit log: who did what, and when. Security-relevant events only (logins, rights, keys, privacy actions,
// rule and assignment changes), not every feedback edit. One list per month; months older than the retention
// period are deleted. Two backends with one interface:
//
// - createAudit(dataDir): JSON lines in DATA_DIR/audit/2026-09.jsonl, written right away.
// - createBlobAudit(store): Netlify Blobs, key audit/2026-09. Events are collected per request and appended
//   after the request's data was saved (begin/commit, see netlify.js), with a conditional write so concurrent
//   requests don't lose each other's events.
//
// log() is synchronous; query(), prune() and rename() return promises.
import fs from 'node:fs';
import path from 'node:path';

export const AUDIT_MONTHS = 12;

/**
 * @param {string} type    e.g. 'login.ok', 'member.updated'
 * @param {object} o       actor (account), target (account), ip, details (small object)
 */
function entry(type, { actor = null, target = null, ip, details } = {}) {
  const e = { at: Date.now(), type };
  if (actor) { e.actorId = actor.id; e.actorName = actor.name; }
  if (target) { e.targetId = target.id; e.targetName = target.name; }
  if (ip) e.ip = ip;
  if (details && Object.keys(details).length) e.details = details;
  return e;
}
const month = t => new Date(t).toISOString().slice(0, 7);
const cutoff = months => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - months); return d.toISOString().slice(0, 7); };
/** Newest first over months (newest first), with filters. */
function filterRows(monthRows, { before = Infinity, type = '', person = '', limit = 100 }) {
  const out = [];
  for (const rows of monthRows) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const e = rows[i];
      if (e.at >= before || (type && !e.type.startsWith(type)) || (person && e.actorId !== person && e.targetId !== person)) continue;
      out.push(e);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
function renameRows(rows, id, name) {
  let hit = false;
  for (const e of rows) {
    if (e.actorId === id) { e.actorName = name; hit = true; }
    if (e.targetId === id) { e.targetName = name; hit = true; }
  }
  return hit;
}

export function createAudit(dataDir) {
  const dir = path.join(dataDir, 'audit');
  fs.mkdirSync(dir, { recursive: true });
  const files = () => fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort();
  const readFile = f => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);

  return {
    log(type, o) {
      const e = entry(type, o);
      try { fs.appendFileSync(path.join(dir, month(e.at) + '.jsonl'), JSON.stringify(e) + '\n'); } catch (err) { console.error('[audit] schrijven mislukt:', err.message); }
    },
    begin() {},
    async commit() {},
    /** Newest first. Filters: before (timestamp), type (prefix), person (actor or target id), limit. */
    async query(q = {}) { return filterRows(files().reverse().map(readFile), q); },
    async prune(months = AUDIT_MONTHS) {
      const cut = cutoff(months);
      for (const f of files()) if (f.slice(0, 7) < cut) fs.unlinkSync(path.join(dir, f));
    },
    /** Replaces a person's name in all entries (used when an account is anonymised). */
    async rename(id, name) {
      for (const f of files()) {
        const rows = readFile(f);
        if (renameRows(rows, id, name)) fs.writeFileSync(path.join(dir, f), rows.map(e => JSON.stringify(e)).join('\n') + '\n');
      }
    },
  };
}

export function createBlobAudit(storeOrFn) {
  const store = () => typeof storeOrFn === 'function' ? storeOrFn() : storeOrFn;
  const PREFIX = 'audit/';
  let buffer = [];
  const months = async () => (await store().list({ prefix: PREFIX })).blobs.map(b => b.key).sort();
  const read = async k => (await store().get(k, { type: 'json', consistency: 'strong' })) || [];
  /** Read-modify-write with a conditional write, retried when someone else wrote in between. */
  async function update(k, fn) {
    for (let i = 0; i < 10; i++) {
      const r = await store().getWithMetadata(k, { type: 'json', consistency: 'strong' });
      const rows = r && r.data ? r.data : [];
      if (fn(rows) === false) return;
      const res = await store().setJSON(k, rows, r ? { onlyIfMatch: r.etag } : { onlyIfNew: true });
      if (res && res.modified) return;
      await new Promise(ok => setTimeout(ok, 20 + Math.random() * 60));
    }
    console.error('[audit] schrijven mislukt na herhaalde pogingen:', k);
  }

  return {
    log(type, o) { buffer.push(entry(type, o)); },
    /** Start of a request (attempt): forget events of an attempt that was rerun. */
    begin() { buffer = []; },
    /** After the request's data was saved: append its events. */
    async commit() {
      const list = buffer; buffer = [];
      const byMonth = {};
      for (const e of list) (byMonth[month(e.at)] ||= []).push(e);
      for (const [m, rows] of Object.entries(byMonth)) await update(PREFIX + m, all => { all.push(...rows); });
    },
    async query(q = {}) {
      const ks = (await months()).reverse(), out = [];
      for (const k of ks) {
        out.push(...filterRows([await read(k)], { ...q, limit: (q.limit || 100) - out.length }));
        if (out.length >= (q.limit || 100)) break;
      }
      return out;
    },
    async prune(n = AUDIT_MONTHS) {
      const cut = cutoff(n);
      for (const k of await months()) if (k.slice(PREFIX.length) < cut) await store().delete(k);
    },
    async rename(id, name) {
      for (const k of await months()) await update(k, rows => renameRows(rows, id, name));
    },
  };
}
