// Time in the app as the server stores it (server/timing.js): weekly team totals per kind of screen, and the agreed
// minutes per task. The routes and rights around it are tested end to end in server.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTiming } from '../server/timing.js';

/** In-memory documents with the interface of jsonfile.js. */
const memDocs = () => (name, initial) => ({ data: initial(), save() {}, flush() {} });
// Internal week 42 is ISO week 42: Monday 12 – Sunday 18 October 2026. Its feedback round runs in that same week.
const wed14 = new Date(2026, 9, 14, 11, 0).getTime(), sun18 = new Date(2026, 9, 18, 23, 0).getTime(), mon19 = new Date(2026, 9, 19, 0, 30).getTime();

test('time is filed under the feedback week: the week it was spent in', () => {
  const t = createTiming(memDocs());
  t.add({ feedback: 120, other: 30 }, wed14);
  t.add({ feedback: 60 }, sun18);
  t.add({ overview: 45 }, mon19);
  assert.deepEqual(t.report().weeks, { 42: { feedback: 180, other: 30 }, 43: { overview: 45 } });
});

test('only known screens, whole seconds, at most a quarter of an hour per send', () => {
  const t = createTiming(memDocs()), add = s => () => t.add(s, wed14);
  assert.throws(add({ toewijzing: 10 }), /Onbekend/);
  assert.throws(add({ feedback: -5 }), /Ongeldige/);
  assert.throws(add({ feedback: 1.5 }), /Ongeldige/);
  assert.throws(add({ feedback: '60' }), /Ongeldige/);
  assert.throws(add({ feedback: 600, overview: 301 }), /Te veel/);
  assert.throws(add(null), /Ongeldige/);
  add({ feedback: 600, overview: 300 })();
  add({})();
  assert.deepEqual(t.report().weeks, { 42: { feedback: 600, overview: 300 } }, 'refused sends leave nothing behind');
});

test('agreed minutes per task: set, changed and cleared, with what changed for the audit log', () => {
  const t = createTiming(memDocs());
  assert.deepEqual(t.report().minutes, { feedback: null, klant: null, overview: null });
  assert.deepEqual(t.setMinutes({ feedback: 12, klant: 7.5 }, wed14), { feedback: { van: null, naar: 12 }, klant: { van: null, naar: 7.5 } });
  assert.deepEqual(t.setMinutes({ feedback: 12, klant: null, overview: 4 }, mon19), { klant: { van: 7.5, naar: null }, overview: { van: null, naar: 4 } });
  const r = t.report();
  assert.deepEqual(r.minutes, { feedback: 12, klant: null, overview: 4 });
  assert.equal(r.minutesAt, mon19);
  assert.deepEqual(t.setMinutes({ feedback: 12 }, sun18), {}, 'nothing changed');
  assert.equal(t.report().minutesAt, mon19);
});

test('agreed minutes must be a number from 0 to 600 for a known task', () => {
  const t = createTiming(memDocs()), set = m => () => t.setMinutes(m, wed14);
  assert.throws(set({ other: 5 }), /Onbekende taak/);
  assert.throws(set({ feedback: -1 }), /0 en 600/);
  assert.throws(set({ feedback: 601 }), /0 en 600/);
  assert.throws(set({ feedback: 'tien' }), /0 en 600/);
  assert.deepEqual(set({ feedback: 7.25 })(), { feedback: { van: null, naar: 7.3 } }, 'one decimal');
  assert.deepEqual(set({ feedback: '' })(), { feedback: { van: 7.3, naar: null } }, 'empty clears it');
});
