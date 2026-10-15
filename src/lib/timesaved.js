// Tijdwinst: per feedback week and per task, the active time in the app (src/lib/activity.js, server/timing.js) next
// to the agreed time per unit from before the app, times the units that week.

export const TASKS = [
  { key: 'feedback', label: 'Wekelijkse feedback', unit: 'campagne met recruiterfeedback', units: 'campagnes met recruiterfeedback' },
  { key: 'klant', label: 'Klantfeedback', unit: 'campagne met klantfeedback', units: 'campagnes met klantfeedback' },
  { key: 'overview', label: 'Campagnecheck', unit: 'lopende campagne', units: 'lopende campagnes' },
];
export const TASK_KEYS = TASKS.map(t => t.key);

/** Seconds as "1 u 30 min", "5 min" or "−5 min"; null is "—". */
export function dur(sec) {
  if (sec == null) return '—';
  const m = Math.round(Math.abs(sec) / 60), h = Math.floor(m / 60), r = m % 60;
  const txt = h ? (r ? `${h} u ${r} min` : `${h} u`) : `${r} min`;
  return sec < 0 && m ? '−' + txt : txt;
}

/** Per task, how many units week w has: campaigns with recruiter feedback, with client feedback, and running. */
export function unitsIn(campaigns, w) {
  const u = { feedback: 0, klant: 0, overview: 0 };
  for (const c of campaigns) {
    const wk = c.weeks.find(x => x.w === w);
    if (!wk) continue;
    u.overview++;
    if (wk.q != null) u.feedback++;
    if (wk.klant) u.klant++;
  }
  return u;
}

const blank = () => ({ tasks: Object.fromEntries(TASK_KEYS.map(k => [k, { units: 0, appSec: 0, oldSec: null, savedSec: null }])), otherSec: 0, activeSec: 0, savedSec: null });
const plus = (a, b) => b == null ? a : (a ?? 0) + b;

/**
 * timing: { weeks: { [w]: { feedback, klant, overview, other } } in seconds, minutes: { [task]: minutes per unit or null } }.
 * Returns the weeks with time, newest first, and their total. A task without agreed minutes has no old time and
 * is left out of savedSec.
 */
export function timeReport(campaigns, { weeks = {}, minutes = {} }) {
  const total = blank();
  const rows = Object.keys(weeks).map(Number).sort((a, b) => b - a).map(w => {
    const sec = weeks[w] || {}, units = unitsIn(campaigns, w), row = { w, ...blank() };
    for (const k of TASK_KEYS) {
      const m = minutes[k], appSec = sec[k] || 0, oldSec = m == null ? null : Math.round(units[k] * m * 60);
      const t = { units: units[k], appSec, oldSec, savedSec: oldSec == null ? null : oldSec - appSec };
      row.tasks[k] = t;
      row.savedSec = plus(row.savedSec, t.savedSec);
      const T = total.tasks[k];
      T.units += t.units; T.appSec += appSec; T.oldSec = plus(T.oldSec, oldSec); T.savedSec = plus(T.savedSec, t.savedSec);
    }
    row.otherSec = sec.other || 0;
    row.activeSec = TASK_KEYS.reduce((s, k) => s + row.tasks[k].appSec, row.otherSec);
    total.otherSec += row.otherSec; total.activeSec += row.activeSec; total.savedSec = plus(total.savedSec, row.savedSec);
    return row;
  });
  return { weeks: rows, total };
}
