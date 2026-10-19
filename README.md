# Campagnemonitor · Horeca Toppers

An internal web app for the Horeca Toppers recruitment team. It puts weekly campaign feedback, campaign health,
history and the Trello candidate pipeline in one place for the teamlead, the Recruitment Marketeers and the
recruiters.

The interface is in Dutch. The app started as a Claude Design export (`Campagnemonitor.html`, kept in the repo
as the design reference) and was built out into a React app with a small Express server.

## Features

Everyone logs in with a personal account. What you see and can do depends on your role and rights (see
[Accounts and rights](#accounts-and-rights)); the menu only shows what you have access to.

**Recruiter work** (right: *Eigen recruiterfeedback invullen*, plus a recruiter name on the account)

- **Live campagnes**: today's call work per client, with new candidates and contact attempts pulled from Trello.
  One row per client (Trello board) with its Recruitment Marketeer and how much feedback is still open; a client
  with several functions folds open to one row per function. Open feedback links straight to the check-in.
- **Wekelijkse feedback recruiter**: the weekly check-in per campaign, headed with the week it is about (for
  example *Feedback week 39*). It covers new candidates, a quality score (1–10), written feedback, an optional
  action, and a **Bijsturing nodig** (needs adjusting) flag. That flag puts the campaign on *Actie nodig* even when
  its scores are fine, for example when a new question needs to be added. The latest update from the Recruitment
  Marketeer on that campaign is shown above the form.
- **Mijn campagnes**: your own campaigns with this week's candidates, quality, feedback and signals (no status,
  recruiter or average-quality columns). Sorted by most new candidates; you can also sort by fewest or by client.

**Campaign overview** (right: *Alle campagnes bekijken*; Account Managers, Teamlead, Dev. Recruitment Marketeers
have *Eigen klanten bekijken* instead, see the last point)

- **Weekoverzicht**: the **Monitorstatus** of this week's campaigns (see [Monitor status](#monitor-status-and-health-rules)),
  grouped per status. Each campaign opens on click, or in a new browser tab with the icon (or Cmd/Ctrl-click).
  The **Feedback recruiter** card lists the first 3 campaigns without feedback (*Alle campagnes* shows the rest)
  and has a button to send reminders. A recruiter gets at most one reminder per 48 hours; the server checks this.
- **Campagnes**: all active campaigns with status, client and vacancy, recruiter, candidates, quality and average
  quality. Filter by status; sort by priority, lowest quality, fewest candidates or client.
- **Campaign detail**: candidates and quality per week, the Trello pipeline, rejection reasons, and a log of
  campaign changes (ad, audience, budget, vacancy text, ...). With the right *Monitorstatus en updates bijhouden*
  you set the campaign to *Check* or *In afwachting van klant*, and write an **update for the recruiter**. The
  recruiter sees it on the campaign and in their weekly feedback, and gets a notification under Meldingen. The
  address bar follows the open campaign (`#campagne=<id>`), so a link or a reload opens it again.
- **Vraag stellen** on a campaign (right: *Vragen stellen over campagnes*): send a question to the campaign's
  Recruitment Marketeer and/or recruiter. They answer it under Meldingen, and the answer comes back there too.
- **Feedback klant**: record the client's feedback, separately from the recruiter's.
- **Historie & analyse**: totals, averages and changes over past weeks.
- **Health-regels**: the rules that put a campaign on *Actie nodig*.
- **Own clients** (right: *Eigen klanten bekijken*): the same screens, but Weekoverzicht, Campagnes and Feedback klant
  (and so the reminders) only show the clients you are the Recruitment Marketeer of in Toewijzing. A client without
  a Recruitment Marketeer shows up for no marketeer. Add *Alle campagnes bekijken* to show all clients again, for
  example while covering for a colleague. Like a recruiter's own campaigns, this is a filter in the app, not a
  server check.

**Candidates** (right: *Blacklist raadplegen*; recruiters, Teamlead, Dev)

- **Blacklist**: candidates Horeca Toppers doesn't put forward (again), with the reason. Look someone up by name,
  email address or phone number (in any format) before planning an interview or trial day. Each entry has a name
  plus an email address or phone number (so nobody is mixed up with a namesake), a reason from a fixed list
  (`BL_REASONS` in `src/lib/constants.js`), an optional note, the client and function they applied for, and
  whether it applies to all clients or only that one. It ends by itself after 6, 12 or 24 months.
- Recruiters **propose** a candidate (*Kandidaat voordragen*). Whoever has *Blacklist beheren* (Teamlead, Dev) gets
  a notification and confirms or rejects it; a proposal nobody decides on lapses after 30 days. With that right you
  also see the whole list, add candidates directly, correct, extend and remove entries, and download an entry for a
  candidate's request for access. Without it you only see confirmed entries and your own proposals.

**Management** (Teamlead and Dev by default)

- **Toewijzing**: every Trello board is a client and every function on it (an intake list *Nieuwe Sollicitant | Kok*
  or a label, see [Trello conventions](#trello-conventions)) has its own campaign (and its own recruiter and client
  feedback). Assign a recruiter and a Recruitment Marketeer per client; they cover all its functions. New boards and
  functions show up here by themselves, a new intake list even while it is still empty. Tick several clients to
  assign them at once, mark a client inactive, set a board that isn't a client to *Geen klant* or a label or list that
  isn't a function to *Geen functie*.
- **Trello-koppeling testen**: check the Trello setup against the conventions below.
- Editing the health rules.
- Setting the status of bugs and ideas (*Nieuw*, *Opgepakt*, *Opgelost*, *Doen we niet*) in the *Bug of idee
  melden* panel (right *Bugs en ideeën afhandelen*).
- **Tijdwinst** (Instellingen, right *Tijdwinst bekijken*): the active time the team spends in the app is measured per
  week for the whole team together, and shown per task next to the agreed time per task from before the app.

**Dev** (the *Dev-tools* right; a menu section of its own, also while using *Bekijk als*)

- **Bugs & ideeën**: everything sent with *Bug of idee melden* on a board with the columns *Ongesorteerd*, *Te
  bespreken*, *Prio 1*, *Prio 2*, *Prio 3* and *Nice-to-have*. Drag a card to another column, or pick the column on
  the card (phones). Each card shows who sent it, when, from which screen and how many +1's; set the status there,
  or open it to remove it. Finished ones (*Opgelost*, *Doen we niet*) are hidden until you pick *Afgehandeld* or
  *Alles*. The menu shows how many open reports are still unsorted. The column is stored on the report (`prio`); only
  the Dev can set it, and colleagues don't see it in the app (it is in the shared data, though). Above the board you
  set the **address that gets a mail about every new report** (empty: no mail), send a test mail, and see whether
  the last mail went out. The link in the mail (`/#ideeen`) opens the board. Mail goes through the mail server under
  Integraties.
- **Mail to the reporter**: when the status of a report becomes *Opgepakt*, *Opgelost* or *Doen we niet* (here or
  in the panel), whoever sent it gets a mail at the address they log in with, with the new status, who set it and
  their own text. Not for *Nieuw*, a +1 or a column, not when you change your own report, not to a deactivated
  account, and not while no mail server is set. The reporter is found by name, so after a rename older reports
  get no mail. The same `/#ideeen` link opens *Bug of idee melden* for anyone without the Dev right, and that panel
  only promises a mail when a mail server is set.

**Everyone**: **Meldingen** (in-app notifications), **Wat is er nieuw** (changelog), **Bug of idee melden**
(report a bug or idea; it goes to the developer, others can give it a +1), the **Databron** switch between demo
data and live Trello data, and **Instellingen** (your account, password, two-factor, sessions and a download of
your own data).

### Monitor status and health rules

Every active campaign has one monitor status per week. The health rules decide it, until a Recruitment Marketeer
(or anyone with *Monitorstatus en updates bijhouden*) sets it on the campaign.

| Status | When |
|---|---|
| **Actie nodig** | At least one health rule fires, and nobody has set another status |
| **Wekelijkse controle** | No rule fires and nobody has checked the campaign yet this week. So every campaign comes up once a week; in the Weekoverzicht a *Check* button per row ticks it off |
| **In afwachting van klant** | Set by hand when the client still has to deliver something, such as ad balance or photos. It stays on in the weeks after, until someone changes it |
| **Check** | Set by hand: the campaign has been reviewed this week, whatever its scores. The next week it starts over. If a signal appears after the check that wasn't there at the time, the campaign goes back to *Actie nodig* |

The health rules and their defaults are below. Red signals sort above orange ones; both put a campaign on *Actie
nodig*. Anyone with the right *Health-regels aanpassen* can switch each rule on or off and change its threshold in
**Health-regels**.

| Signal | Rules |
|---|---|
| **Red** | quality is 4 or lower · quality has dropped 2 weeks in a row · 2 or fewer new candidates last week · recruiter ticked *Bijsturing nodig* |
| **Orange** | quality is 6 or lower · new candidates last week 30% or more below the average of the 3 weeks before · no feedback yet this week |

The two inflow rules look at last week, because the current week is still filling up with candidates. Everything
else, including the feedback round, is about the current week.

The status is stored on the week (`mon`: `check`, `klant`, or `open` to hand it back to the rules; with `monBy`
and, for a check, the signals seen at that moment in `monSig`). The update for the recruiter is `upd` / `updBy`.

## Accounts and rights

Modelled on Trello and Notion: every account has a **role**, the role comes with a default set of **rights**, and
whoever manages members can switch individual rights on or off per account (**Instellingen › Leden**). The
roles and rights are defined once in `src/lib/permissions.js`, which both the server and the app use.

| Role | Level | Default rights |
|---|---|---|
| **Dev** | Eigenaar (owner) | Everything, including **Integraties** (API keys), **Auditlog**, **Privacy** tools and dev tools (*Bekijk als* for everyone, demo reset, the Bugs & ideeën board) |
| **Teamlead** | Beheerder (admin) | All work rights, plus members and rights, Toewijzing, Trello linking, health rules, the status of bugs and ideas, managing the blacklist, Tijdwinst |
| **Recruitment Marketeer** | Lid (member) | Campaign overview of their own clients, monitor status and updates for the recruiter, client feedback, logging campaign changes, reminders |
| **Account Manager** | Lid (member) | Campaign overview of all clients and asking questions about campaigns; changes nothing |
| **Recruiter** | Lid (member) | Own weekly feedback, Live campagnes, and looking up and proposing candidates for the blacklist |

The rules for managing people:

- You can't change your own role or rights.
- Owners manage everyone. Admins manage members only, not other admins or owners.
- You can only hand out rights (and roles) you have yourself.
- There is always at least one active Dev.

**The server checks every change.** The app hides what you can't use, but `server/authorize.js` checks each
saved change against the rights of whoever is logged in. For example, a recruiter can only fill in feedback on
campaigns where they are the recruiter. Refused changes are not stored; the app reloads the server's version and
shows a message. Author names (`recBy`, `klantBy`, `monBy`, `updBy`, `by`, `from`) are always filled in by the
server, so nobody can save under someone else's name. Answering a question needs no right, but only the person it was sent to can
answer, and only to whoever asked it.

**Bekijk als** (in the sidebar) shows the app as another team member sees it. Who you can pick is set in
`canViewAs` (`src/lib/permissions.js`) and checked by the server:

| You are | You can view as |
|---|---|
| Dev | Anyone |
| Recruitment Marketeer | Recruiters and other Recruitment Marketeers |
| Recruiter | Other recruiters, never a Recruitment Marketeer |
| Teamlead, Account Manager | Nobody |

Anything you save is still saved as yourself, with your own rights, and the switch is written to the audit log.

**Recruiter name.** Campaigns and Trello links store the recruiter by name (`rec`). An account's *recruiternaam*
connects it to those campaigns. The Dev account for Tsjerk has the recruiter name *Tsjerk*.

### First start: the Dev account

On first start the server creates `accounts.json` with the current team (same ids as before, so earlier data stays
linked), all as *invited*. The Dev account is Tsjerk's.

1. The server prints a one-time **setup link** (valid 1 hour) in the terminal, or in the Render logs. While no Dev
   account is active, it prints a new one every hour and on every restart.
2. Open it, choose your email address and password, and set up two-factor login (required for Dev and Teamlead).
   Save the 10 recovery codes it shows.
3. In **Instellingen › Leden**, make an invite link for each team member and send it to them yourself (WhatsApp,
   Teams, ...). The app does not send email yet. Invite links work for 7 days, once.

Password forgotten? Someone who manages members makes a **reset link** (valid 24 hours) in Instellingen › Leden.

**Dev locked out** (lost password and two-factor)? Set `OWNER_RECOVERY=1` and restart. The server prints a reset
link for each active Dev; it also clears two-factor, which is then set up again at the next login. Remove the
variable afterwards.

### Integrations (API keys)

**Instellingen › Integraties** (Dev only) holds the API keys for connected services: Trello, and the mail server
(**E-mail (SMTP)**) that sends new bugs and ideas to the developer, and status changes to whoever reported them.

- Keys are tested before saving and stored encrypted (AES-256-GCM, key from `SECRETS_KEY`) in
  `DATA_DIR/secrets.json`. For the mail server the test logs in without sending anything.
- The browser only ever sees the last 4 characters of a key or password; a mail server's address, port, login and
  sender address are shown in full. Every change goes into the audit log.
- `TRELLO_KEY` / `TRELLO_TOKEN` and `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` environment
  variables still work as a fallback when nothing is stored in the app.
- Any SMTP server works. Brevo (EU, free up to 300 mails a day): `smtp-relay.brevo.com`, port 587, the SMTP login
  and key from *SMTP & API*, and a sender address confirmed in Brevo. Gmail: `smtp.gmail.com`, port 465, an app
  password. Port 465 uses SSL; on other ports the password only goes over STARTTLS (except to `localhost`).
- Every mail, sent or failed, goes into the audit log (recipient and kind, not the text). On Netlify, mails go out
  after the request's data was saved, so a request that is rerun never sends one twice.

## Privacy (GDPR)

- **Personal accounts, least privilege.** Each person only gets the rights their role needs, and the server
  enforces them.
- **Data minimisation for candidates.** The server decides which Trello fields are fetched, not the browser. Only
  lists, labels, and per card its list, labels and the two custom fields the monitor uses (*Sollicitatiedatum*,
  *Reden afgewezen*) come through. Descriptions and other custom fields are never fetched. To know which intake list
  a card came in through, the server also reads each board's history; Trello always sends the card's title (the
  candidate's name) with it. The server keeps only the card and list ids of each move and drops the rest right away,
  so names are never stored or sent to the browser (`server/trello.js`). The privacy notice says so.
  The server only stores counts (the [Trello snapshot](#trello-snapshot)) and, per card, the id of its intake list
  (the [intake memory](#functions-from-intake-lists)), never cards, names or rejection reasons.
- **The blacklist is the exception**: the only place the app stores candidates' personal data, typed in by the
  team. It is its own document (`DATA_DIR/blacklist.json`), only reachable through `/api/blacklist` with a
  blacklist right, and never part of `/api/state`, so people without the right never receive it. Notifications
  about proposals don't name the candidate (everyone receives the inbox), and the audit log has the entry id and
  initials, not the name. Entries are deleted when their term ends. Reasons come from a fixed list without
  sensitive data or suspicions of crimes, and the form warns against putting those in the note.
- **Audit log** (Instellingen › Auditlog): logins (with IP address), failed attempts and lockouts, invites, role
  and rights changes, two-factor changes, API-key changes, exports, anonymisation, rule and assignment changes,
  every blacklist change, every mail the app sends (recipient and kind, not the text), and refused changes.
  Individual feedback edits are not logged.
- **Mail about bugs and ideas** carries the reporter's name and text to the address the Dev set, through the mail
  server under Integraties, and a status change on a report goes to the reporter's own address. The privacy notice
  says so. Anonymising an account later can't reach mails already sent.
- **Time in the app** is stored as weekly totals for the whole team, without names.
- **Right of access.** Everyone can download their own data (Instellingen › Mijn account). The Dev can export
  anyone's data (Instellingen › Privacy). For a candidate on the blacklist, *Gegevens downloaden* on the entry;
  correcting and removing are done there too.
- **Right to erasure.** Deactivate the account (Leden), then anonymise it (Privacy). The name is replaced by a
  pseudonym (*Oud-teamlid 1*) everywhere: campaigns, feedback, assignments, notifications, ideas and the audit
  log. Email, password and two-factor are wiped. Free text that people typed can still mention names and has to be
  checked by hand.
- **Retention:**

  | What | Kept for |
  |---|---|
  | Sessions | 30 days |
  | Invite links | 7 days |
  | Reset links | 24 hours |
  | Setup link | 1 hour |
  | Audit log | 12 months |
  | Daily backups | 14 days |
  | Deactivated accounts | Anonymised automatically after 12 months (setting in Instellingen › Privacy) |
  | Blacklist entries | 6, 12 or 24 months, chosen per entry (can be extended) |
  | Blacklist proposals nobody decided on | 30 days |
  | Trello snapshot (counts per campaign) | Until the next load of that board; boards gone from Trello are removed |
  | Trello intake memory (card id → intake list id) | While the card is on the board; boards gone from Trello are removed |

- **Privacy notice** at `/privacy`, linked from the login page. It is a draft: have it checked and fill in the
  contact person in `server/pages.js`.
- **Outside the app:** add the Campagnemonitor to Horeca Toppers' record of processing (verwerkingsregister), and
  have data processing agreements with Render (hosting, Frankfurt), Atlassian (Trello) and the mail service set
  under Integraties (for example Brevo). Before the blacklist is
  used: do a DPIA (the Dutch DPA lists blacklists as processing that requires one), and mention the blacklist in
  the privacy statement for candidates, including how to object or ask for access. Don't share the list with
  clients: that would be a different, heavier kind of processing that needs its own legal check.

## Tech stack

- **Frontend:** React 18, built with Vite
- **Server:** Express 5 on Node.js 20+, only built-in crypto (scrypt, AES-GCM, TOTP)
- **Storage:** JSON documents: files on disk (Render, local), or Netlify Blobs (Netlify). No database.
- **Hosting:** Render (`render.yaml`) or Netlify (`netlify.toml`). The same server code runs on both; see
  [Deploy to Render](#deploy-to-render) and [Deploy to Netlify](#deploy-to-netlify).

## Getting started

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

The terminal shows a setup link for the Dev account (see [First start](#first-start-the-dev-account)). Open it,
set up your login, and you're in at <http://localhost:5173>. Local data lives in `./data`; your session lasts 30
days. Without Trello keys the app runs on demo data.

To run it the way it runs in production:

```bash
npm run build
NODE_ENV=production SECRETS_KEY=something-long-and-random npm start   # http://localhost:3000
```

### Fake Trello

To try the Trello side without a Trello account, `scripts/fake-trello.js` stands in for the Trello API: six demo
clients with a few functions each and candidates over the last weeks: some with their functions as labels, some as
intake lists (*Nieuwe Sollicitant | …*, with a history that has made-up candidate names, as Trello's has real ones),
one with both. Each board takes 2 seconds to load
(`FAKE_TRELLO_DELAY`, in ms), so you can see the app show the [Trello snapshot](#trello-snapshot) first and update
it after. Every minute the first function of each client gets one more new candidate (up to 4, then back), so the
numbers move between logins. It only works with `FAKE_TRELLO=1`, fills in Trello keys when none are set, and says
so at the top of the log (`[nep-trello]`). **Never use it in production.**

- Locally: `npm run dev:fake-trello`.
- On the stage service (Render, branch `CI_Testing`): set the start command to
  `node --import ./scripts/fake-trello.js server/index.js` (Settings › Build & Deploy) and add `FAKE_TRELLO=1` under
  Environment. To go back to the real Trello, set the start command back to `npm start` and remove `FAKE_TRELLO`.

To see the snapshot at work: link the demo boards in Toewijzing, wait for *Trello bijgewerkt* under Databron, log
out and log in again. The numbers are there at once, with *Stand HH:MM · bijwerken…*, and update when the boards
are in.

| Script | What it does |
|---|---|
| `npm run dev` | Runs the API server on :3000 (restarts when `server/` changes) and the Vite dev server on :5173 |
| `npm run dev:fake-trello` | The same, with demo boards instead of Trello (see [Fake Trello](#fake-trello)) |
| `npm run build` | Builds the frontend into `dist/` |
| `npm start` | Starts the server, which serves `dist/` and the API |
| `npm run preview` | Build, then start |
| `npm test` | Rights, monitor status, crypto, the blacklist, time in the app, counting Trello boards, functions from intake lists, the intake memory, the 5-minute refresh and the Trello snapshot, and an end-to-end test of login, invites, the blacklist, reset, lockout, recovery and simultaneous saves, run against both the Render/local server and the Netlify function |

## Configuration

The server reads settings from environment variables. It does **not** load `.env` files, so set them in your
shell or in Render's **Environment** tab. `.env.example` lists them all.

| Variable | Needed | What it does |
|---|---|---|
| `SECRETS_KEY` | yes, in production; always on Netlify | Encrypts stored API keys and two-factor secrets. Render generates it; on Netlify you set it yourself. Locally, without it, a key file is created in the data folder. **Don't change it** once set: stored keys and two-factor would have to be set up again. |
| `DATA_DIR` | yes, on Render | Folder for the data files. Default `./data`; on Render `/var/data` (the persistent disk). |
| `NODE_ENV` | in production | Set to `production` for secure (HTTPS-only) cookies. |
| `TZ` | yes, on Render | `Europe/Amsterdam` (set in `render.yaml`), so the server counts Trello cards in Dutch weeks for the [snapshot](#trello-snapshot). Render runs on UTC otherwise. |
| `APP_URL` | no | Base URL for the setup and recovery links printed at startup. Default: Render's `RENDER_EXTERNAL_URL`, else `http://localhost:PORT` (`npm run dev` sets `http://localhost:5173`). |
| `TRELLO_KEY`, `TRELLO_TOKEN` | no | Fallback for the Trello keys when none are stored under Instellingen › Integraties. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | Fallback for the mail server when none is stored under Instellingen › Integraties. All five are needed. |
| `OWNER_RECOVERY` | only when locked out | `1` prints reset links for the Dev accounts at startup (on Netlify: when you open `/setup`). See [First start](#first-start-the-dev-account). |
| `PORT` | no | Default `3000`. Render sets it automatically. |
| `FAKE_TRELLO`, `FAKE_TRELLO_DELAY` | only for trying things | `1`: demo boards instead of Trello, with the server started through `scripts/fake-trello.js`; the delay per board in ms (default 2000). See [Fake Trello](#fake-trello). Never in production. |

`APP_PASSWORD` and `SESSION_SECRET` are no longer used and can be removed.

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and pick the repository. `render.yaml` sets up everything else. It asks
   for `SECRETS_KEY`: paste a long random value (`openssl rand -hex 32`), keep it somewhere safe, never change it.
3. Open **Logs**, copy the setup link, and set up the Dev account.
4. Invite the team from Instellingen › Leden, and set the Trello keys under Instellingen › Integraties.

The Blueprint uses the **Starter** plan with a 1 GB persistent disk (about $7/month in total) in the Frankfurt
region. The disk is what keeps the team's data: on the free plan, the data would be wiped on every deploy or
restart. Every push to the main branch deploys automatically.

**Moving an existing Render deployment from the team password:**

1. Check that `SECRETS_KEY` exists in the Environment tab; otherwise add a long random value yourself.
2. Deploy. The team password stops working right away.
3. Take the setup link from the logs, set up the Dev account, and send everyone their invite link.

**Moving from Netlify to Render** (keeps all data, accounts and 2FA):

1. Create the Render service from the Blueprint. When it asks for `SECRETS_KEY`, paste the **exact** value from
   Netlify. A different key makes everyone's 2FA and the stored integration keys unreadable. Copy any `TRELLO_*` or
   `SMTP_*` variables from Netlify too. Don't open the app yet.
2. Pick a quiet moment and ask the team not to use the app for half an hour.
3. Export from Netlify into a new folder, with the same key so the script can check it:
   `NETLIFY_SITE_ID=… NETLIFY_TOKEN=… SECRETS_KEY=… node scripts/export-netlify.js ./migrated`
   It must end with "SECRETS_KEY past". Optionally test locally first:
   `DATA_DIR=./migrated SECRETS_KEY=… npm start` and log in.
4. Copy the folder to the disk, into a **new** subfolder (not into `/var/data` itself, where the running server
   would write over it): set up SSH for the service, then `scp -s -r ./migrated <service-id>@ssh.frankfurt.render.com:/var/data/`.
5. Change `DATA_DIR` to `/var/data/migrated` (in `render.yaml`, then push; Render redeploys). The startup log
   should show the accounts and `trello: ingesteld (in de app)`, with no "onleesbaar" warnings.
6. Log in, check the data, share the new URL. Everyone logs in once more (cookies are per domain).
7. Delete `./migrated` and the Netlify token. After a week without issues, remove the Netlify site and its
   Blobs data, and update the data processing agreement (Render instead of Netlify).

## Deploy to Netlify

Netlify only serves static files, so the server runs as a Netlify Function (`netlify/functions/server.mjs`,
built from `server/netlify.js`), and the data lives in **Netlify Blobs** instead of files. `netlify.toml` sets up
the build, the function and the security headers.

1. In Netlify, open the site and go to **Site configuration › Environment variables**. Add `SECRETS_KEY` with
   a long random value, for example the output of `openssl rand -hex 32`. Keep it somewhere safe and **don't change
   it** later. Without it, the login pages show what's missing.
2. Deploy: push to GitHub, or use **Deploys › Trigger deploy** (a new environment variable needs a new deploy).
3. Open `https://<your-site>/setup`. The setup link is then written to the function log: **Logs & metrics ›
   Functions › server** (valid 1 hour; open the log first if it only shows new lines). Set up the Dev account and
   two-factor.
4. Invite the team from Instellingen › Leden, and set the Trello keys under Instellingen › Integraties.

How it works:

- **Data location:** Blobs are stored in Frankfurt (`eu-central-1`). On Netlify's free plan the function itself
  runs in the US (Ohio); on a Pro plan you can set the functions region to Frankfurt (Site configuration ›
  Functions › Region). The privacy page says this; arrange a data processing agreement with Netlify.
- **Every request** loads the data fresh from Blobs and saves changed documents only if nobody else changed them
  in the meantime. Otherwise it reruns on the fresh data, so simultaneous saves never overwrite each other.
  Login steps, lockouts and one-time links are stored the same way, so any function instance can continue them.
- **Housekeeping** (expired sessions, automatic anonymisation, old audit months, a daily backup copy under
  `backups/` in the store, last 14 days) runs on the first request after an hour, since functions have no timers.
- **Polling:** the app checks for other people's changes every 60 seconds instead of 15, to stay within the free
  plan's credits.
- **Separate data:** Netlify and Render each have their own data; nothing is copied between them automatically.
  To move from Netlify to Render, see `scripts/export-netlify.js` and [Deploy to Render](#deploy-to-render).

To try the Netlify setup locally (after `npm run build`):

```bash
SECRETS_KEY=dev PORT=8888 BLOB_FILE=/tmp/htcm-blobs.json node test/netlify-harness.js
```

Then open <http://localhost:8888/setup>; the link appears in that terminal.

## How data works

- On Render and locally, everything is in files in `DATA_DIR`, described below. On Netlify, the same documents
  are blobs in the `campagnemonitor` store (see [Deploy to Netlify](#deploy-to-netlify)).
- Shared data (campaigns, feedback, rules, assignments, notifications, ideas) lives on the server in
  `DATA_DIR/campagnemonitor.json`.
- Accounts, sessions and one-time links live in `DATA_DIR/accounts.json`. Passwords are scrypt hashes; sessions and
  links are stored as SHA-256 hashes; two-factor secrets are encrypted.
- Integration keys are in `DATA_DIR/secrets.json` (encrypted). The audit log is in `DATA_DIR/audit/YYYY-MM.jsonl`.
- The blacklist is in `DATA_DIR/blacklist.json`, apart from the shared data (see [Privacy](#privacy-gdpr)).
- Time in the app (Tijdwinst) is in `DATA_DIR/timing.json`.
- The last Trello numbers for the home screens are in `DATA_DIR/trello-snapshot.json` (see
  [Trello snapshot](#trello-snapshot)), and the intake list every card came in through in
  `DATA_DIR/trello-intake.json` (see [Functions from intake lists](#functions-from-intake-lists)).
- For each JSON file except those two, a dated copy is kept for each of the last 14 days as a safety net.
- The app sends only what changed (per campaign, per rule, ...), so two people saving at the same moment don't
  overwrite each other. Other people's changes appear within about 15 seconds, or right away when you switch back
  to the tab.
- Each browser remembers the chosen **Databron**, which news you've read, and the Dev's *Bekijk als* choice.
- The feedback week moves on automatically: each round is about the current week, and all feedback for a week is
  due by the end of that same week.
- `data/` is in `.gitignore`. Never commit it, because it holds the team's real data and accounts.

## Trello conventions

The monitor reads every board the Trello account can see. Each board is one client.

- **Lists** are recognised by name: `Nieuw`, `Contactpoging`, `Gescreend`, `Gesprek`, `Voorstel…`, `Aangenomen`,
  `Afgewezen`. Lists with `Informatie` in the name are ignored.
- **Functions** (job roles, vacancies) are intake lists or labels:
  - An **intake list** is where new candidates of one function come in: `Nieuwe Sollicitant | Kok` (also with `-`,
    `–` or `:`, and in any case). It counts as *Nieuw*. Clients add these themselves for a new function; see
    [Functions from intake lists](#functions-from-intake-lists).
  - A **label** is a function too, for cards that didn't come in through an intake list.
  - A board without either can be linked as a whole.
- **Custom fields** (optional): `Sollicitatiedatum` (date; otherwise the card's creation date is used) and
  `Reden afgewezen` (dropdown). Other custom fields are dropped by the server.

The server only proxies a few read-only Trello endpoints, with fixed fields. *Trello-koppeling testen* shows per
board which functions come from intake lists and which from labels, and warns about candidates without a function.

### Functions from intake lists

A candidate keeps the function of the intake list they came in through, also after moving on to *Contactpoging*,
*Gescreend* or *Afgewezen*, without anyone putting a label on the card:

- The server reads each board's history (`server/trello.js`) and remembers per card which intake list it came in
  through, in `DATA_DIR/trello-intake.json` (`server/trelloIntake.js`): only card and list ids. The first time it
  reads the 12 weeks the monitor shows; after that only what is new, starting 5 minutes before the newest move it
  read, so a move Trello shows late is still picked up. Reading a move twice changes nothing.
- The app gets each card with `idIntake` and counts it for that function (`src/lib/boardStats.js`). The intake list
  goes before the card's labels; only a card without one follows its labels. Moved between two intake lists, the
  last one counts.
- An intake list and a label with the same name are one function, under the label (so a campaign linked to the label
  earlier keeps its feedback). A new intake list with the name of an archived one continues its function.
- When the history can't be read, the board still loads with what the server remembers, and catches up next time.
- Older than the 12 weeks: a card that had already moved on and has no label counts only for the client as a whole.

### Every 5 minutes

The server loads the boards that changed every 5 minutes, also when nobody has the app open, and the open app does
the same while its tab is visible:

- One call for the list of boards, which has each board's last activity. Only boards whose activity changed since
  their last load are loaded again (and only their new history), plus every board once an hour, in case Trello
  doesn't count a change as activity. Like the app, the server loads linked boards and boards active in the last 30
  days.
- The server keeps the last load of every board in memory (not on disk), with the activity the list of boards gave
  *before* that load. While the list says the same, the app gets the board from memory without a Trello call. A
  change during a load makes the next list say something newer, so a board is never skipped, at worst loaded once
  more than needed. The numbers are always counted from the whole board, never added up, so nobody counts twice.
- The list of boards and `/members/me` are shared for 30 seconds, so several people opening the app at once share
  one Trello call.
- Only on Render and locally (`trello.refresh()` in `server/index.js`). On Netlify the app loads the boards itself.

### Trello snapshot

So the screens don't start at zero after login, the server keeps the numbers of the last Trello load, by whoever
did it, in `DATA_DIR/trello-snapshot.json`:

- Right after login the app shows those: Weekoverzicht, Campagnes, Mijn campagnes and Live campagnes have their
  numbers at once. The status in the menu says from when (*Stand 09:12 · bijwerken…*, or *Stand 13 okt ·
  bijwerken…* from an earlier day).
- In the background the app loads the boards as before, and the numbers move to the live state (*Trello bijgewerkt
  09:14*). Until a campaign's board is in, its page shows *Laden uit Trello…* for the pipeline.
- Only counts per campaign go in: new candidates per week (the 12 weeks a campaign shows) and today's call list
  (open cards in *Nieuw* and *Contactpoging*). No cards, no pipeline, no rejection reasons.
- The server fills it from every board it loads from Trello (`server/trelloSnapshot.js`), also in its round every
  5 minutes (see [Every 5 minutes](#every-5-minutes)); the app never writes to it. Boards Trello no longer lists are removed, and a new Trello key starts it over. It has no daily copies: every
  load rebuilds it.
- The server and the app count the same way (`src/lib/boardStats.js`), so the snapshot matches the live numbers. The
  server counts in Dutch weeks (`TZ`, see [Configuration](#configuration)).
- Only on Render and locally. On Netlify the app loads the boards first, as before.

## Security

- **Personal logins.** Email and password (at least 12 characters, scrypt), plus a code from an authenticator app
  for Dev and Teamlead (optional for others), with 10 one-time recovery codes.
- **Sessions** are random ids in an HttpOnly, SameSite cookie, valid for 30 days and stored server-side.
  Deactivating an account, resetting a password or resetting two-factor logs that person out right away.
  Everyone can see their sessions and log out elsewhere.
- **Brute-force protection.** After 10 failed attempts per IP address or per account, login is blocked for 15
  minutes, and the lockout is logged.
- **Web protections.** The server rejects cross-site writes, sends a strict Content Security Policy, and tells
  search engines not to index the site.
- **Keys stay server-side.** Trello keys and the mail server's password never reach the browser, and changing one
  needs the Dev role.

## Known limitations

- **Email only for bugs and ideas.** Invites, reset links and reminders are still copied and sent by hand, or
  arrive under Meldingen. They can use the same mail server later (`server/mail.js`).
- **Everyone with campaign access sees all clients.** Access per client (like Trello board membership) and guest
  accounts are planned for later.
- **One instance only on Render.** There, data is held in memory and written to files, so don't scale the service
  to more than one instance. (The Netlify function is built for many instances.)

## Project layout

```
server/
  app.js          the Express app: security headers, routes, all parts wired together
  index.js        long-running server (Render, local): files, startup setup link, hourly housekeeping
  netlify.js      Netlify Function: Blobs, load → handle → conditional save → rerun on conflict
  auth.js         login, two-factor, sessions, setup/invite/reset pages
  accounts.js     accounts, sessions, one-time links, two-factor (DATA_DIR/accounts.json)
  authorize.js    which right each change to the shared data needs
  api.js          JSON API: me, members, integrations, mail for bugs and ideas, audit log, privacy
  store.js        shared data in memory + JSON file
  secrets.js      encrypted API keys (DATA_DIR/secrets.json)
  audit.js        audit log (DATA_DIR/audit/*.jsonl)
  privacy.js      data export and anonymisation
  blacklist.js    the candidate blacklist (DATA_DIR/blacklist.json): checks, search, terms, expiry
  mail.js         mail through the SMTP server under Integraties (new bugs and ideas to the developer, status changes to the reporter)
  crypto.js       scrypt, TOTP, AES-GCM helpers
  pages.js        server-rendered pages (login, 2FA, invite, reset, privacy)
  jsonfile.js     document storage: files with daily backups, or Netlify Blobs with conditional writes
  trello.js       read-only Trello proxy with fixed fields and a short cache
  trelloSnapshot.js  the last Trello numbers for the home screens (DATA_DIR/trello-snapshot.json)
src/
  App.jsx         app logic (from the design); renderVals() feeds the views
  views/          one component per screen; views/settings/ holds Instellingen
  lib/            rights (permissions.js), week math, demo data, health rules, sync with the server, Trello boards
                  → campaigns (boardStats.js, also used by the server)
  styles/         design tokens, app styles, fonts
netlify/functions/server.mjs   the Netlify Function (routes its paths to server/netlify.js)
test/             node:test suites (npm test), a fake Blobs store and a local Netlify harness
public/           logo, favicon, self-hosted fonts
scripts/dev.js    runs the API server and Vite together
scripts/fake-trello.js   demo boards instead of Trello, for trying things (FAKE_TRELLO=1; never in production)
render.yaml       Render Blueprint
Campagnemonitor.html   original Claude Design export (reference only)
```

### Server endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Health check (no login needed) |
| GET, POST | `/login`, `/login/code`, `/login/2fa-instellen` | Login, two-factor code, two-factor setup |
| GET | `/setup` | Writes a new setup link (or with `OWNER_RECOVERY=1` reset links) to the server log, at most once a minute |
| GET, POST | `/setup/:token`, `/invite/:token`, `/reset/:token` | One-time links |
| POST | `/logout` | Log out |
| GET | `/privacy` | Privacy notice (no login needed) |
| GET | `/api/config` | Whether Trello is connected |
| GET | `/api/me` | Your account and the team directory |
| POST | `/api/me/password`, `/api/me/email`, `/api/me/2fa/*`, `/api/me/sessions/revoke-others` | Your own account |
| GET | `/api/me/export` | Download your own data |
| GET | `/api/state?rev=` | All shared data, or `unchanged` if `rev` is current |
| POST | `/api/state/patch` | Apply changes: `{ patches: [{ doc, set, del }] }` → `{ rev, rejected }` |
| GET, POST, PATCH, DELETE | `/api/admin/members/…` | Members: invite, edit, links, deactivate (*members.manage*) |
| GET, PUT, DELETE, POST | `/api/admin/integrations/…` | API keys (*integrations*) |
| GET | `/api/admin/audit` | Audit log (*audit.view*) |
| GET, PUT, POST | `/api/admin/privacy/…` | Retention, export, anonymise (*privacy*) |
| GET, PUT, POST | `/api/admin/idea-mail`, `/api/admin/idea-mail/test` | The address for mails about new bugs and ideas, the last delivery, a test mail (*dev*) |
| GET | `/api/blacklist?q=`, `/api/blacklist/summary` | Search (at least 3 characters), the list, and the counts for the menu (*blacklist.view* or *blacklist.manage*; without the second, only confirmed entries and your own proposals) |
| POST | `/api/blacklist` | Add (*blacklist.manage*) or propose (*blacklist.view*) a candidate |
| PATCH, DELETE | `/api/blacklist/:id` | Correct or extend, remove or reject (*blacklist.manage*); withdraw your own proposal |
| POST, GET | `/api/blacklist/:id/approve`, `/api/blacklist/:id/export` | Confirm a proposal, download an entry (*blacklist.manage*) |
| GET | `/api/trello/…` | Read-only Trello proxy (`members/me`, `members/me/boards`, `boards/:id`) |
| GET | `/api/trello/snapshot` | The [Trello snapshot](#trello-snapshot): `{ boards: { [boardId]: { at, stats } } }` |
