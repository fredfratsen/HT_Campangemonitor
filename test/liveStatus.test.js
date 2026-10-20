// The Ermee bezig / Done status per client on Live campagnes (src/lib/liveStatus.js): it only counts on the day
// it was set, and the toggle steps through nothing → bezig → done → nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusToday, nextStatus, msToMidnight } from '../src/lib/liveStatus.js';

// Local times, like the browser that shows the status.
const at = (d, h, m = 0, s = 0, ms = 0) => new Date(2026, 9, d, h, m, s, ms).getTime();

test('a status set today counts all day, until midnight', () => {
  const e = { s: 'bezig', by: 'Kim', at: at(20, 9, 15) };
  assert.equal(statusToday(e, at(20, 9, 15)), 'bezig');
  assert.equal(statusToday(e, at(20, 23, 59, 59, 999)), 'bezig', 'just before midnight');
  assert.equal(statusToday(e, at(21, 0, 0)), '', 'from midnight on it is gone');
  assert.equal(statusToday({ ...e, s: 'done', at: at(20, 0, 0) }, at(20, 17)), 'done', 'set right after midnight');
});

test('a status from another day, a missing entry or an unknown value counts as none', () => {
  assert.equal(statusToday({ s: 'done', by: 'Kim', at: at(19, 16) }, at(20, 8)), '', 'yesterday');
  assert.equal(statusToday({ s: 'done', by: 'Kim', at: at(20, 16) - 7 * 864e5 }, at(20, 16)), '', 'same weekday a week ago');
  assert.equal(statusToday(undefined, at(20, 8)), '');
  assert.equal(statusToday(null, at(20, 8)), '');
  assert.equal(statusToday({ s: 'klaar', by: 'Kim', at: at(20, 8) }, at(20, 9)), '');
  assert.equal(statusToday({ s: 'bezig', by: 'Kim' }, at(20, 9)), '', 'without a time');
});

test('the toggle goes nothing → Ermee bezig → Done → nothing', () => {
  assert.equal(nextStatus(''), 'bezig');
  assert.equal(nextStatus('bezig'), 'done');
  assert.equal(nextStatus('done'), '');
});

test('time to the next midnight, for clearing the colours while the screen is open', () => {
  assert.equal(msToMidnight(at(20, 23, 59, 59)), 1000);
  assert.equal(msToMidnight(at(20, 12)), 12 * 36e5);
  assert.equal(msToMidnight(at(20, 0, 0)), 24 * 36e5, 'at midnight itself: the next one');
});
