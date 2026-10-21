// Toewijzing filtered on a recruiter and/or Recruitment Marketeer (src/lib/assignFilter.js): the name pills above the list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ofPeople, pickPerson, NOBODY } from '../src/lib/assignFilter.js';

const clients = [
  { name: 'Oost', rec: 'Kim', mkt: 'Molina' },
  { name: 'Hoek', rec: 'Kim', mkt: 'Mare' },
  { name: 'Zuid', rec: 'Robbin', mkt: 'Molina' },
  { name: 'Anker', rec: '__inactive', mkt: 'Molina' },
  { name: 'Haven', rec: '', mkt: '' }
];
const names = who => clients.filter(x => ofPeople(x, who)).map(x => x.name);

test('without a filter every client is shown', () => {
  assert.deepEqual(names(NOBODY), ['Oost', 'Hoek', 'Zuid', 'Anker', 'Haven']);
});

test('a recruiter or a marketeer alone shows their clients', () => {
  assert.deepEqual(names({ rec: 'Kim', mkt: '' }), ['Oost', 'Hoek']);
  assert.deepEqual(names({ rec: '', mkt: 'Molina' }), ['Oost', 'Zuid', 'Anker']);
  assert.deepEqual(names({ rec: '__inactive', mkt: '' }), ['Anker'], 'Niet actief is a filter too');
});

test('a recruiter and a marketeer together show only the clients they share', () => {
  assert.deepEqual(names({ rec: 'Kim', mkt: 'Molina' }), ['Oost']);
  assert.deepEqual(names({ rec: 'Robbin', mkt: 'Mare' }), []);
});

test('clicking a pill picks it, clicking it again drops it, and one person per group', () => {
  let A = { tab: 'all', who: NOBODY };
  A = { ...A, ...pickPerson(A, 'rec', 'Kim') };
  assert.deepEqual(A.who, { rec: 'Kim', mkt: '' });
  A = { ...A, ...pickPerson(A, 'mkt', 'Molina') };
  assert.deepEqual(A.who, { rec: 'Kim', mkt: 'Molina' });
  A = { ...A, ...pickPerson(A, 'rec', 'Robbin') };
  assert.deepEqual(A.who, { rec: 'Robbin', mkt: 'Molina' }, 'another recruiter replaces Kim');
  A = { ...A, ...pickPerson(A, 'mkt', 'Molina') };
  assert.deepEqual(A.who, { rec: 'Robbin', mkt: '' });
});

test('the first pick moves to Alle klanten, so the list matches the count on the pill; after that the tab stays', () => {
  assert.equal(pickPerson({ tab: 'open', who: NOBODY }, 'rec', 'Kim').tab, 'all');
  assert.equal(pickPerson({ tab: 'ignored', who: NOBODY }, 'mkt', 'Molina').tab, 'all');
  assert.equal(pickPerson({ tab: 'open', who: { rec: 'Kim', mkt: '' } }, 'mkt', 'Molina').tab, undefined, 'narrowing down keeps Niet volledig toegewezen');
  assert.equal(pickPerson({ tab: 'open', who: { rec: 'Kim', mkt: '' } }, 'rec', 'Kim').tab, undefined, 'dropping it too');
});
