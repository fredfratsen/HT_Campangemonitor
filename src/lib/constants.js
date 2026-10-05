// Statuses, rules and copy that the whole app shares. The team itself lives in the accounts (server/accounts.js).

// Recruiter names in older demo data, renamed on load.
export const RENAME = { Sanne: 'Robin', Mehmet: 'Tsjerk', Lotte: 'Kim', Joris: 'Juul' };
// Health level from the rules (0 no signal, 1 orange, 2 red). Colours the signals; the status shown is MONITOR.
export const STAT = [
  { label: 'Geen signaal', fg: '#1A7A4A', bg: '#E6F4ED' },
  { label: 'Oranje signaal', fg: '#B45309', bg: '#FEF3C7' },
  { label: 'Rood signaal', fg: '#D32F2F', bg: '#FDECEA' }
];
// Monitor status of a campaign this week (see monitor() in helpers.js), in order of priority.
export const MONITOR = {
  actie: { label: 'Actie nodig', fg: '#D32F2F', bg: '#FDECEA', rank: 2 },
  klant: { label: 'In afwachting van klant', fg: '#B45309', bg: '#FEF3C7', rank: 1 },
  check: { label: 'Check', fg: '#1A7A4A', bg: '#E6F4ED', rank: 0 }
};
export const MONITOR_KEYS = ['actie', 'klant', 'check'];
// A recruiter gets at most one feedback reminder per 48 hours (checked by the server too).
export const REMIND_GAP_MS = 48 * 36e5;
export const DEF_RULES = { qRedOn: true, qRed: 4, declOn: true, declWeeks: 2, minLeadsOn: true, minLeads: 2, manualOn: true, qOrangeOn: true, qOrange: 6, dropOn: true, dropPct: 30, missingOn: true };

// Trello. Demo: labels just found in Trello without a campaign (a new function of a client, a label that isn't a
// function, and new boards), and boards without activity for [days].
export const TR_EXTRA = [
  { board: 'Hotel Wijnberg', label: 'Kok', cards: 3 },
  { board: 'Hotel De Linde', label: 'Spoed', cards: 1 },
  { board: 'Restaurant De Zwaan', label: 'Bediening', cards: 4 },
  { board: 'Restaurant De Zwaan', label: 'Afwasser', cards: 2 },
  { board: 'Hotel Bellevue', label: 'Receptionist', cards: 6 },
  { board: 'Hotel Bellevue', label: 'Ontbijtmedewerker', cards: 2 }
];
export const TR_INACTIVE = [
  ['Café De Gouden Leeuw', ['Bediening'], 142], ['Hotel Rivierzicht', ['Kok', 'Afwasser'], 96], ['Restaurant Het Anker', ['Sous-chef'], 210],
  ['Bistro Sjiek', ['Bediening', 'Barmedewerker'], 64], ['Eetcafé De Brug', ['Kok'], 318], ['Strandclub West', ['Bediening'], 181],
  ['Hotel Maasoever', ['Receptionist'], 75], ['Pannenkoekenhuis Oma', ['Allround'], 402], ['Lunchcafé Kade', ['Barista'], 133]
];
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

// Blacklist (server/blacklist.js): why a candidate is on it. Only things the candidate did, so no health, origin,
// religion or other sensitive data, and no suspicions of crimes (those need legal advice first). 'Overig' needs a
// note. An entry ends after one of BL_MONTHS; a proposal nobody decided on after BL_PROPOSAL_DAYS.
export const BL_REASONS = ['No-show bij gesprek of proefdag', 'Niet verschenen na plaatsing', 'Ongepast of agressief gedrag', 'Bewust onjuiste informatie gegeven', 'Klant wil niet meer met deze kandidaat werken', 'Overig'];
export const BL_MONTHS = [6, 12, 24];
export const BL_DEF_MONTHS = 12;
export const BL_PROPOSAL_DAYS = 30;

export const NEWS = [
  { id: 14, date: '5 okt', tag: 'Verbeterd', title: 'Je bugs en ideeën komen aan', text: 'Wat je via ‘Bug of idee melden’ instuurt, komt nu direct bij de ontwikkelaar binnen, ook per e-mail. Staat jouw punt er al tussen? Geef dan een +1, zo zie je wat het vaakst speelt.' },
  { id: 13, date: '5 okt', tag: 'Nieuw', title: 'Blacklist voor kandidaten', text: 'Onder Kandidaten › Blacklist zoek je op naam, e-mail of telefoonnummer of een kandidaat op de blacklist staat, en waarom. Recruiters dragen iemand voor; de teamlead bevestigt of wijst af. Een vermelding geldt voor alle klanten of alleen voor één klant, en verloopt vanzelf na de gekozen termijn.' },
  { id: 12, date: '5 okt', tag: 'Verbeterd', title: 'Klanten uit Trello zit nu in Toewijzing', text: 'Nieuwe borden en functies uit Trello verschijnen direct in Toewijzing; het scherm Klanten uit Trello is vervallen. Elke functie houdt een eigen campagne met eigen feedback, maar de recruiter en Recruitment Marketeer kies je per klant: zij volgen alle functies. Vink meerdere klanten aan om ze in één keer toe te wijzen. Een label dat geen functie is, zet je op Geen functie.' },
  { id: 11, date: '2 okt', tag: 'Nieuw', title: 'Monitorstatus voor Recruitment Marketeers', text: 'Het weekoverzicht toont nu de monitorstatus: Actie nodig, In afwachting van klant (bijvoorbeeld saldo of foto’s) of Check. Op een campagne zet je de status en schrijf je een update voor de recruiter; die krijgt een melding. Een campagne open je vanuit het weekoverzicht ook in een nieuw tabblad. Herinneringen voor feedback gaan hooguit eens per 48 uur naar dezelfde recruiter.' },
  { id: 10, date: '2 okt', tag: 'Verbeterd', title: 'Rustiger overzicht voor recruiters', text: 'De wekelijkse feedback toont nu groot om welke week het gaat. Mijn campagnes heeft geen kolommen meer voor status, recruiter en gemiddelde kwaliteit, en sorteert standaard op meeste instroom. Recruiters en Recruitment Marketeers kunnen via ‘Bekijk als’ elkaars scherm bekijken; recruiters zien alleen dat van andere recruiters.' },
  { id: 9, date: '30 sep', tag: 'Nieuw', title: 'Rol Account Manager en vragen over campagnes', text: 'Account Managers zien alles wat een Recruitment Marketeer ziet, maar wijzigen niets. Via ‘Vraag stellen’ op een campagne sturen ze een vraag aan de marketeer en recruiter. Die beantwoord je onder Meldingen.' },
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
// Historie & analyse is parked for now: hidden from the menu and not reachable. Set to true to bring it back.
export const HISTORY_ENABLED = false;
export const VIEW_NAMES = { settings: 'Instellingen', week: 'Weekoverzicht', campaigns: 'Campagnes', klant: 'Feedback klant', 'trello-test': 'Trello-koppeling testen', toewijzing: 'Toewijzing', history: 'Historie & analyse', rules: 'Health-regels', detail: 'Campagnedetail', checkin: 'Wekelijkse feedback recruiter', live: 'Live campagnes', mine: 'Mijn campagnes', blacklist: 'Blacklist' };
export const ACT_TYPES = ['Advertentie', 'Doelgroep', 'Budget', 'Vacaturetekst', 'Screening', 'Klantafspraak', 'Besluit'];
