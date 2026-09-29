// Audit log: who did what, and when. Security-relevant events only (logins, rights, keys, privacy actions,
// rule and assignment changes), not every feedback edit. One JSON line per event in a file per month
// (DATA_DIR/audit/2026-09.jsonl). Files older than the retention period are deleted.
import fs from 'node:fs';
import path from 'node:path';

export const AUDIT_MONTHS = 12;

export function createAudit(dataDir) {
  const dir = path.join(dataDir, 'audit');
  fs.mkdirSync(dir, { recursive: true });
  const fileOf = t => path.join(dir, new Date(t).toISOString().slice(0, 7) + '.jsonl');

  /**
   * @param {string} type    e.g. 'login.ok', 'member.updated'
   * @param {object} o       actor (account), target (account), ip, details (small object)
   */
  function log(type, { actor = null, target = null, ip, details } = {}) {
    const e = { at: Date.now(), type };
    if (actor) { e.actorId = actor.id; e.actorName = actor.name; }
    if (target) { e.targetId = target.id; e.targetName = target.name; }
    if (ip) e.ip = ip;
    if (details && Object.keys(details).length) e.details = details;
    try { fs.appendFileSync(fileOf(e.at), JSON.stringify(e) + '\n'); } catch (err) { console.error('[audit] schrijven mislukt:', err.message); }
  }

  const files = () => fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort();
  const readFile = f => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);

  /** Newest first. Filters: before (timestamp), type (prefix), person (actor or target id), limit. */
  function query({ before = Infinity, type = '', person = '', limit = 100 } = {}) {
    const out = [];
    for (const f of files().reverse()) {
      const rows = readFile(f).reverse();
      for (const e of rows) {
        if (e.at >= before) continue;
        if (type && !e.type.startsWith(type)) continue;
        if (person && e.actorId !== person && e.targetId !== person) continue;
        out.push(e);
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  function prune(months = AUDIT_MONTHS) {
    const d = new Date(); d.setUTCMonth(d.getUTCMonth() - months);
    const cut = d.toISOString().slice(0, 7);
    for (const f of files()) if (f.slice(0, 7) < cut) fs.unlinkSync(path.join(dir, f));
  }

  /** Replaces a person's name in all entries (used when an account is anonymised). */
  function rename(id, name) {
    for (const f of files()) {
      const rows = readFile(f);
      let hit = false;
      for (const e of rows) {
        if (e.actorId === id) { e.actorName = name; hit = true; }
        if (e.targetId === id) { e.targetName = name; hit = true; }
      }
      if (hit) fs.writeFileSync(path.join(dir, f), rows.map(e => JSON.stringify(e)).join('\n') + '\n');
    }
  }

  return { log, query, prune, rename };
}
