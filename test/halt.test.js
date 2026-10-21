// Pauze and Gestopt (src/lib/halt.js): a new campaign starts on Pauze until its ads are live, and the line that says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHalt, haltLine, waitsForAds, haltLabel } from '../src/lib/halt.js';
import { wl } from '../src/lib/weeks.js';

test('a new campaign starts on Pauze, marked as new', () => {
  assert.deepEqual(startHalt('Robbin', 43), { kind: 'pauze', nieuw: true, by: 'Robbin', w: 43 });
  assert.equal(waitsForAds(startHalt('Robbin', 43)), true);
  for (const h of [null, undefined, { kind: 'pauze', by: 'Danielle', w: 43 }, { ...startHalt('Robbin', 43), kind: 'stop' }]) assert.equal(waitsForAds(h), false, JSON.stringify(h));
});

test('the label in Campagnes tells a new campaign from one paused by hand', () => {
  assert.equal(haltLabel(startHalt('Robbin', 43)), 'Pauze · nieuw');
  assert.equal(haltLabel({ kind: 'pauze', by: 'Danielle', w: 43 }), 'Pauze');
  assert.equal(haltLabel({ kind: 'stop', w: 43 }), 'Gestopt');
});

test('the halt line: who paused or stopped it, or that a new campaign waits for its ads', () => {
  assert.equal(haltLine({ kind: 'pauze', by: 'Danielle', w: 43 }), `Gepauzeerd door Danielle · week ${wl(43)}`);
  assert.equal(haltLine({ kind: 'stop', w: 43 }), `Gestopt · week ${wl(43)}`);
  assert.equal(haltLine(startHalt('Robbin', 43)), `Nieuw · op pauze tot de ads live staan · week ${wl(43)}`, 'not the teamlead who assigned it');
  assert.equal(haltLine({ ...startHalt('Robbin', 43), kind: 'stop' }), `Gestopt door Robbin · week ${wl(43)}`, 'stopped is never new');
});
