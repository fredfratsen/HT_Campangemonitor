// The "last active" text of a Trello board (src/lib/helpers.js): a board that has been quiet for over 60 days, or
// was never active at all (a new board without dateLastActivity), shows "> 60 dagen niet actief".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agoTxt } from '../src/lib/helpers.js';

const now = new Date(2026, 9, 21, 12).getTime();
const ago = d => new Date(now - d * 864e5).toISOString();

test('recent activity counts the days', () => {
  assert.equal(agoTxt(ago(0), now), 'vandaag actief');
  assert.equal(agoTxt(ago(1), now), 'gisteren actief');
  assert.equal(agoTxt(ago(12), now), '12 dagen geleden actief');
  assert.equal(agoTxt(ago(60), now), '60 dagen geleden actief');
});

test('over 60 days the count stops', () => {
  assert.equal(agoTxt(ago(61), now), '> 60 dagen niet actief');
  assert.equal(agoTxt(ago(400), now), '> 60 dagen niet actief');
});

test('a board that was never active counts as over 60 days', () => {
  assert.equal(agoTxt(null, now), '> 60 dagen niet actief');
  assert.equal(agoTxt(undefined, now), '> 60 dagen niet actief');
  assert.equal(agoTxt('', now), '> 60 dagen niet actief');
});
