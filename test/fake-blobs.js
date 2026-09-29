// An in-memory stand-in for a Netlify Blobs store, with the same conditional-write behaviour (onlyIfMatch,
// onlyIfNew) and small random delays, so concurrent requests really interleave. Optionally kept in a JSON file,
// so a restarted test server sees the same data.
import fs from 'node:fs';

export class FakeBlobStore {
  constructor(file = null) {
    this.file = file;
    this.map = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    this.n = Object.keys(this.map).length; this.writes = 0; this.conflicts = 0;
  }
  persist() { if (this.file) fs.writeFileSync(this.file, JSON.stringify(this.map)); }
  delay() { return new Promise(r => setTimeout(r, Math.random() * 4)); }
  async getWithMetadata(key, { type } = {}) {
    await this.delay();
    const e = this.map[key];
    return e ? { data: type === 'json' ? JSON.parse(e.v) : e.v, etag: e.etag, metadata: {} } : null;
  }
  async get(key, o) { const r = await this.getWithMetadata(key, o); return r ? r.data : null; }
  async setJSON(key, data, { onlyIfMatch, onlyIfNew } = {}) {
    await this.delay();
    const e = this.map[key];
    if ((onlyIfNew && e) || (onlyIfMatch && (!e || e.etag !== onlyIfMatch))) { this.conflicts++; return { modified: false }; }
    const etag = `"${++this.n}"`;
    this.map[key] = { v: JSON.stringify(data), etag };
    this.writes++; this.persist();
    return { modified: true, etag };
  }
  async list({ prefix = '' } = {}) {
    await this.delay();
    return { blobs: Object.keys(this.map).filter(k => k.startsWith(prefix)).map(key => ({ key, etag: this.map[key].etag })), directories: [] };
  }
  async delete(key) { await this.delay(); delete this.map[key]; this.persist(); }
}
