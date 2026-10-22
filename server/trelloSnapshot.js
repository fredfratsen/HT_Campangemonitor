// The last Trello numbers for the home screens (Weekoverzicht, Campagnes, Mijn campagnes, Live campagnes), kept in
// DATA_DIR/trello-snapshot.json. After login the app shows these right away and loads the full boards in the
// background. Whoever loaded a board last, everyone starts from that.
//
// Only counts per campaign (see quickStats in src/lib/boardStats.js): new candidates per week for the weeks a
// campaign shows, and today's call list. No cards, no pipeline, no rejection reasons: those only come with the full
// board. No daily backups either: it is rebuilt from Trello on every load.
import { boardStats, quickStats, LIVE_WEEKS } from '../src/lib/boardStats.js';
import { feedbackWeek } from '../src/lib/weeks.js';

/** @param docs  document factory from jsonfile.js (files) */
export function createTrelloSnapshot(docs) {
  const f = docs('trello-snapshot', () => ({ boards: {} }), { backups: 0 });
  const boards = () => f.data.boards || (f.data.boards = {});

  return {
    /** All boards: { [boardId]: { at, stats } }. */
    get: () => boards(),
    /** A board just loaded from Trello (as the proxy sends it to the app), with its Trello links (see boardStats). */
    board(id, bd, now = Date.now(), links = []) {
      boards()[id] = { at: now, stats: quickStats(boardStats(bd, now, links), feedbackWeek(now) - LIVE_WEEKS + 1) };
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
