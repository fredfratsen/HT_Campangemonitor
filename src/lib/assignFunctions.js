// The functions of a client (Trello board) in Toewijzing: which have a campaign, which are new, and which campaigns
// lost their function in Trello. On a board with intake lists ("Nieuwe Sollicitant | Kok"), a campaign of an older
// label or of an archived intake list misses one (noCol): the teamlead moves it to an intake list (Overzetten, so it
// keeps its feedback) or stops it. How the functions are counted: lib/boardStats.js.
import { linkKey } from './boardStats.js';

/**
 * Client boardId with its Trello links (campaigns), fns (boardFunctions of the loaded board, null while it loads) and
 * ignored (the functions set to Geen functie, { 'boardId|fnId': true }). Returns
 * - whole: one campaign for the whole board; cols: the board has open intake lists;
 * - fns: its campaigns ('linked', with noCol) and, unless whole, the functions without one ('pending' or 'ignored');
 * - split: when whole, the functions it can be split into; moveTo: the new intake lists a campaign can be moved to.
 */
export function clientFunctions(boardId, links, fns, ignored = {}) {
  const all = fns || [], cols = all.some(f => f.listId), whole = links.some(k => linkKey(k) === '*');
  const cardsOf = id => (all.find(f => f.id === id) || {}).cards, hasCol = k => all.some(f => f.listId && f.id === linkKey(k));
  // The whole-board campaign only gets a row of its own when it's on Pauze or stopped, to resume or activate it.
  const own = links.filter(k => linkKey(k) !== '*' || k.halt).map(k => ({ key: k.id, name: k.vac, kind: 'linked', link: k, halt: k.halt, cards: cardsOf(linkKey(k)),
    noCol: cols && linkKey(k) !== '*' && !hasCol(k) && !(k.halt && k.halt.kind === 'stop') }));
  const free = all.filter(f => !links.some(k => linkKey(k) === f.id))
    .map(f => ({ key: boardId + '|' + f.id, name: f.name, fnId: f.id, labelId: f.labelId, listId: f.listId, cards: f.cards, kind: ignored[boardId + '|' + f.id] ? 'ignored' : 'pending' }));
  const pending = free.filter(f => f.kind === 'pending');
  return { whole, cols, fns: whole ? own : [...own, ...free], split: whole ? pending : [], moveTo: pending.filter(f => f.listId) };
}

/**
 * Open in Toewijzing (Niet volledig toegewezen): no recruiter or marketeer yet, a function without a campaign, a
 * campaign that misses its intake list, or a board with intake lists that has one campaign for the whole board.
 */
export const isOpen = x => !x.rec || !x.mkt || x.fns.some(f => f.kind === 'pending' || f.noCol) || (!!x.cols && x.split.length > 0);

/** The new functions shown in a client's row: the ones without a campaign; when whole, the intake lists to split into. */
export const newFns = x => x.whole ? (x.cols ? x.split : []) : x.fns.filter(f => f.kind === 'pending');

/** Who a new function of client x can be added with: its recruiter (or Niet actief), either one when it has several. */
export const addWith = x => !x.linked || !x.rec ? [] : x.rec === '__multi' ? x.recs.filter(Boolean) : [x.rec];
