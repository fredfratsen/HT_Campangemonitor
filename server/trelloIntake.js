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
// The same history read also gives when a card last got the Trello button ‘Geen gehoor’ or the automation ‘TBA
// afspraak’ (a comment, whose text the proxy drops): geenGehoor { cardId: date }, only today's, so the call list can
// leave it out until midnight. And in which weeks a card was called: calls { cardId: [week] }, only this week and last
// (the weeks feedback can be given on), for such a comment or a move from Nieuw or Contactpoging to a list further
// on. A week without new candidates and without calls asks the recruiter no feedback (src/lib/checkin.js).
import { intakeName, stageOf } from '../src/lib/constants.js';
import { LIVE_WEEKS } from '../src/lib/boardStats.js';
import { feedbackWeek, mondayOf, weekOf } from '../src/lib/weeks.js';

const OVERLAP = 5 * 60 * 1000;
// What a history read picks up besides the intake lists: 1 calls and ‘Geen gehoor’, 2 also ‘TBA afspraak’.
const VERSION = 2;

/** @param docs  document factory from jsonfile.js (files) */
export function createTrelloIntake(docs) {
  const f = docs('trello-intake', () => ({ boards: {} }), { backups: 0 });
  const boards = () => f.data.boards || (f.data.boards = {});

  return {
    /**
     * From when to read a board's history: the weeks the monitor shows the first time, after that what is new. A
     * memory read by an older VERSION (it missed calls, ‘Geen gehoor’ or ‘TBA afspraak’) reads from last Monday once
     * more, so this week's and last week's calls and today's call list are complete.
     */
    since(id, now = Date.now()) {
      const b = boards()[id];
      if (!b || !b.since) return new Date(mondayOf(feedbackWeek(now) - LIVE_WEEKS + 1).getTime()).toISOString();
      const from = Date.parse(b.since) - OVERLAP;
      const back = (b.version || 0) < VERSION ? mondayOf(feedbackWeek(now) - 1).getTime() : from;
      return new Date(Math.min(from, back)).toISOString();
    },
    /**
     * Board bd just loaded (as the proxy sends it), with the moves in its history since since(): [{ date, card, list,
     * from }] and [{ date, card, geenGehoor: true }], or null when Trello didn't give them (then only where the cards
     * are now counts, and the next read starts from the same point). Gives the cards of bd their idIntake, geenGehoor
     * when it was today, and calls: the weeks (this one and last) they were called in.
     */
    update(id, bd, moves, now = Date.now()) {
      const intake = new Set((bd.lists || []).filter(l => intakeName(l.name)).map(l => l.id));
      const stage = {}; (bd.lists || []).forEach(l => { stage[l.id] = stageOf(l.name); });
      // Called: moved on from Nieuw or Contactpoging, not to another intake list or to Informatie.
      const callMove = m => (stage[m.from] === 'nieuw' || stage[m.from] === 'contact') && !!stage[m.list] && stage[m.list] !== 'nieuw' && stage[m.list] !== 'info';
      const b = boards()[id] || (boards()[id] = { since: null, cards: {} });
      const called = b.geenGehoor || {}, calls = b.calls || {}, today = new Date(now).setHours(0, 0, 0, 0), lastWeek = feedbackWeek(now) - 1;
      if (moves) {
        b.geenGehoor = called; b.calls = calls; b.version = VERSION;
        // Oldest first, so of two intake lists the last one wins.
        for (const m of [...moves].sort((x, y) => Date.parse(x.date) - Date.parse(y.date))) {
          if (m.card && m.geenGehoor) called[m.card] = m.date;
          else if (m.card && intake.has(m.list)) b.cards[m.card] = m.list;
          const w = weekOf(Date.parse(m.date));
          if (m.card && w >= lastWeek && (m.geenGehoor || callMove(m)) && !(calls[m.card] || []).includes(w)) calls[m.card] = [...(calls[m.card] || []), w].sort((x, y) => x - y);
          if (!b.since || Date.parse(m.date) > Date.parse(b.since)) b.since = m.date;
        }
        if (!b.since) b.since = new Date(now).toISOString();
      }
      const on = new Set();
      for (const c of bd.cards || []) { on.add(c.id); if (intake.has(c.idList)) b.cards[c.id] = c.idList; }
      for (const card of Object.keys(b.cards)) if (!on.has(card)) delete b.cards[card];
      for (const [card, date] of Object.entries(called)) if (!on.has(card) || Date.parse(date) < today) delete called[card];
      for (const [card, ws] of Object.entries(calls)) {
        const keep = ws.filter(w => w >= lastWeek);
        if (on.has(card) && keep.length) calls[card] = keep; else delete calls[card];
      }
      for (const c of bd.cards || []) {
        if (b.cards[c.id]) c.idIntake = b.cards[c.id];
        if (called[c.id]) c.geenGehoor = called[c.id];
        if (calls[c.id]) c.calls = calls[c.id];
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
