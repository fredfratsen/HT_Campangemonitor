// The Ermee bezig / Done status per client on Live campagnes (shared document live.status, key: the Trello board, or
// the client in demo mode): { s: 'bezig' | 'done', by, at }. It is the work of today, so it only counts on the day it
// was set; at midnight every client starts clean again, without anything being written.

const ORDER = ['', 'bezig', 'done'];

/** 'bezig', 'done', or '' for entry e ({ s, by, at }) at time now, in this browser's local time. */
export function statusToday(e, now = Date.now()) {
  if (!e || !ORDER.includes(e.s) || !e.at) return '';
  return new Date(e.at).toDateString() === new Date(now).toDateString() ? e.s : '';
}

/**
 * Today's call list n ({ nieuw, contact, gebeld }) of a client with status entry e: once it's Done today, nothing is
 * left to call until midnight, not even candidates that come in later; gebeld (called today) still shows.
 */
export function afterDone(n, e, now = Date.now()) {
  return statusToday(e, now) === 'done' ? { ...n, nieuw: 0, contact: 0 } : n;
}

/** What a click on the toggle makes of status s: nothing → bezig → done → nothing. */
export const nextStatus = s => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length];

/** Milliseconds from now to the next local midnight. */
export function msToMidnight(now = Date.now()) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now;
}
