// Counting a Trello board per campaign (src/lib/boardStats.js), and the smaller snapshot of it that the home screens
// show right after login, before the full boards are loaded in the background.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardStats, quickStats, liveCampaign } from '../src/lib/boardStats.js';
import { CUR } from '../src/lib/weeks.js';
import { board, BOARD_ID, KOK, BEDIENING } from './trello-fixture.js';

const tr = (nieuw, o = {}) => ({ nieuw, gescreend: 0, gesprek: 0, voorgesteld: 0, geplaatst: 0, reasons: {}, ...o });

test('a board counts per campaign: the whole board and each function, by application week', () => {
  const s = boardStats(board());
  assert.deepEqual(Object.keys(s).sort(), ['*', KOK, BEDIENING].sort());
  assert.deepEqual(s['*'], {
    minW: CUR - 2,
    weeks: { [CUR]: tr(3), [CUR - 1]: tr(1, { gescreend: 1, gesprek: 1 }), [CUR - 2]: tr(1, { reasons: { Afstand: 1 } }) },
    live: { nieuw: 1, contact: 1 },
  });
  assert.deepEqual(s[KOK], { minW: CUR, weeks: { [CUR]: tr(3) }, live: { nieuw: 1, contact: 1 } }, 'the Informatie list does not count');
  assert.deepEqual(s[BEDIENING].live, { nieuw: 0, contact: 0 }, 'archived and rejected cards are not on the call list');
});

test('the snapshot keeps only new candidates per week and today\'s call list', () => {
  const q = quickStats(boardStats(board()), CUR - 1);
  assert.deepEqual(q['*'], { minW: CUR - 2, weeks: { [CUR]: { nieuw: 3 }, [CUR - 1]: { nieuw: 1 } }, live: { nieuw: 1, contact: 1 } });
  assert.deepEqual(q[BEDIENING], { minW: CUR - 2, weeks: { [CUR - 1]: { nieuw: 1 } }, live: { nieuw: 0, contact: 0 } }, 'no pipeline, no rejection reasons, no older weeks');
});

test('a campaign from the snapshot shows the same weeks and numbers as one from the full board', () => {
  const link = { id: `t-${BOARD_ID}-all`, boardId: BOARD_ID, boardName: 'Hotel Zee', labelId: null, vac: 'Alle functies', rec: 'Kim' };
  const fb = { [CUR]: { q: 7, rec: 'goede kandidaten' }, [CUR - 1]: { leads: 5 } };
  const full = liveCampaign(link, boardStats(board())['*'], fb, []);
  const quick = liveCampaign(link, JSON.parse(JSON.stringify(quickStats(boardStats(board()), CUR - 11)))['*'], fb, [], true);
  for (const c of [full, quick]) {
    assert.deepEqual(c.weeks.map(w => [w.w, w.leads, w.q]), [[CUR - 2, 1, null], [CUR - 1, 5, null], [CUR, 3, 7]]);
    assert.deepEqual(c.live, { nieuw: 1, contact: 1 });
    assert.equal(c.start, CUR - 2);
    assert.equal(c.client, 'Hotel Zee');
  }
  assert.equal(quick.quick, true, 'marked, so the pipeline shows as still loading');
  assert.equal(full.quick, undefined);
  assert.equal(full.weeks[1].tr.gesprek, 1);
  assert.equal(quick.weeks[1].tr.gesprek, 0);
});

test('a function without cards yet is a campaign of one empty week', () => {
  const link = { id: 't-x', boardId: BOARD_ID, boardName: 'Hotel Zee', labelId: 'cccccccccccccccccccccccc', vac: 'Afwas', rec: 'Kim' };
  const c = liveCampaign(link, undefined, {}, []);
  assert.deepEqual(c.weeks.map(w => [w.w, w.leads]), [[CUR, 0]]);
  assert.deepEqual(c.live, { nieuw: 0, contact: 0 });
});
