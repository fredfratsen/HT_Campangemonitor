// Week arithmetic.
// Internally a week is a running number: week 1 starts on Monday 29 December 2025 (ISO week 1 of 2026)
// and keeps counting across years, so sorting and "weeks since" stay simple. Everything shown to people
// uses the real ISO week number via wl().

const DAY = 864e5;
const BASE_UTC = Date.UTC(2025, 11, 29);

export const MON = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

// Calendar-day based (not ms based) so daylight saving time never shifts a week boundary.
const dayNum = d => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - BASE_UTC) / DAY);
export const weekOf = ts => Math.floor(dayNum(new Date(ts)) / 7) + 1;
export const mondayOf = w => new Date(2025, 11, 29 + (w - 1) * 7);

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
}
/** ISO week number shown to people for internal week w. */
export const wl = w => isoWeek(mondayOf(w));

// The Monday check-in round is about the week that just ended, so the "current" feedback week is last week.
const now = new Date();
export const CUR = weekOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime());

/** "21–27 sep" or "28 sep – 4 okt" */
export function range(w) {
  const a = mondayOf(w), b = new Date(a); b.setDate(a.getDate() + 6);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MON[b.getMonth()]}` : `${a.getDate()} ${MON[a.getMonth()]} – ${b.getDate()} ${MON[b.getMonth()]}`;
}
/** "21 – 27 september" or "28 september – 4 oktober" */
export function rangeLong(w) {
  const a = mondayOf(w), b = new Date(a); b.setDate(a.getDate() + 6);
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}
/** "Maandag 28 september" */
export function todayLong(d = new Date()) {
  const s = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return s[0].toUpperCase() + s.slice(1);
}
/** "28 sep 09:15" */
export const stamp = () => { const d = new Date(); return `${d.getDate()} ${MON[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
