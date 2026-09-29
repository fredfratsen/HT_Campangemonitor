// Where the JSON documents live (team data, accounts, integration secrets). Two backends with one interface:
//
// - fileDocs(dir): a file per document, kept in memory and written back shortly after each change (atomically,
//   via a temp file), with a dated copy per day. For a long-running server (Render, local development).
// - blobDocs(store): Netlify Blobs, for serverless functions. Every request loads the documents fresh
//   (loadAll), works on them in memory, and writes the changed ones back only if nobody else changed them in
//   the meantime (commitAll, conditional on the ETag). If someone did, the caller reruns the request on the
//   fresh data (see netlify.js), so concurrent saves never overwrite each other.
//
// A document is { data, save(), flush(), isNew, file }. `data` stays the same object for the document's life:
// loading replaces its contents in place, so modules may keep a reference to it.
import fs from 'node:fs';
import path from 'node:path';

export const BACKUP_DAYS = 14;
const fresh = initial => typeof initial === 'function' ? initial() : structuredClone(initial);
const today = () => new Date().toISOString().slice(0, 10);

export function jsonFile(dir, name, initial, { backups = BACKUP_DAYS, mode } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.json`);
  const dated = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d{4}-\\d{2}-\\d{2}\\.json$`);
  let data, isNew = false;
  if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'));
  else { data = fresh(initial); isNew = true; }

  let timer = null;
  function writeNow() {
    clearTimeout(timer); timer = null;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), mode ? { mode } : undefined);
    fs.renameSync(tmp, file);
    if (!backups) return;
    const backup = path.join(dir, `${name}.${today()}.json`);
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(file, backup);
      if (mode) fs.chmodSync(backup, mode);
      const old = fs.readdirSync(dir).filter(f => dated.test(f)).sort().slice(0, -backups);
      for (const f of old) fs.unlinkSync(path.join(dir, f));
    }
  }

  return {
    file, isNew,
    get data() { return data; },
    /** Call after changing `data`; the write happens a moment later so bursts of changes cost one write. */
    save() { if (!timer) timer = setTimeout(writeNow, 300); },
    flush() { if (timer || isNew) { isNew = false; writeNow(); } },
  };
}

/** Document factory for files in `dir`. */
export function fileDocs(dir) {
  const all = [];
  const docs = (name, initial, opts) => { const d = jsonFile(dir, name, initial, opts); all.push(d); return d; };
  docs.flushAll = () => { for (const d of all) d.flush(); };
  return docs;
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
/** What changed from `a` to `b`, as set/delete operations on paths up to `depth` levels deep. */
export function diffOps(a, b, depth = 3, path = [], ops = []) {
  if (depth > 0 && isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in b)) ops.push({ path: [...path, k], del: true });
      else if (!(k in a)) ops.push({ path: [...path, k], value: b[k] });
      else if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffOps(a[k], b[k], depth - 1, [...path, k], ops);
    }
  } else if (JSON.stringify(a) !== JSON.stringify(b)) ops.push({ path, value: b });
  return ops;
}
export function applyOps(target, ops) {
  for (const op of ops) {
    let o = target;
    for (const k of op.path.slice(0, -1)) { if (!isObj(o[k])) o[k] = {}; o = o[k]; }
    const last = op.path[op.path.length - 1];
    if (op.del) delete o[last]; else o[last] = structuredClone(op.value);
  }
  return target;
}

/**
 * Document factory for a Netlify Blobs store (`store` is the store, or a function returning it).
 *
 * commitAll writes the changed documents in the order they were created. If the first changed one conflicts,
 * nothing was written and it returns false: the caller reruns the request on fresh data (so rights are checked
 * against the latest state). If a later one conflicts after an earlier one was written, it merges just the fields
 * this request changed into the latest version (e.g. a session's "last seen" next to someone else's login).
 * Create the busiest document (the team data) first.
 */
export function blobDocs(storeOrFn) {
  const all = [];
  const store = () => typeof storeOrFn === 'function' ? storeOrFn() : storeOrFn;
  function docs(name, initial) {
    const data = fresh(initial);
    let etag = null, dirty = false, snapshot = null;
    const fill = v => { for (const k of Object.keys(data)) delete data[k]; Object.assign(data, v); };
    const d = {
      name, file: null, isNew: false, data,
      get dirty() { return dirty; },
      save() { dirty = true; },
      flush() {},
      async load() {
        const r = await store().getWithMetadata(name, { type: 'json', consistency: 'strong' });
        if (r && r.data) { fill(r.data); snapshot = structuredClone(r.data); etag = r.etag; dirty = false; d.isNew = false; }
        else { fill(fresh(initial)); snapshot = null; etag = null; dirty = true; d.isNew = true; }
      },
      /** Writes the document if it changed. False when someone else changed it first. */
      async commit() {
        if (!dirty) return true;
        const res = await store().setJSON(name, data, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
        if (!res || !res.modified) return false;
        etag = res.etag || null; dirty = false; d.isNew = false;
        return true;
      },
      /** Applies this request's changes to the latest version, retrying until it sticks. */
      async commitMerged() {
        const ops = diffOps(snapshot || {}, data);
        for (let i = 0; i < 10; i++) {
          const r = await store().getWithMetadata(name, { type: 'json', consistency: 'strong' });
          const merged = applyOps(r && r.data ? r.data : fresh(initial), ops);
          const res = await store().setJSON(name, merged, r ? { onlyIfMatch: r.etag } : { onlyIfNew: true });
          if (res && res.modified) { fill(merged); snapshot = structuredClone(merged); etag = res.etag || null; dirty = false; return; }
          await new Promise(ok => setTimeout(ok, 20 + Math.random() * 60));
        }
        throw new Error(`Opslaan van ${name} mislukt na herhaalde pogingen`);
      },
      /** A dated copy per day, the last BACKUP_DAYS kept. */
      async backup() {
        const s = store(), prefix = `backups/${name}/`;
        await s.setJSON(prefix + today(), data, { onlyIfNew: true });
        const { blobs } = await s.list({ prefix });
        const old = blobs.map(b => b.key).sort().slice(0, -BACKUP_DAYS);
        for (const k of old) await s.delete(k);
      },
    };
    all.push(d);
    return d;
  }
  docs.loadAll = () => Promise.all(all.map(d => d.load()));
  docs.commitAll = async () => {
    let written = false;
    for (const d of all) {
      if (!d.dirty) continue;
      if (await d.commit()) { written = true; continue; }
      if (!written) return false; // nothing written yet: rerun the request on fresh data
      await d.commitMerged();
    }
    return true;
  };
  docs.backupAll = async () => { for (const d of all) await d.backup(); };
  docs.flushAll = () => {};
  return docs;
}
