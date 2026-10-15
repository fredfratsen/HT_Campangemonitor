// Active time in the app, per kind of screen. The browser counts it with ActivityMeter and sends whole seconds to
// /api/timing now and then; the server adds them to the team's total for the week (server/timing.js). Who spent the
// time is not sent along.
//
// Time counts as active while the tab is visible and someone clicked, typed, scrolled, touched or moved the mouse
// in the last IDLE_MS. The app passes no group (null) while nothing should count.

export const IDLE_MS = 60000;
// Most seconds in one send; the server refuses more (server/timing.js).
export const MAX_SEND_SEC = 900;
// The kinds of screen that are counted separately; every other screen is 'other'.
export const GROUPS = ['feedback', 'klant', 'overview', 'other'];
const GROUP_OF_VIEW = { checkin: 'feedback', klant: 'klant', week: 'overview', campaigns: 'overview', detail: 'overview' };
export const groupOf = view => GROUP_OF_VIEW[view] || 'other';

export class ActivityMeter {
  constructor({ idleMs = IDLE_MS, now = Date.now() } = {}) {
    this.idleMs = idleMs;
    this.last = now;   // counted up to here
    this.seen = now;   // last interaction; opening the app counts as one
    this.group = null; // what is on screen since `last`
    this.ms = {};
  }
  /** Adds the active part of the time since `last` to the group on screen. */
  count(now) {
    const add = Math.min(now, this.seen + this.idleMs) - this.last;
    if (this.group && add > 0) this.ms[this.group] = (this.ms[this.group] || 0) + add;
    this.last = now;
  }
  /** Someone clicked, typed, scrolled or touched. After a pause, counting starts again from here. */
  interact(now) {
    if (now - this.seen > this.idleMs) this.count(now);
    this.seen = now;
  }
  /** Counts the time since the previous tick for the group that was on screen, then switches to `group` (or null). */
  tick(now, group) {
    this.count(now);
    this.group = group || null;
  }
  /** The whole seconds counted so far per group, at most `max` in all; the rest stays for next time. */
  take(max = Infinity) {
    const out = {};
    for (const [g, ms] of Object.entries(this.ms)) {
      const s = Math.min(Math.floor(ms / 1000), max);
      if (s > 0) { out[g] = s; this.ms[g] = ms - s * 1000; max -= s; }
    }
    return out;
  }
  /** Seconds that could not be sent, to try again later. */
  giveBack(seconds) {
    for (const [g, s] of Object.entries(seconds)) this.ms[g] = (this.ms[g] || 0) + s * 1000;
  }
}
