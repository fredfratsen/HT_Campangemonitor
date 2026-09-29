// Shared app data: a handful of documents, each a flat map key -> value, kept as one JSON document (a file with
// daily backups, or a Netlify Blob; see jsonfile.js). One document is plenty for a team this size.

export const DOCS = new Set(['campaigns', 'rules', 'trIgnored', 'mktDemo', 'live.links', 'live.fb', 'live.actions', 'live.ignored', 'live.inactive', 'live.mkt', 'assignLog', 'inbox', 'ideas', 'seen', 'meta']);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** @param docs  document factory from jsonfile.js (files or Netlify Blobs) */
export function createStore(docs) {
  const f = docs('campagnemonitor', () => ({ rev: 0, docs: {} }));
  if (f.file) console.log(f.isNew ? `[store] nieuw databestand: ${f.file}` : `[store] ${f.file} geladen (rev ${f.data.rev})`);
  const state = f.data;

  /** Checks the shape of [{ doc, set: {key: value}, del: [key] }]. Throws on bad input. */
  function validate(patches) {
    if (!Array.isArray(patches) || patches.length > 50) throw new Error('patches must be an array');
    for (const p of patches) {
      if (!p || !DOCS.has(p.doc)) throw new Error('unknown doc ' + (p && p.doc));
      if (p.set != null && (typeof p.set !== 'object' || Array.isArray(p.set))) throw new Error('set must be an object');
      if (p.del != null && !Array.isArray(p.del)) throw new Error('del must be an array');
      for (const k of [...Object.keys(p.set || {}), ...(p.del || [])]) {
        if (typeof k !== 'string' || k.length > 300 || BAD_KEYS.has(k)) throw new Error('bad key');
      }
    }
  }

  /**
   * Applies validated patches. `authorize(doc, key, before, after)` returns '' to allow a change, or a reason to
   * reject it; it may also return { value } to store a corrected value (e.g. the author name filled in by the
   * server). Rejected keys are skipped, the rest is applied. Returns { rev, rejected: [{doc, key, reason}], applied }.
   */
  function patch(patches, authorize = () => '') {
    validate(patches);
    const rejected = [], applied = [];
    for (const p of patches) {
      const d = state.docs[p.doc] || {};
      const changes = [...Object.entries(p.set || {}).map(([k, v]) => [k, v]), ...(p.del || []).map(k => [k, undefined])];
      for (const [k, v] of changes) {
        const before = Object.prototype.hasOwnProperty.call(d, k) ? d[k] : undefined;
        if (JSON.stringify(before) === JSON.stringify(v)) continue;
        const res = authorize(p.doc, k, before, v);
        if (typeof res === 'string' && res) { rejected.push({ doc: p.doc, key: k, reason: res }); continue; }
        const value = res && typeof res === 'object' && 'value' in res ? res.value : v;
        const doc = state.docs[p.doc] || (state.docs[p.doc] = {});
        if (value === undefined) delete doc[k]; else doc[k] = value;
        applied.push({ doc: p.doc, key: k, before, after: value });
      }
    }
    if (applied.length) { state.rev++; f.save(); }
    return { rev: state.rev, rejected, applied };
  }

  /** Server-side edits (anonymisation): fn(docs) changes documents in place. */
  function mutate(fn) { fn(state.docs); state.rev++; f.save(); }

  return {
    get rev() { return state.rev; },
    get docs() { return state.docs; },
    patch, mutate,
    flush: f.flush,
  };
}
