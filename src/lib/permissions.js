// Roles and rights, shared by the server (which enforces them) and the app (which hides what you can't use).
//
// Like Trello and Notion: every account has a role, and the role gives a set of default rights. Per account,
// someone who manages members can switch individual rights on or off (grants / revokes). The role's level
// (owner > admin > member) decides who may manage whom.

export const RIGHTS = [
  { key: 'campaigns.all', group: 'werk', label: 'Alle campagnes bekijken', desc: 'Weekoverzicht, Campagnes, Historie & analyse en de Health-regels. Zonder dit recht zie je alleen je eigen campagnes.' },
  { key: 'feedback.own', group: 'werk', label: 'Eigen recruiterfeedback invullen', desc: 'De wekelijkse feedback voor campagnes waar jij de recruiter bent, plus Live campagnes.' },
  { key: 'feedback.all', group: 'werk', label: 'Recruiterfeedback van anderen invullen', desc: 'Feedback invullen of corrigeren voor campagnes van andere recruiters.' },
  { key: 'feedback.client', group: 'werk', label: 'Klantfeedback vastleggen', desc: 'De terugkoppeling van de klant per week.' },
  { key: 'campaign.changes', group: 'werk', label: 'Campagnewijzigingen vastleggen', desc: 'Advertentie, doelgroep, budget, vacaturetekst, …' },
  { key: 'campaigns.monitor', group: 'werk', label: 'Monitorstatus en updates bijhouden', desc: 'Een campagne op Check of In afwachting van klant zetten, en updates schrijven die de recruiter ziet.' },
  { key: 'reminders.send', group: 'werk', label: 'Herinneringen sturen', desc: 'Recruiters herinneren aan ontbrekende feedback.' },
  { key: 'questions.ask', group: 'werk', label: 'Vragen stellen over campagnes', desc: 'Een vraag over een campagne sturen aan de Recruitment Marketeer en recruiter. Vraag en antwoord komen binnen onder Meldingen.' },
  { key: 'blacklist.view', group: 'werk', label: 'Blacklist raadplegen', desc: 'Opzoeken of een kandidaat op de blacklist staat, en waarom. Een kandidaat voordragen; wie de blacklist beheert, beslist.' },
  { key: 'rules.edit', group: 'beheer', label: 'Health-regels aanpassen', desc: 'Regels aan- en uitzetten en drempels wijzigen. Geldt voor het hele team.' },
  { key: 'trello.link', group: 'beheer', label: 'Trello-koppeling testen', desc: 'Op de testpagina nagaan of de borden uit Trello goed binnenkomen.' },
  { key: 'assign', group: 'beheer', label: 'Toewijzing beheren', desc: 'Klanten uit Trello toewijzen: recruiter en Recruitment Marketeer per klant kiezen, nieuwe functies toevoegen, een klant op Niet actief zetten, of een bord op Geen klant.' },
  { key: 'ideas.manage', group: 'beheer', label: 'Bugs en ideeën afhandelen', desc: 'De status van meldingen wijzigen.' },
  { key: 'members.manage', group: 'beheer', label: 'Leden en rechten beheren', desc: 'Mensen uitnodigen, rollen en rechten wijzigen, accounts deactiveren.' },
  { key: 'blacklist.manage', group: 'beheer', label: 'Blacklist beheren', desc: 'De hele blacklist zien, kandidaten erop zetten, voordrachten bevestigen of afwijzen, vermeldingen wijzigen en verwijderen.' },
  { key: 'integrations', group: 'eigenaar', label: 'Integraties en API-sleutels', desc: 'Sleutels voor Trello (en later andere diensten) instellen en testen.' },
  { key: 'audit.view', group: 'eigenaar', label: 'Auditlog bekijken', desc: 'Wie heeft wanneer ingelogd, rechten gewijzigd of sleutels aangepast.' },
  { key: 'privacy', group: 'eigenaar', label: 'Privacy-tools', desc: 'Gegevens van een persoon exporteren of anonimiseren, bewaartermijnen instellen.' },
  { key: 'dev', group: 'eigenaar', label: 'Dev-tools', desc: '“Bekijk als” voor iedereen, demo-data herstellen.' },
];
export const RIGHT_KEYS = RIGHTS.map(r => r.key);
export const RIGHT_GROUPS = { werk: 'Werk', beheer: 'Beheer', eigenaar: 'Eigenaar' };

export const LEVELS = { owner: { label: 'Eigenaar', rank: 3 }, admin: { label: 'Beheerder', rank: 2 }, member: { label: 'Lid', rank: 1 } };

const WORK = ['campaigns.all', 'feedback.own', 'feedback.all', 'feedback.client', 'campaign.changes', 'campaigns.monitor', 'reminders.send', 'questions.ask', 'blacklist.view'];
const ADMIN = ['rules.edit', 'trello.link', 'assign', 'ideas.manage', 'members.manage', 'blacklist.manage'];

export const ROLES = {
  dev: { label: 'Dev', level: 'owner', rights: RIGHT_KEYS, desc: 'Alles, inclusief integraties, auditlog en privacy-tools.' },
  teamlead: { label: 'Teamlead', level: 'admin', rights: [...WORK, ...ADMIN], desc: 'Al het werk, plus leden, toewijzing, Trello, regels en de blacklist.' },
  marketeer: { label: 'Recruitment Marketeer', level: 'member', rights: ['campaigns.all', 'feedback.client', 'campaign.changes', 'campaigns.monitor', 'reminders.send'], desc: 'Campagnes, monitorstatus, klantfeedback, campagnewijzigingen en herinneringen.' },
  accountmanager: { label: 'Account Manager', level: 'member', rights: ['campaigns.all', 'questions.ask'], desc: 'Ziet alles wat een Recruitment Marketeer ziet, maar wijzigt niets. Kan vragen stellen over campagnes.' },
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
 * "Bekijk als": whose view each role may open. Recruiters and Recruitment Marketeers can open each other's,
 * except that a recruiter never sees a Recruitment Marketeer's view. With the "dev" right you can open anyone's.
 */
export const VIEW_AS = { marketeer: ['marketeer', 'recruiter'], recruiter: ['recruiter'] };
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
