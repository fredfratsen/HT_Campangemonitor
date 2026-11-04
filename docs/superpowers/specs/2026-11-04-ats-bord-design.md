# ATS en Bord per functie

Datum: 2026-11-04 · Status: goedgekeurd in gesprek, gebouwd dezelfde dag

## Doel

Recruiters werken niet meer in Trello, maar op een bord in de Campagnemonitor (ontwerp A: bord per functie met
zijpaneel). Kandidaten staan in een eigen kandidatenopslag (route 2: eigen ATS). Leads uit Meta komen binnenkort
via een Zapier-zap op een eigen API binnen. Kandidaatgegevens blijven 4 weken bewaard.

## Besluiten van de gebruiker

- **Overstap per functie.** Per campagne (Trello-link in Toewijzing) zet de teamlead een schakelaar om. Vanaf dan
  komen nieuwe kandidaten via de API in de app en tellen de cijfers van die campagne uit het ATS. Kaarten die al
  in Trello staan, lopen daar af; hun cijfers tellen gewoon mee (opgeteld, de zap maakt voor die functie geen
  Trello-kaarten meer, dus niets dubbel).
- **Eigen intake-link per functie**, met een geheime sleutel erin. Eén keer volledig te zien, daarna de laatste 4
  tekens; *Nieuwe link* vervangt hem.
- **4 weken na afronding**: vanaf Afgewezen of Aangenomen, of na 4 weken zonder actie in een open fase. Daarna
  blijft een anoniem restje (campagne, week van binnenkomst, hoe ver gekomen, afwijsreden, belweken).
- **Geen gehoor verplaatst nooit een kaart**, ook niet na 3 keer en niet vanuit Nieuw (net als de Trello-knop nu).
  De recruiter verplaatst zelf; na 3 pogingen toont het paneel een knop *Naar Niet bereikbaar*.
- Opslag als eigen JSON-document naast de blacklist (optie 1), niet SQLite.

## Opslag (`server/candidates.js`, `DATA_DIR/candidates.json`)

Apart van de teamdata, nooit in `/api/state`. Dagelijkse back-ups van 14 dagen, net als de blacklist.

- `links[linkId]`: `{ hash, last4, at, by }`: de intake-sleutel (sha256) per omgezette functie.
- `cands[id]`: `{ id, link, name, phone, email, src, answers: [[vraag, antwoord]], at, stage, reached, att, gg,
  tba: { at, text }, gesprek, reason, endedAt, lastAt, calls: [week], log: [{ at, by, what }], undo }`.
  Fasen: `nieuw`, `contact`, `nb` (Niet bereikbaar), `gescreend`, `gesprek`, `voorstel`, `aangenomen`, `afgewezen`.
  `reached`: de verste fase-rang (gescreend 1 … aangenomen 4), voor de pijplijncijfers.
- `anon`: `[{ link, w, reached, reason, calls }]`: wat overblijft na de bewaartermijn.

## Intake: `POST /api/intake/<sleutel>`

Zonder login, vóór `auth.guard`; maximaal 60 verzoeken per minuut per sleutel.

- Velden: `naam`/`name`/`full_name` (of `first_name` + `last_name`), `telefoon`/`phone`/`phone_number`, `email`,
  `bron`/`source` (standaard *Meta*). Alle andere velden worden antwoorden (max. 30, elk max. 500 tekens).
- `201 { id }` nieuw; `200 { id, dubbel: true }` als hetzelfde nummer of adres in de laatste 30 dagen al op die
  functie binnenkwam (alleen een regel in de tijdlijn); `400` zonder naam of contactgegeven; `404` onbekende
  of vervangen sleutel.
- Een lead komt ook binnen als de campagne op Pauze staat; wat de recruiter ziet volgt de bestaande pauzeregels.

## Cijfers voor de monitor

`atsStats` (`src/lib/ats.js`) rekent per omgezette functie dezelfde vorm uit als `boardStats`: instroom per week,
gescreend … geplaatst, afwijsredenen, gebeld per week en de belllijst van vandaag (Nieuw en Contactpoging; met
Geen gehoor of TBA vandaag telt een kandidaat tot middernacht als gebeld). Gebeld in een week: Geen gehoor, TBA,
of verplaatst uit Nieuw/Contactpoging naar verder. `GET /api/kandidaten/stats` geeft die cijfers (anoniem) aan
iedereen; `liveCampaigns` telt ze op bij de Trello-cijfers.

## Rechten

- Recruiter (*Eigen recruiterfeedback invullen*): het bord van omgezette functies waar die de recruiter van is.
- Nieuw recht **Alle kandidaten bekijken** (`candidates.all`): Teamlead en Dev.
- Omzetten en nieuwe link: *Toewijzing beheren*.
- Recruitment Marketeers en Account Managers zien geen kandidaatgegevens.

## Scherm

- Menu Kandidaten › **Bord**, zodra je een omgezette functie hebt. Live campagnes krijgt *Bord →* bij een omgezette
  functie. Adresbalk `#bord=<functie>`.
- Kop: klant, RM, Ermee bezig/Done-pill (dezelfde `live.status`), keuze van klant, tabs per omgezette functie.
- Kolommen Nieuw · Contactpoging · Niet bereikbaar · Gescreend · Gesprek · Voorstel · Aangenomen; Afgewezen als
  tegel die een extra kolom opent.
- Kaart: naam, drie blokjes Geen gehoor, wachttijd, TBA-label, gespreksmoment.
- Zijpaneel: naam, fase, telefoon (bellen + kopiëren), e-mail, automatische blacklistcontrole op telefoon/e-mail,
  acties, antwoorden uit het formulier, notitie, historie.
- Acties (op de server): Geen gehoor, TBA afspraak (korte tekst), Bereikt · gescreend, Niet geschikt (reden uit
  `REASONS`), Verplaatsen naar (Gesprek vraagt datum en tijd), Notitie, Ongedaan maken (de laatste verplaatsing,
  tot je volgende actie).
- Slepen (toegevoegd op verzoek, zelfde dag): een kaart naar een andere kolom slepen verplaatst hem; tijdens het
  slepen staat onderin een dropzone *Sleep hierheen om af te wijzen*. Naar Gesprek of Afgewezen vraagt eerst het
  moment of de reden in het paneel. Afwijzen kan nu vanuit elke fase (knop *Afwijzen* buiten de belfases).
- Samenwerken: na elke wijziging hoogt de server `meta.ats` op; open apps horen dat via de bestaande push en laden
  opnieuw.

## Bewust niet

Mijn bord (B), talentpool, kandidatenbestand (C/D), wissen op verzoek van de kandidaat, Netlify.

## Fouten

- Intake: duidelijke JSON-fout (Nederlands) per geval; onbekende sleutel 404 zonder te verraden of hij ooit bestond.
- Acties op een kandidaat die intussen gewist of verplaatst is: 400 met melding, de app laadt het bord opnieuw.
- Zonder server (lokale demo) is er geen bord.

## Testen

- `test/ats.test.js`: `atsStats` (weken, rang, redenen, belllijst vandaag, anoniem restje).
- `test/candidates.test.js`: intake (velden, dubbel, sleutel vervangen), acties (geen gehoor verplaatst niet, TBA,
  verplaatsen, afwijzen, ongedaan maken), bewaartermijn.
- `test/server.test.js`: intake-link aanmaken met Toewijzing beheren, lead binnen via HTTP zonder login, recruiter
  ziet alleen eigen functie, marketeer niets.
