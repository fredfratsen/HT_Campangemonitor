// Time in the app: the meter in the browser (src/lib/activity.js) and the weekly report (src/lib/timesaved.js).
// What the server stores is tested in timing.test.js, the routes and rights end to end in server.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityMeter, groupOf } from '../src/lib/activity.js';
import { unitsIn, timeReport, dur } from '../src/lib/timesaved.js';

const S = 1000, MIN = 60 * S, T0 = 1_800_000_000_000;

test('screens fall into the task they belong to, everything else is "other"', () => {
  assert.equal(groupOf('checkin'), 'feedback');
  assert.equal(groupOf('klant'), 'klant');
  for (const v of ['week', 'campaigns', 'detail']) assert.equal(groupOf(v), 'overview', v);
  for (const v of ['live', 'mine', 'settings', 'blacklist', 'toewijzing']) assert.equal(groupOf(v), 'other', v);
});

test('counts time on the screen while someone clicked, typed, scrolled or touched in the last minute', () => {
  const m = new ActivityMeter({ now: T0 });
  m.tick(T0, 'feedback');
  m.interact(T0 + 20 * S);
  m.tick(T0 + 30 * S, 'feedback');
  assert.deepEqual(m.take(), { feedback: 30 });
});

test('stops a minute after the last interaction and starts again at the next one, not at the previous tick', () => {
  const m = new ActivityMeter({ now: T0 });
  m.tick(T0, 'overview');
  m.tick(T0 + 5 * MIN, 'overview'); // nobody touched anything: only the first minute counts
  assert.deepEqual(m.take(), { overview: 60 });
  m.interact(T0 + 10 * MIN);
  m.tick(T0 + 10 * MIN + 15 * S, 'overview');
  assert.deepEqual(m.take(), { overview: 15 });
});

test('a laptop waking from sleep adds at most a minute', () => {
  const m = new ActivityMeter({ now: T0 });
  m.tick(T0, 'klant');
  m.tick(T0 + 2 * 3600 * S, 'klant');
  assert.deepEqual(m.take(), { klant: 60 });
});

test('nothing counts while there is no group (hidden tab, demo data, Bekijk als)', () => {
  const m = new ActivityMeter({ now: T0 });
  m.tick(T0, null);
  m.interact(T0 + 10 * S);
  m.tick(T0 + 40 * S, null);
  assert.deepEqual(m.take(), {});
});

test('time goes to the screen that was open before a switch', () => {
  const m = new ActivityMeter({ now: T0 });
  m.tick(T0, 'overview');
  m.interact(T0 + 10 * S);
  m.tick(T0 + 20 * S, 'feedback'); // the first 20 seconds were on the overview
  m.interact(T0 + 30 * S);
  m.tick(T0 + 50 * S, 'feedback');
  assert.deepEqual(m.take(), { overview: 20, feedback: 30 });
});

test('take hands out whole seconds and keeps the rest; giveBack puts unsent seconds back', () => {
  const m = new ActivityMeter({ now: T0 });
  m.tick(T0, 'other');
  m.tick(T0 + 2500, 'other');
  assert.deepEqual(m.take(), { other: 2 });
  m.tick(T0 + 3000, 'other');
  assert.deepEqual(m.take(), { other: 1 }, 'the half second left over plus the next half');
  m.giveBack({ other: 1, feedback: 4 });
  assert.deepEqual(m.take(), { other: 1, feedback: 4 });
  assert.deepEqual(m.take(), {});
});

test('take(max) hands out at most max seconds in all, so a backlog goes out over several sends', () => {
  const m = new ActivityMeter({ now: T0 });
  m.giveBack({ feedback: 700, overview: 500 });
  assert.deepEqual(m.take(900), { feedback: 700, overview: 200 });
  assert.deepEqual(m.take(900), { overview: 300 });
  assert.deepEqual(m.take(900), {});
});

// Week 41: A has recruiter and client feedback, B nothing yet, C ended in week 40.
const wk = (w, o = {}) => ({ w, leads: 5, q: null, rec: '', klant: '', note: '', needsAction: false, at: '', tr: { nieuw: 5 }, ...o });
const CAMPS = [
  { id: 'a', client: 'A', vac: 'Kok', rec: 'Kim', ended: false, weeks: [wk(40, { q: 7 }), wk(41, { q: 6, klant: 'Tevreden' })] },
  { id: 'b', client: 'B', vac: 'Bediening', rec: 'Juul', ended: false, weeks: [wk(40, { q: 8, klant: 'Prima' }), wk(41)] },
  { id: 'c', client: 'C', vac: 'Afwas', rec: 'Robin', ended: true, weeks: [wk(39, { q: 5 }), wk(40, { q: 5 })] },
];

test('units per week come from the campaigns: feedback given, client feedback given, campaigns running', () => {
  assert.deepEqual(unitsIn(CAMPS, 41), { feedback: 1, klant: 1, overview: 2 });
  assert.deepEqual(unitsIn(CAMPS, 40), { feedback: 3, klant: 1, overview: 3 });
  assert.deepEqual(unitsIn(CAMPS, 30), { feedback: 0, klant: 0, overview: 0 });
});

test('per task: old time is units × agreed minutes, saved is old minus app time, also when that is negative', () => {
  const timing = { weeks: { 41: { feedback: 600, klant: 120, overview: 900, other: 300 } }, minutes: { feedback: 10, klant: 5, overview: 3 } };
  const r = timeReport(CAMPS, timing);
  assert.deepEqual(r.weeks.map(x => x.w), [41]);
  const w = r.weeks[0];
  assert.deepEqual(w.tasks.feedback, { units: 1, appSec: 600, oldSec: 600, savedSec: 0 });
  assert.deepEqual(w.tasks.klant, { units: 1, appSec: 120, oldSec: 300, savedSec: 180 });
  assert.deepEqual(w.tasks.overview, { units: 2, appSec: 900, oldSec: 360, savedSec: -540 });
  assert.equal(w.otherSec, 300, 'other screens are shown, not counted against a task');
  assert.equal(w.activeSec, 1920);
  assert.equal(w.savedSec, -360);
});

test('a task without agreed minutes has no old time and is left out of the total saved', () => {
  const timing = { weeks: { 41: { feedback: 600, klant: 120 } }, minutes: { feedback: 12, klant: null } };
  const w = timeReport(CAMPS, timing).weeks[0];
  assert.deepEqual(w.tasks.klant, { units: 1, appSec: 120, oldSec: null, savedSec: null });
  assert.deepEqual(w.tasks.overview, { units: 2, appSec: 0, oldSec: null, savedSec: null });
  assert.equal(w.savedSec, 120);
  assert.equal(timeReport(CAMPS, { weeks: { 41: { feedback: 60 } }, minutes: {} }).weeks[0].savedSec, null, 'nothing agreed yet');
});

test('the period total adds up the weeks, newest week first', () => {
  const timing = { weeks: { 40: { feedback: 300, overview: 60 }, 41: { feedback: 600, other: 30 } }, minutes: { feedback: 10, klant: 5, overview: 3 } };
  const r = timeReport(CAMPS, timing);
  assert.deepEqual(r.weeks.map(x => x.w), [41, 40]);
  // Week 40: feedback 3 × 600 − 300 = 1500, klant 1 × 300 − 0 = 300, overview 3 × 180 − 60 = 480. Week 41: 0 + 300 + 360.
  assert.deepEqual(r.total.tasks.feedback, { units: 4, appSec: 900, oldSec: 2400, savedSec: 1500 });
  assert.equal(r.total.savedSec, 1500 + 300 + 480 + 0 + 300 + 360);
  assert.equal(r.total.otherSec, 30);
  assert.equal(r.total.activeSec, 990);
  assert.deepEqual(timeReport(CAMPS, { weeks: {}, minutes: {} }).weeks, []);
});

test('durations read as hours and minutes, rounded to the minute, with a real minus sign', () => {
  const cases = [[0, '0 min'], [29, '0 min'], [31, '1 min'], [300, '5 min'], [3600, '1 u'], [5400, '1 u 30 min'], [36300, '10 u 5 min'], [-300, '−5 min'], [-5400, '−1 u 30 min'], [null, '—']];
  for (const [s, want] of cases) assert.equal(dur(s), want, String(s));
});
