// Monitor status (src/lib/helpers.js): Actie nodig, Alles goed check, In afwachting van klant or Check, from the
// health rules and what a marketeer set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { health, monitor } from '../src/lib/helpers.js';
import { DEF_RULES, MONITOR, MONITOR_KEYS } from '../src/lib/constants.js';

const week = (w, o = {}) => ({ w, leads: 8, q: 8, rec: 'ok', klant: '', note: '', needsAction: false, at: 'x', tr: { nieuw: 8 }, ...o });
const camp = weeks => ({ id: 'c1', client: 'Klant', vac: 'Kok', rec: 'Kim', weeks });
const mon = c => monitor(c, health(c, DEF_RULES));

test('without a choice the rules decide: a signal is Actie nodig, none is Alles goed check', () => {
  assert.deepEqual(mon(camp([week(38), week(39), week(40)])), { s: 'goed', by: '', w: null, stale: false });
  assert.equal(mon(camp([week(38), week(39), week(40, { q: 3 })])).s, 'actie', 'red signal');
  assert.equal(mon(camp([week(38), week(39), week(40, { q: null })])).s, 'actie', 'missing feedback (was Monitoren) is Actie nodig too');
});

test('a campaign without signals is on Check only once someone checked it this week', () => {
  assert.deepEqual(mon(camp([week(38), week(39), week(40, { mon: 'check', monBy: 'Danielle', monSig: [] })])), { s: 'check', by: 'Danielle', w: 40, stale: false });
  assert.equal(mon(camp([week(38), week(39, { mon: 'check', monSig: [] }), week(40)])).s, 'goed', 'every week it comes up again');
  assert.equal(mon(camp([week(38), week(39), week(40, { mon: 'open' })])).s, 'goed', 'undoing the check');
});

test('the statuses in order of priority: what needs doing first, Check last', () => {
  assert.deepEqual(MONITOR_KEYS, ['actie', 'goed', 'klant', 'check']);
  assert.deepEqual(MONITOR_KEYS.map(k => MONITOR[k].rank), [3, 2, 1, 0]);
  assert.equal(MONITOR.goed.label, 'Alles goed check');
});

test('a check holds for the signals seen at that moment, not for new ones', () => {
  const checked = o => camp([week(38), week(39), week(40, { q: null, mon: 'check', monBy: 'Danielle', monSig: ['missing'], ...o })]);
  assert.deepEqual(mon(checked()), { s: 'check', by: 'Danielle', w: 40, stale: false });
  assert.equal(mon(checked({ q: 8 })).s, 'check', 'a signal going away keeps it on Check');
  const late = mon(checked({ q: 3 }));
  assert.equal(late.s, 'actie', 'a new red signal after the check');
  assert.equal(late.stale, true);
  assert.equal(mon(camp([week(38), week(39, { mon: 'check', monSig: [] }), week(40, { q: 3 })])).s, 'actie', 'last week\'s check does not carry over');
});

test('waiting for the client carries over to later weeks until someone changes it', () => {
  const waiting = camp([week(38), week(39, { q: 3, mon: 'klant', monBy: 'Danielle' }), week(40, { q: 3 })]);
  assert.deepEqual(mon(waiting), { s: 'klant', by: 'Danielle', w: 39, stale: false });
  const reopened = { ...waiting, weeks: [...waiting.weeks.slice(0, 2), { ...waiting.weeks[2], mon: 'open' }] };
  assert.equal(mon(reopened).s, 'actie', '"open" hands it back to the rules');
  const checked = { ...waiting, weeks: [...waiting.weeks.slice(0, 2), { ...waiting.weeks[2], mon: 'check', monSig: ['qRed'] }] };
  assert.equal(mon(checked).s, 'check');
});

test('the inflow signals look at last week, not at the week that is still filling up', () => {
  const keys = ws => health(camp(ws), DEF_RULES).reasons.map(r => r.k);
  assert.deepEqual(keys([week(37), week(38), week(39), week(40), week(41, { leads: 0 })]), [], 'a quiet start of the week is fine');
  assert.deepEqual(keys([week(37), week(38), week(39), week(40, { leads: 1 }), week(41)]), ['minLeads', 'drop'], 'too few last week');
  assert.deepEqual(keys([week(37), week(38), week(39), week(40, { leads: 5 }), week(41)]), ['drop'], '5 is 38% below the 8 before it');
  assert.deepEqual(keys([week(41, { leads: 0 })]), [], 'a campaign that started this week has no last week yet');
  assert.equal(health(camp([week(39), week(40, { leads: 2 }), week(41)]), DEF_RULES).reasons[0].t, 'Maar 2 kandidaten vorige week');
});

test('missing feedback for this week is a signal from Thursday, or right away when last week is missing too', () => {
  // Week 43 runs from Monday 19 to Sunday 25 October 2026.
  const mon19 = new Date(2026, 9, 19, 9).getTime(), wed21 = new Date(2026, 9, 21, 23, 59).getTime(), thu22 = new Date(2026, 9, 22).getTime();
  const missing = (ws, now) => health(camp(ws), DEF_RULES, now).reasons.filter(r => r.k === 'missing').map(r => r.t);
  const lastDone = [week(41), week(42), week(43, { q: null })], lastOpen = [week(41), week(42, { q: null }), week(43, { q: null })];
  assert.deepEqual(missing(lastDone, mon19), [], 'last week is in, so Monday is quiet');
  assert.deepEqual(missing(lastDone, wed21), [], 'still quiet on Wednesday evening');
  assert.deepEqual(missing(lastDone, thu22), ['Feedback ontbreekt'], 'from Thursday it counts');
  assert.deepEqual(missing(lastOpen, mon19), ['Feedback ontbreekt, ook vorige week'], 'last week missing: up on Monday already');
  assert.deepEqual(missing([week(41), week(42, { q: null }), week(43)], mon19), [], 'filled in this week clears it');
  assert.deepEqual(missing([week(40), week(41, { q: null }), week(42, { q: null })], new Date(2026, 9, 12, 9).getTime()), [], 'weeks before the start of the monitor never count');
  assert.deepEqual(missing([week(43, { q: null })], mon19), [], 'a campaign that started this week waits for Thursday');
  assert.deepEqual(missing([week(43, { q: null })], thu22), ['Feedback ontbreekt']);
  assert.equal(monitor(camp(lastDone), health(camp(lastDone), DEF_RULES, mon19)).s, 'goed', 'so on Monday it is Alles goed check, not Actie nodig');
});
