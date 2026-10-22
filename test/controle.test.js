// Controle in x dagen (src/lib/controle.js and monitor() in src/lib/helpers.js): after a change a marketeer picks in
// how many days a campaign comes up again. Until then it stays on Check, also through the weekly round; a new
// signal brings it up sooner; on the day it is back on Wekelijkse controle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { health, monitor } from '../src/lib/helpers.js';
import { ctlDate, dayShort, dayLong, ctlDays, monFields, ctlText, CTL_PICKS, CTL_MAX } from '../src/lib/controle.js';
import { DEF_RULES } from '../src/lib/constants.js';

const week = (w, o = {}) => ({ w, leads: 8, q: 8, rec: 'ok', klant: '', note: '', needsAction: false, at: 'x', tr: { nieuw: 8 }, ...o });
const camp = (weeks, o = {}) => ({ id: 'c1', client: 'Klant', vac: 'Kok', rec: 'Kim', actions: [], weeks, ...o });
// Week 42 is 12–18 October 2026, week 43 is 19–25 October, week 44 is 26 October – 1 November.
const day = (m, d) => new Date(2026, m - 1, d, 10).getTime();
const mon = (c, now) => monitor(c, health(c, DEF_RULES), now);
const set = (o = {}) => ({ mon: 'check', monBy: 'Danielle', monSig: [], ctl: '2026-10-29', ctlFrom: '2026-10-16', ...o });

test('the quick picks are 1, 2 and 3 days', () => {
  assert.deepEqual(CTL_PICKS, [1, 2, 3]);
});

test('the day it comes back counts calendar days, across months and the end of summer time', () => {
  assert.equal(ctlDate(3, day(10, 22)), '2026-10-25');
  assert.equal(ctlDate(3, day(10, 30)), '2026-11-02');
  assert.equal(ctlDate(1, new Date(2026, 9, 24, 23, 30).getTime()), '2026-10-25', 'late on the night summer time ends');
  assert.equal(ctlDate(0, day(10, 22)), '2026-10-22');
  assert.equal(dayShort('2026-10-29'), 'do 29 okt');
  assert.equal(dayLong('2026-10-29'), 'donderdag 29 oktober');
});

test('a typed number of days counts only as a whole number from 1 to the maximum', () => {
  assert.equal(CTL_MAX, 60);
  assert.equal(ctlDays('3'), 3);
  assert.equal(ctlDays(2), 2);
  assert.equal(ctlDays('60'), 60);
  for (const v of ['', '0', '-1', '61', '2.5', 'abc', null, undefined]) assert.equal(ctlDays(v), 0, String(v));
});

test('before its day a controle keeps the campaign on Check, also in the weeks after it was set', () => {
  const c = camp([week(41), week(42, set()), week(43)]);
  const m = mon(c, day(10, 22));
  assert.equal(m.s, 'check');
  assert.equal(m.by, 'Danielle');
  assert.equal(m.w, 42);
  assert.deepEqual(m.ctl, { at: '2026-10-29', from: '2026-10-16', act: undefined, by: 'Danielle', due: false });
});

test('on its day the campaign is back on Wekelijkse controle, even in the week it was checked', () => {
  const later = mon(camp([week(41), week(42, set()), week(43), week(44)]), day(10, 29));
  assert.equal(later.s, 'goed');
  assert.equal(later.ctl.due, true);
  const sameWeek = camp([week(42), week(43, set({ ctl: '2026-10-22', ctlFrom: '2026-10-19' }))]);
  assert.equal(mon(sameWeek, day(10, 21)).s, 'check', 'the day before');
  assert.equal(mon(sameWeek, day(10, 22)).s, 'goed', 'from midnight on its day');
  assert.equal(mon(camp([week(42), week(43, set({ ctl: '2026-10-22', q: 3 }))]), day(10, 22)).s, 'actie', 'with a signal it is Actie nodig');
});

test('a new signal brings it up before its day', () => {
  const m = mon(camp([week(41), week(42, set()), week(43, { q: 3 })]), day(10, 22));
  assert.equal(m.s, 'actie');
  assert.equal(m.stale, true);
  assert.equal(m.ctl.due, false);
  const known = mon(camp([week(41), week(42, set({ q: 3, monSig: ['qRed'] })), week(43, { q: 3 })]), day(10, 22));
  assert.equal(known.s, 'check', 'a signal that was there when it was set keeps it on Check');
});

test('a later status replaces the controle', () => {
  const after = camp([week(42, set({ ctl: '2026-10-20' })), week(43, { mon: 'check', monBy: 'Danielle', monSig: [] })]);
  assert.deepEqual(mon(after, day(10, 22)), { s: 'check', by: 'Danielle', w: 43, stale: false }, 'a plain Check after its day');
  assert.equal(mon(camp([week(42, set()), week(43, { mon: 'klant', monBy: 'Danielle' })]), day(10, 22)).s, 'klant');
  assert.equal(mon(camp([week(42, set()), week(43, { mon: 'open' })]), day(10, 22)).s, 'goed', 'Check ongedaan maken');
});

test('setting a controle puts the campaign on Check with the day it comes back', () => {
  const c = camp([week(42), week(43)]);
  const f = monFields(c, 'check', ['qOrange'], { days: 2, act: 'c1a1', now: day(10, 22) });
  assert.equal(f.mon, 'check');
  assert.deepEqual(f.monSig, ['qOrange']);
  assert.equal(f.ctl, '2026-10-24');
  assert.equal(f.ctlFrom, '2026-10-22');
  assert.equal(f.ctlAct, 'c1a1');
});

test('a plain Check keeps a controle that has not come yet, and ends one that has', () => {
  const pending = camp([week(42, set({ ctlAct: 'c1a1' })), week(43, { q: 3 })]);
  const kept = monFields(pending, 'check', ['qRed'], { now: day(10, 22) });
  assert.deepEqual([kept.ctl, kept.ctlFrom, kept.ctlAct, kept.monSig], ['2026-10-29', '2026-10-16', 'c1a1', ['qRed']]);
  const due = monFields(pending, 'check', [], { now: day(10, 29) });
  assert.equal(due.ctl, undefined);
  assert.equal(due.ctlAct, undefined);
});

test('In afwachting van klant and Check ongedaan maken end a controle', () => {
  const pending = camp([week(42, set()), week(43)]);
  for (const m of ['klant', 'open']) {
    const f = monFields(pending, m, ['qRed'], { now: day(10, 22) });
    assert.equal(f.mon, m);
    assert.equal(f.ctl, undefined, m);
    assert.equal(f.monSig, undefined, m);
  }
});

test('what the monitor says about a controle', () => {
  const actions = [{ id: 'c1a1', w: 43, type: 'Budget', text: 'Budget omhoog' }];
  assert.equal(ctlText({ at: '2026-10-29', from: '2026-10-22', due: false }), 'controle do 29 okt');
  assert.equal(ctlText({ at: '2026-10-29', from: '2026-10-22', act: 'c1a1', due: true }, actions), 'Controle · Budget aangepast op 22 okt');
  assert.equal(ctlText({ at: '2026-10-29', from: '2026-10-22', due: true }, actions), 'Controle · gezet op 22 okt');
  assert.equal(ctlText({ at: '2026-10-29', from: '2026-10-22', act: 'weg', due: true }, actions), 'Controle · gezet op 22 okt', 'a removed change');
});
