// Roles and rights, shared by the server (which enforces them) and the app (which hides what you can't use).
//
// Like Trello and Notion: every account has a role, and the role gives a set of default rights. Per account,
// someone who manages members can switch individual rights on or off (grants / revokes). The role's level
// (owner > admin > member) decides who may manage whom.

export const RIGHTS = [
  { key: 'campaigns.all', group: 'werk', label: 'Alle campagnes bekijken', desc: 'Weekoverzicht, Campagnes, Historie & analyse en de Health-regels, voor alle klanten. Zonder dit recht zie je alleen je eigen campagnes of klanten.' },
  { key: 'campaigns.own', group: 'werk', label: 'Eigen klanten bekijken', desc: 'Weekoverzicht, Campagnes en Feedback klant, alleen voor de klanten waar jij de Recruitment Marketeer bent. Met Alle campagnes bekijken zie je alle klanten.' },
  { key: 'feedback.own', group: 'werk', label: 'Eigen recruiterfeedback invullen', desc: 'De wekelijkse feedback voor campagnes waar jij de recruiter bent, plus Live campagnes.' },
  { key: 'feedback.all', group: 'werk', label: 'Recruiterfeedback van anderen invullen', desc: 'Feedback invullen of corrigeren voor campagnes van andere recruiters.' },
  { key: 'feedback.client', group: 'werk', label: 'Klantfeedback vastleggen', desc: 'De terugkoppeling van de klant per week.' },
  { key: 'campaign.changes', group: 'werk', label: 'Campagnewijzigingen vastleggen', desc: 'Advertentie, doelgroep, budget, vacaturetekst, …' },
  { key: 'campaigns.monitor', group: 'werk', label: 'Monitorstatus en updates bijhouden', desc: 'Een campagne op Check of In afwachting van klant zetten, en updates schrijven die de recruiter ziet.' },
  { key: 'campaigns.pause', group: 'werk', label: 'Campagnes pauzeren en stopzetten', desc: 'Een campagne van een eigen klant op Pauze zetten, hervatten of stopzetten (met Alle campagnes bekijken: van elke klant). Een gestopte campagne zet alleen Toewijzing beheren weer aan.' },
  { key: 'reminders.send', group: 'werk', label: 'Herinneringen sturen', desc: 'Recruiters herinneren aan ontbrekende feedback.' },
  { key: 'questions.ask', group: 'werk', label: 'Vragen stellen over campagnes', desc: 'Een vraag over een campagne sturen aan de Recruitment Marketeer en recruiter. Vraag en antwoord komen binnen onder Meldingen.' },
  { key: 'blacklist.view', group: 'werk', label: 'Blacklist raadplegen', desc: 'Opzoeken of een kandidaat op de blacklist staat, en waarom. Een kandidaat voordragen; wie de blacklist beheert, beslist.' },
  { key: 'rules.edit', group: 'beheer', label: 'Health-regels aanpassen', desc: 'Regels aan- en uitzetten en drempels wijzigen. Geldt voor het hele team.' },
  { key: 'trello.link', group: 'beheer', label: 'Trello-koppeling testen', desc: 'Op de testpagina nagaan of de borden uit Trello goed binnenkomen.' },
  { key: 'assign', group: 'beheer', label: 'Toewijzing beheren', desc: 'Klanten uit Trello toewijzen: recruiter en Recruitment Marketeer per klant kiezen, nieuwe functies toevoegen, een klant op Niet actief zetten, of een bord op Geen klant.' },
  { key: 'ideas.manage', group: 'beheer', label: 'Bugs en ideeën afhandelen', desc: 'De status van gemelde bugs en ideeën wijzigen, onder Bug of idee melden.' },
  { key: 'members.manage', group: 'beheer', label: 'Leden en rechten beheren', desc: 'Mensen uitnodigen, rollen en rechten wijzigen, accounts deactiveren.' },
  { key: 'blacklist.manage', group: 'beheer', label: 'Blacklist beheren', desc: 'De hele blacklist zien, kandidaten erop zetten, voordrachten bevestigen of afwijzen, vermeldingen wijzigen en verwijderen.' },
  { key: 'timesaved', group: 'beheer', label: 'Tijdwinst bekijken', desc: 'De tijd die het team per week in de app werkt naast de afgesproken tijd van vroeger per taak zien, en die afgesproken tijd instellen.' },
  { key: 'integrations', group: 'eigenaar', label: 'Integraties en API-sleutels', desc: 'Sleutels voor Trello en de mailserver instellen en testen.' },
  { key: 'audit.view', group: 'eigenaar', label: 'Auditlog bekijken', desc: 'Wie heeft wanneer ingelogd, rechten gewijzigd of sleutels aangepast.' },
  { key: 'privacy', group: 'eigenaar', label: 'Privacy-tools', desc: 'Gegevens van een persoon exporteren of anonimiseren, bewaartermijnen instellen.' },
  { key: 'dev', group: 'eigenaar', label: 'Dev-tools', desc: '“Bekijk als” voor iedereen, demo-data gebruiken en herstellen, en het Dev-menu: bugs en ideeën op prioriteit sorteren, verwijderen en kiezen naar welk adres nieuwe gemaild worden.' },
];
export const RIGHT_KEYS = RIGHTS.map(r => r.key);
export const RIGHT_GROUPS = { werk: 'Werk', beheer: 'Beheer', eigenaar: 'Eigenaar' };

export const LEVELS = { owner: { label: 'Eigenaar', rank: 3 }, admin: { label: 'Beheerder', rank: 2 }, member: { label: 'Lid', rank: 1 } };

const WORK = ['campaigns.all', 'campaigns.own', 'feedback.own', 'feedback.all', 'feedback.client', 'campaign.changes', 'campaigns.monitor', 'campaigns.pause', 'reminders.send', 'questions.ask', 'blacklist.view'];
const ADMIN = ['rules.edit', 'trello.link', 'assign', 'ideas.manage', 'members.manage', 'blacklist.manage', 'timesaved'];

export const ROLES = {
  dev: { label: 'Dev', level: 'owner', rights: RIGHT_KEYS, desc: 'Alles, inclusief integraties, auditlog en privacy-tools.' },
  teamlead: { label: 'Teamlead', level: 'admin', rights: [...WORK, ...ADMIN], desc: 'Al het werk, plus leden, toewijzing, Trello, regels, de blacklist en tijdwinst.' },
  marketeer: { label: 'Recruitment Marketeer', level: 'member', rights: ['campaigns.own', 'feedback.client', 'campaign.changes', 'campaigns.monitor', 'campaigns.pause', 'reminders.send'], desc: 'Campagnes, monitorstatus, klantfeedback, campagnewijzigingen, pauzeren en stopzetten, en herinneringen, voor de eigen klanten.' },
  accountmanager: { label: 'Account Manager', level: 'member', rights: ['campaigns.all', 'questions.ask'], desc: 'Ziet de campagnes van alle klanten, maar wijzigt niets, behalve de status op Live campagnes. Kan vragen stellen over campagnes.' },
  recruiter: { label: 'Recruiter', level: 'member', rights: ['feedback.own', 'blacklist.view'], desc: 'Eigen campagnes, wekelijkse feedback, Live campagnes en de blacklist raadplegen.' },
};
export const ROLE_KEYS = Object.keys(ROLES);

export const levelOf = a => (ROLES[a && a.role] || {}).level || 'member';
export const rankOf = a => LEVELS[levelOf(a)].rank;

/** Effective rights of an account: role defaults + grants − revokes. */
export function rightsOf(a) {
  if (!a || !ROLES[a.role]) return new Set();
  const s = new Set(ROLES[a.role].rights);
  for (const r of a.grants || []) if (RIGHT_KEYS.includes(r)) s.add(r);
  for (const r of a.revokes || []) s.delete(r);
  return s;
}
export const can = (a, right) => rightsOf(a).has(right);

/**
 * The campaigns `me` ({ name, rights: Set }) sees in Weekoverzicht, Campagnes and Feedback klant: with
 * "campaigns.own" but not "campaigns.all" only those of the clients `me` is the Recruitment Marketeer of (by
 * `mktOf(c)`), else all of them.
 */
export function visibleCampaigns(campaigns, me, mktOf) {
  if (me.rights.has('campaigns.all') || !me.rights.has('campaigns.own')) return campaigns;
  return campaigns.filter(c => mktOf(c) === me.name);
}

/**
 * "Bekijk als": whose view each role may open. Recruiters and Recruitment Marketeers can open each other's,
 * except that a recruiter never sees a Recruitment Marketeer's view. Teamleads and Account Managers open a
 * recruiter's, to follow (and set Ermee bezig / Done on) their Live campagnes. With the "dev" right you can open
 * anyone's.
 */
export const VIEW_AS = { marketeer: ['marketeer', 'recruiter'], recruiter: ['recruiter'], teamlead: ['recruiter'], accountmanager: ['recruiter'] };
export function canViewAs(actor, target) {
  if (!actor || !target || actor.id === target.id || !ROLES[target.role]) return false;
  return can(actor, 'dev') || (VIEW_AS[actor.role] || []).includes(target.role);
}

/** Grants/revokes that turn `role` defaults into exactly `rights`. */
export function overridesFor(role, rights) {
  const def = new Set(ROLES[role].rights), want = new Set(rights);
  return { grants: RIGHT_KEYS.filter(r => want.has(r) && !def.has(r)), revokes: RIGHT_KEYS.filter(r => def.has(r) && !want.has(r)) };
}

/**
 * Why `actor` may not change `target` into `next` ({ role, rights }), or '' when allowed. Rules:
 * you need "members.manage"; you can't change yourself; only owners manage admins and owners; you can only hand
 * out a role or rights you have yourself.
 */
export function manageError(actor, target, next = null) {
  if (!can(actor, 'members.manage')) return 'Je hebt geen recht om leden te beheren.';
  if (target && actor.id === target.id) return 'Je kunt je eigen account hier niet wijzigen.';
  const own = rightsOf(actor), ownRank = rankOf(actor);
  if (target && rankOf(target) >= ownRank && levelOf(actor) !== 'owner') return 'Alleen een Eigenaar kan dit account wijzigen.';
  if (next) {
    if (!ROLES[next.role]) return 'Onbekende rol.';
    if (LEVELS[ROLES[next.role].level].rank > ownRank || (ROLES[next.role].level === 'admin' && levelOf(actor) !== 'owner')) return `Je kunt de rol ${ROLES[next.role].label} niet toekennen.`;
    const before = target ? rightsOf(target) : new Set();
    for (const r of next.rights || ROLES[next.role].rights) if (!own.has(r) && !before.has(r)) return `Je kunt het recht “${RIGHTS.find(x => x.key === r)?.label || r}” niet toekennen, omdat je het zelf niet hebt.`;
  }
  return '';
}
