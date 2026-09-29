// Statuses, rules and copy that the whole app shares. The team itself lives in the accounts (server/accounts.js).

// Recruiter names in older demo data, renamed on load.
export const RENAME = { Sanne: 'Robin', Mehmet: 'Tsjerk', Lotte: 'Kim', Joris: 'Juul' };
export const STAT = [
  { label: 'Goed', fg: '#1A7A4A', bg: '#E6F4ED' },
  { label: 'Monitoren', fg: '#B45309', bg: '#FEF3C7' },
  { label: 'Actie nodig', fg: '#D32F2F', bg: '#FDECEA' }
];
export const DEF_RULES = { qRedOn: true, qRed: 4, declOn: true, declWeeks: 2, minLeadsOn: true, minLeads: 2, manualOn: true, qOrangeOn: true, qOrange: 6, dropOn: true, dropPct: 30, missingOn: true };

// Trello
export const LABEL_COLORS = ['#61BD4F', '#F2D600', '#FF9F1A', '#EB5A46', '#C377E0', '#0079BF', '#00C2E0', '#51E898'];
export const TR_EXTRA = [
  { board: 'Hotel Wijnberg', label: 'Kok', cards: 3 },
  { board: 'Hotel De Linde', label: 'Spoed', cards: 1 },
  { board: 'Restaurant De Zwaan', label: 'Bediening', cards: 4, isNew: true },
  { board: 'Restaurant De Zwaan', label: 'Afwasser', cards: 2, isNew: true },
  { board: 'Hotel Bellevue', label: 'Receptionist', cards: 6, isNew: true },
  { board: 'Hotel Bellevue', label: 'Ontbijtmedewerker', cards: 2, isNew: true }
];
export const TR_INACTIVE = [
  ['Café De Gouden Leeuw', ['Bediening'], 142], ['Hotel Rivierzicht', ['Kok', 'Afwasser'], 96], ['Restaurant Het Anker', ['Sous-chef'], 210],
  ['Bistro Sjiek', ['Bediening', 'Barmedewerker'], 64], ['Eetcafé De Brug', ['Kok'], 318], ['Strandclub West', ['Bediening'], 181],
  ['Hotel Maasoever', ['Receptionist'], 75], ['Pannenkoekenhuis Oma', ['Allround'], 402], ['Lunchcafé Kade', ['Barista'], 133]
];
export const TCOL = { green: 'groen', yellow: 'geel', orange: 'oranje', red: 'rood', purple: 'paars', blue: 'blauw', sky: 'lichtblauw', lime: 'lime', pink: 'roze', black: 'zwart' };
export const TCOLHEX = { green: '#61BD4F', yellow: '#F2D600', orange: '#FF9F1A', red: '#EB5A46', purple: '#C377E0', blue: '#0079BF', sky: '#00C2E0', lime: '#51E898', pink: '#FF78CB', black: '#344563' };
export const RANK = { gescreend: 1, gesprek: 2, voorgesteld: 3, geplaatst: 4 };
/** Maps a Trello list name to a pipeline stage. */
export function stageOf(name) {
  const n = name.toLowerCase();
  if (n.includes('informatie')) return 'info';
  if (n.includes('afgewezen')) return 'afgewezen';
  if (n.includes('aangenomen')) return 'geplaatst';
  if (n.includes('voorstel')) return 'voorgesteld';
  if (n.includes('gesprek')) return 'gesprek';
  if (n.includes('gescreend')) return 'gescreend';
  if (n.includes('contactpoging')) return 'contact';
  if (n.includes('nieuw')) return 'nieuw';
  return 'overig';
}
// Trello card ids start with the creation time (seconds, hex).
export const cardTs = id => parseInt(id.slice(0, 8), 16) * 1000;

export const REASONS = ['Te weinig ervaring', 'Afstand', 'Taalbarrière', 'Geen interesse', 'Geen reactie', 'No show', 'Foutieve contactgegevens', 'Ander aanbod', 'Salaris te laag', 'Overgekwalificeerd', 'Overig'];

export const NEWS = [
  { id: 8, date: '29 sep', tag: 'Nieuw', title: 'Eigen accounts en rechten', text: 'Iedereen logt nu in met een eigen account in plaats van het teamwachtwoord. Wat je ziet en mag, hangt af van je rol en rechten. Onder Instellingen beheer je je wachtwoord, tweestapsverificatie en je gegevens.' },
  { id: 7, date: '28 sep', tag: 'Nieuw', title: 'Meldingen, nieuws en ideeën', text: 'Herinneringen voor open feedback komen binnen onder Meldingen. Via ‘Bug of idee melden’ kan iedereen aangeven wat niet werkt of beter kan.' },
  { id: 6, date: '28 sep', tag: 'Nieuw', title: 'Opvolging ‘Niet actief’', text: 'In Toewijzing kan een klant op Niet actief. De klant verdwijnt dan uit alle schermen en het belwerk.' },
  { id: 5, date: '28 sep', tag: 'Nieuw', title: 'Toewijzing voor de teamlead', text: 'Per klant een recruiter en Recruitment Marketeer kiezen, met het aantal klanten per persoon.' },
  { id: 4, date: '28 sep', tag: 'Nieuw', title: 'Trello live', text: 'Klanten, nieuwe kandidaten en contactpogingen komen direct uit Trello. Kies linksonder de databron ‘Trello live’.' },
  { id: 3, date: '28 sep', tag: 'Verbeterd', title: 'Live campagnes voor recruiters', text: 'Belwerk van vandaag per klant: nieuwe kandidaten en contactpogingen.' },
  { id: 2, date: '28 sep', tag: 'Verbeterd', title: 'Klantfeedback los van recruiterfeedback', text: 'Recruiters vullen alleen hun eigen feedback in. Klantfeedback is optioneel en wordt door marketeers vastgelegd.' },
  { id: 1, date: '28 sep', tag: 'Nieuw', title: 'Campagnemonitor gestart', text: 'Wekelijkse feedback, weekoverzicht, campagne health en historie op één plek.' }
];
export const IDEA_TYPES = { bug: ['Bug', '#FDECEA', '#D32F2F', 'Wat ging er mis? Wat deed je, en wat verwachtte je?'], idee: ['Idee', '#E7E7F0', '#1B1B63', 'Wat zou je handig vinden?'], verbetering: ['Verbetering', '#FEF3C7', '#B45309', 'Wat werkt nu onhandig, en hoe zou het beter kunnen?'] };
export const IDEA_STATUS = { nieuw: ['Nieuw', '#5C5C5A'], opgepakt: ['Opgepakt', '#B45309'], opgelost: ['Opgelost', '#1A7A4A'], niet: ['Doen we niet', '#8C8C8A'] };
export const VIEW_NAMES = { settings: 'Instellingen', week: 'Weekoverzicht', campaigns: 'Campagnes', klant: 'Feedback klant', trello: 'Klanten uit Trello', 'trello-test': 'Trello-koppeling testen', toewijzing: 'Toewijzing', history: 'Historie & analyse', rules: 'Health-regels', detail: 'Campagnedetail', checkin: 'Wekelijkse feedback recruiter', live: 'Live campagnes', mine: 'Mijn campagnes' };
export const ACT_TYPES = ['Advertentie', 'Doelgroep', 'Budget', 'Vacaturetekst', 'Screening', 'Klantafspraak', 'Besluit'];
