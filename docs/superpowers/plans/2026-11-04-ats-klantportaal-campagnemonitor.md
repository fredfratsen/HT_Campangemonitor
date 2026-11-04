# ATS naar het klantportaal: Campagnemonitor (implementatieplan 1 van 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In de Campagnemonitor zijn de screening als poort naar Gescreend, de klantacties, de vragen via de RM en een
beveiligde portaal-API waar het klantportaal tegenaan praat.

**Architecture:** De kandidaatlogica blijft in `server/candidates.js` (opslag en acties) en `src/lib/ats.js` (gedeeld
door server en app). Een nieuw bestand `server/portaal.js` bevat het filter `forClient` en de routes `/api/portaal/*`.
Die staan vóór `auth.guard` en draaien op een gedeelde sleutel. Het Bord (`src/App.jsx` › `bordVals`,
`src/views/BoardView.jsx`) krijgt het screeningsblok, de poort, de labels en een alleen-lezen-modus voor de RM.

**Tech Stack:** Node ≥ 20, Express 5, React 18 (class component in App.jsx, render-only views), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-04-ats-klantportaal-design.md`. Het portaal (plan 2,
`2026-11-04-ats-klantportaal-portaal.md`) bouwt op de API uit taak 4.

## Global Constraints

- Werk in `/Users/tsjerk/Webdesign/HT_Campagnemonitor`, branch `CI_Testing`. Er staan niet-gecommitte wijzigingen van de
  gebruiker in `src/App.jsx`, `src/lib/constants.js`, `src/styles/app.css` en andere bestanden: **commit alleen de
  bestanden van je taak, met expliciete paden** (`git add <pad>` / `git commit -- <paden>`), nooit `git add -A`. Raakt
  je taak een bestand dat al wijzigingen van de gebruiker heeft, stop dan en meld het.
- Elke commit eindigt met `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commentaar in het Engels, UI-teksten en foutmeldingen in het Nederlands. Volg de stijl van de omliggende code (korte
  JSDoc boven exports, inline styles in views).
- Kandidaatgegevens komen nooit in `/api/state` of de `inbox`. Persoonsgegevens alleen via `/api/kandidaten` en
  `/api/portaal`.
- Alle tests: `npm test`. Dat moet aan het eind van elke taak groen zijn.
- Productie draait alleen op Render. Netlify hoeft niets te krijgen voor de portaal-API (zie `render-only`).

## Review Focus

1. Een recruiter **sleept** een kaart van Nieuw of Contactpoging direct naar Gesprek, Voorstel of Aangenomen, met een
   lege screening. Verwacht: de server weigert (de poort geldt voor elke stap vanuit een belfase naar rang ≥ 1), en de
   app opent de poort in plaats van alleen een foutmelding te tonen. *Test in taak 2, gedrag in taak 6.*
2. De klant klikt op een kandidaat die de recruiter intussen terugzette naar Contactpoging, of die na 4 weken gewist
   is. Verwacht: `404 Kandidaat niet gevonden`, geen 400 die laat zien dat de kandidaat bestaat. *Test in taak 4.*
3. Een uit Trello overgehaalde kaart in Gesprek, zonder screening. Verwacht: onzichtbaar voor de klant en voor de RM,
   en *Doorzetten naar klant* weigert zolang de screening onvolledig is. *Test in taak 2.*
4. Een klant stelt twee vragen en de RM beantwoordt er één. Verwacht: het label *Vraag van klant* blijft staan, en een
   tweede antwoord op dezelfde vraag geeft 400. *Test in taak 3.*
5. Het portaal vraagt `?links=` leeg of met meer dan 50 ids. Verwacht: leeg geeft `{ kandidaten: [] }`, meer dan 50
   geeft 400. *Test in taak 4.*

---

### Task 1: Screening en hulpfuncties in `src/lib/ats.js`

**Files:**
- Modify: `src/lib/ats.js`
- Create: `test/ats.test.js`

**Interfaces:**
- Produces:
  - `SCREENING`: array van `{ key, emoji, label, kind: 'text'|'long'|'age'|'choice', required, options?, other?, otherLabel?, placeholder? }`, in deze volgorde en met deze waarden:
    `talen` 🗣️ Talenkennis text req · `ervaring` 💼 Werkervaring / opleiding / vakkennis long req · `situatie` 🏢 Huidige werkgever / situatie text req · `beschikbaar` 📅 Beschikbaarheid text req · `leeftijd` 🎂 Leeftijd age · `diplomas` 🎓 Diploma's / certificaten text, placeholder `Bijv. koksopleiding, SVH Leermeester, Sociale Hygiëne, HACCP, BHV, Allergenenkennis, etc.` · `woonplaats` 📍 Woonplaats text req · `rijbewijs` 🚘 Rijbewijs choice req, options `['B','Nee','Anders']`, other `'Anders'`, otherLabel `'Anders, namelijk'` · `vervoer` 🚗 Eigen vervoer choice req, options `['Ja','Nee']`, other `'Nee'`, otherLabel `'Reist met'` · `extra` 📝 Extra info / motivatie long · `advies` ➡️ Advies long req.
  - `cleanScreening(input) → screening`: alleen bekende sleutels. Bij text worden spaties samengevoegd en is het maximum 200 tekens. Bij long worden regeleinden behouden (max. 1000) en wordt alleen getrimd. Bij age een geheel getal van 14–99, anders `null`. Bij choice `{ keuze, tekst }`, met `keuze` uit options of `''` en `tekst` (max. 200) alleen bewaard als `keuze === other`.
  - `screeningMissing(s) → string[]`: de labels van de verplichte velden die leeg zijn, in de volgorde van `SCREENING`. Een choice is leeg zonder `keuze`, of met `keuze === other` en een lege `tekst`.
  - `screeningText(s, name) → string`: eerste regel `name`, dan per veld een blok `` `${emoji} ${label}:\n${waarde}` ``, gescheiden door een lege regel. De waarde voor rijbewijs is `B` / `Nee` / `Anders, namelijk: <tekst>`; voor vervoer `Ja` / `Nee → reist met: <tekst>`; een leeg veld geeft een lege waarde.
  - `CLIENT_STAGES = ['gescreend', 'gesprek', 'voorstel', 'aangenomen', 'afgewezen']`
  - `visibleToClient(c) → boolean`: `!!c.doorgezetOp && CLIENT_STAGES.includes(c.stage)`
  - `waitingSince(c) → number|null`: `c.doorgezetOp` als `c.stage === 'gescreend'`, `c.doorgezetOp` gezet is en niet `c.klantAt >= c.doorgezetOp`; anders `null`.
  - `openQuestions(c) → number`: het aantal `c.vragen` zonder `antwoord`.
  - `workdaysSince(from, now) → number`: het aantal dagen ma–vr ná de kalenderdag van `from`, tot en met de dag van `now`.
  - `CLIENT_WAIT_DAYS = 3`

- [ ] **Step 1: Write the failing tests** in `test/ats.test.js`:

```js
test('screeningMissing: the required fields, and Anders or Nee need their text', () => {
  assert.deepEqual(screeningMissing({}), ['Talenkennis', 'Werkervaring / opleiding / vakkennis', 'Huidige werkgever / situatie', 'Beschikbaarheid', 'Woonplaats', 'Rijbewijs', 'Eigen vervoer', 'Advies']);
  const full = cleanScreening({ talen: 'NL', ervaring: '3 jaar', situatie: 'Zoekend', beschikbaar: 'Direct', woonplaats: 'Utrecht',
    rijbewijs: { keuze: 'Anders', tekst: '' }, vervoer: { keuze: 'Nee', tekst: '' }, advies: 'Doen' });
  assert.deepEqual(screeningMissing(full), ['Rijbewijs', 'Eigen vervoer']);
  assert.deepEqual(screeningMissing({ ...full, rijbewijs: { keuze: 'B' }, vervoer: { keuze: 'Nee', tekst: 'OV' } }), []);
});
test('cleanScreening drops unknown keys and bad values', () => {
  const s = cleanScreening({ talen: '  NL   en EN ', hack: 'x', leeftijd: '120', rijbewijs: { keuze: 'C', tekst: 'x' }, vervoer: { keuze: 'Ja', tekst: 'fiets' } });
  assert.equal(s.talen, 'NL en EN');
  assert.equal(s.hack, undefined);
  assert.equal(s.leeftijd, null);
  assert.deepEqual(s.rijbewijs, { keuze: '', tekst: '' });
  assert.deepEqual(s.vervoer, { keuze: 'Ja', tekst: '' });
});
test('screeningText: the recruiters\' format, in order', () => {
  const t = screeningText(cleanScreening({ talen: 'NL', rijbewijs: { keuze: 'Anders', tekst: 'AM' }, vervoer: { keuze: 'Nee', tekst: 'OV' } }), 'Priya Ramdin');
  assert.ok(t.startsWith('Priya Ramdin\n\n🗣️ Talenkennis:\nNL\n\n💼 Werkervaring / opleiding / vakkennis:\n\n'));
  assert.match(t, /🚘 Rijbewijs:\nAnders, namelijk: AM/);
  assert.match(t, /🚗 Eigen vervoer:\nNee → reist met: OV/);
  assert.ok(t.trimEnd().endsWith('➡️ Advies:'));
});
test('workdaysSince skips weekends', () => {
  const d = s => new Date(s + 'T10:00:00').getTime();
  assert.equal(workdaysSince(d('2026-11-06'), d('2026-11-11')), 3); // vr → wo
  assert.equal(workdaysSince(d('2026-11-02'), d('2026-11-05')), 3); // ma → do
  assert.equal(workdaysSince(d('2026-11-07'), d('2026-11-09')), 1); // za → ma
  assert.equal(workdaysSince(d('2026-11-09'), d('2026-11-09')), 0);
});
test('visibleToClient and waitingSince', () => {
  const c = { stage: 'gescreend', doorgezetOp: 100 };
  assert.equal(visibleToClient(c), true);
  assert.equal(visibleToClient({ stage: 'contact', doorgezetOp: 100 }), false);
  assert.equal(visibleToClient({ stage: 'gesprek' }), false);
  assert.equal(waitingSince(c), 100);
  assert.equal(waitingSince({ ...c, klantAt: 150 }), null);
  assert.equal(waitingSince({ ...c, stage: 'gesprek' }), null);
});
```

- [ ] **Step 2: Run** `node --test test/ats.test.js`. Expected: FAIL (`screeningMissing` is not exported).
- [ ] **Step 3: Implement** the exports from *Produces* in `src/lib/ats.js`, below `KEEP_MS`, each with a one-line JSDoc.
- [ ] **Step 4: Run** `node --test test/ats.test.js`, then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "ats: screeningsformulier en klantzichtbaarheid" -- src/lib/ats.js test/ats.test.js` (with the Co-Authored-By line).

---

### Task 2: De poort, screening, gegevens en doorzetten in `server/candidates.js`

**Files:**
- Modify: `server/candidates.js` (`act`, `moveTo`, plus a `checkContact` helper next to `parseLead`)
- Test: `test/candidates.test.js`

**Interfaces:**
- Consumes: `cleanScreening`, `screeningMissing` and `CALL_STAGES` / `STAGE_RANK` from Task 1.
- Produces, on each candidate (new fields, `undefined` on older ones): `screening`, `doorgezetOp`.
  New `act` kinds:
  - `{ kind: 'screening', screening }`: `c.screening = cleanScreening(screening)`. Tijdlijnregel `Screening bijgewerkt`, behalve als `c.log[0]` dezelfde `what` en `by` heeft en jonger is dan 30 minuten.
  - `{ kind: 'contact', name, phone, email }`: dezelfde controles en foutteksten als `parseLead` (naam verplicht, max. 80; telefoon ≥ 9 cijfers als ingevuld; geldig e-mailadres als ingevuld; minstens één van de twee). Tijdlijn: `Gegevens gecontroleerd` als er niets verandert. Anders de wijzigingen, gescheiden door `; `: `Naam: oud → nieuw`, `Telefoon: oud → nieuw`, `E-mail: oud → nieuw`.
  - `{ kind: 'doorzetten' }`: voor een kaart die al voorbij de poort staat zonder `doorgezetOp` (uit Trello). Eisen, in deze volgorde: `STAGE_RANK[c.stage] >= 1`, anders `Doorzetten kan pas vanaf Gescreend.`; `!c.doorgezetOp`, anders `<naam> ligt al bij de klant.`; een complete screening, anders `Vul eerst de screening in: <labels>.`. Zet `c.doorgezetOp = now` en schrijft `Doorgezet naar klant`.
  - `move` krijgt optioneel `contact` (`{ name, phone, email }`) en `screening` mee. Die worden eerst toegepast, met dezelfde regels als hierboven. **De poort:** als `STAGE_RANK[to] >= 1` en `CALL_STAGES.includes(c.stage)`, dan weigert de move met `Vul eerst de screening in: <labels>.` zolang `screeningMissing(c.screening)` iets teruggeeft. Na de move: zonder `doorgezetOp` zet hij `doorgezetOp = now` en schrijft hij `Doorgezet naar klant` (na de regel `Naar …`).
  - `screening`, `contact` en `doorzetten` laten `c.undo` ongemoeid. Nu zet `act` `c.undo` op `before` of `null`; voeg een `keepUndo`-pad toe. Een undo van een poortstap laat `doorgezetOp` staan; de kaart is daarna onzichtbaar voor de klant, omdat de fase eruit valt.

- [ ] **Step 1: Write the failing tests** in `test/candidates.test.js`, using the existing `setup()` and `priya`:

```js
const SCR = { talen: 'NL', ervaring: '3 jaar', situatie: 'Zoekend', beschikbaar: 'Direct', woonplaats: 'Utrecht', rijbewijs: { keuze: 'B' }, vervoer: { keuze: 'Ja' }, advies: 'Doen' };
test('the gate: no Gescreend (or further) from a call stage without a complete screening', () => {
  const { ats, key } = setup(), c = ats.take(key, priya).cand;
  assert.throws(() => ats.act(kim, c.id, { kind: 'move', to: 'gescreend' }), /Vul eerst de screening in: Talenkennis/);
  assert.throws(() => ats.act(kim, c.id, { kind: 'move', to: 'aangenomen' }), /Vul eerst de screening in/);
  const out = ats.act(kim, c.id, { kind: 'move', to: 'gescreend', screening: SCR, contact: { name: 'Priya R. Ramdin', phone: '+31 6 1234 5678', email: 'priya@example.com' } });
  assert.equal(out.stage, 'gescreend');
  assert.ok(out.doorgezetOp);
  assert.deepEqual(out.log.slice(0, 2).map(e => e.what), ['Doorgezet naar klant', 'Naar Gescreend']);
  assert.ok(out.log.some(e => e.what === 'Naam: Priya Ramdin → Priya R. Ramdin'));
  assert.ok(out.undo, 'the move itself can be undone');
});
test('screening saves as a draft, without touching undo, one timeline line per half hour', () => {
  const { ats, key } = setup(), c = ats.take(key, priya).cand, t = Date.now();
  ats.act(kim, c.id, { kind: 'move', to: 'contact' }, t);
  ats.act(kim, c.id, { kind: 'screening', screening: { talen: 'NL' } }, t + 1000);
  const out = ats.act(kim, c.id, { kind: 'screening', screening: { talen: 'NL, EN' } }, t + 2000);
  assert.equal(out.screening.talen, 'NL, EN');
  assert.ok(out.undo, 'the move to Contactpoging can still be undone');
  assert.equal(out.log.filter(e => e.what === 'Screening bijgewerkt').length, 1);
});
test('doorzetten: a Trello card past the gate goes to the client once its screening is complete', () => {
  const { ats } = setup();
  ats.takeTrello(kim, 't-b1-kok', 'b1', [{ card: { id: 'c1' }, list: 'Gesprek', stage: 'gesprek', at: Date.now(), name: 'Jan', desc: 'Telefoon: 0612345678' }]);
  const c = ats.ofLink('t-b1-kok')[0];
  assert.equal(c.doorgezetOp, undefined);
  assert.throws(() => ats.act(kim, c.id, { kind: 'doorzetten' }), /Vul eerst de screening in/);
  ats.act(kim, c.id, { kind: 'screening', screening: SCR });
  assert.ok(ats.act(kim, c.id, { kind: 'doorzetten' }).doorgezetOp);
  assert.throws(() => ats.act(kim, c.id, { kind: 'doorzetten' }), /ligt al bij de klant/);
});
test('contact: the same checks as the intake', () => {
  const { ats, key } = setup(), c = ats.take(key, priya).cand;
  assert.throws(() => ats.act(kim, c.id, { kind: 'contact', name: '', phone: '0612345678' }), /Naam ontbreekt/);
  assert.throws(() => ats.act(kim, c.id, { kind: 'contact', name: 'P', phone: '123' }), /telefoonnummer klopt niet/);
  assert.equal(ats.act(kim, c.id, { kind: 'contact', name: 'Priya Ramdin', phone: priya.phone_number, email: 'priya@example.com' }).log[0].what, 'Gegevens gecontroleerd');
});
```

- [ ] **Step 2: Run** `node --test test/candidates.test.js`. Expected: the new tests FAIL; the old ones PASS.
- [ ] **Step 3: Implement** the kinds and the gate from *Produces* in `act`. Move the field checks of `parseLead` into `checkContact({ name, phone, email }) → { name, phone, email }`, which both `parseLead` and `act` use, so the error texts stay the same.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, including the existing `server.test.js` ATS test. That test does not move candidates to Gescreend; if it does by now, give it `screening: SCR`.
- [ ] **Step 5: Commit** `-- server/candidates.js test/candidates.test.js`, message `ats: poort naar Gescreend met screening`.

---

### Task 3: Klantacties, vragen en antwoorden in `server/candidates.js`

**Files:**
- Modify: `server/candidates.js`
- Test: `test/candidates.test.js`

**Interfaces:**
- Consumes: `visibleToClient` (Task 1).
- Produces:
  - `klantAct(linkId, id, a, door, now = Date.now()) → c | null`. Returns `null` (route: 404) when the candidate doesn't exist, `c.link !== linkId`, or `!visibleToClient(c)`. `door = { naam, organisatie }`, both required strings (trim, max. 80; otherwise `fail('Wie de actie deed ontbreekt.')`). In the timeline `by` is `` `${organisatie} · ${naam}` `` and the line gets `klant: true`. Every action sets `c.klantAt = now`. Kinds:
    - `geenGehoor`: `c.klantGg = (c.klantGg || 0) + 1`, line `Gebeld, geen gehoor`.
    - `gesprek` `{ at }`: only in `gescreend` or `gesprek` (otherwise `Een gesprek plannen kan alleen bij Gescreend of Gesprek.`); `at` required (`Kies de datum en tijd van het gesprek.`); `moveTo(c, 'gesprek')`, `c.gesprek = at`, line `` `Op gesprek · ${when(at)}` ``, `c.undo = null`.
    - `aangenomen`: not from `aangenomen` or `afgewezen`; line `Aangenomen`; `c.undo = null`.
    - `afwijzen` `{ reason }` from `REASONS`: not from `afgewezen`; `c.reason`, line `` `Afgewezen: ${reason}` ``; `c.undo = null`.
    - `opmerking` `{ text }`: required, max. 1000; line `` `Opmerking: ${text}` ``.
    - `vraag` `{ text }`: required, max. 1000; `c.vragen.push({ id: 'v' + now.toString(36) + randomToken(3), at: now, door: by, tekst, antwoord: null })`; line `` `Vraag: ${text}` ``.
  - `act` kind `antwoord` `{ vraagId, text }`: text required (max. 1000). Errors: `Deze vraag bestaat niet (meer).` / `Deze vraag is al beantwoord.`. Sets `antwoord = { at, door: actor.name, tekst }`, line `` `Antwoord aan klant: ${text}` ``, keeps `c.undo`.
  - The `log` helper gets a fourth parameter `extra` (spread into the entry), for `{ klant: true }`.

- [ ] **Step 1: Write the failing tests**, with a helper `atClient(ats, key)` that takes in `priya` and moves her to Gescreend with `SCR` (from Task 2):

```js
const door = { naam: 'Anna', organisatie: 'Sojubar' };
test('the client: Geen gehoor stays put, Op gesprek / Aangenomen / Afwijzen move, each marked as the client', () => {
  const { ats, key } = setup(), c = atClient(ats, key);
  assert.equal(ats.klantAct('t-b1-kok', c.id, { kind: 'geenGehoor' }, door).stage, 'gescreend');
  assert.equal(c.klantGg, 1);
  assert.deepEqual([c.log[0].by, c.log[0].klant], ['Sojubar · Anna', true]);
  assert.ok(c.undo, 'Geen gehoor keeps the recruiter\'s undo');
  const g = ats.klantAct('t-b1-kok', c.id, { kind: 'gesprek', at: '2026-11-12T14:00:00' }, door);
  assert.equal(g.stage, 'gesprek');
  assert.equal(g.undo, null, 'a move by the client clears the recruiter\'s undo');
  assert.equal(ats.klantAct('t-b1-kok', c.id, { kind: 'gesprek', at: '2026-11-19T14:00:00' }, door).stage, 'gesprek', 'nog een gesprek');
  assert.throws(() => ats.klantAct('t-b1-kok', c.id, { kind: 'afwijzen', reason: 'Diefstal' }, door), /Kies een reden/);
  assert.equal(ats.klantAct('t-b1-kok', c.id, { kind: 'afwijzen', reason: 'No show' }, door).reason, 'No show');
  assert.throws(() => ats.klantAct('t-b1-kok', c.id, { kind: 'gesprek', at: '2026-11-20T10:00:00' }, door), /alleen bij Gescreend of Gesprek/);
});
test('the client only reaches visible candidates of the link it names', () => {
  const { ats, key } = setup(), c = atClient(ats, key), fresh = ats.take(key, { naam: 'Mo', telefoon: '0633334444' }).cand;
  assert.equal(ats.klantAct('t-b1-andere', c.id, { kind: 'opmerking', text: 'x' }, door), null);
  assert.equal(ats.klantAct('t-b1-kok', fresh.id, { kind: 'opmerking', text: 'x' }, door), null);
  assert.equal(ats.klantAct('t-b1-kok', 'bestaatniet', { kind: 'opmerking', text: 'x' }, door), null);
  assert.throws(() => ats.klantAct('t-b1-kok', c.id, { kind: 'opmerking', text: 'x' }, { naam: '' }), /Wie de actie deed ontbreekt/);
});
test('questions: the RM answers each once; open ones are counted', () => {
  const { ats, key } = setup(), c = atClient(ats, key);
  ats.klantAct('t-b1-kok', c.id, { kind: 'vraag', text: 'Rijbewijs?' }, door);
  ats.klantAct('t-b1-kok', c.id, { kind: 'vraag', text: 'Weekend?' }, door);
  const [q1] = c.vragen, rm = { id: 'danielle', name: 'Danielle' };
  ats.act(rm, c.id, { kind: 'antwoord', vraagId: q1.id, text: 'Ja, B' });
  assert.equal(openQuestions(c), 1);
  assert.deepEqual([q1.antwoord.door, q1.antwoord.tekst], ['Danielle', 'Ja, B']);
  assert.throws(() => ats.act(rm, c.id, { kind: 'antwoord', vraagId: q1.id, text: 'nog eens' }), /al beantwoord/);
  assert.throws(() => ats.act(rm, c.id, { kind: 'antwoord', vraagId: 'nee', text: 'x' }), /bestaat niet/);
});
```

- [ ] **Step 2: Run** `node --test test/candidates.test.js`. Expected: FAIL (`klantAct` is not a function).
- [ ] **Step 3: Implement** `klantAct` and `antwoord` from *Produces*; add `klantAct` to the returned object.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `-- server/candidates.js test/candidates.test.js`, message `ats: klantacties en vragen via de RM`.

---

### Task 4: De portaal-API (`server/portaal.js`)

**Files:**
- Create: `server/portaal.js`, `test/portaal.test.js`
- Modify: `server/secrets.js` (`INTEGRATIONS.portaal`), `server/app.js` (mount before `auth.guard`), `test/server.test.js`

**Interfaces:**
- Consumes: `klantAct` (Task 3), `visibleToClient`, `waitingSince`, `stageName` (Task 1), `candidates.switched/get/ofLink`, `store.docs['live.links']`, `store.docs['live.mkt']`, `accounts.all()`, `can` from `src/lib/permissions.js`, `stamp` from `src/lib/weeks.js`.
- Produces:
  - `INTEGRATIONS.portaal = { label: 'Klantportaal', desc: 'Het klantportaal haalt hiermee de kandidaten op die bij de klant liggen, en stuurt terug wat de klant doet.', fields: [{ key: 'sleutel', label: 'Sleutel', env: 'PORTAAL_SLEUTEL', pattern: /^\S{32,}$/, hint: 'Minimaal 32 tekens; dezelfde als CAMPAGNEMONITOR_SLEUTEL in het portaal' }] }`. No entry in `TESTS`.
  - `forClient(c) → object`. Exactly the keys `id, linkId, naam, telefoon, email, screening, fase, faseNaam, gesprek, reden, doorgezetOp, wachtSinds, klantGg, vragen, tijdlijn`:
    - `reden` only when `fase === 'afgewezen'`, otherwise `null`;
    - `vragen` as `{ id, at, door, tekst, antwoord }`;
    - `tijdlijn` = `c.log` entries with `klant: true`, plus entries whose `what` starts with `Doorgezet naar klant`, `Naar Gesprek`, `Naar Voorstel`, `Naar Aangenomen` or `Afgewezen`. Those entries without `klant` get `door: 'Horeca Toppers'`. Every entry has the form `{ at, door, wat }`.
  - `portaalRouter({ candidates, secrets, store, accounts, audit, atsChanged }) → express.Router`, mounted in `app.js` as `app.use('/api/portaal', …)` directly after the intake route, so before `app.use(auth.guard)`. Middleware, in this order:
    1. at most 120 requests per minute (one counter for the whole route), otherwise `429 { fout: 'Te veel verzoeken; probeer het over een minuut opnieuw.' }`;
    2. `secrets.get('portaal')` is `null` → `503 { fout: 'Koppeling met het klantportaal staat uit' }`;
    3. compare the header `x-toppers-sleutel` with `timingSafeEqual` (same length first), otherwise `401 { fout: 'Geen toegang' }`, plus `audit.log('portaal.denied', { details: { ip: req.ip } })` at most once per minute.
  - Routes:
    - `GET /functies` → `{ functies: [{ linkId, klant: link.boardName, functie: link.vac }] }` for every id in `candidates.switched()` that has a `live.links` entry, sorted by klant then functie (`localeCompare 'nl'`).
    - `GET /kandidaten?links=a,b` → `{ kandidaten }`: `forClient` for `visibleToClient` candidates of those links, newest `doorgezetOp` first. No `links` → `[]`; more than 50 → `400 { fout: 'Maximaal 50 functies per verzoek.' }`.
    - `POST /kandidaten/:id/actie` (`express.json({ limit: '20kb' })`): `{ linkId, kind, at, reason, text, door }` → `candidates.klantAct(…)`. `null` → `404 { fout: 'Kandidaat niet gevonden' }`; a `CandidateError` → `400 { fout: e.message }`; otherwise `atsChanged()` and `200 { kandidaat: forClient(c) }`. For `kind === 'vraag'` also `store.patch(questionNotice(...))`.
  - `questionNotice(store, accounts, link, cand, now) → patches`: a single `{ doc: 'inbox', set }` with one item per recipient. Recipients: the RM `(store.docs['live.mkt'] || {})[link.boardId]` and the recruiter `link.rec`. Without an RM: every account with `status === 'active'` and `can(a, 'assign')`, plus the recruiter. Each item: `{ id, to, from: 'Klantportaal', at: stamp(), read: false, kind: 'klantvraag', client: link.boardName, title: \`Vraag van ${link.boardName} over een kandidaat · ${link.vac}\`, items: [], link: \`#bord=${link.id}&k=${cand.id}\` }`. **No name, phone number or question text.**

- [ ] **Step 1: Write the failing unit tests** in `test/portaal.test.js`:

```js
const FORBIDDEN = ['answers', 'att', 'gg', 'tba', 'calls', 'src', 'undo', 'log', 'phone', 'name', 'link', 'stage', 'reason', 'klantAt', 'lastAt', 'endedAt', 'reached', 'bl'];
test('forClient: exactly the allowed keys, no internal field, no internal timeline line', () => {
  // c (built with createCandidates + memDocs): Priya taken in via Meta, a Geen gehoor by Kim, moved to Gescreend
  // with SCR by Kim, a note 'belt liever na 17u' by Kim, then an opmerking by the client (door Sojubar · Anna)
  const out = forClient(c);
  assert.deepEqual(Object.keys(out).sort(), ['doorgezetOp', 'email', 'fase', 'faseNaam', 'gesprek', 'id', 'klantGg', 'linkId', 'naam', 'reden', 'screening', 'telefoon', 'tijdlijn', 'vragen', 'wachtSinds'].sort());
  for (const k of FORBIDDEN) assert.equal(k in out, false, k);
  const text = JSON.stringify(out);
  for (const s of ['belt liever', 'Geen gehoor', 'Meta', 'Kim']) assert.ok(!text.includes(s), s);
  assert.deepEqual(out.tijdlijn.map(e => e.door), ['Sojubar · Anna', 'Horeca Toppers']);
});
test('questionNotice carries no candidate data and goes to the RM and the recruiter', () => { /* store with live.mkt { b1: 'Danielle' }, link.rec 'Kim' */
  const [p] = questionNotice(store, accounts, link, cand, Date.now());
  const items = Object.values(p.set);
  assert.deepEqual(items.map(n => n.to).sort(), ['Danielle', 'Kim']);
  assert.ok(!JSON.stringify(p).includes('Priya') && !JSON.stringify(p).includes('1234'));
  assert.equal(items[0].link, `#bord=${link.id}&k=${cand.id}`);
});
test('questionNotice without an RM goes to whoever has Toewijzing beheren', () => {
  const accounts = { all: () => [{ name: 'Lea', role: 'teamlead', status: 'active' }, { name: 'Oud', role: 'teamlead', status: 'deactivated' }, { name: 'Kim', role: 'recruiter', status: 'active' }] };
  const [p] = questionNotice({ docs: { 'live.mkt': {} } }, accounts, link, cand, Date.now());
  assert.deepEqual(Object.values(p.set).map(n => n.to).sort(), ['Kim', 'Lea']);
});
```

- [ ] **Step 2: Write the failing HTTP test** in `test/server.test.js`, as a new `if (mode === 'server') test('portaal: …')` after the ATS test (it uses its `kok`/`bed` links and Priya). The Dev sets the key with `PUT /api/admin/integrations/portaal` and body `{ values: { sleutel: 'p'.repeat(40) } }`. Check:
  - without the integration `GET /api/portaal/functies` gives 503; after `PUT` and without a header 401, with a wrong header 401;
  - `functies` contains `{ linkId: kok.id, klant: 'Restaurant ATS', functie: 'Kok' }`;
  - after the recruiter moves Priya to Gescreend with a screening: `kandidaten?links=${kok.id}` gives one candidate; a candidate in Nieuw is not in it;
  - `?links=` with 51 ids gives 400; an empty `?links=` gives `[]`;
  - a `vraag` gives 200, and `/api/state` (as the Dev) contains `klantvraag` but not `Priya` and not the question text;
  - an action with `linkId: bed.id` gives 404; after `act({ kind: 'move', to: 'contact' })` by the recruiter, an action gives 404.
- [ ] **Step 3: Run** `node --test test/portaal.test.js test/server.test.js`. Expected: FAIL (module not found / 404 on routes).
- [ ] **Step 4: Implement** `server/portaal.js`, the integration and the mount in `app.js`, as in *Produces*.
- [ ] **Step 5: Run** `npm test`. Expected: PASS.
- [ ] **Step 6: Try it by hand:** start `npm run dev:fake-trello`, set the key under Integraties, then `curl -s -H 'x-toppers-sleutel: <sleutel>' localhost:3000/api/portaal/functies` gives JSON.
- [ ] **Step 7: Commit** `-- server/portaal.js server/secrets.js server/app.js test/portaal.test.js test/server.test.js`, message `portaal-API: kandidaten bij de klant, klantacties en vragen`.

---

### Task 5: De RM leest mee en antwoordt (`candidates.answer`)

**Files:**
- Modify: `src/lib/permissions.js`, `server/api.js` (ATS section, lines ~426–458), `test/rights.test.js`, `test/server.test.js`

**Interfaces:**
- Consumes: `visibleToClient` (Task 1), kind `antwoord` (Task 3).
- Produces:
  - Right `{ key: 'candidates.answer', group: 'werk', label: 'Vragen van klanten over kandidaten beantwoorden', desc: 'De kandidaten die bij de klant liggen (vanaf Gescreend) van je eigen klanten bekijken, alleen lezen, en vragen van de klant daarover beantwoorden. Met Alle campagnes bekijken: van alle klanten.' }`, directly after `candidates.all`; in `WORK` (so Teamlead gets it) and in the `marketeer` rights. Add to the marketeer `desc`: `, en vragen van klanten over kandidaten beantwoorden`.
  - In `api.js`: `accessOf(a, link) → 'full' | 'answer' | null`. `'full'` = the current `seesLink`. `'answer'` = `can(a, 'candidates.answer') && (can(a, 'campaigns.all') || (store.docs['live.mkt'] || {})[link.boardId] === a.name)`.
    - `GET /api/kandidaten?link=`: with `'answer'` only `visibleToClient` candidates, each `{ ...view(a, c), readOnly: true }`.
    - `POST /:id/actie`: with `'answer'` only kinds `antwoord` and `note`, otherwise 403. With `'full'`, `antwoord` needs `can(a, 'candidates.answer')`, otherwise 403.

- [ ] **Step 1: Write the failing tests.** In `rights.test.js`: the marketeer and the teamlead have `candidates.answer`, the recruiter and the account manager don't. In `server.test.js`, extend the ATS test after the existing marketeer part: patch `live.mkt` `{ b8: 'ATS Marketeer' }`, then for `mkt`:
  - `GET /api/kandidaten?link=${kok.id}` gives 200 with only the candidates past the gate, all `readOnly`;
  - `move` gives 403;
  - `note` gives 200;
  - `antwoord` on an open question gives 200;
  - `GET` for a board of another marketeer gives 403.
- [ ] **Step 2: Run** `npm test`. Expected: the new assertions FAIL. The existing assertion `mkt GET … 403` before the `live.mkt` patch keeps passing.
- [ ] **Step 3: Implement** the right and `accessOf`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `-- src/lib/permissions.js server/api.js test/rights.test.js test/server.test.js`, message `rechten: RM leest kandidaten bij de klant en beantwoordt vragen`.

---

### Task 6: Bord: screeningsblok, poort en Kopieer als tekst

**Files:**
- Modify: `src/App.jsx` (`bordVals` ~1857–1933, `BORD0`, the board state), `src/views/BoardView.jsx` (`Panel`)

**Interfaces:**
- Consumes: `SCREENING`, `cleanScreening`, `screeningMissing`, `screeningText`, `STAGE_RANK`, `CALL_STAGES` (Task 1); kinds `screening`, `contact`, `doorzetten`, `move` with `contact` and `screening` (Task 2).
- Produces (props on `panel`, used by `Panel`):
  - `screening: { fields: [{ key, emoji, label, kind, required, options, other, otherLabel, placeholder, value, set }], missing: string[], save, copy }`. `value`/`set` work on a draft in `state.bord.scr` (per candidate id). `save` is triggered 800 ms after the last change, and on blur: `bordAct({ kind: 'screening', screening: draft })` without a toast.
  - `gate: null | { name, phone, email, setName, setPhone, setEmail, ok: boolean, missing: string[], submit, cancel }`. Shown when `B.mode === 'gate'`.
  - `canDoorzetten: boolean`: `STAGE_RANK[x.stage] >= 1 && !x.doorgezetOp`. Shows the button *Screening invullen* / *Doorzetten naar klant*.
- Behaviour:
  - *Bereikt · gescreend*, a move from a call stage to a stage of rank ≥ 1 through *Verplaatsen naar*, and a drop with the same effect, all open `mode: 'gate'` with `gateTo: <fase>` instead of acting straight away. For `gesprek` the existing date question comes first, then the gate.
  - `submit` sends `{ kind: 'move', to: gateTo, at?, contact, screening }`. Toast: `` `${name} ligt nu bij de klant` ``.
  - *Doorzetten naar klant* is disabled when `!ok`; under the button: `Nog in te vullen: <missing>`.
  - *Kopieer als tekst*: `navigator.clipboard.writeText(screeningText(draft, x.name))`, toast `Screening gekopieerd`.
  - The screening block sits in `Panel` above *Uit het formulier*. Fields: text → `<input>`, long → `<textarea rows=3>`, age → `<input type="number" min=14 max=99>`, choice → a row of pill buttons, plus an input when `value.keuze === other`. Required fields carry a `*` in the label. Use the existing `field` and `eyebrow` styles.

- [ ] **Step 1: Build the panel props and the `Panel` markup** from *Produces*. There are no unit tests for views in this repo; the behaviour is covered by the server tests from Task 2.
- [ ] **Step 2: Run** `npm test` and `npx vite build`. Expected: PASS, and a build without errors.
- [ ] **Step 3: Check visually** following the `ui-verification` memory: `FAKE_TRELLO=1 node --import ./scripts/fake-trello.js server/index.js` with `DATA_DIR`/`PORT`/`APP_URL` in the scratchpad, setup and 2FA via fetch, link a function to Kim, switch it to the ATS (`POST /api/kandidaten/intake/<id>`), post two leads to the intake URL. Playwright, desktop 1440 px and phone 390 px:
  - (a) panel of a lead in Nieuw, *Bereikt · gescreend*: the gate with fields;
  - (b) the button disabled with an empty screening, enabled once filled in;
  - (c) after submitting, the card is in Gescreend.
  Expected: no horizontal scroll at 390 px, the error text from the server never shown.
- [ ] **Step 4: Commit** `-- src/App.jsx src/views/BoardView.jsx`, message `bord: screening en doorzetten naar klant`. Before you start the task, check `git diff --stat src/App.jsx src/views/BoardView.jsx`: if it shows changes that aren't yours (the user's work in progress), **stop and report this** instead of committing. Interactive `git add -p` does not work here.

---

### Task 7: Bord: labels, klanttijdlijn, vragen, RM-modus en de meldingen

**Files:**
- Modify: `src/App.jsx` (`bordVals`, `bordCampaigns`, the menu rights at ~994, the hash parsing of `#bord=`, the inbox rendering at ~859), `src/views/BoardView.jsx` (`Card`, `Panel`)

**Interfaces:**
- Consumes: `waitingSince`, `workdaysSince`, `CLIENT_WAIT_DAYS`, `openQuestions`, `visibleToClient` (Task 1); `readOnly` on candidates and kind `antwoord` (Task 5); inbox items `kind: 'klantvraag'` with `link` (Task 4).
- Produces:
  - `card.tags: [{ text, tone: 'amber'|'navy'|'red' }]` (replaces `tag`; the TBA label becomes a tag with tone `'amber'`). New tags:
    - `Bij klant` (navy) when `x.stage === 'gescreend' && x.doorgezetOp`;
    - `Klant reageert niet` (red) when `waitingSince(x)` and `workdaysSince(waitingSince(x), now) >= CLIENT_WAIT_DAYS`, replacing *Bij klant*;
    - `Vraag van klant` (amber) when `openQuestions(x) > 0`;
    - `Gesprek bij klant` is the existing meta on Gesprek cards.
  - `panel.log` entries get `klant: boolean`. Client lines show the name in `#1B1B63` with a small label `klant`.
  - `panel.questions: [{ id, at, door, tekst, antwoord, canAnswer, text, setText, submit }]`, a block *Vragen van de klant* above *Historie*. `canAnswer` = `me.rights.has('candidates.answer') && !antwoord`. Submit: `bordAct({ kind: 'antwoord', vraagId, text })`, toast `Antwoord verstuurd naar de klant`.
  - `panel.readOnly`: hides *Belpoging loggen*, *Afwijzen*, *Verplaatsen naar*, *Ongedaan maken*, *Doorzetten* and drag-and-drop (`draggable` false), and makes the screening block read-only. *Notitie* stays.
  - `bordCampaigns(me)` also returns, for `me.rights.has('candidates.answer')`, the switched campaigns where `this.mktOf(c) === me.name`, or all of them with `campaigns.all`. Menu `bord`: `rec || r('candidates.all') || r('candidates.answer')`.
  - Hash `#bord=<link>&k=<id>` opens the board and selects candidate `id` once it is loaded.
  - Inbox: `klantvraag` renders like a `question`, but without a reply field. A click on it goes to `n.link` and marks it read.

- [ ] **Step 1: Implement** the props and markup from *Produces*.
- [ ] **Step 2: Run** `npm test` and `npx vite build`. Expected: PASS.
- [ ] **Step 3: Check visually** on the same setup as Task 6, after adding as the Dev: a `live.mkt` patch for the board, a marketeer account, and through `curl` with the portal key a `vraag` and an `opmerking` on the candidate from Gescreend. Screenshots:
  - (a) the recruiter's board with *Bij klant* and *Vraag van klant*;
  - (b) the panel with the client line in the timeline and the question;
  - (c) the marketeer (*Bekijk als* or their own login) sees only the cards from Gescreend onwards, no move buttons, and can answer;
  - (d) a click on the notification opens the board with the panel.
- [ ] **Step 4: Commit** as in Task 6 (same check beforehand), with `src/views/BoardView.jsx`, message `bord: klantlabels, vragen en RM-modus`.

---

### Task 8: Docs and memory

**Files:**
- Modify: `README.md` (the ATS section: add the screening, the portal API with `PORTAAL_SLEUTEL`, and the RM right), `docs/superpowers/specs/2026-11-04-ats-klantportaal-design.md` (Status: `gebouwd (Campagnemonitor)`)

- [ ] **Step 1:** Write it in the style of the README (short, Dutch, no reasons for the time savings; see the `time-savings-measurement` memory).
- [ ] **Step 2: Commit** `-- README.md docs/superpowers/specs/2026-11-04-ats-klantportaal-design.md`, message `docs: ATS naar het klantportaal`.
