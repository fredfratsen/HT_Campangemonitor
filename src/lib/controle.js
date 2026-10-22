// Controle in x dagen: after a change a marketeer picks in how many days a campaign comes up again in the monitor,
// to see how the change worked out. Until then it stays on Check, also through the weekly round; a new signal from
// the health rules brings it up sooner (monitor() in helpers.js). Stored with the monitor status, in the week it was
// set (MON_FIELDS): `ctl` the day it comes back, `ctlFrom` the day it was set (both yyyy-mm-dd) and `ctlAct` the id
// of the campaign change it belongs to, if any.
import { MON, isoDate, todayLong } from './weeks.js';

export const CTL_PICKS = [1, 2, 3];
export const CTL_MAX = 60;
const DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

/** The number of days as typed ('' or anything else for none): a whole number from 1 to CTL_MAX, or 0. */
export const ctlDays = v => { const n = v === '' || v == null ? NaN : Number(v); return Number.isInteger(n) && n >= 1 && n <= CTL_MAX ? n : 0; };

/** The day (yyyy-mm-dd) `days` calendar days after now. */
export const ctlDate = (days, now = Date.now()) => { const d = new Date(now); return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)); };
const parse = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
/** "22 okt" */
export const dateShort = iso => { const d = parse(iso); return `${d.getDate()} ${MON[d.getMonth()]}`; };
/** "do 29 okt" */
export const dayShort = iso => `${DAYS[parse(iso).getDay()]} ${dateShort(iso)}`;
/** "donderdag 29 oktober" */
export const dayLong = iso => todayLong(parse(iso)).toLowerCase();

/**
 * The week fields for putting campaign c on monitor status mon now, with the health signals sig seen at that moment.
 * With days it is Check with a new controle. A plain Check keeps a controle whose day hasn't come yet (it was a new
 * signal that brought the campaign up early); any other status ends it.
 */
export function monFields(c, mon, sig, { days, act, now = Date.now() } = {}) {
  const today = ctlDate(0, now);
  if (days) return { mon: 'check', monSig: sig, ctl: ctlDate(days, now), ctlFrom: today, ctlAct: act };
  const set = [...c.weeks].reverse().find(w => w.mon), keep = mon === 'check' && !!set && !!set.ctl && set.ctl > today;
  return { mon, monSig: mon === 'check' ? sig : undefined, ctl: keep ? set.ctl : undefined, ctlFrom: keep ? set.ctlFrom : undefined, ctlAct: keep ? set.ctlAct : undefined };
}

/** What the monitor says about controle ctl (from monitor()): before its day "controle do 29 okt", on it where it came from. */
export function ctlText(ctl, actions = []) {
  if (!ctl.due) return `controle ${dayShort(ctl.at)}`;
  const a = ctl.act && actions.find(x => x.id === ctl.act), on = ctl.from ? ` op ${dateShort(ctl.from)}` : '';
  return a ? `Controle · ${a.type} aangepast${on}` : `Controle · gezet${on}`;
}
