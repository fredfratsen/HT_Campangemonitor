# ATS naar het klantportaal: Portaal (implementatieplan 2 van 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Klanten zien in het klantportaal onder **Kandidaten** wie wij hebben doorgezet. Ze leggen daar hun opvolging
vast en stellen vragen. Ze krijgen herinneringen. De RM koppelt in het beheer campagnes aan functies in de
Campagnemonitor, en managers aan campagnes.

**Architecture:** Het portaal bewaart geen kandidaatgegevens. Een kleine client
(`src/lib/integrations/campagnemonitor.ts`) praat server-naar-server met `/api/portaal/*` van de Campagnemonitor. Pure
logica (zichtbaarheid, werkdagen, welke herinnering) staat in `src/lib/kandidaten.ts`, zodat die testbaar is zonder
database. De pagina's zijn server components met server actions; de sleutel komt nooit in de browser.

**Tech Stack:** Next.js 16.3 (lees eerst `node_modules/next/dist/docs/`, zie `AGENTS.md`), React 19, Prisma 7 + SQLite,
`tsx --test`.

**Spec:** `/Users/tsjerk/Webdesign/HT_Campagnemonitor/docs/superpowers/specs/2026-11-04-ats-klantportaal-design.md`.
Hangt af van taak 4 van plan 1 (`2026-11-04-ats-klantportaal-campagnemonitor.md`): de API moet draaien.

## Global Constraints

- Werk in `/Users/tsjerk/Webdesign/WenC_Klantportaal`, op een nieuwe branch `ats-kandidaten` vanaf `main`.
- Elke commit eindigt met `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code en commentaar in het Nederlands, zoals de rest van deze repo (`verstuurHerinneringen`, `ontvangers`). Inline
  styles met de CSS-variabelen uit `globals.css` en de bouwstenen uit `src/components/ui.tsx`.
- Env: `CAMPAGNEMONITOR_URL`, `CAMPAGNEMONITOR_SLEUTEL`. Zet ze in `.env.example` (of waar de andere sleutels staan) en
  in `render.yaml` als `sync: false`.
- **Geen kandidaatnaam, telefoonnummer, e-mailadres of vraagtekst in de database** (dus ook niet in `Notification` of
  `ActivityEvent`). Alleen kandidaat-id's en aantallen.
- Afwijsredenen = de `REASONS` van de Campagnemonitor:
  `['Te weinig ervaring', 'Afstand', 'Taalbarrière', 'Geen interesse', 'Geen reactie', 'No show', 'Foutieve contactgegevens', 'Ander aanbod', 'Salaris te laag', 'Overgekwalificeerd', 'Overig']`.
  Kopieer ze als `AFWIJSREDENEN` in `src/lib/kandidaten.ts`; de monorepo maakt er later één lijst van.
- Checks per taak: `npm test`, `npm run typecheck`, `npm run lint`. Alle drie moeten groen zijn.

## Review Focus

1. **De Campagnemonitor ligt eruit of is traag.** Verwacht: binnen ~5 s de melding *Kandidaten zijn even niet te
   laden. Probeer het over een paar minuten opnieuw.* De rest van het portaal laadt gewoon; geen 500-pagina.
   *Test in taak 1 (time-out en 5xx geven een `CmFout`), gedrag in taak 3.*
2. **Een manager die aan Locatie A gekoppeld is, plakt de URL van een kandidaat van Locatie B.** Verwacht: *niet
   gevonden*, en een actie op die kandidaat weigert. *Test in taak 1 (`zichtbareLinks`), afgedwongen in de server
   action van taak 3.*
3. **Een medewerker kijkt mee via "Open als klant".** Verwacht: alles is te zien, maar acties weigeren met *Meekijken
   is alleen lezen*. Anders zou een actie op naam van de eigenaar komen te staan. *Taak 3.*
4. **De dagelijkse ronde draait twee keer op een dag.** Verwacht: geen tweede mail voor dezelfde kandidaat en soort.
   *Test in taak 1 (`herinneringenVoor` met `gemeld`), opslag in taak 4.*
5. **Een kandidaat verdwijnt tussen het laden en de klik** (terug naar Contactpoging, of gewist). Verwacht: de actie
   geeft *Deze kandidaat is niet meer beschikbaar* en de lijst laadt opnieuw. *Taak 3 (een 404 van de API).*

---

### Task 1: Pure logica en de API-client

**Files:**
- Create: `src/lib/kandidaten.ts`, `src/lib/kandidaten.test.ts`, `src/lib/integrations/campagnemonitor.ts`, `src/lib/integrations/campagnemonitor.test.ts`

**Interfaces:**
- Produces in `src/lib/kandidaten.ts`:
  - `type Kandidaat`: exactly the shape of `forClient` in the Campagnemonitor: `{ id, linkId, naam, telefoon, email, screening, fase, faseNaam, gesprek: number|null, reden: string|null, doorgezetOp: number, wachtSinds: number|null, klantGg: number, vragen: { id, at, door, tekst, antwoord: { at, door, tekst } | null }[], tijdlijn: { at, door, wat }[] }`. `screening` as `Record<string, unknown>`.
  - `SCREENING_VELDEN`: `[key, emoji, label][]`, in the order of the Campagnemonitor (`talen` 🗣️ Talenkennis … `advies` ➡️ Advies), plus `screeningWaarde(key, v) → string` (rijbewijs: `B` / `Nee` / `Anders, namelijk: …`; vervoer: `Ja` / `Nee → reist met: …`; leeftijd as a number; otherwise the text).
  - `AFWIJSREDENEN` (see Global Constraints).
  - `zichtbareLinks(campagnes: { id, cmLinkId }[], gekoppeld: string[]) → string[]`: the `cmLinkId`s of the campaigns with a non-empty `cmLinkId`. With `gekoppeld` non-empty, only campaigns whose `id` is in it.
  - `werkdagenSinds(van: number, nu: number) → number`: the same rule as `workdaysSince` in the Campagnemonitor (Mon–Fri after the calendar day of `van`, up to and including the day of `nu`).
  - `type Herinnering = { soort: 'kandidaat_wacht' | 'gesprek_terugkoppeling' | 'vraag_beantwoord', linkId: string, sleutels: string[] }`.
  - `herinneringenVoor(kandidaten: Kandidaat[], gemeld: Set<string>, nu: number) → Herinnering[]`: per `(soort, linkId)` one entry with the keys not yet in `gemeld` (keys in `gemeld` are formatted `` `${soort}:${sleutel}` ``):
    - `kandidaat_wacht`: `wachtSinds` set and `werkdagenSinds(wachtSinds, nu) >= 3`; key `id`;
    - `gesprek_terugkoppeling`: `fase === 'gesprek'` and `gesprek` before the start of the day of `nu`; key `` `${id}@${gesprek}` ``, so *Nog een gesprek* asks again;
    - `vraag_beantwoord`: per question with `antwoord`; key `vraag.id`.
    Entries without keys are left out.
- Produces in `src/lib/integrations/campagnemonitor.ts` (`import "server-only"`):
  - `class CmFout extends Error { status: number }`: `0` for timeout or network error, otherwise the HTTP status. `message` is the Dutch `fout` from the response body, or `'De Campagnemonitor is niet bereikbaar.'`.
  - `cmGeconfigureerd() → boolean`.
  - `cmFuncties(f = fetch) → Promise<{ linkId, klant, functie }[]>`.
  - `cmKandidaten(links: string[], f = fetch) → Promise<Kandidaat[]>`: in batches of 50 (`?links=` comma-separated, `encodeURIComponent` per id); `[]` without links, and then no request.
  - `cmActie(id: string, body: { linkId, kind, at?, reason?, text?, door: { naam, organisatie } }, f = fetch) → Promise<Kandidaat>`.
  - Each request: header `x-toppers-sleutel`, `signal: AbortSignal.timeout(5000)`, `cache: 'no-store'`. A non-2xx response throws `CmFout`.

- [ ] **Step 1: Write the failing tests** in `src/lib/kandidaten.test.ts`:

```ts
test("zichtbareLinks: zonder koppeling alles met een cmLinkId, met koppeling alleen die", () => {
  const c = [{ id: "a", cmLinkId: "t-1" }, { id: "b", cmLinkId: "t-2" }, { id: "c", cmLinkId: "" }];
  assert.deepEqual(zichtbareLinks(c, []), ["t-1", "t-2"]);
  assert.deepEqual(zichtbareLinks(c, ["b", "c"]), ["t-2"]);
});
test("werkdagenSinds slaat het weekend over", () => {
  const d = (s: string) => new Date(s + "T10:00:00").getTime();
  assert.equal(werkdagenSinds(d("2026-11-06"), d("2026-11-11")), 3);
  assert.equal(werkdagenSinds(d("2026-11-07"), d("2026-11-09")), 1);
});
test("herinneringenVoor: wachten, gesprek voorbij, antwoord; niets twee keer", () => {
  const nu = new Date("2026-11-11T09:00:00").getTime(), vr = new Date("2026-11-06T10:00:00").getTime();
  const k = (x: Partial<Kandidaat>) => ({ id: "k1", linkId: "t-1", fase: "gescreend", wachtSinds: null, gesprek: null, vragen: [], ...x }) as Kandidaat;
  const lijst = [k({ wachtSinds: vr }), k({ id: "k2", fase: "gesprek", gesprek: new Date("2026-11-10T14:00:00").getTime() }),
    k({ id: "k3", vragen: [{ id: "v1", at: 1, door: "x", tekst: "?", antwoord: { at: 2, door: "Danielle", tekst: "ja" } }] })];
  const h = herinneringenVoor(lijst, new Set(), nu);
  assert.deepEqual(h.map((x) => [x.soort, x.sleutels.length]).sort(), [["gesprek_terugkoppeling", 1], ["kandidaat_wacht", 1], ["vraag_beantwoord", 1]]);
  const gemeld = new Set(h.flatMap((x) => x.sleutels.map((s) => `${x.soort}:${s}`)));
  assert.deepEqual(herinneringenVoor(lijst, gemeld, nu), []);
});
```

  And in `campagnemonitor.test.ts`, with a fake `fetch` (a function that records the URL and headers):
  - `cmKandidaten([])` does no request;
  - 120 links give 3 requests of at most 50;
  - the header carries the key;
  - a 404 with `{ fout: 'Kandidaat niet gevonden' }` throws `CmFout` with `status 404` and that message;
  - a fetch that throws (`AbortError`) gives `status 0` and `'De Campagnemonitor is niet bereikbaar.'`.

  Set `process.env.CAMPAGNEMONITOR_URL/SLEUTEL` in the test. `server-only` throws outside Next: check how the other tests deal with it (`profielfoto.test.ts`). If none of them import a `server-only` module, put the request logic in `campagnemonitor-verzoek.ts` without `server-only`, and let `campagnemonitor.ts` import and export it again.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL (modules don't exist).
- [ ] **Step 3: Implement** both files following *Produces*.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/kandidaten.ts src/lib/kandidaten.test.ts src/lib/integrations/campagnemonitor*.ts && git commit -m "kandidaten: logica en client voor de Campagnemonitor"`.

---

### Task 2: Schema en beheer (koppelen)

**Files:**
- Modify: `prisma/schema.prisma`, `src/app/beheer/actions.ts`, `src/app/beheer/[id]/page.tsx`, `render.yaml`, `.env.example` (if it exists)
- Create: `prisma/migrations/<timestamp>_kandidaten/` (via the command), `src/components/beheer/CmKoppeling.tsx`

**Interfaces:**
- Consumes: `cmFuncties`, `cmGeconfigureerd` (Task 1).
- Produces:
  - Schema:
    - `Campaign.cmLinkId String @default("")`;
    - `model MemberCampaign { memberId String; member Member @relation(…, onDelete: Cascade); campaignId String; campaign Campaign @relation(…, onDelete: Cascade); @@id([memberId, campaignId]) }`, plus the back relations `Member.campagnes` and `Campaign.opvolgers`;
    - `model KandidaatMelding { id String @id @default(cuid()); organizationId String; soort String; sleutel String; createdAt DateTime @default(now()); @@unique([soort, sleutel]); @@index([organizationId]) }`. Only ids; see Global Constraints.
  - Server actions in `src/app/beheer/actions.ts`, both behind the right `functions.prepare` and `seesClient` (as the other actions there do):
    - `koppelCmFunctie(campaignId: string, cmLinkId: string)`: `''` unlinks. A `cmLinkId` that is already linked to another campaign gives the error `Deze functie hangt al aan <organisatie> · <campagne>.`;
    - `zetOpvolgers(campaignId: string, memberIds: string[])`: replaces the `MemberCampaign` rows of that campaign; only members of the same organization.
  - `CmKoppeling` (client component) per campaign on `beheer/[id]`:
    - a `<select>` *Functie in de Campagnemonitor* with options `` `${klant} · ${functie}` ``, from `cmFuncties()` fetched on the server page and passed as a prop;
    - below it the members of the organization as checkboxes *Volgt deze kandidaten op*, with the help text *Niemand aangevinkt: alle collega's van de klant zien de kandidaten.*;
    - without configuration: the text *Koppeling met de Campagnemonitor staat uit (CAMPAGNEMONITOR_URL en _SLEUTEL).*; on a `CmFout`: its message.

- [ ] **Step 1: Change the schema** and run `npx prisma migrate dev --name kandidaten`. Expected: a new migration folder, and `prisma generate` succeeds.
- [ ] **Step 2: Implement** the actions and `CmKoppeling`. Put the component in the existing campaign block of `beheer/[id]/page.tsx`, near `FunctieKlaarzetten`.
- [ ] **Step 3: Run** `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 4: Check by hand:** Campagnemonitor on `:3000` (fake Trello, key set, one function switched over), portal `npm run dev` on `:3100` with the env set. In the beheer, pick the function on a campaign: the choice is still there after a reload. Pick it on a second campaign: the error text.
- [ ] **Step 5: Commit** schema, migration, actions, page, component, `render.yaml` and `.env.example`; message `beheer: campagne aan Campagnemonitor-functie en opvolgers koppelen`.

---

### Task 3: Klantmenu Kandidaten

**Files:**
- Create: `src/app/(portaal)/kandidaten/page.tsx`, `src/app/(portaal)/kandidaten/[id]/page.tsx`, `src/app/(portaal)/kandidaten/actions.ts`, `src/components/portal/kandidaten/KandidaatActies.tsx`, `src/components/portal/kandidaten/Screening.tsx`
- Modify: `src/components/portal/TopBar.tsx` (nav item and `routeHref`), `src/lib/toppers-os.ts` (helper `kandidatenVoorSessie`)

**Interfaces:**
- Consumes: `cmKandidaten`, `cmActie`, `CmFout`, `zichtbareLinks`, `SCREENING_VELDEN`, `screeningWaarde`, `AFWIJSREDENEN` (Task 1); `Campaign.cmLinkId`, `MemberCampaign` (Task 2); `getSession()`.
- Produces:
  - `kandidatenVoorSessie(session) → Promise<{ campagnes: { id, titel, linkId }[], kandidaten: Kandidaat[] } | { fout: string }>` in `toppers-os.ts`:
    - the campaigns of `session.organizationId` with a `cmLinkId`, filtered with `zichtbareLinks` and the `MemberCampaign` rows of `session.memberId`;
    - with `viewAs`, the filter is skipped (the owner sees everything anyway);
    - a `CmFout` gives `{ fout: 'Kandidaten zijn even niet te laden. Probeer het over een paar minuten opnieuw.' }`.
  - TopBar: `{ label: "Kandidaten", href: "/kandidaten" }` after Vacatures, and `routeHref("kandidaten") → "/kandidaten"`.
  - `/kandidaten`:
    - a list per campaign (title from the function profile), with cards showing name, `faseNaam`, label *Wacht op jou* when `wachtSinds` is set, label *Gesprek <datum tijd>* in Gesprek, and the number of open questions;
    - order: waiting first, then by `doorgezetOp` newest first;
    - empty: *Nog geen kandidaten. Zodra we iemand gesproken hebben die past, staat die hier.*
  - `/kandidaten/[id]`: the candidate from `kandidatenVoorSessie` (not in it → `notFound()`):
    - phone (`tel:`) and email (`mailto:`);
    - `Screening` (fields in the order of `SCREENING_VELDEN`, empty ones left out);
    - `KandidaatActies`;
    - questions with answers;
    - the timeline.
  - `KandidaatActies` (client component): buttons *Geen gehoor*, *Op gesprek* (opens `datetime-local`), *Aangenomen*, *Afwijzen* (opens the reasons as pills), *Opmerking* and *Vraag aan Horeca Toppers* (both a textarea, max. 1000). When `fase === 'gesprek'` and `gesprek < Date.now()`: on top the block *Hoe ging het gesprek?* with Aangenomen, Afwijzen and Nog een gesprek. In Aangenomen and Afgewezen only Opmerking and Vraag. Uses `useActionState` with `kandidaatActie`.
  - `kandidaatActie(_, formData) → { ok: boolean, fout?: string }` in `actions.ts` (`"use server"`):
    - `getSession()` → none: `fout: 'Je bent uitgelogd.'`; `viewAs`: `fout: 'Meekijken is alleen lezen.'`;
    - the `linkId` from the form must be in the session's visible links, otherwise `fout: 'Deze kandidaat is niet meer beschikbaar.'`;
    - `door: { naam: member.name, organisatie: org.name }`;
    - `CmFout` 404: `'Deze kandidaat is niet meer beschikbaar.'`; another `CmFout`: its message;
    - always `revalidatePath('/kandidaten')` and `revalidatePath('/kandidaten/' + id)`.

- [ ] **Step 1: Implement** the pages, components, action and helper following *Produces*. Read the Next 16 docs in `node_modules/next/dist/docs/` on server actions and `useActionState` first.
- [ ] **Step 2: Run** `npm test && npm run typecheck && npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 3: Check by hand**, with both apps running (as in Task 2), and a candidate the recruiter moved to Gescreend in the Campagnemonitor:
  - (a) the list shows the candidate, and a candidate in Nieuw is missing;
  - (b) *Op gesprek* with a date: the card on the Campagnemonitor's Bord moves to Gesprek;
  - (c) *Vraag*: the RM gets the notification in the Campagnemonitor, answers, and the answer is in the portal after a reload;
  - (d) stop the Campagnemonitor: the error text, and the rest of the portal works;
  - (e) a member linked to another campaign sees nothing, and the URL of the candidate gives *niet gevonden*;
  - (f) "Open als klant" from the beheer: the actions give *Meekijken is alleen lezen*.
  Take screenshots at 1440 and 390 px.
- [ ] **Step 4: Commit** the new files plus `TopBar.tsx` and `toppers-os.ts`; message `portaal: klantmenu Kandidaten`.

---

### Task 4: Herinneringen

**Files:**
- Modify: `src/lib/toppers-os.ts` (`verstuurHerinneringen`, `mailBijEvent`), `src/lib/mail/berichten.ts`

**Interfaces:**
- Consumes: `herinneringenVoor`, `Herinnering` (Task 1); `KandidaatMelding`, `MemberCampaign` (Task 2); `cmKandidaten`; `emitEvent`.
- Produces:
  - `kandidaatRonde(nu) → Promise<{ verstuurd: { organisatie, functie, event, aantal }[], overgeslagen: { organisatie, reden }[] }>`, called at the end of `verstuurHerinneringen` and merged into its result. Per organization with `demo: false` and `portalStatus: 'actief'` that has campaigns with a `cmLinkId`:
    1. `cmKandidaten(links)` (a `CmFout` → `overgeslagen` with reason `Campagnemonitor niet bereikbaar` and stop the whole round);
    2. `gemeld` = the `KandidaatMelding` rows of that organization;
    3. per `Herinnering`: `emitEvent({ organizationId, campaignId, event: soort, titel, route: 'kandidaten' })`, then a `KandidaatMelding` per key (`createMany`).
    Titles:
    - `kandidaat_wacht`: `` `${n} ${n === 1 ? 'kandidaat wacht' : 'kandidaten wachten'} op je reactie · ${functie}` ``;
    - `gesprek_terugkoppeling`: `` `Hoe ${n === 1 ? 'ging het gesprek' : 'gingen de gesprekken'}? ${n} ${n === 1 ? 'kandidaat' : 'kandidaten'} · ${functie}` ``;
    - `vraag_beantwoord`: `` `Je hebt ${n === 1 ? 'een antwoord' : n + ' antwoorden'} op je vraag · ${functie}` ``.
    Finally, delete `KandidaatMelding` rows older than 60 days.
  - `BERICHTEN` in `berichten.ts` gets the three events, with the same title as subject and a button *Bekijk kandidaten* → `${portaal}/kandidaten`. Body text: one sentence, in the style of the existing messages. No names.
  - `mailBijEvent`: for these three events, a member only gets mail when `notifyReminders` is on, and, when `campaignId` is set and the member has `MemberCampaign` rows, only if one of them is that campaign.

- [ ] **Step 1: Implement** following *Produces*.
- [ ] **Step 2: Run** `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 3: Check by hand:** set the `doorgezetOp` of a candidate in the Campagnemonitor 5 working days back (edit `DATA_DIR/candidates.json` and restart), then `curl -X POST -H "x-taak-sleutel: $TAKEN_SLEUTEL" localhost:3100/api/taken/herinneringen`. Expected:
  - `verstuurd` contains `kandidaat_wacht` with `aantal: 1`;
  - with the mail provider `log`, the mail is in stdout without the candidate's name;
  - a second call sends nothing for it;
  - `KandidaatMelding` holds only ids (`npx prisma studio`).
- [ ] **Step 4: Commit** `toppers-os.ts` and `berichten.ts`; message `herinneringen: kandidaten die wachten, gesprekken en antwoorden`.

---

### Task 5: Docs

**Files:**
- Modify: `README.md` (section *Kandidaten*: what the client sees, the env variables, the link in the beheer), `docs/sollicitanten.md` (add: the ATS lives in the Campagnemonitor; the `Lead` table stays a safety net for now, and the double intake is still open)

- [ ] **Step 1: Write it** in the style of the repo.
- [ ] **Step 2: Commit** the two files; message `docs: kandidaten in het portaal`.
