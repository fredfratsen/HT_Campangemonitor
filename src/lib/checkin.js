// Wekelijkse feedback recruiter: which campaign weeks a recruiter can still fill in. Feedback on a week can be given in
// that week and, to catch up, in the week after (weeks.js fbOpenWeek); weeks before FB_START never count.
import { CUR, FB_START, fbOpenWeek } from './weeks.js';

const byOpen = (a, b) => (a.open ? 0 : 1) - (b.open ? 0 : 1);

/** The weeks of campaign c that still wait for recruiter feedback: last week's (catching up) first. */
export function openWeeks(c, cur = CUR) {
  if (c.ended || c.inactive) return [];
  return c.weeks.filter(w => w.q == null && w.w >= FB_START && fbOpenWeek(w.w, cur)).map(w => w.w).sort((a, b) => a - b);
}

/**
 * The list on Wekelijkse feedback recruiter for recruiter rec ('all' for everyone): an item { c, w, late, open } per
 * campaign for this week (its last week), after one per campaign whose feedback on last week is still open (late).
 * keep: items ('id|w') caught up during this visit; they stay in the list so they can still be corrected.
 */
export function checkinQueue(campaigns, rec, { cur = CUR, keep = [] } = {}) {
  const cs = campaigns.filter(c => !c.ended && !c.inactive && (rec === 'all' || c.rec === rec));
  const late = cs.flatMap(c => {
    const wk = c.weeks.find(x => x.w === cur - 1);
    return wk && wk.w >= FB_START && (wk.q == null || keep.includes(c.id + '|' + wk.w)) ? [{ c, w: wk.w, late: true, open: wk.q == null }] : [];
  });
  const now = cs.map(c => { const wk = c.weeks[c.weeks.length - 1]; return { c, w: wk.w, late: false, open: wk.q == null }; });
  return [...late.sort(byOpen), ...now.sort(byOpen)];
}
