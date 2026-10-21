// Toewijzing filtered on people: click a recruiter and/or Recruitment Marketeer in the pills above the list.

/** No filter: rec and mkt are each '' (anyone) or a name; rec can be '__inactive' (Niet actief). */
export const NOBODY = { rec: '', mkt: '' };

/** Is client x (from assignItems) one of who's? With a recruiter and a marketeer: the clients they share. */
export function ofPeople(x, who) {
  return (!who.rec || x.rec === who.rec) && (!who.mkt || x.mkt === who.mkt);
}

/**
 * The asg state after clicking the pill of `name` in group k ('rec' | 'mkt'): it picks that person (one per group) or
 * drops them when they were picked. The first pick moves to Alle klanten, so the list matches the count on the pill.
 */
export function pickPerson(A, k, name) {
  const who = { ...A.who, [k]: A.who[k] === name ? '' : name }, first = !A.who.rec && !A.who.mkt && (who.rec || who.mkt);
  return { who, ...(first && A.tab !== 'all' ? { tab: 'all' } : {}) };
}
