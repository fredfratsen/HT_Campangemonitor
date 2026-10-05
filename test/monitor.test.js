// Monitor status (src/lib/helpers.js): Actie nodig, In afwachting van klant or Check, from the health rules and
// what a marketeer set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { health, monitor } from '../src/lib/helpers.js';
import { DEF_RULES } from '../src/lib/constants.js';

const week = (w, o = {}) => ({ w, leads: 8, q: 8, rec: 'ok', klant: '', note: '', needsAction: false, at: 'x', tr: { nieuw: 8 }, ...o });
const camp = weeks => ({ id: 'c1', client: 'Klant', vac: 'Kok', rec: 'Kim', weeks });
const mon = c => monitor(c, health(c, DEF_RULES));

test('without a choice the rules decide: a signal is Actie nodig, none is Check', () => {
  assert.deepEqual(mon(camp([week(38), week(39), week(40)])), { s: 'check', by: '', w: null, stale: false });
  assert.equal(mon(camp([week(38), week(39), week(40, { q: 3 })])).s, 'actie', 'red signal');
  assert.equal(mon(camp([week(38), week(39), week(40, { q: null })])).s, 'actie', 'missing feedback (was Monitoren) is Actie nodig too');
});

test('a check holds for the signals seen at that moment, not for new ones', () => {
  const checked = o => camp([week(38), week(39), week(40, { q: null, mon: 'check', monBy: 'Danielle', monSig: ['missing'], ...o })]);
  assert.deepEqual(mon(checked()), { s: 'check', by: 'Danielle', w: 40, stale: false });
  assert.equal(mon(checked({ q: 8 })).s, 'check', 'a signal going away keeps it on Check');
  const late = mon(checked({ q: 3 }));
  assert.equal(late.s, 'actie', 'a new red signal after the check');
  assert.equal(late.stale, true);
  assert.equal(mon(camp([week(38), week(39, { mon: 'check', monSig: [] }), week(40, { q: 3 })])).s, 'actie', 'last week\'s check does not carry over');
});

test('waiting for the client carries over to later weeks until someone changes it', () => {
  const waiting = camp([week(38), week(39, { q: 3, mon: 'klant', monBy: 'Danielle' }), week(40, { q: 3 })]);
  assert.deepEqual(mon(waiting), { s: 'klant', by: 'Danielle', w: 39, stale: false });
  const reopened = { ...waiting, weeks: [...waiting.weeks.slice(0, 2), { ...waiting.weeks[2], mon: 'open' }] };
  assert.equal(mon(reopened).s, 'actie', '"open" hands it back to the rules');
  const checked = { ...waiting, weeks: [...waiting.weeks.slice(0, 2), { ...waiting.weeks[2], mon: 'check', monSig: ['qRed'] }] };
  assert.equal(mon(checked).s, 'check');
});
