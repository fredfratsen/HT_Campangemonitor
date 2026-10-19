// Which intake list ("Nieuwe Sollicitant | Kok", see intakeName in src/lib/constants.js) every Trello card came in
// through, kept in DATA_DIR/trello-intake.json. That way a candidate keeps their function after moving on to
// Contactpoging or Gescreend, without anyone putting a label on the card (see src/lib/boardStats.js).
//
// Filled from Trello's history of each board (server/trello.js). Only card ids and list ids are kept: Trello also
// sends the card's title (the candidate's name), which the proxy drops before it gets here. Per board: cards
// { cardId: listId } and since, the newest Trello action read. The next read starts OVERLAP before that, so a move
// Trello shows a little late is still read; reading a move twice changes nothing. Cards no longer on the board and
// boards Trello no longer lists are forgotten.
//
// The same history read also gives when a card last got the Trello button ‘Geen gehoor’ (a comment, whose text the
// proxy drops): geenGehoor { cardId: date }, only today's, so the call list can leave it out until midnight.
import { intakeName } from '../src/lib/constants.js';
import { LIVE_WEEKS } from '../src/lib/boardStats.js';
import { feedbackWeek, mondayOf } from '../src/lib/weeks.js';

const OVERLAP = 5 * 60 * 1000;

/** @param docs  document factory from jsonfile.js (files) */
export function createTrelloIntake(docs) {
  const f = docs('trello-intake', () => ({ boards: {} }), { backups: 0 });
  const boards = () => f.data.boards || (f.data.boards = {});

  return {
    /**
     * From when to read a board's history: the weeks the monitor shows the first time, after that what is new. A
     * memory from before ‘Geen gehoor’ was read (no geenGehoor yet) reads today's history once more for it.
     */
    since(id, now = Date.now()) {
      const b = boards()[id];
      if (!b || !b.since) return new Date(mondayOf(feedbackWeek(now) - LIVE_WEEKS + 1).getTime()).toISOString();
      const from = Date.parse(b.since) - OVERLAP;
      return new Date(b.geenGehoor ? from : Math.min(from, new Date(now).setHours(0, 0, 0, 0))).toISOString();
    },
    /**
     * Board bd just loaded (as the proxy sends it), with the moves in its history since since(): [{ date, card, list }]
     * and [{ date, card, geenGehoor: true }], or null when Trello didn't give them (then only where the cards are now
     * counts, and the next read starts from the same point). Gives the cards of bd their idIntake, and geenGehoor
     * when it was today.
     */
    update(id, bd, moves, now = Date.now()) {
      const intake = new Set((bd.lists || []).filter(l => intakeName(l.name)).map(l => l.id));
      const b = boards()[id] || (boards()[id] = { since: null, cards: {} });
      const called = b.geenGehoor || {}, today = new Date(now).setHours(0, 0, 0, 0);
      if (moves) {
        b.geenGehoor = called;
        // Oldest first, so of two intake lists the last one wins.
        for (const m of [...moves].sort((x, y) => Date.parse(x.date) - Date.parse(y.date))) {
          if (m.card && m.geenGehoor) called[m.card] = m.date;
          else if (m.card && intake.has(m.list)) b.cards[m.card] = m.list;
          if (!b.since || Date.parse(m.date) > Date.parse(b.since)) b.since = m.date;
        }
        if (!b.since) b.since = new Date(now).toISOString();
      }
      const on = new Set();
      for (const c of bd.cards || []) { on.add(c.id); if (intake.has(c.idList)) b.cards[c.id] = c.idList; }
      for (const card of Object.keys(b.cards)) if (!on.has(card)) delete b.cards[card];
      for (const [card, date] of Object.entries(called)) if (!on.has(card) || Date.parse(date) < today) delete called[card];
      for (const c of bd.cards || []) {
        if (b.cards[c.id]) c.idIntake = b.cards[c.id];
        if (called[c.id]) c.geenGehoor = called[c.id];
      }
      f.save();
    },
    /** The open boards Trello lists now: the others are closed or no longer shared, and are forgotten. */
    keepOnly(list) {
      const keep = new Set(list.map(b => b.id)), all = boards(), gone = Object.keys(all).filter(id => !keep.has(id));
      for (const id of gone) delete all[id];
      if (gone.length) f.save();
    },
    /** Another Trello key: start over. */
    clear() { f.data.boards = {}; f.save(); },
  };
}
