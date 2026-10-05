// Small formatting helpers and the campaign health rules.

export const qc = q => q == null ? '#8C8C8A' : q >= 7 ? '#1A7A4A' : q >= 5 ? '#B45309' : '#D32F2F';
export const qb = q => q == null ? '#F5F2ED' : q >= 7 ? '#E6F4ED' : q >= 5 ? '#FEF3C7' : '#FDECEA';
export const nl = n => (Math.round(n * 10) / 10).toString().replace('.', ',');
export const avgOf = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
export const sgn = (n, unit = '') => n > 0 ? `+${nl(n)}${unit}` : n < 0 ? `−${nl(-n)}${unit}` : `±0${unit}`;
export const reasonList = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ t, n }));
export function agoTxt(iso) { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5); return d <= 0 ? 'vandaag actief' : d === 1 ? 'gisteren actief' : `${d} dagen geleden actief`; }
export const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };

/** Deterministic pseudo-random 0..1 from a string (FNV-1a). */
export function rnd(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }

/** Health level (0 goed, 1 monitoren, 2 actie nodig) and the rules that fired. */
export function health(c, R) {
  const ws = c.weeks, cur = ws[ws.length - 1], reasons = [];
  const qs = ws.filter(w => w.q != null).map(w => w.q);
  const lastQ = qs.length ? qs[qs.length - 1] : null;
  let lvl = 0;
  const add = (l, t, k) => { reasons.push({ l, t, k }); lvl = Math.max(lvl, l); };
  if (R.qRedOn && lastQ != null && lastQ <= R.qRed) add(2, `Kwaliteit ${lastQ}/10`, 'qRed');
  if (R.declOn && qs.length > R.declWeeks) {
    let d = true;
    for (let i = 0; i < R.declWeeks; i++) if (!(qs[qs.length - 1 - i] < qs[qs.length - 2 - i])) d = false;
    if (d) add(2, `${R.declWeeks} weken dalende kwaliteit`, 'decl');
  }
  if (R.minLeadsOn && cur.leads <= R.minLeads) add(2, `Maar ${cur.leads} kandidaten`, 'minLeads');
  if (R.manualOn && cur.needsAction) add(2, 'Bijsturing gevraagd', 'manual');
  if (R.qOrangeOn && lastQ != null && lastQ > (R.qRedOn ? R.qRed : 0) && lastQ <= R.qOrange) add(1, `Kwaliteit ${lastQ}/10`, 'qOrange');
  if (R.dropOn && ws.length >= 3) {
    const prior = ws.slice(-4, -1), avg = prior.reduce((s, w) => s + w.leads, 0) / prior.length;
    if (cur.leads <= avg * (1 - R.dropPct / 100)) add(1, `Instroom −${Math.round((1 - cur.leads / avg) * 100)}%`, 'drop');
  }
  if (R.missingOn && cur.q == null) add(1, 'Feedback ontbreekt', 'missing');
  return { lvl, reasons };
}

/**
 * Monitor status this week, from the marketeer's choice (week field `mon`) and the health h:
 * - 'klant': waiting for the client. Stays on in later weeks until someone sets another status.
 * - 'check': a marketeer checked it this week, whatever its scores. A signal that wasn't there at the check
 *   (`monSig`) puts it back on 'actie' (`stale`). Without any signal a campaign is 'check' by itself.
 * - 'actie': everything else (at least one rule fires).
 * `mon: 'open'` clears an earlier choice. Returns { s, by, w, stale }; `by` is empty when nobody set it.
 */
export function monitor(c, h) {
  const ws = c.weeks, cur = ws[ws.length - 1], set = [...ws].reverse().find(w => w.mon);
  if (set && set.mon === 'klant') return { s: 'klant', by: set.monBy || '', w: set.w, stale: false };
  const checked = cur.mon === 'check', fresh = checked && h.reasons.every(r => (cur.monSig || []).includes(r.k));
  if (fresh) return { s: 'check', by: cur.monBy || '', w: cur.w, stale: false };
  return { s: h.lvl ? 'actie' : 'check', by: '', w: null, stale: checked };
}
