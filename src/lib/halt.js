// Pauze and Gestopt (HALT in constants.js): the halt a new campaign starts with, and the line that says whose it is.
import { HALT } from './constants.js';
import { wl } from './weeks.js';

/**
 * A campaign made in Toewijzing (a new board, or a new function of a client) starts on Pauze: its ads aren't live yet.
 * The Recruitment Marketeer resumes it once they are; a teamlead or dev can too. w: the current week.
 */
export const startHalt = (by, w) => ({ kind: 'pauze', nieuw: true, by, w });
/** Is halt h the Pauze a new campaign started with (not resumed or stopped since)? */
export const waitsForAds = h => !!h && h.kind === 'pauze' && !!h.nieuw;

/** "Pauze", "Gestopt", or "Pauze · nieuw" for a new campaign that waits for its ads (Campagnes › Pauze). */
export const haltLabel = h => waitsForAds(h) ? `${HALT.pauze.label} · nieuw` : HALT[h.kind].label;

/** "Gepauzeerd door Danielle · week 43" for halt h; for one a new campaign started with: "Nieuw · op pauze tot de ads live staan". */
export function haltLine(h) {
  if (waitsForAds(h)) return `Nieuw · op pauze tot de ads live staan · week ${wl(h.w)}`;
  const d = HALT[h.kind].done;
  return `${d[0].toUpperCase() + d.slice(1)}${h.by ? ` door ${h.by}` : ''} · week ${wl(h.w)}`;
}
