# ATS naar het klantportaal

Datum: 2026-11-04 · Status: ontwerp goedgekeurd in gesprek, nog niet gebouwd · Bouwt voort op
[2026-11-04-ats-bord-design.md](2026-11-04-ats-bord-design.md)

## Doel

Robbin wil dat klanten meedoen in het ATS: kandidaten opvolgen, belpogingen en opmerkingen vastleggen, vragen stellen.
Klanten krijgen **geen account op de Campagnemonitor**. Ze werken in een eigen menu in het klantportaal
(`WenC_Klantportaal`, Next.js + Prisma), en dat portaal praat met de Campagnemonitor. Zo bepalen wij wat een klant
te zien krijgt. Later worden beide apps één monorepo. De API is daarom zo opgezet dat hij dan een gedeeld pakket
kan worden.

Een klant ziet **alleen kandidaten die wij hebben doorgezet**: kandidaten waarmee de recruiter heeft gesproken en
waarvan hij het screeningsformulier heeft ingevuld. Cijfers voor de klant komen later.

## Besluiten van de gebruiker

- **De Campagnemonitor blijft het ATS.** Het portaal bewaart geen kandidaatgegevens. Bij elk bezoek vraagt het die op
  via een server-naar-server-API, en wat de klant doet stuurt het terug. Er is één plek met persoonsgegevens, één
  bewaartermijn (4 weken) en één filter.
- **De koppeling ligt vast in het portaal.** In het portaalbeheer kiest de RM bij een `Campaign` de omgezette functie
  uit de Campagnemonitor (`cmLinkId`). Het portaal beslist welke functies een member mag zien.
- **Naar Gescreend zetten is doorzetten.** Gescreend betekent dat wij de kandidaat gesproken hebben. Vanaf dat moment
  ziet de klant de kaart, zonder aparte knop of kolom. Gesprek betekent een gesprek **bij de klant**.
- **Voor Gescreend moet het screeningsformulier ingevuld zijn** (het bestaande format van de recruiters), en moeten
  naam en contactgegevens gecontroleerd zijn. Er komt geen losse voorsteltekst.
- **Klantacties:** Geen gehoor, Op gesprek (datum en tijd), Aangenomen, Afwijzen (reden), Opmerking, Vraag.
- **Vragen gaan altijd via de RM.** De RM leest ze en beantwoordt ze **in de Campagnemonitor**.
- Herinnering aan de klant na **3 werkdagen** zonder klantactie.

## Aannames (niet bevestigd)

- *Voorstel* betekent dat de klant een aanbod heeft gedaan. De klant zet die kolom niet zelf; recruiters wel.
- Als afzender van een antwoord ziet de klant **de naam van de RM** (de gebruiker liet dit open).
- Werkdagen zijn maandag tot en met vrijdag. Feestdagen tellen mee als werkdag.
- De klant kiest een afwijsreden uit dezelfde `REASONS` als de recruiter, zodat de cijfers één lijst houden.
- Leeftijd is geen verplicht veld (gevoelig onder de gelijkebehandelingswet).

## Deel A: screening en de poort naar Gescreend (Campagnemonitor)

### Screeningsformulier

`SCREENING` in `src/lib/ats.js`: de velden in deze volgorde, elk met een emoji, label, soort en of het verplicht is.

| Sleutel | Label | Soort | Verplicht |
|---|---|---|---|
| `talen` | 🗣️ Talenkennis | tekst | ja |
| `ervaring` | 💼 Werkervaring / opleiding / vakkennis | meerdere regels | ja |
| `situatie` | 🏢 Huidige werkgever / situatie | tekst | ja |
| `beschikbaar` | 📅 Beschikbaarheid | tekst | ja |
| `leeftijd` | 🎂 Leeftijd | getal 14–99 | nee |
| `diplomas` | 🎓 Diploma's / certificaten | tekst; placeholder *Bijv. koksopleiding, SVH Leermeester, Sociale Hygiëne, HACCP, BHV, Allergenenkennis, etc.* | nee |
| `woonplaats` | 📍 Woonplaats | tekst | ja |
| `rijbewijs` | 🚘 Rijbewijs | keuze `B` / `Nee` / `Anders` + tekst bij Anders | ja (bij Anders ook de tekst) |
| `vervoer` | 🚗 Eigen vervoer | keuze `Ja` / `Nee` + *reist met* bij Nee | ja (bij Nee ook *reist met*) |
| `extra` | 📝 Extra info / motivatie | meerdere regels | nee |
| `advies` | ➡️ Advies | meerdere regels | ja |

- `screeningMissing(s)` geeft de labels terug van de verplichte velden die nog leeg zijn. De server en de app
  gebruiken allebei die functie.
- `screeningText(s, name)` geeft de tekst in de emoji-opmaak, voor *Kopieer als tekst*. Lege velden blijven staan
  met een lege regel, net als in het format.
- Het formulier staat in het zijpaneel als blok *Screening*, in elke fase. Het slaat automatisch op als concept
  (actie `screening`, geen undo, wel één regel in de tijdlijn per sessie: *Screening bijgewerkt*).

### De poort

- *Bereikt · gescreend* en het slepen van een kaart naar Gescreend openen in het paneel de stap **Doorzetten naar
  klant**: naam, telefoon en e-mail om te bevestigen of te verbeteren (dezelfde controles als de intake), plus het
  formulier. De knop blijft grijs zolang `screeningMissing` iets teruggeeft of de naam leeg is.
- Server: `move` naar `gescreend` (en verder, vanuit een fase vóór Gescreend) weigert met
  *"Vul eerst de screening in: …"* zolang er iets ontbreekt. Bij de eerste keer dat de kaart door de poort gaat,
  zet de server `doorgezetOp`, en de tijdlijn krijgt *"Doorgezet naar klant"*.
- Correcties van naam, telefoon of e-mail gaan via de actie `contact` (`{ name, phone, email }`), met een regel in
  de tijdlijn (*Gegevens gecontroleerd*, of *Naam gewijzigd: oud → nieuw*).
- **Uit Trello overgehaalde kaarten** in Gescreend of verder hebben geen `doorgezetOp`. Het paneel toont dan
  *Screening invullen*. Zodra het formulier compleet is, zet *Doorzetten naar klant* de waarde `doorgezetOp` zonder
  de kaart te verplaatsen.
- Zet een recruiter een kaart terug naar een fase vóór Gescreend, dan blijft `doorgezetOp` staan, maar ziet de klant
  hem niet meer (zie *Wat de klant ziet*). Bij een nieuwe stap naar Gescreend verschijnt hij weer.

## Deel B: de portaal-API (Campagnemonitor)

### Sleutel

- Nieuwe integratie `portaal` in `server/secrets.js`: alleen `sleutel` (env `PORTAAL_SLEUTEL`, minimaal 32 tekens).
  De URL van het portaal komt pas als de Campagnemonitor zelf het portaal aanroept (functieprofiel, later). Het portaal
  krijgt `CAMPAGNEMONITOR_URL` en `CAMPAGNEMONITOR_SLEUTEL`.
- Header `x-toppers-sleutel`, vergeleken met `timingSafeEqual`, net als bij de leads-route van het portaal.
- De routes staan in `server/app.js` vóór `auth.guard`, net als de intake, met een limiet van 120 verzoeken per minuut.
  Zonder geldige sleutel volgt `401 { fout: 'Geen toegang' }`, en een regel in de auditlog (hooguit één per minuut).
- Zonder ingestelde integratie volgt `503 { fout: 'Koppeling met het klantportaal staat uit' }`.

### Routes (`server/portaal.js`)

| Route | Antwoord |
|---|---|
| `GET /api/portaal/functies` | `{ functies: [{ linkId, klant, functie }] }`: de omgezette functies, met de klantnaam en de functienaam zoals in Toewijzing |
| `GET /api/portaal/kandidaten?links=a,b` | `{ kandidaten: [forClient(c)] }`: zichtbaar voor de klant (hieronder), nieuwste `doorgezetOp` eerst. Maximaal 50 links per verzoek |
| `POST /api/portaal/kandidaten/:id/actie` | body `{ linkId, kind, at?, reason?, text?, door: { naam, organisatie } }` → `{ kandidaat: forClient(c) }` |

`door.naam` en `door.organisatie` zijn verplicht (max. 80 tekens). Ze komen in de tijdlijn als
*"Sojubar · Anna"*. De Campagnemonitor neemt ze over zoals het portaal ze stuurt.

### Wat de klant ziet: `forClient(c)` (`server/portaal.js`)

Zichtbaar: `c.doorgezetOp` is gezet en `c.stage` is een van `gescreend`, `gesprek`, `voorstel`, `aangenomen` of
`afgewezen`.

Velden, en **alleen** deze, via een expliciete lijst:

```
{ id, linkId, naam, telefoon, email, screening, fase, faseNaam, gesprek, reden (alleen bij afgewezen),
  doorgezetOp, wachtSinds, klantGg, vragen: [{ id, at, door, tekst, antwoord: { at, door, tekst } | null }],
  tijdlijn: [{ at, door, wat }] }
```

- `tijdlijn` bevat alleen de regels met `klant: true`, plus *Doorgezet naar klant*, *Naar Gesprek*, *Naar Voorstel*,
  *Aangenomen* en *Afgewezen*. Die laatste regels krijgen als `door` de tekst *"Horeca Toppers"* als een recruiter
  ze zette, en de naam van de klant als de klant het deed.
- `wachtSinds`: `doorgezetOp` zolang de kaart in Gescreend staat en er sindsdien geen klantactie is. Anders `null`.
- Nooit mee: interne notities, Geen gehoor en TBA van de recruiter, `att`, `gg`, `tba`, `calls`, `src`, `answers`
  (de formulierantwoorden uit Meta), de blacklistcontrole, `undo`, en namen van teamleden (behalve de RM als afzender
  van een antwoord).

### Klantacties (`act` in `server/candidates.js`, actor `{ name: 'Sojubar · Anna', klant: true }`)

Alleen op een kaart die de klant ziet, en alleen als `c.link === linkId`. Anders volgt
`404 { fout: 'Kandidaat niet gevonden' }`.

| `kind` | Effect |
|---|---|
| `geenGehoor` | `klantGg + 1`, tijdlijn *Gebeld, geen gehoor*. De kaart blijft staan |
| `gesprek` | `at` verplicht → `moveTo('gesprek')`, `c.gesprek = at`. Mag ook vanuit Gesprek: dan is het een nieuw moment (*Nog een gesprek*) |
| `aangenomen` | → Aangenomen |
| `afwijzen` | `reason` uit `REASONS` → Afgewezen |
| `opmerking` | `text` verplicht (max. 1000) → tijdlijn |
| `vraag` | `text` verplicht (max. 1000) → `c.vragen`, en een melding voor de RM (Deel C) |

- Elke klantactie zet `c.klantAt = now`. Een regel in de tijdlijn krijgt `klant: true`.
- De klant heeft geen *ongedaan maken*. Een recruiter kan een kaart altijd zelf terugzetten. Een klantactie die de
  kaart verplaatst (Op gesprek, Aangenomen, Afwijzen), wist de `undo` van de recruiter. Anders zou *Ongedaan maken*
  de keuze van de klant stilletjes terugdraaien. Geen gehoor, Opmerking en Vraag laten de undo staan.
- Na elke klantactie hoogt de server `meta.ats` op, zodat open borden opnieuw laden (zoals nu).
- Fouten: `400 { fout }` met een Nederlandse melding (fase klopt niet meer, reden ontbreekt, enz.). Het portaal laadt
  dan de kandidaat opnieuw.

## Deel C: vragen van de klant (Campagnemonitor)

- Een vraag staat **op de kandidaat**: `c.vragen = [{ id, at, door, tekst, antwoord: null | { at, door, tekst } }]`.
  Hij verdwijnt met de rest bij de bewaartermijn.
- Melding in `inbox` (gedeelde teamdata), **zonder kandidaatgegevens**:
  `{ kind: 'klantvraag', to: <RM uit Toewijzing>, title: 'Vraag van <klant> over een kandidaat · <functie>',
  link: '#bord=<linkId>&k=<id>' }`. De recruiter van die functie krijgt dezelfde melding ter informatie. Zonder RM
  gaat de melding naar de Teamlead (iedereen met `assign`). Het portaal kan geen state-patch doen; de server maakt
  de melding zelf aan (nieuw toegestaan `kind` in `authorize.js`, alleen vanaf de server).
- Nieuw recht **`candidates.answer`** (*Vragen van klanten over kandidaten beantwoorden*), standaard voor Recruitment
  Marketeer, Teamlead en Dev. Met dit recht:
  - zie je het Bord van de omgezette functies van je eigen klanten (`campaigns.own`) of van alle klanten
    (`campaigns.all`);
  - zonder `candidates.all` of eigen recruiterschap zie je alleen de kaarten die de klant ook ziet, **alleen lezen**:
    geen bel-, verplaats- of sleepacties en geen screening bewerken, wel de interne tijdlijn en het formulier;
  - beantwoord je een open vraag (actie `antwoord` `{ vraagId, text }`). Het antwoord krijgt als `door` de naam van
    de RM;
  - schrijf je een interne notitie (zoals nu), bijvoorbeeld een vraag aan de recruiter.
- Labels op de kaart: **Vraag van klant** zolang er een vraag zonder antwoord is.
- De bestaande regel *"Recruitment Marketeers zien geen kandidaatgegevens"* (ATS-bord-spec, Rechten) vervalt
  hiermee voor doorgezette kaarten van de eigen klanten.

## Bord: wat er verandert (Campagnemonitor)

- Labels op de kaart: **Bij klant** (doorgezet, in Gescreend), **Klant reageert niet** (`wachtSinds` ouder dan 3
  werkdagen; `workdaysSince` in `src/lib/ats.js`), **Vraag van klant**, **Gesprek bij klant · <moment>** (in Gesprek,
  gezet door de klant).
- In de tijdlijn staan klantregels met de naam van de klant en een eigen kleur.
- Het zijpaneel krijgt het blok *Screening* met *Kopieer als tekst*, en de stap *Doorzetten naar klant*.
- `#bord=<linkId>&k=<id>` opent het bord met die kandidaat in het paneel (voor de meldingen).

## Portaal (`WenC_Klantportaal`)

- **Schema:** `Campaign.cmLinkId String @default("")`; een nieuwe tabel `MemberCampaign { memberId, campaignId }`.
  Een member zonder koppelingen ziet alle campagnes van de organisatie, een member met koppelingen alleen die.
- **Beheer:** bij een campagne een keuzelijst *Functie in de Campagnemonitor*, gevuld via `GET /api/portaal/functies`.
  Bij een member de campagnes die die opvolgt (bijvoorbeeld een manager per locatie, zoals bij Sojubar).
- **Klantmenu Kandidaten** (`src/app/(portaal)/kandidaten`): een lijst per vacature, met een kaart per kandidaat:
  contactgegevens, het screeningsformulier, de fase, de acties, opmerkingen, vragen met antwoorden en de tijdlijn.
  Alleen server components en server actions; de sleutel gaat nooit naar de browser.
- **Herinneringen** (`/api/taken/herinneringen`, dagelijks), via `emitEvent` per campagne, dus één melding en mail
  per campagne per soort per ronde, met een aantal en **zonder kandidaatnamen**:
  - kandidaten met `wachtSinds` ouder dan 3 werkdagen: *"2 kandidaten wachten op je reactie · Kok"*;
  - een gesprek dat voorbij is zonder latere klantactie: *"Hoe gingen de gesprekken? 1 kandidaat · Kok"*;
  - een nieuw antwoord op een vraag: *"Je hebt een antwoord op je vraag · Kok"*.
  Het portaal onthoudt alleen welke kandidaat-id al voor welke soort gemeld is (tabel `KandidaatMelding`), zodat
  niemand twee keer voor hetzelfde een mail krijgt. Mail naar members gaat alleen naar wie de campagne opvolgt
  (`MemberCampaign`, of iedereen zonder koppelingen).
- **Fouten:** is de Campagnemonitor niet bereikbaar (time-out van 5 s of 5xx), dan toont het portaal
  *"Kandidaten zijn even niet te laden. Probeer het over een paar minuten opnieuw."* Er is geen cache.
- **`Lead`-tabel:** valt buiten deze spec. Zolang Zapier naar beide apps levert, staan de leads dubbel. Vastgelegd
  als vervolgpunt.

## Bewust niet (latere specs)

Agenda (punt 2), wekelijkse feedback van de klant (punt 6), functieprofiel op het Bord (punt 5), cijfers voor de
klant, de `Lead`-tabel van het portaal terugbrengen tot alleen herkomst, en push van de Campagnemonitor naar het
portaal (het portaal haalt op bij elk bezoek).

## Testen

**Campagnemonitor**
- `test/ats.test.js`: `screeningMissing` (verplichte velden, Anders zonder tekst, Nee zonder *reist met*),
  `screeningText` (volgorde en emoji), `workdaysSince` (over een weekend).
- `test/candidates.test.js`:
  - de poort: naar Gescreend weigert zonder screening; `doorgezetOp` wordt één keer gezet; *Doorzetten naar klant*
    werkt voor een Trello-kaart;
  - klantacties: elk effect, `klantAt`, Geen gehoor verplaatst niet, een verplaatsing door de klant wist de undo van de recruiter;
  - `antwoord` door de RM.
- `test/portaal.test.js`:
  - `forClient` geeft **precies** de toegestane sleutels terug, en een lijst met verboden sleutels
    (`answers`, `att`, `gg`, `tba`, `calls`, `src`, `undo`, interne logregels) komt nergens voor;
  - een kaart vóór Gescreend of zonder `doorgezetOp` is onzichtbaar;
  - een verkeerde `linkId` geeft 404; geen of een foute sleutel geeft 401; zonder integratie volgt 503.
- `test/server.test.js`:
  - een RM met `candidates.answer` ziet alleen de doorgezette kaarten van de eigen klanten en kan niet verplaatsen;
  - de melding in de inbox bevat geen naam, telefoonnummer of e-mail van de kandidaat.

**Portaal**
- De filtering per member (gekoppeld tegenover niet gekoppeld).
- De herinneringen: 3 werkdagen over een weekend, en niet twee keer dezelfde melding.
