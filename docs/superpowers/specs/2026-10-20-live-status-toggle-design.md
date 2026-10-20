# Live campagnes: "Ermee bezig" / "Done" toggle per restaurant

Date: 2026-10-20 · Status: approved in brainstorming, awaiting spec review

## Goal

Recruiters can see at a glance what each of them is working on, and update each other without texting. Each restaurant (client) on Live campagnes gets a toggle: nothing → **Ermee bezig** (orange) → **Done** (green). Anyone who looks at that recruiter's Live campagnes, for example someone helping with the workload, sees the change within a second. The colours use gradients so toggling feels rewarding ("a bit of dopamine").

## Decisions (made with the user)

| Topic | Decision |
|---|---|
| Scope of a status | One status per restaurant (Trello board; client name in demo mode). It covers the client row and every function row under it. |
| Reset | Every night at midnight. "Done" means done for today. |
| Who may toggle | Any logged-in account: recruiters, teamlead, Dev, Recruitment Marketeers and Account Managers, on any client. |
| Toggling from Bekijk als | Allowed. The pill shows the name of whoever actually clicked. The rest of Bekijk als stays read-only. |
| Reaching the screen | Account Managers and teamleads may use **Bekijk als** on recruiters (marketeers already can). |
| Real-time | Server push via Server-Sent Events: the server only says "rev N", and the app pulls through the existing route. The 15 s poll stays as a backup. |
| Left out | A header progress line ("2 van 6 klanten done"), reordering rows by status, notifications, checking that the call list is really empty before "Done". |

## 1. Data and rights

**New shared document `live.status`**, a flat map like the other `live.*` documents:

```js
// key: the Live campagnes group key, i.e. c.boardId || c.client
{ s: 'bezig' | 'done', by: 'Kim', at: 1792502520000 }   // at = epoch ms
```

- Switching back to nothing deletes the key.
- **Only today counts.** The app treats an entry as active only if `at` falls on today's date in the browser's local time (`new Date(at).toDateString() === new Date().toDateString()`). There is no midnight job. A stale entry is overwritten by the next toggle, so the document holds at most one entry per board.
- **Midnight while the screen is open.** While Live campagnes is open, the app schedules one re-render at the next local midnight, so rows turn neutral without waiting for a change.
- **Wiring:** add `live.status` to `DOCS` in [server/store.js](../../../server/store.js), and to `toDocs`/`fromDocs` in [src/lib/sync.js](../../../src/lib/sync.js) as `st.live.status`.

**Server rule** in [server/authorize.js](../../../server/authorize.js), with no right required:

- Delete: allowed.
- Set: allowed only when `after.s` is `'bezig'` or `'done'`. The server stores `{ s, by: actor.name, at: Date.now() }`, so the name and time can't be forged and don't depend on the browser's clock.
- Anything else: refused.
- Not written to the audit log (`auditPatch` only logs specific documents, and toggles aren't audit-worthy).

**Bekijk als:** in [src/lib/permissions.js](../../../src/lib/permissions.js), `VIEW_AS` gets `accountmanager: ['recruiter']` and `teamlead: ['recruiter']`. The server uses the same `canViewAs` for `/api/me`, so one change covers both sides. The current tests that say teamleads and AMs can't use Bekijk als ([test/rights.test.js:57-58](../../../test/rights.test.js)) change on purpose.

**Role text:** the Account Manager description becomes "Ziet de campagnes van alle klanten, maar wijzigt niets, behalve de status op Live campagnes. Kan vragen stellen over campagnes."

## 2. Instant updates

**Server: `GET /api/events`**, behind the existing `auth.guard` like every other `/api` route.

- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
- On connect it sends `retry: 5000` and the current `rev`.
- After every store change it sends `data: {"rev":N}` to every open stream. That covers patches and `mutate` from any route, not just toggles.
- A comment line (`: ping`) every 25 s keeps Render's proxy from closing idle streams.
- Closed connections are removed from the set.
- The store gets a small `onChange(fn)` hook, called after `rev` goes up in `patch` and `mutate`.
- The stream carries no data, only version numbers.
- Render only. The Netlify path gets no stream; the app falls back to polling there by itself.

**App ([src/lib/sync.js](../../../src/lib/sync.js)):**

- In `begin()`, server mode only: open `new EventSource('/api/events')`.
- On a message whose `rev` differs from `this.rev`, while the tab is visible, call `this.pull()`. It goes through the same rights-checked `/api/state`, and local unsaved edits are still pushed first.
- `stop()` closes the stream. The browser reconnects on its own after a drop.
- The 15 s poll stays unchanged as the backup.
- The person who clicked also gets the push, so their screen picks up the server-stamped `by`/`at` within a second.
- Side effect: every shared change (feedback, assignments, notifications) now reaches other screens in under a second.
- Cost: each change makes every open app download the shared state once (~70 KB today). That's fine for a team this size.

**Static demo mode:** no server and no stream. The status lives in that browser's localStorage, like the rest of the demo data.

## 3. UI

Changes go in [src/views/LiveView.jsx](../../../src/views/LiveView.jsx), `liveData()` in [src/App.jsx](../../../src/App.jsx), and [src/styles/app.css](../../../src/styles/app.css).

**Status column.** A new last column on client rows holds a pill `<button>` with an `aria-label`. The header reads "Status".

| State | Pill | Click goes to |
|---|---|---|
| none | outlined "Oppakken" | Ermee bezig |
| bezig | orange gradient "● Ermee bezig · Kim 10:42" | Done |
| done | green gradient "✓ Done · Kim 11:30" | none (deletes the key) |

- The pill shows `by` and `at` (HH:MM) from the entry.
- `stopPropagation` keeps the pill from opening or folding the row; clicking the row still does that, as before.
- Function rows get no pill: the status belongs to the restaurant.

**The umbrella colouring.** The colour goes on the client wrapper (the `div` that holds the client row and its function rows) through a class `live-st-bezig` / `live-st-done`.

| Element | Orange (Ermee bezig) | Green (Done) |
|---|---|---|
| Client row background, `linear-gradient(90deg, …)` | `#FFE2BD → #FFF3E2 → #FFFDF9` | `#C9EED8 → #E8F7EE → #FBFEFC` |
| 4px left accent bar, through the client row and every function row | `#F9CE00 → #FB8915` | `#3CC27F → #1A7A4A` |
| Function rows (replacing `#FAF8F5`) | `#FFF7EC` | `#F1FAF5` |
| Pill | gradient `#F9CE00 → #FB8915`, dark text `#1D1D1B` (≥ 7:1) | gradient `#1C8450 → #14603A`, white text (≥ 4.7:1) |

- **Hover:** `.hov-row:hover` sets `background: #FDFBF8 !important`, which would wipe the gradient. Status rows get their own slightly deeper hover instead.
- **Phone (≤640px):** the pill gets its own full-width grid area in the `.live-row` card layout.

**Animation.** It plays when an entry's `s` changes while the screen is open, whoever made the change, including pushed changes. It doesn't play on first load.

- The gradient sweeps in from the left (~400 ms, background-size/position).
- The pill pops (scale 1 → 1.06 → 1).
- Done also gets a check-mark bounce.
- Going back to none has no sweep; the row just returns to white.
- Under `prefers-reduced-motion: reduce`, colours switch with no animation.

**Legend.** The line under the table gets one more item: orange = ermee bezig, green = done vandaag, resets at midnight.

## 4. Testing

- **Unit:** a small pure module, e.g. `src/lib/liveStatus.js`, with `statusToday(entry, now)`, `nextStatus(s)` and `msToMidnight(now)`, tested just before and after midnight, with a missing entry, and through the full cycle.
- **Rights ([test/rights.test.js](../../../test/rights.test.js)):**
  - Each role (recruiter, marketeer, AM, teamlead, Dev) can set and clear a status.
  - Values other than `bezig`/`done` are refused.
  - The server overwrites `by`/`at`.
  - AMs and teamleads can use Bekijk als on recruiters but not on marketeers; recruiters still can't on marketeers.
- **Server ([test/server.test.js](../../../test/server.test.js)):**
  - `/api/events` without login is refused.
  - With login, a patch sends the new `rev` on the stream.
  - `/api/state` returns the stamped `live.status` entry.
- **Visual:** two logged-in Playwright contexts on the local server (see the ui-verification notes). One toggles; the other, on Bekijk als for the same recruiter, turns orange within ~1 s. Screenshots: orange and green, folded open and closed, desktop and phone width.

## Assumptions not yet confirmed by the client

- "Done" is per day and not tied to the call list being empty.
- The neutral pill text "Oppakken".
- AMs and teamleads seeing a recruiter's other screens (Wekelijkse feedback recruiter, Mijn campagnes) through Bekijk als.
