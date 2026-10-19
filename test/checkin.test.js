// Wekelijkse feedback recruiter (src/lib/checkin.js): the feedback on a week can be given in that week and, to catch
// up, in the week after; from the Monday after that it has expired.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FB_START, fbOpenWeek, fbLastDay, mondayOf } from '../src/lib/weeks.js';
import { checkinQueue, openWeeks } from '../src/lib/checkin.js';

const W = FB_START + 1; // "this week" in these tests; W - 1 is the first feedback week
const week = (w, q = null) => ({ w, leads: 5, q, rec: '', tr: { nieuw: 5 } });
const camp = (id, qPrev, qCur, o = {}) => ({ id, client: 'Klant ' + id, vac: 'Kok', rec: 'Kim', weeks: [week(W - 2, 7), week(W - 1, qPrev), week(W, qCur)], ...o });
const keys = q => q.map(i => `${i.c.id}|${i.w}${i.late ? ' late' : ''}`);

test('a week is open in its own week and the week after, then it expires', () => {
  assert.equal(fbOpenWeek(W, W), true);
  assert.equal(fbOpenWeek(W - 1, W), true, 'last week: catching up');
  assert.equal(fbOpenWeek(W - 2, W), false, 'two weeks ago: expired');
  assert.equal(fbOpenWeek(W + 1, W), false, 'next week: not yet');
});

test('the last day to fill a week in is the Sunday of the week after', () => {
  const d = fbLastDay(W - 1), mon = mondayOf(W);
  assert.equal(d.getDay(), 0, 'a Sunday');
  assert.equal(Math.round((d - mon) / 864e5), 6, 'the end of the catch-up week');
});

test('the queue: last week\'s open feedback first, then this week\'s, open before done', () => {
  const cs = [camp('a', null, null), camp('b', 8, null), camp('c', null, 7), camp('d', null, null, { rec: 'Robin' })];
  assert.deepEqual(keys(checkinQueue(cs, 'Kim', { cur: W })), ['a|' + (W - 1) + ' late', 'c|' + (W - 1) + ' late', 'a|' + W, 'b|' + W, 'c|' + W]);
  assert.deepEqual(keys(checkinQueue(cs, 'all', { cur: W })).length, 7, 'everyone\'s for feedback.all');
  assert.equal(checkinQueue(cs, 'Kim', { cur: W })[0].open, true);
  assert.equal(checkinQueue(cs, 'Kim', { cur: W })[4].open, false);
});

test('expired weeks, weeks before the start, Niet actief and ended campaigns never come up', () => {
  const two = { ...camp('e', 8, null), weeks: [week(W - 2), week(W - 1, 8), week(W)] };
  assert.deepEqual(keys(checkinQueue([two], 'Kim', { cur: W })), ['e|' + W], 'two weeks ago is expired');
  const first = { ...camp('f', null, null), weeks: [week(FB_START - 1), week(FB_START)] };
  assert.deepEqual(keys(checkinQueue([first], 'Kim', { cur: FB_START })), ['f|' + FB_START], 'the week before the start never counts');
  assert.deepEqual(checkinQueue([camp('g', null, null, { inactive: true }), camp('h', null, null, { ended: true })], 'Kim', { cur: W }), []);
});

test('a paused or stopped campaign asks no feedback', () => {
  const p = camp('p', null, null, { halt: { kind: 'pauze', by: 'Danielle', w: W } }), s = camp('s', null, null, { halt: { kind: 'stop', by: 'Danielle', w: W } });
  assert.deepEqual(openWeeks(p, W), []);
  assert.deepEqual(openWeeks(s, W), []);
  assert.deepEqual(checkinQueue([p, s], 'Kim', { cur: W }), []);
});

test('feedback caught up in this visit stays in the queue, so it can still be corrected', () => {
  const cs = [camp('a', 8, null), camp('b', null, null)];
  const q = checkinQueue(cs, 'Kim', { cur: W, keep: ['a|' + (W - 1)] });
  assert.deepEqual(keys(q), ['b|' + (W - 1) + ' late', 'a|' + (W - 1) + ' late', 'a|' + W, 'b|' + W]);
  assert.equal(q[1].open, false);
});

test('open weeks of a campaign: last week first, nothing expired', () => {
  assert.deepEqual(openWeeks(camp('a', null, null), W), [W - 1, W]);
  assert.deepEqual(openWeeks(camp('b', 8, null), W), [W]);
  assert.deepEqual(openWeeks(camp('c', null, 7), W), [W - 1]);
  assert.deepEqual(openWeeks({ ...camp('d', 8, 8), weeks: [week(W - 2), week(W - 1, 8), week(W, 8)] }, W), [], 'two weeks ago has expired');
  assert.deepEqual(openWeeks(camp('e', null, null, { inactive: true }), W), []);
});
