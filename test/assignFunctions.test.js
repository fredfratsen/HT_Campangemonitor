// The functions of a client in Toewijzing (src/lib/assignFunctions.js): which have a campaign, which are new, and
// which campaigns lost their function in Trello (an older label on a board that has intake lists now).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientFunctions, isOpen, newFns, addWith, withTrelloNames } from '../src/lib/assignFunctions.js';
import { boardFunctions } from '../src/lib/boardStats.js';
import { board, intakeBoard, BOARD_ID, KOK, SPOED, IN } from './trello-fixture.js';

const link = o => ({ id: `t-${BOARD_ID}-${o.labelId || o.listId || 'all'}`, boardId: BOARD_ID, boardName: 'Hotel Zee', labelId: null, rec: 'Kim', ...o });
const client = (links, bd = intakeBoard()) => clientFunctions(BOARD_ID, links, boardFunctions(bd, links), {});
const done = x => ({ ...x, linked: true, rec: 'Kim', mkt: 'Molina' });
const fn = (x, name) => x.fns.find(f => f.name === name);
// Every open intake list on intakeBoard has a campaign: Kok by its label, Bediening and Afwas by their list.
const ALL = [link({ labelId: KOK, vac: 'Kok' }), link({ listId: IN.bediening, vac: 'Bediening' }), link({ listId: IN.afwas, vac: 'Afwas' })];

test('a campaign of an older label without an intake list is flagged, with the intake lists it can move to', () => {
  const x = client([link({ labelId: KOK, vac: 'Kok' }), link({ labelId: SPOED, vac: 'Spoed' })]);
  assert.equal(fn(x, 'Kok').noCol, false, 'Kok has Nieuwe Sollicitant | Kok');
  assert.equal(fn(x, 'Spoed').noCol, true);
  assert.deepEqual(x.moveTo.map(f => f.name).sort(), ['Afwas', 'Bediening'], 'the intake lists without a campaign');
});

test('a client with such a campaign needs work in Toewijzing, also when every intake list has one; a stopped one does not', () => {
  assert.equal(isOpen(done(client(ALL))), false);
  const spoed = link({ labelId: SPOED, vac: 'Spoed' }), x = client([...ALL, spoed]);
  assert.equal(isOpen(done(x)), true);
  assert.deepEqual(x.moveTo, [], 'no intake list left to move to');
  const stopped = client([...ALL, { ...spoed, halt: { kind: 'stop', by: 'Danielle', w: 1 } }]);
  assert.equal(fn(stopped, 'Spoed').noCol, false);
  assert.equal(isOpen(done(stopped)), false);
});

test('after Overzetten the campaign is the function of its intake list', () => {
  const x = client([...ALL.slice(0, 2), link({ labelId: SPOED, vac: 'Afwas', joinList: IN.afwas })]);
  assert.equal(fn(x, 'Afwas').kind, 'linked');
  assert.equal(fn(x, 'Afwas').noCol, false);
  assert.equal(x.fns.filter(f => f.name === 'Afwas').length, 1, 'no second, new Afwas');
  assert.equal(isOpen(done(x)), false);
});

test('a client linked as a whole shows its intake lists as new, and needs work until it is split', () => {
  const x = client([link({ vac: 'Alle functies' })]);
  assert.equal(x.whole, true);
  assert.deepEqual(newFns(x).map(f => f.name).sort(), ['Afwas', 'Bediening', 'Kok']);
  assert.equal(isOpen(done(x)), true);
});

test('a board with only labels, linked as a whole, stays as it was: nothing new, nothing to do, but it can be split', () => {
  const x = client([link({ vac: 'Alle functies' })], board());
  assert.deepEqual(newFns(x), []);
  assert.equal(isOpen(done(x)), false);
  assert.deepEqual(x.split.map(f => f.name).sort(), ['Bediening', 'Kok']);
  assert.equal(x.fns.some(f => f.noCol), false, 'no intake lists, so no campaign misses one');
});

test('a new function is added with the client\'s recruiter, or with either of them when there are several', () => {
  assert.deepEqual(addWith({ linked: true, rec: 'Kim', recs: ['Kim'] }), ['Kim']);
  assert.deepEqual(addWith({ linked: true, rec: '__multi', recs: ['Kim', 'Juul'] }), ['Kim', 'Juul']);
  assert.deepEqual(addWith({ linked: true, rec: '__inactive', recs: [''] }), ['__inactive']);
  assert.deepEqual(addWith({ linked: false, rec: '', recs: [] }), [], 'a new client gets its recruiter first');
});

test('Opnieuw ophalen gives the campaigns the names of their board and functions in Trello now', () => {
  const bd = intakeBoard();
  bd.name = 'Hotel Zee & Strand';
  bd.lists.find(l => l.id === IN.bediening).name = 'Nieuwe Sollicitant | Bediening & bar';
  const other = { id: 't-other-x', boardId: 'other', boardName: 'Ander bord', listId: 'x', vac: 'Kok' };
  const links = [...ALL, link({ labelId: SPOED, vac: 'Spoed' }), link({ vac: 'Alle functies', labelName: 'Hele bord' }), other];
  const got = withTrelloNames(links, BOARD_ID, bd), by = id => got.find(k => k.id === id);
  assert.equal(by(ALL[1].id).vac, 'Bediening & bar', 'a renamed intake list');
  assert.equal(by(ALL[1].id).labelName, 'Bediening & bar');
  assert.equal(by(ALL[0].id).vac, 'Kok', 'Kok by its label, named after its intake list');
  assert.equal(by(`t-${BOARD_ID}-${SPOED}`).vac, 'Spoed', 'without an intake list it keeps its name');
  assert.equal(by(`t-${BOARD_ID}-all`).vac, 'Alle functies');
  assert.ok(got.filter(k => k.boardId === BOARD_ID).every(k => k.boardName === 'Hotel Zee & Strand'));
  assert.equal(by(other.id), other, 'other boards stay as they are');
  assert.deepEqual(got.map(k => k.id), links.map(k => k.id), 'the same campaigns, so their feedback stays');
});
