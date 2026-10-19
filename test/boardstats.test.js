// Counting a Trello board per campaign (src/lib/boardStats.js), and the smaller snapshot of it that the home screens
// show right after login, before the full boards are loaded in the background.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardStats, boardFunctions, withoutFunction, quickStats, liveCampaign, liveCampaigns, linkKey } from '../src/lib/boardStats.js';
import { intakeName, stageOf } from '../src/lib/constants.js';
import { CUR } from '../src/lib/weeks.js';
import { board, intakeBoard, BOARD_ID, KOK, BEDIENING, IN, INTAKE_CARD } from './trello-fixture.js';

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

test('an intake list "Nieuwe Sollicitant | <functie>" names a function, in the ways clients write it', () => {
  const cases = [
    ['Nieuwe Sollicitant | Kok', 'Kok'],
    ['nieuwe sollicitanten - Bediening', 'Bediening'],
    ['Nieuwe Sollicitant: Afwas ', 'Afwas'],
    ['Nieuwe sollicitant – Sous-chef', 'Sous-chef'],
    ['  NIEUWE SOLLICITANT|Gastvrouw', 'Gastvrouw'],
    ['Nieuwe Sollicitant', null],
    ['Nieuwe Sollicitant | ', null],
    ['Nieuw', null],
    ['Contactpoging', null],
    ['Kok – nieuwe sollicitant', null],
  ];
  for (const [name, want] of cases) assert.equal(intakeName(name), want, name);
  assert.equal(stageOf('Nieuwe Sollicitant | Gastvrouw gesprekken'), 'nieuw', 'an intake list is always Nieuw, whatever the function is called');
});

test('a candidate counts for the intake list it came in through, also after moving on, and the list goes before a label', () => {
  const s = boardStats(intakeBoard());
  assert.deepEqual(Object.keys(s).sort(), ['*', KOK, IN.bediening, IN.barista].sort(), 'no key for Spoed: the intake list decides');
  assert.deepEqual(s['*'].weeks[CUR], tr(7, { gescreend: 1 }), 'every card once, Informatie not');
  assert.deepEqual(s['*'].live, { nieuw: 2, contact: 3 });
  // Kok: the label and the list "Nieuwe Sollicitant | Kok" are one function, under the label: inKok, kokMoved, labelOnly.
  assert.deepEqual(s[KOK].weeks[CUR], tr(3));
  assert.deepEqual(s[KOK].live, { nieuw: 1, contact: 2 });
  // Bediening: bedMislabeled (labelled Kok, came in through Bediening) and inBedSpoed.
  assert.deepEqual(s[IN.bediening].weeks[CUR], tr(2, { gescreend: 1 }));
  assert.deepEqual(s[IN.bediening].live, { nieuw: 1, contact: 0 });
  assert.deepEqual(s[IN.barista].weeks[CUR], tr(1), 'an archived intake list still counts for the cards that came in through it');
});

test('the functions of a board: open intake lists (also empty) and labels with cards, one per name', () => {
  const fns = boardFunctions(intakeBoard()).sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(fns, [
    { id: IN.afwas, name: 'Afwas', labelId: null, listId: IN.afwas, cards: 0 },
    { id: IN.bediening, name: 'Bediening', labelId: null, listId: IN.bediening, cards: 2 },
    { id: KOK, name: 'Kok', labelId: KOK, listId: IN.kok, cards: 3 },
  ]);
  const old = boardFunctions(board()).sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(old, [
    { id: BEDIENING, name: 'Bediening', labelId: BEDIENING, listId: null, cards: 2 },
    { id: KOK, name: 'Kok', labelId: KOK, listId: null, cards: 3 },
  ], 'a board with only labels: as before, Informatie not counted');
});

test('a new intake list with the name of an archived one continues its function', () => {
  const bd = intakeBoard(), NEW = '2200000000000000000000b4', card = INTAKE_CARD.inKok.replace(/.$/, 'f');
  bd.lists.push({ id: NEW, name: 'Nieuwe Sollicitant - Barista', closed: false });
  bd.cards.push({ id: card, idList: NEW, idLabels: [], closed: false, customFieldItems: [] });
  assert.deepEqual(boardStats(bd)[IN.barista].weeks[CUR], tr(2), 'the old card and the one in the new list');
  assert.equal(boardStats(bd)[NEW], undefined);
  assert.deepEqual(boardFunctions(bd).find(f => f.name === 'Barista'), { id: IN.barista, name: 'Barista', labelId: null, listId: NEW, cards: 2 });
});

test('a campaign linked to an intake list, a label or the whole board gets those numbers', () => {
  const s = boardStats(intakeBoard()), camp = k => liveCampaign({ id: 't', boardId: BOARD_ID, boardName: 'Hotel Zee', vac: 'x', rec: 'Kim', ...k }, s[linkKey(k)], {}, []);
  assert.equal(camp({ labelId: null, listId: IN.bediening }).weeks.at(-1).leads, 2);
  assert.equal(camp({ labelId: KOK }).weeks.at(-1).leads, 3);
  assert.equal(camp({ labelId: null }).weeks.at(-1).leads, 7);
});

test('candidates without a function: no intake list and no label, Informatie not counted', () => {
  assert.equal(withoutFunction(intakeBoard()), 1, 'only the card "none"');
  assert.equal(withoutFunction(board()), 0);
});

test('a board on Niet actief keeps its campaigns, without a recruiter', () => {
  const link = { id: `t-${BOARD_ID}-all`, boardId: BOARD_ID, boardName: 'Hotel Zee', labelId: null, vac: 'Alle functies', rec: 'Kim' };
  const L = { links: [link], fb: {}, actions: {}, inactive: {} }, full = { [BOARD_ID]: boardStats(board()) };
  const [on] = liveCampaigns(L, full, {});
  assert.equal(on.rec, 'Kim');
  assert.equal(on.inactive, undefined);
  const [off] = liveCampaigns({ ...L, inactive: { [BOARD_ID]: true } }, full, {});
  assert.equal(off.rec, '', 'no recruiter, so in nobody\'s weekly feedback');
  assert.equal(off.inactive, true);
  assert.equal(off.ended, false, 'still in the marketeer\'s screens');
  assert.deepEqual(off.weeks.map(w => w.leads), on.weeks.map(w => w.leads));
  assert.deepEqual(liveCampaigns(L, {}, {}), [], 'a board that is not loaded yet shows no campaign');
});

test('a paused or stopped link keeps its campaign, with who did it and when', () => {
  const halt = { kind: 'pauze', by: 'Danielle', w: CUR };
  const link = { id: `t-${BOARD_ID}-all`, boardId: BOARD_ID, boardName: 'Hotel Zee', labelId: null, vac: 'Alle functies', rec: 'Kim' };
  const full = { [BOARD_ID]: boardStats(board()) }, L = { links: [{ ...link, halt }], fb: {}, actions: {}, inactive: {} };
  const [c] = liveCampaigns(L, full, {});
  assert.deepEqual(c.halt, halt);
  assert.equal(c.rec, 'Kim', 'the recruiter still calls its candidates');
  assert.equal(liveCampaigns({ ...L, links: [link] }, full, {})[0].halt, undefined);
});

test('a function without cards yet is a campaign of one empty week', () => {
  const link = { id: 't-x', boardId: BOARD_ID, boardName: 'Hotel Zee', labelId: 'cccccccccccccccccccccccc', vac: 'Afwas', rec: 'Kim' };
  const c = liveCampaign(link, undefined, {}, []);
  assert.deepEqual(c.weeks.map(w => [w.w, w.leads]), [[CUR, 0]]);
  assert.deepEqual(c.live, { nieuw: 0, contact: 0 });
});
