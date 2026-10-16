// A Trello board as the proxy returns it (server/trello.js: fixed fields, only the two custom fields the monitor
// uses), with cards in this feedback week (CUR) and the two weeks before. Shared by the board-stats and snapshot tests.
import { CUR, mondayOf } from '../src/lib/weeks.js';

/** Noon on day `d` (0 = Monday) of week w, local time. */
export const dayOf = (w, d) => { const m = mondayOf(w); return new Date(m.getFullYear(), m.getMonth(), m.getDate() + d, 12); };
/** A Trello id created at `date`: the first 8 hex characters are the creation time in seconds. */
export const idAt = (date, n) => Math.floor(date.getTime() / 1000).toString(16).padStart(8, '0') + n.toString(16).padStart(16, '0');

export const BOARD_ID = 'b0a4d0000000000000000001';
export const KOK = 'aaaaaaaaaaaaaaaaaaaaaaaa', BEDIENING = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const L = { nieuw: '1100000000000000000000a1', contact: '1100000000000000000000a2', gesprek: '1100000000000000000000a3', afgewezen: '1100000000000000000000a4', info: '1100000000000000000000a5' };
const SD = 'cf00000000000000000000d1', RF = 'cf00000000000000000000d2', AFSTAND = 'cf00000000000000000000e1';

export const CARD = {
  kokNew: idAt(dayOf(CUR, 1), 1),          // Nieuw, open
  kokContact: idAt(dayOf(CUR, 2), 2),      // Contactpoging, open
  kokArchived: idAt(dayOf(CUR, 3), 3),     // Nieuw, archived: counts in the week, not on today's call list
  bedGesprek: idAt(dayOf(CUR - 1, 0), 4),  // Gesprek: screened and interviewed
  bedRejected: idAt(dayOf(CUR, 4), 5),     // Afgewezen, applied two weeks earlier (Sollicitatiedatum), reason Afstand
  kokInfo: idAt(dayOf(CUR, 1), 6),         // in the Informatie list: never counted
};

const card = (id, list, labels, extra = {}) => ({ id, idList: L[list], idLabels: labels, closed: false, customFieldItems: [], ...extra });

// A board that has its functions as intake lists ("Nieuwe Sollicitant | Kok") instead of labels. Cards that moved on
// carry idIntake: the intake list they came in through, as the proxy adds it from Trello's history.
export const IN = {
  info: '2200000000000000000000a0', kok: '2200000000000000000000a1', bediening: '2200000000000000000000a2', afwas: '2200000000000000000000a3',
  barista: '2200000000000000000000a4', contact: '2200000000000000000000a5', gescreend: '2200000000000000000000a6', afgewezen: '2200000000000000000000a7',
};
export const SPOED = 'dddddddddddddddddddddddd';
export const INTAKE_CARD = {
  inKok: idAt(dayOf(CUR, 0), 11),       // still in Nieuwe Sollicitant | Kok, no label
  kokMoved: idAt(dayOf(CUR, 0), 12),    // moved on to Contactpoging, came in through Kok
  bedMislabeled: idAt(dayOf(CUR, 1), 13), // came in through Bediening, now Gescreend, but labelled Kok
  inBedSpoed: idAt(dayOf(CUR, 1), 14),  // in Nieuwe Sollicitant - Bediening, with the label Spoed
  labelOnly: idAt(dayOf(CUR, 2), 15),   // older card without an intake list: follows its label Kok
  none: idAt(dayOf(CUR, 2), 16),        // no intake list, no label: only the board as a whole
  info: idAt(dayOf(CUR, 2), 17),        // Informatie: never counted
  barista: idAt(dayOf(CUR, 3), 18),     // came in through an archived intake list, now Afgewezen
};

export function intakeBoard() {
  const c = (id, list, labels = [], extra = {}) => ({ id, idList: IN[list], idLabels: labels, closed: false, customFieldItems: [], ...extra });
  return {
    id: BOARD_ID, name: 'Hotel Zee',
    lists: [
      { id: IN.info, name: 'Informatie voor de recruiter', closed: false },
      { id: IN.kok, name: 'Nieuwe Sollicitant | Kok', closed: false },
      { id: IN.bediening, name: 'nieuwe sollicitanten - Bediening', closed: false },
      { id: IN.afwas, name: 'Nieuwe Sollicitant: Afwas', closed: false },
      { id: IN.barista, name: 'Nieuwe Sollicitant | Barista', closed: true },
      { id: IN.contact, name: 'Contactpoging', closed: false },
      { id: IN.gescreend, name: 'Gescreend', closed: false },
      { id: IN.afgewezen, name: 'Afgewezen', closed: false },
    ],
    labels: [{ id: KOK, name: 'kok ', color: 'green' }, { id: SPOED, name: 'Spoed', color: 'red' }],
    customFields: [],
    cards: [
      c(INTAKE_CARD.inKok, 'kok'),
      c(INTAKE_CARD.kokMoved, 'contact', [], { idIntake: IN.kok }),
      c(INTAKE_CARD.bedMislabeled, 'gescreend', [KOK], { idIntake: IN.bediening }),
      c(INTAKE_CARD.inBedSpoed, 'bediening', [SPOED]),
      c(INTAKE_CARD.labelOnly, 'contact', [KOK]),
      c(INTAKE_CARD.none, 'contact'),
      c(INTAKE_CARD.info, 'info'),
      c(INTAKE_CARD.barista, 'afgewezen', [], { idIntake: IN.barista }),
    ],
  };
}

export function board() {
  return {
    id: BOARD_ID, name: 'Hotel Zee',
    lists: [
      { id: L.nieuw, name: 'Nieuw' }, { id: L.contact, name: 'Contactpoging' }, { id: L.gesprek, name: 'Gesprek' },
      { id: L.afgewezen, name: 'Afgewezen' }, { id: L.info, name: 'Informatie kandidaten' },
    ],
    labels: [{ id: KOK, name: 'Kok', color: 'green' }, { id: BEDIENING, name: 'Bediening', color: 'blue' }],
    customFields: [
      { id: SD, name: 'Sollicitatiedatum', type: 'date' },
      { id: RF, name: 'Reden afgewezen', type: 'list', options: [{ id: AFSTAND, value: { text: 'Afstand' } }] },
    ],
    cards: [
      card(CARD.kokNew, 'nieuw', [KOK]),
      card(CARD.kokContact, 'contact', [KOK]),
      card(CARD.kokArchived, 'nieuw', [KOK], { closed: true }),
      card(CARD.bedGesprek, 'gesprek', [BEDIENING]),
      card(CARD.bedRejected, 'afgewezen', [BEDIENING], { closed: true, customFieldItems: [
        { id: 'cfi1', idCustomField: SD, value: { date: dayOf(CUR - 2, 2).toISOString() } },
        { id: 'cfi2', idCustomField: RF, idValue: AFSTAND },
      ] }),
      card(CARD.kokInfo, 'info', [KOK]),
    ],
  };
}
