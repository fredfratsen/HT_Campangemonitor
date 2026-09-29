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
- **Wekelijkse feedback recruiter**: the weekly check-in per campaign. It covers new candidates, a quality score
  (1–10), written feedback, an optional action, and a **Bijsturing nodig** (needs adjusting) flag.
- **Mijn campagnes**: your own campaigns and earlier check-ins.

**Campaign overview** (right: *Alle campagnes bekijken*; Recruitment Marketeers, Teamlead, Dev)

- **Weekoverzicht**: campaign health for this week, whose feedback is still missing, and a button to send
  reminders.
- **Campagnes** and campaign detail: candidates and quality per week, the Trello pipeline, rejection reasons, and a
  log of campaign changes (ad, audience, budget, vacancy text, ...).
- **Feedback klant**: record the client's feedback, separately from the recruiter's.
- **Historie & analyse**: totals, averages and changes over past weeks.
- **Health-regels**: the rules that label each campaign *Goed*, *Monitoren* or *Actie nodig*.

**Management** (Teamlead and Dev by default)

- **Klanten uit Trello**: link Trello boards and labels to campaigns.
- **Toewijzing**: assign a recruiter and a Recruitment Marketeer per client, or mark a client inactive.
- **Trello-koppeling testen**: check the Trello setup against the conventions below.
- Editing the health rules.

**Everyone**: **Meldingen** (in-app notifications), **Wat is er nieuw** (changelog), **Bug of idee melden**
(report a bug or idea), the **Databron** switch between demo data and live Trello data, and **Instellingen**
(your account, password, two-factor, sessions and a download of your own data).

### Health rules

The defaults are below. Anyone with the right *Health-regels aanpassen* can switch each rule on or off and change
its threshold in **Health-regels**.

| Status | When |
|---|---|
| **Actie nodig** | Any of: quality is 4 or lower · quality has dropped 2 weeks in a row · 2 or fewer new candidates this week · recruiter ticked *Bijsturing nodig* |
| **Monitoren** | No red rule applies, and any of: quality is 6 or lower · new candidates 30% or more below the average of the previous 3 weeks · no feedback yet this week |
| **Goed** | None of the above |

## Accounts and rights

Modelled on Trello and Notion: every account has a **role**, the role comes with a default set of **rights**, and
whoever manages members can switch individual rights on or off per account (**Instellingen › Leden**). The
roles and rights are defined once in `src/lib/permissions.js`, which both the server and the app use.

| Role | Level | Default rights |
|---|---|---|
| **Dev** | Eigenaar (owner) | Everything, including **Integraties** (API keys), **Auditlog**, **Privacy** tools and dev tools (*Bekijk als*, demo reset) |
| **Teamlead** | Beheerder (admin) | All work rights, plus members and rights, Toewijzing, Trello linking, health rules, handling bugs and ideas |
| **Recruitment Marketeer** | Lid (member) | Campaign overview, client feedback, logging campaign changes, reminders |
| **Recruiter** | Lid (member) | Own weekly feedback and Live campagnes |

The rules for managing people:

- You can't change your own role or rights.
- Owners manage everyone. Admins manage members only, not other admins or owners.
- You can only hand out rights (and roles) you have yourself.
- There is always at least one active Dev.

**The server checks every change.** The app hides what you can't use, but `server/authorize.js` checks each
saved change against the rights of whoever is logged in. For example, a recruiter can only fill in feedback on
campaigns where they are the recruiter. Refused changes are not stored; the app reloads the server's version and
shows a message. Author names (`recBy`, `klantBy`, `by`, `from`) are always filled in by the server, so nobody can
save under someone else's name.

**Bekijk als** (Dev only, in the sidebar) shows the app as another team member sees it. Anything you save is
still saved as yourself, with your own rights, and the switch is written to the audit log.

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

**Instellingen › Integraties** (Dev only) holds the API keys for connected services, currently Trello.

- Keys are tested before saving and stored encrypted (AES-256-GCM, key from `SECRETS_KEY`) in
  `DATA_DIR/secrets.json`.
- The browser only ever sees the last 4 characters. Every change goes into the audit log.
- `TRELLO_KEY` / `TRELLO_TOKEN` environment variables still work as a fallback when nothing is stored in the app.

## Privacy (GDPR)

- **Personal accounts, least privilege.** Each person only gets the rights their role needs, and the server
  enforces them.
- **Data minimisation for candidates.** The server decides which Trello fields are fetched, not the browser. Only
  lists, labels, and per card its list, labels and the two custom fields the monitor uses (*Sollicitatiedatum*,
  *Reden afgewezen*) come through. Candidate names, descriptions and other custom fields are never fetched.
- **Audit log** (Instellingen › Auditlog): logins (with IP address), failed attempts and lockouts, invites, role
  and rights changes, two-factor changes, API-key changes, exports, anonymisation, rule and assignment changes,
  and refused changes. Individual feedback edits are not logged.
- **Right of access.** Everyone can download their own data (Instellingen › Mijn account). The Dev can export
  anyone's data (Instellingen › Privacy).
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

- **Privacy notice** at `/privacy`, linked from the login page. It is a draft: have it checked and fill in the
  contact person in `server/pages.js`.
- **Outside the app:** add the Campagnemonitor to Horeca Toppers' record of processing (verwerkingsregister), and
  have data processing agreements with Render (hosting, Frankfurt) and Atlassian (Trello).

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

| Script | What it does |
|---|---|
| `npm run dev` | Runs the API server on :3000 (restarts when `server/` changes) and the Vite dev server on :5173 |
| `npm run build` | Builds the frontend into `dist/` |
| `npm start` | Starts the server, which serves `dist/` and the API |
| `npm run preview` | Build, then start |
| `npm test` | Rights, crypto, and an end-to-end test of login, invites, reset, lockout, recovery and simultaneous saves, run against both the Render/local server and the Netlify function |

## Configuration

The server reads settings from environment variables. It does **not** load `.env` files, so set them in your
shell or in Render's **Environment** tab. `.env.example` lists them all.

| Variable | Needed | What it does |
|---|---|---|
| `SECRETS_KEY` | yes, in production; always on Netlify | Encrypts stored API keys and two-factor secrets. Render generates it; on Netlify you set it yourself. Locally, without it, a key file is created in the data folder. **Don't change it** once set: stored keys and two-factor would have to be set up again. |
| `DATA_DIR` | yes, on Render | Folder for the data files. Default `./data`; on Render `/var/data` (the persistent disk). |
| `NODE_ENV` | in production | Set to `production` for secure (HTTPS-only) cookies. |
| `APP_URL` | no | Base URL for the setup and recovery links printed at startup. Default: Render's `RENDER_EXTERNAL_URL`, else `http://localhost:PORT` (`npm run dev` sets `http://localhost:5173`). |
| `TRELLO_KEY`, `TRELLO_TOKEN` | no | Fallback for the Trello keys when none are stored under Instellingen › Integraties. |
| `OWNER_RECOVERY` | only when locked out | `1` prints reset links for the Dev accounts at startup (on Netlify: when you open `/setup`). See [First start](#first-start-the-dev-account). |
| `PORT` | no | Default `3000`. Render sets it automatically. |

`APP_PASSWORD` and `SESSION_SECRET` are no longer used and can be removed.

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and pick the repository. `render.yaml` sets up everything else,
   including a generated `SECRETS_KEY`.
3. Open **Logs**, copy the setup link, and set up the Dev account.
4. Invite the team from Instellingen › Leden, and set the Trello keys under Instellingen › Integraties.

The Blueprint uses the **Starter** plan with a 1 GB persistent disk (about $7/month in total) in the Frankfurt
region. The disk is what keeps the team's data: on the free plan, the data would be wiped on every deploy or
restart. Every push to the main branch deploys automatically.

**Moving an existing Render deployment from the team password:**

1. Check that `SECRETS_KEY` exists in the Environment tab. A Blueprint sync adds it; otherwise add a long random
   value yourself.
2. Deploy. The team password stops working right away.
3. Take the setup link from the logs, set up the Dev account, and send everyone their invite link.

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
- **Separate data:** Netlify and Render each have their own data; nothing is copied between them, or from your
  local `./data`.

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
- For each JSON file, a dated copy is kept for each of the last 14 days as a safety net.
- The app sends only what changed (per campaign, per rule, ...), so two people saving at the same moment don't
  overwrite each other. Other people's changes appear within about 15 seconds, or right away when you switch back
  to the tab.
- Each browser remembers the chosen **Databron**, which news you've read, and the Dev's *Bekijk als* choice.
- The feedback week moves on automatically: the Monday round is about the week that just ended.
- `data/` is in `.gitignore`. Never commit it, because it holds the team's real data and accounts.

## Trello conventions

The monitor reads every board the Trello account can see. Each board is one client.

- **Lists** are recognised by name: `Nieuw`, `Contactpoging`, `Gescreend`, `Gesprek`, `Voorstel…`, `Aangenomen`,
  `Afgewezen`. Lists with `Informatie` in the name are ignored.
- **Labels** are job roles (vacancies). A board without labels can be linked as a whole.
- **Custom fields** (optional): `Sollicitatiedatum` (date; otherwise the card's creation date is used) and
  `Reden afgewezen` (dropdown). Other custom fields are dropped by the server.

The server only proxies a few read-only Trello endpoints, with fixed fields, and it caches responses for 30
seconds. That way, when several people open the app at once, they share a single Trello call.

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
- **Keys stay server-side.** Trello keys never reach the browser, and changing one needs the Dev role.

## Known limitations

- **No email yet.** Invites, reset links and reminders are copied and sent by hand, or arrive under Meldingen.
  An email service (for example Brevo, EU-based) can be added as an integration.
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
  api.js          JSON API: me, members, integrations, audit log, privacy
  store.js        shared data in memory + JSON file
  secrets.js      encrypted API keys (DATA_DIR/secrets.json)
  audit.js        audit log (DATA_DIR/audit/*.jsonl)
  privacy.js      data export and anonymisation
  crypto.js       scrypt, TOTP, AES-GCM helpers
  pages.js        server-rendered pages (login, 2FA, invite, reset, privacy)
  jsonfile.js     document storage: files with daily backups, or Netlify Blobs with conditional writes
  trello.js       read-only Trello proxy with fixed fields and a short cache
src/
  App.jsx         app logic (from the design); renderVals() feeds the views
  views/          one component per screen; views/settings/ holds Instellingen
  lib/            rights (permissions.js), week math, demo data, health rules, sync with the server
  styles/         design tokens, app styles, fonts
netlify/functions/server.mjs   the Netlify Function (routes its paths to server/netlify.js)
test/             node:test suites (npm test), a fake Blobs store and a local Netlify harness
public/           logo, favicon, self-hosted fonts
scripts/dev.js    runs the API server and Vite together
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
| GET | `/api/trello/…` | Read-only Trello proxy (`members/me`, `members/me/boards`, `boards/:id`) |
