// The search above the list on Feedback klant and Wekelijkse feedback recruiter (src/lib/queueSearch.js): on client
// and vacature, like Campagnes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesQ } from '../src/lib/queueSearch.js';

const campaigns = [
  { client: 'Bakkerij Oost', vac: 'Chauffeur' },
  { client: 'Hoek Logistiek', vac: 'Magazijnmedewerker' },
  { client: 'Zuid Zorg', vac: 'Verpleegkundige' }
];
const found = q => campaigns.filter(c => matchesQ(c, q)).map(c => c.client);

test('an empty search shows every campaign', () => {
  assert.deepEqual(found(''), ['Bakkerij Oost', 'Hoek Logistiek', 'Zuid Zorg']);
  assert.deepEqual(found('   '), ['Bakkerij Oost', 'Hoek Logistiek', 'Zuid Zorg']);
  assert.deepEqual(found(undefined), ['Bakkerij Oost', 'Hoek Logistiek', 'Zuid Zorg']);
});

test('it searches on the client and on the vacature', () => {
  assert.deepEqual(found('hoek'), ['Hoek Logistiek']);
  assert.deepEqual(found('chauffeur'), ['Bakkerij Oost']);
  assert.deepEqual(found('oost chauf'), ['Bakkerij Oost'], 'client and vacature in one search');
});

test('case and spaces around the search do not matter', () => {
  assert.deepEqual(found('  ZUID '), ['Zuid Zorg']);
});

test('no match shows nothing', () => {
  assert.deepEqual(found('kapper'), []);
});
