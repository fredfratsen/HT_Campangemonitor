// Counting a Trello board per campaign (src/lib/boardStats.js), and the smaller snapshot of it that the home screens
// show right after login, before the full boards are loaded in the background.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardStats, boardFunctions, withoutFunction, quickStats, liveCampaign, liveCampaigns, linkKey, cardsOf, afterRound, feedbackRounds } from '../src/lib/boardStats.js';
import { needsFeedback } from '../src/lib/checkin.js';
import { intakeName, stageOf } from '../src/lib/constants.js';
import { CUR, countWeek, mondayOf } from '../src/lib/weeks.js';
import { board, intakeBoard, dayOf, BOARD_ID, KOK, BEDIENING, SPOED, IN, INTAKE_CARD, CARD } from './trello-fixture.js';

const tr = (nieuw, o = {}) => ({ nieuw, gescreend: 0, gesprek: 0, voorgesteld: 0, geplaatst: 0, gebeld: 0, reasons: {}, ...o });

test('a board counts per campaign: the whole board and each function, by application week', () => {
  const s = boardStats(board());
  assert.deepEqual(Object.keys(s).sort(), ['*', KOK, BEDIENING].sort());
  assert.deepEqual(s['*'], {
    minW: CUR - 2,
    weeks: { [CUR]: tr(3), [CUR - 1]: tr(1, { gescreend: 1, gesprek: 1 }), [CUR - 2]: tr(1, { reasons: { Afstand: 1 } }) },
    live: { nieuw: 1, contact: 1, gebeld: 0 },
  });
  assert.deepEqual(s[KOK], { minW: CUR, weeks: { [CUR]: tr(3) }, live: { nieuw: 1, contact: 1, gebeld: 0 } }, 'the Informatie list does not count');
  assert.deepEqual(s[BEDIENING].live, { nieuw: 0, contact: 0, gebeld: 0 }, 'archived and rejected cards are not on the call list');
});

test('a candidate from the weekend counts for the week after: a counting week runs Saturday to Friday', () => {
  const at = (w, d, h) => { const t = dayOf(w, d); t.setHours(h, 0); return t.getTime(); };
  assert.equal(countWeek(at(CUR - 1, 4, 23)), CUR - 1, 'Friday evening: still that week');
  assert.equal(countWeek(at(CUR - 1, 5, 0)), CUR, 'Saturday: the week after');
  assert.equal(countWeek(at(CUR - 1, 6, 23)), CUR, 'Sunday: the week after');
  assert.equal(countWeek(at(CUR, 0, 0)), CUR, 'Monday');
  const bd = board(), sat = bd.cards.find(c => c.id === CARD.kokNew);
  sat.customFieldItems = [{ id: 'cfi9', idCustomField: bd.customFields.find(f => f.name === 'Sollicitatiedatum').id, value: { date: new Date(at(CUR - 1, 5, 10)).toISOString() } }];
  sat.calls = [countWeek(at(CUR - 1, 6, 11))];
  const s = boardStats(bd)[KOK];
  assert.equal(s.weeks[CUR - 1], undefined, 'last week asks no feedback because of the weekend');
  assert.deepEqual(s.weeks[CUR], tr(3, { gebeld: 1 }));
});

// Last week's Friday at hour h, and a board where Kok's three cards applied that Friday at the given hours.
const W = CUR - 1, fri = h => { const t = dayOf(W, 4); t.setHours(h, 0); return t.getTime(); };
function fridayBoard(hNew, hContact, hArchived) {
  const bd = board(), sd = bd.customFields.find(f => f.name === 'Sollicitatiedatum').id;
  for (const [id, h] of [[CARD.kokNew, hNew], [CARD.kokContact, hContact], [CARD.kokArchived, hArchived]])
    bd.cards.find(c => c.id === id).customFieldItems = [{ id: 'cfi-' + id, idCustomField: sd, value: { date: new Date(fri(h)).toISOString() } }];
  return { bd, card: id => bd.cards.find(c => c.id === id) };
}

test('after the recruiter\'s round, the rest of that Friday counts for the week after', () => {
  const { bd, card } = fridayBoard(8, 14, 15);
  card(CARD.kokContact).friCalls = [fri(14) + 6e5]; // called right after coming in
  const s = boardStats(bd)[KOK], at10 = w => w === W ? fri(10) : undefined;
  assert.deepEqual([s.weeks[W].nieuw, s.weeks[W].gebeld], [3, 1], 'without a round the whole Friday counts for that week');
  const ws = afterRound(s.weeks, at10);
  assert.deepEqual([ws[W].nieuw, ws[W].gebeld], [1, 0], 'round at 10:00: only the one from 8:00 stays');
  assert.deepEqual([ws[CUR].nieuw, ws[CUR].gebeld], [2, 1], 'the afternoon counts for the week after');
  assert.equal(afterRound(s.weeks, w => w === W ? dayOf(W, 2).getTime() : undefined)[W].nieuw, 0, 'a round before the Friday moves the whole Friday');
  assert.equal(afterRound(s.weeks, w => w === W ? mondayOf(CUR).getTime() : undefined)[W].nieuw, 3, 'feedback caught up later moves nothing');
  assert.equal(s.weeks[W].nieuw, 3, 'the numbers it got stay as they were');
  card(CARD.kokContact).calls = [W];
  const t = afterRound(boardStats(bd)[KOK].weeks, at10);
  assert.deepEqual([t[W].gebeld, t[CUR].gebeld], [1, 1], 'also called earlier that week: it stays called then too');
});

test('a rejected candidate moves with how far they got and the reason', () => {
  const bd = board(), sd = bd.customFields.find(f => f.name === 'Sollicitatiedatum').id, rej = bd.cards.find(c => c.id === CARD.bedRejected);
  rej.customFieldItems = rej.customFieldItems.map(i => i.idCustomField === sd ? { ...i, value: { date: new Date(fri(16)).toISOString() } } : i);
  const ws = afterRound(boardStats(bd)['*'].weeks, w => w === W ? fri(10) : undefined);
  assert.deepEqual(ws[W].reasons, {}, 'gone from that week');
  assert.deepEqual(ws[CUR].reasons, { Afstand: 1 });
  assert.equal(ws[W].nieuw, 1, 'Bediening from Monday stays');
});

test('a campaign with nothing to give on Friday morning goes by its recruiter\'s round on another campaign', () => {
  const { bd } = fridayBoard(14, 15, 16);
  const kok = { id: 'k', boardId: BOARD_ID, boardName: 'Hotel Zee', labelId: KOK, vac: 'Kok', rec: 'Kim' };
  const bed = { id: 'b', boardId: BOARD_ID, boardName: 'Hotel Zee', labelId: BEDIENING, vac: 'Bediening', rec: 'Kim' };
  const robin = { ...kok, id: 'r', rec: 'Robin' };
  const L = { links: [kok, bed, robin], fb: { b: { [W]: { q: 7, recAt: fri(11) } }, k: { [W]: { recAt: fri(12) } } }, actions: {}, inactive: {} };
  assert.deepEqual(feedbackRounds(L), { Kim: { [W]: fri(11) } }, 'her first feedback that week');
  for (const [full, quick] of [[{ [BOARD_ID]: boardStats(bd) }, {}], [{}, { [BOARD_ID]: { stats: JSON.parse(JSON.stringify(quickStats(boardStats(bd), CUR - 11))) } }]]) {
    const [k, , r] = liveCampaigns(L, full, quick), wk = (c, w) => c.weeks.find(x => x.w === w);
    assert.equal(needsFeedback(wk(k, W)), false, 'Kim did her round at 11:00: the afternoon asks no feedback on that week');
    assert.equal(wk(k, CUR).tr.nieuw, 3);
    assert.equal(needsFeedback(wk(r, W)), true, 'Robin did no round: his Friday still counts for that week');
    assert.equal(wk(k, W).tr.fri, undefined, 'the Friday times stay out of the campaign');
  }
});

test('a card with a ‘Geen gehoor’ from today is off today\'s call list until midnight, counted as called', () => {
  const at = (d, h) => { const t = dayOf(CUR, d); t.setHours(h, 0); return t.getTime(); };
  const bd = board(), card = id => bd.cards.find(c => c.id === id);
  card(CARD.kokContact).geenGehoor = new Date(at(2, 9)).toISOString();
  card(CARD.kokNew).geenGehoor = new Date(at(1, 16)).toISOString();
  card(CARD.kokArchived).geenGehoor = new Date(at(2, 10)).toISOString();
  assert.deepEqual(boardStats(bd, at(2, 23))[KOK].live, { nieuw: 1, contact: 0, gebeld: 1 }, 'yesterday\'s counts again, an archived card not at all');
  assert.deepEqual(boardStats(bd, at(3, 0))[KOK].live, { nieuw: 1, contact: 1, gebeld: 0 }, 'the next day it is back');
  card(CARD.kokNew).geenGehoor = new Date(at(2, 8)).toISOString();
  assert.deepEqual(boardStats(bd, at(2, 23))['*'].live, { nieuw: 0, contact: 0, gebeld: 2 }, 'from Nieuw too');
  assert.deepEqual(quickStats(boardStats(bd, at(2, 23)), CUR)['*'].live, { nieuw: 0, contact: 0, gebeld: 2 }, 'the snapshot counts the same');
});

test('a card called in a week (calls, from the server) counts as called in that week, also without new candidates', () => {
  const bd = board(), card = id => bd.cards.find(c => c.id === id);
  card(CARD.kokContact).calls = [CUR];
  card(CARD.bedGesprek).calls = [CUR - 1, CUR];
  card(CARD.kokInfo).calls = [CUR];
  const s = boardStats(bd);
  assert.equal(s['*'].weeks[CUR].gebeld, 2, 'Informatie does not count');
  assert.equal(s['*'].weeks[CUR - 1].gebeld, 1);
  assert.deepEqual(s[BEDIENING].weeks[CUR], tr(0, { gebeld: 1 }), 'Bediening had no new candidates this week, but was called');
  assert.deepEqual(quickStats(s, CUR - 1)[BEDIENING].weeks, { [CUR - 1]: { nieuw: 1, gebeld: 1 }, [CUR]: { nieuw: 0, gebeld: 1 } }, 'the snapshot keeps the calls');
  const link = { id: 'x', boardId: BOARD_ID, boardName: 'Hotel Zee', labelId: BEDIENING, vac: 'Bediening', rec: 'Kim' };
  const quick = liveCampaign(link, JSON.parse(JSON.stringify(quickStats(s, CUR - 11)))[BEDIENING], {}, [], true);
  assert.deepEqual(quick.weeks.map(w => [w.w, w.tr.nieuw, w.tr.gebeld]), [[CUR - 2, 1, 0], [CUR - 1, 1, 1], [CUR, 0, 1]]);
});

test('the snapshot keeps only new candidates per week and today\'s call list', () => {
  const q = quickStats(boardStats(board()), CUR - 1);
  assert.deepEqual(q['*'], { minW: CUR - 2, weeks: { [CUR]: { nieuw: 3 }, [CUR - 1]: { nieuw: 1 } }, live: { nieuw: 1, contact: 1, gebeld: 0 } });
  assert.deepEqual(q[BEDIENING], { minW: CUR - 2, weeks: { [CUR - 1]: { nieuw: 1 } }, live: { nieuw: 0, contact: 0, gebeld: 0 } }, 'no pipeline, no rejection reasons, no older weeks');
});

test('a campaign from the snapshot shows the same weeks and numbers as one from the full board', () => {
  const link = { id: `t-${BOARD_ID}-all`, boardId: BOARD_ID, boardName: 'Hotel Zee', labelId: null, vac: 'Alle functies', rec: 'Kim' };
  const fb = { [CUR]: { q: 7, rec: 'goede kandidaten' }, [CUR - 1]: { leads: 5 } };
  const full = liveCampaign(link, boardStats(board())['*'], fb, []);
  const quick = liveCampaign(link, JSON.parse(JSON.stringify(quickStats(boardStats(board()), CUR - 11)))['*'], fb, [], true);
  for (const c of [full, quick]) {
    assert.deepEqual(c.weeks.map(w => [w.w, w.leads, w.q]), [[CUR - 2, 1, null], [CUR - 1, 5, null], [CUR, 3, 7]]);
    assert.deepEqual(c.live, { nieuw: 1, contact: 1, gebeld: 0 });
    assert.equal(c.start, CUR - 2);
    assert.equal(c.client, 'Hotel Zee');
  }
  assert.equal(quick.quick, true, 'marked, so the pipeline shows as still loading');
  assert.deepEqual(liveCampaign(link, { minW: CUR, weeks: {}, live: { nieuw: 2, contact: 1 } }, {}, [], true).live, { nieuw: 2, contact: 1, gebeld: 0 }, 'a snapshot from before ‘Geen gehoor’ was read');
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
  assert.deepEqual(s['*'].live, { nieuw: 2, contact: 3, gebeld: 0 });
  // Kok: the label and the list "Nieuwe Sollicitant | Kok" are one function, under the label: inKok, kokMoved, labelOnly.
  assert.deepEqual(s[KOK].weeks[CUR], tr(3));
  assert.deepEqual(s[KOK].live, { nieuw: 1, contact: 2, gebeld: 0 });
  // Bediening: bedMislabeled (labelled Kok, came in through Bediening) and inBedSpoed.
  assert.deepEqual(s[IN.bediening].weeks[CUR], tr(2, { gescreend: 1 }));
  assert.deepEqual(s[IN.bediening].live, { nieuw: 1, contact: 0, gebeld: 0 });
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

/** intakeBoard with an older card that only has the label Spoed, and a new card in Nieuwe Sollicitant: Afwas. */
function spoedBoard() {
  const bd = intakeBoard(), card = (n, list, labels) => ({ id: INTAKE_CARD.none.replace(/.$/, n), idList: IN[list], idLabels: labels, closed: false, customFieldItems: [] });
  bd.cards.push(card('e', 'gescreend', [SPOED]), card('f', 'afwas', []));
  return bd;
}

test('on a board with intake lists a label is no function of its own, only together with an intake list of its name', () => {
  const bd = spoedBoard(), s = boardStats(bd);
  assert.equal(s[SPOED], undefined, 'the card with only Spoed counts for the client as a whole');
  assert.equal(s['*'].weeks[CUR].nieuw, 9);
  assert.equal(boardFunctions(bd).some(f => f.id === SPOED), false, 'and Spoed is no function in Toewijzing');
  assert.equal(withoutFunction(bd), 2, 'the cards "none" and the one with only Spoed');
  assert.deepEqual(s[KOK].weeks[CUR], tr(3), 'the label Kok still counts: it has Nieuwe Sollicitant | Kok');
});

test('a label with a campaign still counts on a board with intake lists, until it is moved to one or stopped', () => {
  const bd = spoedBoard(), links = [{ id: 't-s', boardId: BOARD_ID, labelId: SPOED, vac: 'Spoed', rec: 'Kim' }];
  assert.deepEqual(boardStats(bd, Date.now(), links)[SPOED].weeks[CUR], tr(1, { gescreend: 1 }));
  assert.deepEqual(boardFunctions(bd, links).find(f => f.id === SPOED), { id: SPOED, name: 'Spoed', labelId: SPOED, listId: null, cards: 1 });
});

test('a campaign moved to an intake list (Overzetten) counts it under its own key, with the cards of its old label', () => {
  const bd = spoedBoard(), links = [{ id: 't-s', boardId: BOARD_ID, labelId: SPOED, joinList: IN.afwas, vac: 'Afwas', rec: 'Kim' }];
  const s = boardStats(bd, Date.now(), links);
  assert.deepEqual(s[SPOED].weeks[CUR], tr(2, { gescreend: 1 }), 'the card in Nieuwe Sollicitant: Afwas and the old one with only Spoed');
  assert.equal(s[IN.afwas], undefined);
  assert.deepEqual(boardFunctions(bd, links).find(f => f.name === 'Afwas'), { id: SPOED, name: 'Afwas', labelId: SPOED, listId: IN.afwas, cards: 2 });
});

test('a campaign of an archived intake list moved to a new one keeps the cards of both', () => {
  const bd = spoedBoard(), links = [{ id: 't-b', boardId: BOARD_ID, labelId: null, listId: IN.barista, joinList: IN.afwas, vac: 'Afwas', rec: 'Kim' }];
  assert.deepEqual(boardStats(bd, Date.now(), links)[IN.barista].weeks[CUR], tr(2));
  assert.deepEqual(boardFunctions(bd, links).find(f => f.name === 'Afwas'), { id: IN.barista, name: 'Afwas', labelId: null, listId: IN.afwas, cards: 2 });
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
  assert.deepEqual(c.live, { nieuw: 0, contact: 0, gebeld: 0 });
});

test('the open cards of one campaign, for the ATS to take over: by function, not archived, not Informatie', () => {
  const ids = key => cardsOf(board(), key).map(x => x.card.id).sort();
  assert.deepEqual(ids(KOK), [CARD.kokNew, CARD.kokContact].sort());
  assert.deepEqual(ids(BEDIENING), [CARD.bedGesprek]);
  assert.deepEqual(ids('*'), [CARD.kokNew, CARD.kokContact, CARD.bedGesprek].sort());
  const g = cardsOf(board(), BEDIENING)[0];
  assert.equal(g.stage, 'gesprek');
  assert.equal(g.list, 'Gesprek');
  assert.ok(g.at > 0);
  assert.deepEqual(cardsOf(intakeBoard(), KOK).map(x => x.card.id).sort(), [INTAKE_CARD.inKok, INTAKE_CARD.kokMoved, INTAKE_CARD.labelOnly].sort(), 'a card keeps the intake list it came in through');
});
