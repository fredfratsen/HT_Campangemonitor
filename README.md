<<<<<<< HEAD
# Campagnemonitor · Horeca Toppers

An internal web app for the Horeca Toppers recruitment team. It puts weekly campaign feedback, campaign health,
history and the Trello candidate pipeline in one place for the teamlead, the Recruitment Marketeers and the
recruiters.

The interface is in Dutch. The app started as a Claude Design export (`Campagnemonitor.html`, kept in the repo
as the design reference) and was built out into a React app with a small Express server.

## Features

What you see depends on who you are logged in as (**Ingelogd als** in the sidebar).

**Recruiters**

- **Live campagnes**: today's call work per client, with new candidates and contact attempts pulled from Trello.
- **Wekelijkse feedback recruiter**: the weekly check-in per campaign. It covers new candidates, a quality score
  (1–10), written feedback, an optional action, and a **Bijsturing nodig** (needs adjusting) flag.
- **Mijn campagnes**: your own campaigns and earlier check-ins.

**Recruitment Marketeers and teamlead**

- **Weekoverzicht**: campaign health for this week, whose feedback is still missing, and a button to send
  reminders.
- **Campagnes** and campaign detail: candidates and quality per week, the Trello pipeline, rejection reasons, and a
  log of campaign changes (ad, audience, budget, vacancy text, ...).
- **Feedback klant**: record the client's feedback, separately from the recruiter's.
- **Historie & analyse**: totals, averages and changes over past weeks.
- **Health-regels**: the rules that label each campaign *Goed*, *Monitoren* or *Actie nodig*.

**Teamlead only**

- **Klanten uit Trello**: link Trello boards and labels to campaigns.
- **Toewijzing**: assign a recruiter and a Recruitment Marketeer per client, or mark a client inactive.
- **Trello-koppeling testen**: check the Trello setup against the conventions below.
- Editing the health rules.

**Everyone**: **Meldingen** (in-app notifications), **Wat is er nieuw** (changelog), **Bug of idee melden**
(report a bug or idea), and the **Databron** switch between demo data and live Trello data.

### Health rules

The defaults are below. The teamlead can switch each rule on or off and change its threshold in **Health-regels**.

| Status | When |
|---|---|
| **Actie nodig** | Any of: quality is 4 or lower · quality has dropped 2 weeks in a row · 2 or fewer new candidates this week · recruiter ticked *Bijsturing nodig* |
| **Monitoren** | No red rule applies, and any of: quality is 6 or lower · new candidates 30% or more below the average of the previous 3 weeks · no feedback yet this week |
| **Goed** | None of the above |

## Tech stack

- **Frontend:** React 18, built with Vite
- **Server:** Express 5 on Node.js 20+
- **Storage:** a single JSON file on disk (no database)
- **Hosting:** Render, set up by the Blueprint in `render.yaml`

## Getting started

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Local development needs no password (unless you set `APP_PASSWORD`) and stores
data in `./data`. Without Trello credentials the app runs on demo data.

To run it the way it runs in production:

```bash
npm run build
APP_PASSWORD=choose-something NODE_ENV=production npm start   # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Runs the API server on :3000 (restarts when `server/` changes) and the Vite dev server on :5173 |
| `npm run build` | Builds the frontend into `dist/` |
| `npm start` | Starts the server, which serves `dist/` and the API |
| `npm run preview` | Build, then start |

## Configuration

The server reads settings from environment variables. It does **not** load `.env` files, so set them in your
shell or in Render's **Environment** tab. `.env.example` lists them all.

| Variable | Needed | What it does |
|---|---|---|
| `APP_PASSWORD` | yes, in production | Team password for the login page. The server won't start in production without it. Changing it logs everyone out. |
| `SESSION_SECRET` | recommended | Signs login cookies. Without it, everyone is logged out on every restart. Render generates it automatically. |
| `TRELLO_KEY`, `TRELLO_TOKEN` | for live Trello data | Read-only Trello access. They stay on the server. The **Trello-koppeling testen** page explains how to create them. |
| `DATA_DIR` | yes, on Render | Folder for the data file. Default `./data`; on Render `/var/data` (the persistent disk). |
| `NODE_ENV` | in production | Set to `production` to require the password and use secure cookies. |
| `PORT` | no | Default `3000`. Render sets it automatically. |

## Deploy to Render

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and pick the repository. `render.yaml` sets up everything else.
3. When Render asks, enter `APP_PASSWORD`. You can leave `TRELLO_KEY` and `TRELLO_TOKEN` empty until Trello is
   connected.
4. Open the URL, log in, and share the password with the team.

The Blueprint uses the **Starter** plan with a 1 GB persistent disk (about $7/month in total) in the Frankfurt
region. The disk is what keeps the team's data: on the free plan, the data would be wiped on every deploy or
restart. Every push to the main branch deploys automatically.

## How data works

- Shared data (campaigns, feedback, rules, assignments, notifications, ideas) lives on the server in
  `DATA_DIR/campagnemonitor.json`. A dated copy is kept for each of the last 14 days as a safety net.
- The app sends only what changed (per campaign, per rule, ...), so two people saving at the same moment don't
  overwrite each other. Other people's changes appear within about 15 seconds, or right away when you switch back
  to the tab.
- Each browser remembers who you are (**Ingelogd als**), the chosen **Databron**, and which news you've read.
- The feedback week moves on automatically: the Monday round is about the week that just ended.
- `data/` is in `.gitignore`. Never commit it, because it holds the team's real data.

## Trello conventions

The monitor reads every board the Trello account can see. Each board is one client.

- **Lists** are recognised by name: `Nieuw`, `Contactpoging`, `Gescreend`, `Gesprek`, `Voorstel…`, `Aangenomen`,
  `Afgewezen`. Lists with `Informatie` in the name are ignored.
- **Labels** are job roles (vacancies). A board without labels can be linked as a whole.
- **Custom fields** (optional): `Sollicitatiedatum` (date; otherwise the card's creation date is used) and
  `Reden afgewezen` (dropdown).

The server only proxies a few read-only Trello endpoints, and it caches responses for 30 seconds. That way, when
several people open the app at once, they share a single Trello call.

## Security

- The whole site sits behind one team password. Logins are signed cookies that last 30 days.
- After 10 failed login attempts from one IP address, login is blocked for 15 minutes.
- The server rejects cross-site writes and sends a strict Content Security Policy. Search engines are told not to
  index the site.
- Trello credentials never reach the browser.

## Known limitations

- **Shared login.** After logging in with the team password, people choose who they are under **Ingelogd als**.
  The app doesn't check that choice, so anyone with the password can act as any team member.
- **Hard-coded team.** Team members are defined in `src/lib/constants.js` (`USERS`, `RECS`, `MKTS`) and in the
  dropdown in `src/views/Sidebar.jsx`. To add or rename someone, update both.
- **Reminders stay in the app.** They arrive under **Meldingen**; no email is sent yet.
- **One instance only.** Data is held in memory and written to one file, so don't scale the service to more
  than one instance.

## Project layout

```
server/
  index.js        Express app: security headers, routes, static files
  auth.js         team-password login and signed session cookies
  store.js        shared data in memory + JSON file with daily backups
  trello.js       read-only Trello proxy with a short cache
  login.html      login page
src/
  App.jsx         app logic (from the design); renderVals() feeds the views
  views/          one component per screen
  lib/            week math, demo data, health rules, sync with the server
  styles/         design tokens, app styles, fonts
public/           logo, favicon, self-hosted fonts
scripts/dev.js    runs the API server and Vite together
render.yaml       Render Blueprint
Campagnemonitor.html   original Claude Design export (reference only)
```

### Server endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Health check (no login needed) |
| GET, POST | `/login` | Login page and form |
| POST | `/logout` | Log out |
| GET | `/api/config` | Whether Trello and login are enabled |
| GET | `/api/state?rev=` | All shared data, or `unchanged` if `rev` is current |
| POST | `/api/state/patch` | Apply changes: `{ patches: [{ doc, set, del }] }` |
| GET | `/api/trello/…` | Read-only Trello proxy (`members/me`, `members/me/boards`, `boards/:id`) |
=======
# HT_Campangemonitor
>>>>>>> 0bc42ec3ed5939b3a83aa0abc6f77cdb952fd750
