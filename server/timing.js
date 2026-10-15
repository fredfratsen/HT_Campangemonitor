// Tijdwinst: the team's active time in the app per feedback week and kind of screen (sent by the browsers, see
// src/lib/activity.js), and the agreed minutes per task from before the app (src/lib/timesaved.js). Its own document
// (DATA_DIR/timing.json, or a Netlify Blob), only readable through /api/timing with the right "timesaved".
//
// Only totals are stored: no account, name or time of day. Who changed the agreed minutes is in the audit log.
import { GROUPS, MAX_SEND_SEC } from '../src/lib/activity.js';
import { TASK_KEYS } from '../src/lib/timesaved.js';
import { feedbackWeek } from '../src/lib/weeks.js';

export class TimingError extends Error {}
const fail = msg => { throw new TimingError(msg); };
export const MAX_MINUTES = 600;

/** @param docs  document factory from jsonfile.js (files or Netlify Blobs) */
export function createTiming(docs) {
  const f = docs('timing', () => ({ weeks: {}, minutes: {}, minutesAt: null }));
  const D = () => f.data;

  /** Adds { group: seconds } to the team's total for the feedback week of `now`. */
  function add(seconds, now = Date.now()) {
    if (!seconds || typeof seconds !== 'object' || Array.isArray(seconds)) fail('Ongeldige tijd.');
    let sum = 0;
    for (const [g, s] of Object.entries(seconds)) {
      if (!GROUPS.includes(g)) fail(`Onbekend scherm: ${g}.`);
      if (!Number.isInteger(s) || s < 0) fail('Ongeldige tijd.');
      sum += s;
    }
    if (sum > MAX_SEND_SEC) fail('Te veel tijd in één keer.');
    if (!sum) return;
    const weeks = D().weeks || (D().weeks = {}), w = weeks[feedbackWeek(now)] || (weeks[feedbackWeek(now)] = {});
    for (const [g, s] of Object.entries(seconds)) if (s) w[g] = (w[g] || 0) + s;
    f.save();
  }

  const minutesOf = () => Object.fromEntries(TASK_KEYS.map(k => [k, (D().minutes || {})[k] ?? null]));
  /** Sets the agreed minutes per unit for the given tasks ('' or null clears one). Returns what changed: { task: { van, naar } }. */
  function setMinutes(values, now = Date.now()) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) fail('Ongeldige waarden.');
    const next = {};
    for (const [k, v] of Object.entries(values)) {
      if (!TASK_KEYS.includes(k)) fail(`Onbekende taak: ${k}.`);
      if (v == null || v === '') { next[k] = null; continue; }
      const n = Number(v);
      if (typeof v === 'boolean' || !Number.isFinite(n) || n < 0 || n > MAX_MINUTES) fail(`Vul per taak een aantal minuten tussen 0 en ${MAX_MINUTES} in.`);
      next[k] = Math.round(n * 10) / 10;
    }
    const before = minutesOf(), changed = {};
    for (const [k, v] of Object.entries(next)) if (before[k] !== v) changed[k] = { van: before[k], naar: v };
    if (Object.keys(changed).length) {
      D().minutes = { ...before, ...next };
      D().minutesAt = now;
      f.save();
    }
    return changed;
  }

  const report = () => ({ weeks: D().weeks || {}, minutes: minutesOf(), minutesAt: D().minutesAt || null });
  return { add, setMinutes, report };
}
