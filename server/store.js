// Shared app data: a handful of documents, each a flat map key -> value, kept in memory and written to a
// JSON file. One file is plenty for a team this size. A dated copy is kept per day (last 14 days) as a safety net.
import fs from 'node:fs';
import path from 'node:path';

export const DOCS = new Set(['campaigns', 'rules', 'trIgnored', 'mktDemo', 'live.links', 'live.fb', 'live.actions', 'live.ignored', 'live.inactive', 'live.mkt', 'assignLog', 'inbox', 'ideas', 'seen', 'meta']);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const KEEP_BACKUPS = 14;

export function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'campagnemonitor.json');
  let state = { rev: 0, docs: {} };
  if (fs.existsSync(file)) {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(`[store] ${file} geladen (rev ${state.rev})`);
  } else {
    console.log(`[store] nieuw databestand: ${file}`);
  }

  let timer = null;
  function writeNow() {
    clearTimeout(timer); timer = null;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, file);
    const day = new Date().toISOString().slice(0, 10), backup = path.join(dir, `campagnemonitor.${day}.json`);
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(file, backup);
      const old = fs.readdirSync(dir).filter(f => /^campagnemonitor\.\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(0, -KEEP_BACKUPS);
      for (const f of old) fs.unlinkSync(path.join(dir, f));
    }
  }
  const scheduleWrite = () => { if (!timer) timer = setTimeout(writeNow, 300); };

  /** Validates and applies [{ doc, set: {key: value}, del: [key] }]. Throws on bad input without changing anything. */
  function patch(patches) {
    if (!Array.isArray(patches) || patches.length > 50) throw new Error('patches must be an array');
    for (const p of patches) {
      if (!p || !DOCS.has(p.doc)) throw new Error('unknown doc ' + (p && p.doc));
      if (p.set != null && (typeof p.set !== 'object' || Array.isArray(p.set))) throw new Error('set must be an object');
      if (p.del != null && !Array.isArray(p.del)) throw new Error('del must be an array');
      for (const k of [...Object.keys(p.set || {}), ...(p.del || [])]) {
        if (typeof k !== 'string' || k.length > 300 || BAD_KEYS.has(k)) throw new Error('bad key');
      }
    }
    for (const p of patches) {
      const d = state.docs[p.doc] || (state.docs[p.doc] = {});
      for (const [k, v] of Object.entries(p.set || {})) d[k] = v;
      for (const k of p.del || []) delete d[k];
    }
    state.rev++;
    scheduleWrite();
    return state.rev;
  }

  return {
    get rev() { return state.rev; },
    get docs() { return state.docs; },
    patch,
    flush() { if (timer) writeNow(); },
  };
}
