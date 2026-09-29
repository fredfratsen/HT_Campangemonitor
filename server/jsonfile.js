// A JSON file kept in memory and written back shortly after each change (atomically, via a temp file). A dated
// copy is kept per day as a safety net. Used for the team data, the accounts and the integration secrets.
import fs from 'node:fs';
import path from 'node:path';

export function jsonFile(dir, name, initial, { backups = 14, mode } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.json`);
  const dated = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d{4}-\\d{2}-\\d{2}\\.json$`);
  let data, isNew = false;
  if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'));
  else { data = typeof initial === 'function' ? initial() : initial; isNew = true; }

  let timer = null;
  function writeNow() {
    clearTimeout(timer); timer = null;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), mode ? { mode } : undefined);
    fs.renameSync(tmp, file);
    if (!backups) return;
    const day = new Date().toISOString().slice(0, 10), backup = path.join(dir, `${name}.${day}.json`);
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
    set data(v) { data = v; },
    /** Call after changing `data`; the write happens a moment later so bursts of changes cost one write. */
    save() { if (!timer) timer = setTimeout(writeNow, 300); },
    flush() { if (timer || isNew) { isNew = false; writeNow(); } },
  };
}
