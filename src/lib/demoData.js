// Demo dataset from the design. The design was drawn for week 39 (21–27 sep 2026); the data is shifted
// so the last week of every active campaign is always the current feedback week.
import { REASONS } from './constants.js';
import { rnd, avgOf } from './helpers.js';
import { CUR, MON, mondayOf } from './weeks.js';

const DESIGN_WEEK = 39;
const OFF = CUR - DESIGN_WEEK;
const N = null;

// id, client, vacature, recruiter, start week, leads per week, quality per week, ended
const RAW = [
  ['c1', 'Brasserie De Haven', 'Zelfstandig Werkend Kok', 'Robin', 36, [6, 10, 7, 8], [7, 7, 5, 6]],
  ['c2', 'Hotel Wijnberg', 'Floormanager', 'Tsjerk', 33, [6, 5, 5, 4, 3, 3, 3], [6, 6, 5, 5, 5, 5, 4]],
  ['c3', 'Grand Café Stadhuis', 'Bediening', 'Kim', 31, [14, 12, 15, 11, 13, 12, 10, 12, 12], [8, 7, 8, 8, 7, 8, 8, 8, 8]],
  ['c4', "Eetcafé 't Hoekje", 'Chef-kok', 'Juul', 35, [4, 3, 3, 2, 2], [5, 5, 4, 4, 3]],
  ['c5', 'Strandpaviljoen Zuid', 'Afwasser', 'Robin', 34, [9, 11, 8, 10, 9, 11], [7, 7, 8, 7, 7, 7]],
  ['c6', 'Bistro Lumière', 'Sous-chef', 'Tsjerk', 36, [5, 6, 4, 5], [8, 7, 6, 5]],
  ['c7', 'Hotel De Linde', 'Receptionist', 'Kim', 32, [5, 6, 7, 6, 5, 6, 7, 6], [7, 8, 8, 7, 8, 8, 7, 8]],
  ['c8', 'Pizzeria Nonna', 'Pizzabakker', 'Juul', 37, [8, 9, 11], [6, 7, 7]],
  ['c9', 'Restaurant Oost', 'Bediening parttime', 'Robin', 30, [12, 15, 14, 18, 16, 20, 19, 22, 21, 24], [8, 8, 7, 7, 6, 6, 6, 5, 5, 5]],
  ['c10', 'Café Het Plein', 'Barmedewerker', 'Tsjerk', 34, [10, 9, 11, 10, 12, 10], [7, 7, 7, 8, 7, 7]],
  ['c11', 'Lunchroom Bij Fien', 'Allround medewerker', 'Kim', 35, [7, 5, 6, 4, 3], [7, 7, 7, 7, 7]],
  ['c12', 'Hotel Zeezicht', 'Kok', 'Juul', 33, [3, 4, 3, 4, 3, 3, 4], [8, 9, 8, 9, 9, 8, 9]],
  ['c13', 'Restaurant Vrijdag', 'Gastheer/-vrouw', 'Robin', 36, [9, 8, 10, 9], [6, 6, 7, 6]],
  ['c14', 'Brouwerij De Kroon', 'Tapper', 'Tsjerk', 31, [11, 13, 12, 14, 12, 13, 15, 13, 14], [7, 8, 7, 7, 8, 7, 8, 7, 7]],
  ['c15', 'Hotel Arena', 'Housekeeping', 'Kim', 34, [8, 7, 9, 8, 10, 9], [4, 4, 5, 6, 7, 7]],
  ['c16', 'Bakkerij & Brunch Mout', 'Zelfstandig Werkend Kok', 'Juul', 37, [6, 7, 6], [7, 7, 8]],
  ['c17', 'Café Rood', 'Bediening', 'Robin', 35, [10, 9, 11, 10, 9], [5, 6, 5, 6, N]],
  ['c18', 'Restaurant Graanschuur', 'Sous-chef', 'Tsjerk', 33, [5, 6, 5, 6, 7, 6, 6], [7, 7, 8, 7, 7, 8, 8]],
  ['c19', 'Hotel Stadspark', 'Nachtreceptionist', 'Kim', 36, [3, 4, 3, 3], [7, 6, 7, N]],
  ['c20', 'Foodhall Noord', 'Teamleider', 'Juul', 32, [6, 7, 8, 7, 6, 7, 8, 7], [7, 7, 8, 8, 7, 7, 8, 8]],
  ['c21', 'Strandtent Blue', 'Kok', 'Robin', 35, [7, 8, 9, 8, 9], [7, 7, 7, 8, 8]],
  ['c22', 'Grill De Wilgen', 'Grillkok', 'Tsjerk', 36, [5, 7, 6, 8], [6, 5, 6, 6]],
  ['c23', 'Brasserie Markt', 'Bediening', 'Kim', 34, [12, 11, 13, 12, 14, 13], [8, 8, 7, 8, 8, N]],
  ['c24', 'Landgoed Het Veld', 'Chef de partie', 'Juul', 30, [6, 7, 8, 6, 7, 6, 8, 7, 6, 7], [8, 8, 7, 8, 8, 8, 7, 8, 8, 8]],
  ['e1', 'Hotel Wijnberg', 'Chef de partie', 'Tsjerk', 28, [8, 9, 7, 8, 6, 7], [7, 8, 7, 8, 8, 8], true],
  ['e2', 'Café Het Plein', 'Shiftleader', 'Juul', 29, [4, 3, 3, 2, 2], [5, 4, 4, 3, 3], true],
  ['e3', 'Restaurant Oost', 'Keukenhulp', 'Kim', 30, [10, 12, 11, 9, 10, 9], [6, 7, 7, 8, 7, 8], true],
  ['e4', 'Pizzeria Nonna', 'Bezorger', 'Robin', 31, [15, 14, 16, 12], [7, 7, 6, 7], true]
];
// Texts keyed by campaign + design week: [recruiter, klant, notitie, bijsturing nodig]
const TX = {
  'c1-36': ['Goede eerste instroom, meerdere kandidaten met keukenervaring.', 'Twee kandidaten uitgenodigd.'],
  'c1-37': ['Veel reacties, drie interessant.', 'Eén gesprek gehad.'],
  'c1-38': ['Kwaliteit valt deze week tegen, weinig zelfstandige ervaring.', 'Geen geschikte kandidaat gesproken.'],
  'c1-39': ['Instroom is qua aantal goed. Meerdere kandidaten missen echter de benodigde zelfstandige keukenervaring. Twee kandidaten zijn interessant en worden voorgesteld.', 'Eén kandidaat gesproken, maar te junior. Tweede kandidaat wordt vrijdag uitgenodigd.', 'Voorlopig campagne laten doorlopen. Volgende week opnieuw kwaliteit beoordelen.'],
  'c2-39': ['Weinig kandidaten met leidinggevende ervaring. Instroom blijft laag.', 'Klant vraagt om bijsturing: zoekt echt iemand die een team kan aansturen.', 'Nieuwe creatives testen, focus op leidinggevende ervaring.', 1],
  'c3-39': ['Goede instroom, drie kandidaten voorgesteld.', 'Tevreden, twee gesprekken ingepland.'],
  'c4-39': ['Veel kandidaten missen relevante ervaring.', 'Geen van de kandidaten past bij het niveau van de keuken.', 'Doelgroep en tekst herzien met klant.', 1],
  'c6-39': ['Kwaliteit zakt verder, vooral kandidaten uit fastfood.', 'Klant twijfelt of campagne nog zinvol is.'],
  'c9-39': ['Instroom prima, maar bereikbaarheid valt tegen. Veel scholieren.', 'Wil liefst mensen die ook doordeweeks overdag kunnen.'],
  'c11-39': ['Kandidaten zijn goed, maar het aantal loopt terug.', 'Tevreden met de twee mensen die er nu lopen.'],
  'c15-36': ['Na aanpassing tekst duidelijk betere kandidaten.', 'Eerste proefdag gepland.'],
  'c15-39': ['Stabiel goede instroom sinds aanpassing.', 'Eén kandidaat aangenomen, wil er nog één.']
};
const ACTS = {
  c1: [[38, 'Screening', 'Knock-outvraag toegevoegd: minimaal 2 jaar zelfstandig in de keuken']],
  c2: [[37, 'Advertentie', 'Nieuwe creatives met teamfoto']],
  c4: [[38, 'Vacaturetekst', 'Salarisindicatie toegevoegd']],
  c6: [[37, 'Doelgroep', 'Interesses uitgebreid naar hotelkeukens']],
  c9: [[35, 'Budget', 'Dagbudget verhoogd van €25 naar €40']],
  c11: [[38, 'Klantafspraak', 'Klant wil tijdelijk minder kandidaten']],
  c15: [[35, 'Vacaturetekst', 'Nadruk op vaste uren en reiskostenvergoeding'], [36, 'Doelgroep', 'Straal verkleind van 40 naar 20 km']],
  e2: [[32, 'Besluit', 'Campagne gestopt in overleg met klant']]
};
const POOL = {
  rec: {
    hi: ['Sterke instroom, meerdere kandidaten met relevante ervaring.', 'Goede match met profiel, kandidaten goed bereikbaar.', 'Constante kwaliteit, voorgestelde kandidaten vallen goed.'],
    mid: ['Aantal prima, maar ervaring wisselend. Een paar interessante profielen.', 'Bereikbaarheid valt tegen, meerdere kandidaten niet teruggebeld.', 'Veel kandidaten zonder horeca-achtergrond. Twee bruikbare profielen.'],
    lo: ['Veel kandidaten missen relevante ervaring.', 'Weinig reacties en nauwelijks passende profielen.', 'Kandidaten wonen te ver weg of zoeken alleen een bijbaan.']
  },
  kl: {
    hi: ['Twee gesprekken gepland, erg enthousiast.', 'Eén kandidaat aangenomen, wil er nog één.', 'Tevreden over het niveau van de kandidaten.'],
    mid: ['Eén gesprek gehad, twijfel over ervaring.', 'Nog niet alle kandidaten gebeld.', 'Kandidaat was goed maar salarisverwachting te hoog.'],
    lo: ['Geen geschikte kandidaat gesproken.', 'Profielen sluiten niet aan.', 'Vraagt om bijsturing op ervaring.']
  }
};
function band(q) { return q >= 7 ? 'hi' : q >= 5 ? 'mid' : 'lo'; }

export function genReasons(key, leads, q) {
  const qq = q == null ? 6 : q, n = Math.max(0, Math.round(leads * (0.3 + (10 - qq) * 0.05)));
  const wts = REASONS.map((r, i) => (i === 4 ? 3 : i === 0 ? 0.4 + (10 - qq) * 0.35 : i === 1 ? 1.6 : 0.8) * (0.3 + rnd(key + r)));
  const tot = wts.reduce((a, b) => a + b, 0), out = {};
  for (let j = 0; j < n; j++) { let x = rnd(key + 'r' + j) * tot, i = 0; while (x > wts[i] && i < wts.length - 1) { x -= wts[i]; i++; } out[REASONS[i]] = (out[REASONS[i]] || 0) + 1; }
  return out;
}
export const ensureReasons = c => c.trello ? c : { ...c, weeks: c.weeks.map(w => w.tr && !w.tr.reasons ? { ...w, tr: { ...w.tr, reasons: genReasons(c.id + '-' + w.w, w.leads, w.q) } } : w) };

const dayTxt = d => `${d.getDate()} ${MON[d.getMonth()]}`;

export function build() {
  const fri = mondayOf(CUR); fri.setDate(fri.getDate() + 4);
  return RAW.map(([id, client, vac, rec, start, L, Q, ended]) => {
    const weeks = L.map((leads, i) => {
      const dw = start + i, w = dw + OFF, q = Q[i], key = id + '-' + dw, t = TX[key] || [], r = rnd(key);
      const vg = q == null ? 0 : Math.max(0, Math.round(leads * q / 10 * 0.45));
      return {
        w, leads, q,
        rec: q == null ? '' : (t[0] || POOL.rec[band(q)][Math.floor(r * 3)]),
        klant: q == null ? '' : (t[1] || (r > 0.8 ? '' : POOL.kl[band(q)][Math.floor(rnd(key + 'k') * 3)])),
        note: t[2] || '', needsAction: !!t[3],
        at: w === CUR && q != null ? (r > 0.45 ? dayTxt(new Date()) : 'Vr ' + dayTxt(fri)) : '',
        tr: { nieuw: leads, gescreend: Math.round(leads * 0.85), voorgesteld: vg, gesprek: Math.round(vg * 0.6), geplaatst: q >= 7 && r > 0.72 ? 1 : 0, reasons: genReasons(key, leads, q) }
      };
    });
    return { id, client, vac, rec, start: start + OFF, ended: !!ended, weeks, actions: (ACTS[id] || []).map(([w, type, text], i) => ({ id: id + 'a' + i, w: w + OFF, type, text })) };
  });
}

/** Adds the weeks that passed since the demo data was stored, so active demo campaigns always end at CUR. */
export function rollForward(campaigns) {
  let changed = false;
  const out = campaigns.map(c => {
    const last = c.weeks[c.weeks.length - 1];
    if (c.ended || c.trello || !last || last.w >= CUR) return c;
    const ws = c.weeks.slice(), base = avgOf(ws.slice(-4).map(w => w.leads)) || 0;
    for (let w = last.w + 1; w <= CUR; w++) {
      const key = c.id + '-' + w, leads = Math.max(0, Math.round(base * (0.75 + rnd(key) * 0.5)));
      ws.push({ w, leads, q: null, rec: '', klant: '', note: '', needsAction: false, at: '', tr: { nieuw: leads, gescreend: Math.round(leads * 0.85), voorgesteld: 0, gesprek: 0, geplaatst: 0, reasons: genReasons(key, leads, null) } });
    }
    changed = true;
    return { ...c, weeks: ws };
  });
  return changed ? out : campaigns;
}

export const seedAssign = () => { const n = Date.now(); return [
  { id: 1, mode: 'demo', client: 'Strandtent Blue', from: '', to: 'Robin', at: n - 3 * 36e5, by: 'Robbin' },
  { id: 2, mode: 'demo', client: 'Café Rood', from: 'Kim', to: 'Robin', at: n - 5 * 36e5, by: 'Robbin' },
  { id: 3, mode: 'demo', client: 'Hotel Stadspark', from: 'Robin', to: 'Kim', at: n - 5 * 36e5, by: 'Robbin' }
]; };
