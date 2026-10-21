// Wekelijkse feedback recruiter: which campaign weeks a recruiter can still fill in. Feedback on a week can be given in
// that week and, to catch up, in the week after (weeks.js fbOpenWeek); weeks before FB_START never count. A campaign
// on Pauze or stopped (halt) asks no feedback, nor does a week without new candidates and without calls.
import { CUR, FB_START, fbOpenWeek } from './weeks.js';

const byOpen = (a, b) => (a.open ? 0 : 1) - (b.open ? 0 : 1);

/**
 * Whether week wk asks the recruiter for feedback: new candidates came in that week, or candidates were called (or
 * got ‘Geen gehoor’ or a ‘TBA afspraak’) that week. Without either there is nothing to give. From the Trello numbers (tr, boardStats.js).
 */
export const needsFeedback = wk => (wk.tr.nieuw || 0) > 0 || (wk.tr.gebeld || 0) > 0;

/** The weeks of campaign c that still wait for recruiter feedback: last week's (catching up) first. */
export function openWeeks(c, cur = CUR) {
  if (c.ended || c.inactive || c.halt) return [];
  return c.weeks.filter(w => w.q == null && w.w >= FB_START && fbOpenWeek(w.w, cur) && needsFeedback(w)).map(w => w.w).sort((a, b) => a - b);
}

/**
 * The list on Wekelijkse feedback recruiter for recruiter rec ('all' for everyone): an item { c, w, late, open, needed }
 * per campaign for this week (its last week), after one per campaign whose feedback on last week is still open (late).
 * A campaign that needs no feedback this week (needed: false) comes last; last week's is left out then.
 * keep: items ('id|w') caught up during this visit; they stay in the list so they can still be corrected.
 */
export function checkinQueue(campaigns, rec, { cur = CUR, keep = [] } = {}) {
  const cs = campaigns.filter(c => !c.ended && !c.inactive && !c.halt && (rec === 'all' || c.rec === rec));
  const late = cs.flatMap(c => {
    const wk = c.weeks.find(x => x.w === cur - 1);
    return wk && wk.w >= FB_START && needsFeedback(wk) && (wk.q == null || keep.includes(c.id + '|' + wk.w)) ? [{ c, w: wk.w, late: true, open: wk.q == null, needed: true }] : [];
  });
  const now = cs.map(c => { const wk = c.weeks[c.weeks.length - 1], needed = needsFeedback(wk); return { c, w: wk.w, late: false, open: needed && wk.q == null, needed }; });
  return [...late.sort(byOpen), ...now.filter(i => i.needed).sort(byOpen), ...now.filter(i => !i.needed)];
}
