// Campagnemonitor — app logic. Ported from the Claude Design prototype: renderVals() computes everything the
// views show; the views in ./views are plain markup. Shared data is kept in sync with the server by ./lib/sync.js.
import React from 'react';
import { CUR, FB_START, MON, wl, range, rangeLong, todayLong, stamp, isoDate, mondayOf, feedbackWeek, fbOpenWeek, fbLastDay } from './lib/weeks.js';
import { checkinQueue, openWeeks, needsFeedback, openByRecruiter } from './lib/checkin.js';
import {
  RENAME, STAT, MONITOR, MONITOR_KEYS, HALT, REMIND_GAP_MS, DEF_RULES, TR_EXTRA, TR_INACTIVE, MON_FIELDS,
  NEWS, IDEA_TYPES, IDEA_STATUS, VIEW_NAMES, ACT_TYPES, HISTORY_ENABLED
} from './lib/constants.js';
import { boardStats, boardFunctions, liveCampaigns, linkKey } from './lib/boardStats.js';
import { groupByClient, callList, recruiterSees, trelloCreated, LIVE_SORTS } from './lib/clientGroups.js';
import { statusToday, nextStatus, msToMidnight } from './lib/liveStatus.js';
import { startHalt, waitsForAds, haltLabel, haltLine } from './lib/halt.js';
import { ofPeople, pickPerson, NOBODY } from './lib/assignFilter.js';
import { clientFunctions, isOpen, newFns, addWith } from './lib/assignFunctions.js';
import { matchesQ } from './lib/queueSearch.js';
import { qc, qb, nl, avgOf, sgn, reasonList, agoTxt, daysTxt, lsGet, lsSet, rnd, health, monitor } from './lib/helpers.js';
import { monFields, ctlText, ctlDate, ctlDays, dayShort, CTL_MAX } from './lib/controle.js';
import { build, ensureReasons, rollForward, seedAssign } from './lib/demoData.js';
import { Sync, fromDocs } from './lib/sync.js';
import { ROLES, LEVELS, RIGHT_KEYS, canViewAs, visibleCampaigns } from './lib/permissions.js';
import { api } from './lib/api.js';
import { ActivityMeter, groupOf, MAX_SEND_SEC } from './lib/activity.js';

import Sidebar from './views/Sidebar.jsx';
import MobileBar from './views/MobileBar.jsx';
import TopActions from './views/TopActions.jsx';
import WeekView from './views/WeekView.jsx';
import CampaignsView from './views/CampaignsView.jsx';
import CheckinView from './views/CheckinView.jsx';
import LiveView from './views/LiveView.jsx';
import TrelloTestView from './views/TrelloTestView.jsx';
import AssignView from './views/AssignView.jsx';
import KlantView from './views/KlantView.jsx';
import DetailView from './views/DetailView.jsx';
import HistoryView from './views/HistoryView.jsx';
import RulesView from './views/RulesView.jsx';
import BlacklistView from './views/BlacklistView.jsx';
import SidePanel from './views/SidePanel.jsx';
import SettingsView from './views/settings/SettingsView.jsx';
import DevView from './views/DevView.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import CtlDialog from './components/CtlDialog.jsx';

// Per-browser settings (chosen data source, news read, "Bekijk als")
const SRC_KEY = 'ht-cm-source', NEWS_KEY = 'ht-cm-news-seen', VIEW_AS_KEY = 'ht-cm-view-as', ACTIE_VIEW_KEY = 'ht-cm-actie-view', LIVE_SORT_KEY = 'ht-cm-live-sort', FB_BAR_KEY = 'ht-cm-fb-bar';
// Below this width the sidebar is a slide-in menu (keep in sync with the media query in styles/app.css).
const PHONE_MQ = '(max-width: 900px)';
// How often the open app loads the Trello boards that changed (as the server does, see server/trello.js).
const REFRESH_MS = 5 * 60000;
// Without a server (the built files opened as a static site) there are no accounts: everything is allowed.
const LOCAL_ACCOUNT = { id: 'local', name: 'Lokaal', role: 'dev', recName: null, level: 'owner', rights: RIGHT_KEYS, grants: [], revokes: [] };
const prepCampaigns = cs => rollForward(cs.map(c => RENAME[c.rec] ? { ...c, rec: RENAME[c.rec] } : c).map(ensureReasons));
// When a reminder was sent; older ones only have their id (Date.now() + name).
const sentAt = n => n.ts ?? (parseFloat(String(n.id)) || 0);
/** "zondag 25 oktober": the last day to give feedback on week w. */
const dueTxt = w => todayLong(fbLastDay(w)).toLowerCase();
const DAY_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
/** "wo 4 okt 10:12" */
const when = ts => { const d = new Date(ts); return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const names = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} en ${a[a.length - 1]}` : a.join('');
/** "2 nieuwe campagnes op Pauze tot de ads live staan": new campaigns start on Pauze (lib/halt.js startHalt). */
const pausedText = n => `${n} nieuwe ${n === 1 ? 'campagne' : 'campagnes'} op Pauze tot de ads live staan`;

class TrelloError extends Error {}

export default class App extends React.Component {
  static defaultProps = { startView: 'week', showTrello: true };
  state = this.initState();

  initState() {
    return {
      loaded: false, saveState: 'ok', config: { trello: false, auth: false },
      account: null, members: [], viewAs: null, settingsTab: 'account',
      view: this.props.startView || 'week', sel: 'c1', back: 'week', kform: null, kQ: '', navOpen: false,
      campaigns: null, rules: { ...DEF_RULES },
      f: { q: '', status: 'all', sort: 'status', mineSort: 'leadsMost' },
      ci: { rec: 'all' }, ciKeep: [], ciQ: '', form: null,
      hist: { status: 'all', rec: 'all', period: '12' },
      act: { type: 'Advertentie', text: '', w: CUR, ctl: '' }, ask: { to: '', text: '' }, reply: null, upd: null, fbBar: lsGet(FB_BAR_KEY, false),
      toast: null, asg: { tab: 'open', q: '', sel: {}, rec: '', mkt: '', exp: {}, who: NOBODY }, liveExp: {}, mktDemo: null, seen: null, panel: null,
      assignLog: null, inbox: null, ideas: null, newsSeen: lsGet(NEWS_KEY, 0), idea: { type: 'bug', text: '', filter: 'all' }, trShowInactive: false,
      source: lsGet(SRC_KEY, null), live: null, boardList: null, boardData: {}, sync: { state: 'idle' }, demoCampaigns: null, trIgnored: null, meta: null,
      blSum: null, actieView: lsGet(ACTIE_VIEW_KEY, 'cards'), liveSort: lsGet(LIVE_SORT_KEY, LIVE_SORTS[0][0]), confirm: null, ctlDlg: null
    };
  }

  // ── Loading & syncing ────────────────────────────────────────────────
  async componentDidMount() {
    this._hashOpen = this.hashId();
    // The link in the mail about a new bug or idea; read now, as the address bar is reset once the app is loaded.
    this._ideasLink = window.location.hash === '#ideeen';
    // A link typed or pasted into the address bar. Back and forward between the app's own steps is handled by popstate.
    this._hash = () => { if (window.history.state && window.history.state.nav) return; this._nav = null; this._hashOpen = this.hashId(); this.openPending(); };
    window.addEventListener('hashchange', this._hash);
    // The browser's Back and Forward buttons move between the app's screens (see syncHistory).
    this._pop = e => { if (e.state && e.state.nav) this.restoreNav(e.state.nav); };
    window.addEventListener('popstate', this._pop);
    window.history.scrollRestoration = 'manual';
    this._y = window.scrollY;
    this._scroll = () => { this._y = window.scrollY; clearTimeout(this._yT); this._yT = setTimeout(() => this.stampY(), 250); };
    window.addEventListener('scroll', this._scroll, { passive: true });
    this._k = e => {
      if (e.key === 'Escape' && this.state.navOpen) { this.setState({ navOpen: false }); return; }
      if (this.state.view === 'klant' && this.state.kform && (e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); this.saveKlant(); return; }
      if (this.state.view !== 'checkin' || !this.state.form) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); this.saveForm(); return; }
      const t = e.target.tagName;
      if (t === 'TEXTAREA' || t === 'INPUT' || t === 'SELECT') return;
      if (/^[0-9]$/.test(e.key)) this.setForm({ q: e.key === '0' ? 10 : +e.key, err: false });
    };
    window.addEventListener('keydown', this._k);
    this._mq = window.matchMedia(PHONE_MQ);
    this._mqFn = e => { if (!e.matches && this.state.navOpen) this.setState({ navOpen: false }); };
    this._mq.addEventListener('change', this._mqFn);

    this.sync = new Sync({
      getState: () => this.state, apply: (docs, done) => this.applyShared(docs, done), onStatus: s => this.setState({ saveState: s }),
      onRejected: () => { if (Date.now() - (this._rejAt || 0) > 10000) { this._rejAt = Date.now(); this.flash('Niet opgeslagen: daar heb je geen rechten voor'); } }
    });
    let docs, who, snap;
    try { docs = await this.sync.start(); if (docs) [who, snap] = await Promise.all([this.sync.me(), this.loadSnapshot()]); } catch (e) { this.setState({ bootError: e.serverMessage || 'De server is niet bereikbaar. Probeer het zo opnieuw.' }); return; }
    if (!docs) return; // redirected to login
    this._quick = (snap && snap.boards) || {};
    const account = who ? who.account : LOCAL_ACCOUNT, members = who ? who.members : [];
    const va = lsGet(VIEW_AS_KEY, null), viewAs = members.some(m => m.id === va && m.rights && canViewAs(account, m)) ? va : null;
    const sh = fromDocs(docs), cfg = this.sync.config;
    const meta = sh.meta || {};
    this._nBl = sh.inbox.filter(n => n.kind === 'blacklist').length;
    let campaigns = sh.campaigns, assignLog = sh.assignLog;
    if (!meta.seeded) {
      if (!campaigns.length) campaigns = build();
      if (!assignLog.length) assignLog = seedAssign();
    }
    campaigns = prepCampaigns(campaigns);
    // Only the dev right can switch to demo data; everyone else always works on Trello (also when an old choice is stored).
    const source = account.rights.includes('dev') ? this.state.source || (cfg.trello ? 'trello' : 'demo') : 'trello';
    // On Trello the campaigns start from the snapshot: numbers right away, the full boards follow (startLive).
    if (source === 'trello') this._skipSync = true;
    this.setState({
      account, members, viewAs,
      loaded: true, config: cfg, source, rules: sh.rules, trIgnored: sh.trIgnored, mktDemo: sh.mktDemo, live: sh.live,
      assignLog, inbox: sh.inbox, ideas: sh.ideas, seen: sh.seen, meta: { ...meta, seeded: true },
      ...(source === 'trello' ? { demoCampaigns: campaigns, campaigns: this.liveCampaigns(sh.live) } : { campaigns })
    }, () => {
      // The link in the mails about bugs and ideas (/#ideeen) opens the board for the Dev, the panel for everyone else.
      const me = this.me(), home = this.homeView(me), dev = account.rights.includes('dev');
      this._navOn = true; // from the first real screen on, screen switches are steps in the browser history
      this.setState({ view: this._ideasLink && dev ? 'dev' : home, back: home, ci: { rec: me.rec || 'all' }, ...(this._ideasLink && !dev ? { panel: 'idea' } : {}) }, () => this.openPending());
      this.sync.begin();
      this.touchLogin(account.id);
      this.loadBlSummary();
      this.startMeter();
      this._seenTimer = setInterval(() => this.setState(s => { const id = s.account.id, mine = s.seen[id]; return mine ? { seen: { ...s.seen, [id]: { ...mine, last: Date.now() } } } : null; }), 60000);
      if (this.state.view === 'checkin') this.enterCheckin();
      if (this.state.view === 'klant') this.enterKlant();
      if (this.state.source === 'trello') this.startLive();
      this._trTimer = setInterval(() => this.refreshLive(), REFRESH_MS);
      this.atMidnight();
    });
  }

  /** Ermee bezig / Done only counts on the day it was set: redraw at midnight, so the colours go without a change. */
  atMidnight() { this._midT = setTimeout(() => { this.forceUpdate(); this.atMidnight(); }, msToMidnight() + 500); }

  /** Other people's changes arrive here (see lib/sync.js). */
  applyShared(docs, done) {
    const sh = fromDocs(docs), campaigns = prepCampaigns(sh.campaigns);
    this.setState(s => ({
      rules: sh.rules, trIgnored: sh.trIgnored, mktDemo: sh.mktDemo, live: sh.live, assignLog: sh.assignLog, inbox: sh.inbox, ideas: sh.ideas, seen: sh.seen, meta: { ...sh.meta, seeded: true },
      ...(s.source === 'trello' ? { demoCampaigns: campaigns } : { campaigns })
    }), () => {
      done();
      if (this.state.source === 'trello') this.rebuildLive();
      else if (this.state.view === 'checkin' && !this.state.form) this.enterCheckin();
      // A blacklist notification means a proposal came in or was decided on: the count in the menu changed.
      const nBl = sh.inbox.filter(n => n.kind === 'blacklist').length;
      if (nBl !== this._nBl) { this._nBl = nBl; this.loadBlSummary(); }
    });
  }

  /** How many candidates are on the blacklist and how many proposals wait (for the menu). BlacklistView loads the list itself. */
  loadBlSummary() {
    const r = this.state.account.rights;
    if (this.sync.mode === 'local' || !(r.includes('blacklist.view') || r.includes('blacklist.manage'))) return;
    api('GET', '/api/blacklist/summary').then(s => this.setState({ blSum: s }), () => {});
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.navOpen !== this.state.navOpen) this.navChanged();
    if (!this.state.loaded) return;
    if (!this.viewOk(this.state.view)) { this._navReplace = true; this.setState({ view: this.homeView() }); return; }
    this.syncLive();
    this.sync.changed();
    this.syncHistory();
    this.meterTick();
  }

  componentWillUnmount() { window.removeEventListener('hashchange', this._hash); window.removeEventListener('popstate', this._pop); window.removeEventListener('scroll', this._scroll); clearTimeout(this._yT); window.removeEventListener('keydown', this._k); this._mq.removeEventListener('change', this._mqFn); document.body.classList.remove('nav-locked'); clearInterval(this._seenTimer); clearInterval(this._trTimer); clearTimeout(this._midT); this.stopMeter(); if (this.sync) this.sync.stop(); }

  /** Phone menu opened or closed: lock the page behind it and move focus into / out of it. */
  navChanged() {
    const open = this.state.navOpen;
    document.body.classList.toggle('nav-locked', open);
    if (open) { const b = document.querySelector('.nav-close'); if (b) b.focus(); }
    else if (document.querySelector('.app-aside').contains(document.activeElement)) { const b = document.querySelector('.nav-toggle'); if (b) b.focus(); }
  }

  // ── Time in the app (Tijdwinst) ──────────────────────────────────────
  /** Counts active time per kind of screen (lib/activity.js) and sends it every few minutes, without who it was. */
  startMeter() {
    if (this.sync.mode === 'local') return;
    const meter = this.meter = new ActivityMeter(), poke = () => meter.interact(Date.now());
    this._meterEvents = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart'];
    for (const e of this._meterEvents) window.addEventListener(e, poke, { capture: true, passive: true });
    this._meterPoke = poke;
    this._meterLeave = () => { this.meterTick(); if (document.visibilityState === 'hidden') this.sendTime(true); };
    document.addEventListener('visibilitychange', this._meterLeave);
    window.addEventListener('pagehide', this._meterLeave);
    this._meterTimers = [setInterval(() => this.meterTick(), 5000), setInterval(() => this.sendTime(), 5 * 60000)];
    this.meterTick();
  }
  stopMeter() {
    if (!this.meter) return;
    for (const e of this._meterEvents) window.removeEventListener(e, this._meterPoke, { capture: true });
    document.removeEventListener('visibilitychange', this._meterLeave);
    window.removeEventListener('pagehide', this._meterLeave);
    this._meterTimers.forEach(clearInterval);
  }
  /** Only real work counts: the tab is visible, on Trello data, and not in "Bekijk als". */
  meterTick() {
    if (!this.meter) return;
    const st = this.state, on = document.visibilityState === 'visible' && st.source === 'trello' && !this.me().isPreview;
    this.meter.tick(Date.now(), on ? groupOf(st.view) : null);
  }
  sendTime(leaving = false) {
    const seconds = this.meter.take(MAX_SEND_SEC);
    if (!Object.keys(seconds).length) return;
    fetch('/api/timing', { method: 'POST', credentials: 'same-origin', keepalive: leaving, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seconds }) })
      .then(r => { if (r.status >= 500) this.meter.giveBack(seconds); }, () => this.meter.giveBack(seconds));
  }

  // ── Trello ───────────────────────────────────────────────────────────
  /** Trello data via the server, which also decides which fields are fetched. */
  async tget(path) {
    let r;
    try { r = await fetch(`/api/trello${path}`, { credentials: 'same-origin' }); } catch (e) { throw new TrelloError('Kon de server niet bereiken.'); }
    if (r.status === 401) { window.location.href = '/login'; throw new TrelloError('Sessie verlopen.'); }
    if (r.status === 429) { await new Promise(res => setTimeout(res, 2000)); return this.tget(path); }
    if (r.ok) return r.json();
    const body = await r.json().catch(() => ({}));
    if (body.error === 'trello_unauthorized') throw new TrelloError('Trello-token ongeldig of verlopen. Stel een nieuw token in onder Instellingen › Integraties.');
    if (body.error === 'trello_not_configured') throw new TrelloError('Trello is nog niet gekoppeld (Instellingen › Integraties).');
    if (body.error === 'trello_unreachable') throw new TrelloError('Kon Trello niet bereiken.');
    throw new TrelloError(`Trello gaf een fout (${body.status || r.status}).`);
  }
  /**
   * The home-screen numbers of the last Trello load, by anyone (server/trelloSnapshot.js): shown right after login,
   * until the full boards are in. Without it the app just waits for the boards, as before.
   */
  loadSnapshot() {
    if (this.sync.mode !== 'server' || !this.sync.config.trello) return null;
    return api('GET', '/api/trello/snapshot').catch(() => null);
  }
  async startLive() {
    if (!this.state.config.trello) { this.setState({ sync: { state: 'nocred' } }); return; }
    this._bd = this._bd || {}; this._st = this._st || {}; this._seen = this._seen || {};
    const run = (this._run || 0) + 1; this._run = run;
    this.setState({ sync: { state: 'loading', done: 0, total: 0 } });
    try {
      const boards = await this.tget('/members/me/boards');
      if (this._run !== run) return;
      const todo = this.liveTodo(boards);
      this.setState({ boardList: boards, sync: { state: 'loading', done: 0, total: todo.length } });
      await this.loadBoards(todo, run);
      if (this._run !== run) return;
      this.setState({ boardData: { ...this._bd }, sync: { state: 'ok', at: new Date() } }, () => this.rebuildLive());
    } catch (e) { this.setState({ sync: { state: 'error', msg: e.message } }); }
  }
  /** The boards the app loads: the linked ones and the ones active in the last 30 days, linked first. */
  liveTodo(boards) {
    const lim = Date.now() - 30 * 864e5, linked = new Set(this.state.live.links.map(l => l.boardId));
    return boards.filter(b => linked.has(b.id) || new Date(b.dateLastActivity).getTime() >= lim).sort((a, b) => linked.has(b.id) - linked.has(a.id));
  }
  /** Loads boards (from the list of boards). quiet: in the background, without "Trello laden…". */
  async loadBoards(list, run, quiet = false) {
    let i = 0, n = 0; const total = list.length;
    const worker = async () => {
      while (i < list.length) {
        if (this._run !== run) return;
        const b = list[i++];
        try { const bd = await this.tget(`/boards/${b.id}`); this._bd[b.id] = bd; this._seen[b.id] = { activity: b.dateLastActivity, at: Date.now() }; }
        catch (e) { if (!quiet || !this._bd[b.id] || this._bd[b.id].error) this._bd[b.id] = { error: e.message }; }
        n++;
        if (n % 6 === 0 || n === total) this.setState({ boardData: { ...this._bd }, ...(quiet ? {} : { sync: { state: 'loading', done: n, total } }) }, () => this.rebuildLive());
        await new Promise(r => setTimeout(r, 180));
      }
    };
    await Promise.all([worker(), worker()]);
  }
  /**
   * Every 5 minutes while the app is open and visible: the boards Trello reports changed since the app loaded them,
   * or loaded over an hour ago. The server answers unchanged boards from memory (server/trello.js). After an error
   * it tries the whole load again.
   */
  async refreshLive() {
    const st = this.state, s = st.sync || {};
    if (document.hidden || st.source !== 'trello' || !st.config.trello || s.state === 'loading' || s.state === 'nocred') return;
    if (s.state === 'error' || !st.boardList) { this.startLive(); return; }
    const run = this._run;
    try {
      const boards = await this.tget('/members/me/boards'), hour = Date.now() - 36e5;
      if (this._run !== run) return;
      const todo = this.liveTodo(boards).filter(b => { const x = this._seen[b.id]; return !x || x.activity !== b.dateLastActivity || x.at < hour; });
      this.setState({ boardList: boards });
      if (todo.length) await this.loadBoards(todo, run, true);
      if (this._run !== run) return;
      this.setState({ boardData: { ...this._bd }, sync: { state: 'ok', at: new Date() } }, () => this.rebuildLive());
    } catch (e) { /* keeps the numbers it has; the next round tries again */ }
  }
  async loadInactive() {
    if (!this.state.boardList || !this._bd) return;
    const lim = Date.now() - 30 * 864e5;
    const list = this.state.boardList.filter(b => !this._bd[b.id] && new Date(b.dateLastActivity).getTime() < lim);
    if (!list.length) return;
    const run = this._run;
    await this.loadBoards(list, run);
    if (this._run === run) this.setState({ sync: { state: 'ok', at: new Date() } });
  }
  /** The campaigns of the Trello links, from the full boards or the snapshot (lib/boardStats.js). */
  liveCampaigns(L = this.state.live) { return liveCampaigns(L, this.boardNumbers(L), this._quick || {}); }
  /**
   * boardStats of every loaded board, counted with its Trello links (they decide which campaigns were moved to an
   * intake list and which labels still count). Counted again when the board or those links change.
   */
  boardNumbers(L) {
    const st = this._st || (this._st = {}), by = {}, out = {};
    L.links.forEach(k => { (by[k.boardId] = by[k.boardId] || []).push(k); });
    for (const [id, bd] of Object.entries(this._bd || {})) {
      const links = by[id] || [], sig = links.map(k => `${linkKey(k)}>${k.joinList || ''}`).sort().join();
      if (bd.cards && (!st[id] || st[id].bd !== bd || st[id].sig !== sig)) st[id] = { bd, sig, s: boardStats(bd, Date.now(), links) };
      if (st[id]) out[id] = st[id].s;
    }
    return out;
  }
  rebuildLive() {
    if (this.state.source !== 'trello') return;
    this._skipSync = true;
    this.setState({ campaigns: this.liveCampaigns() }, () => { if (this.state.view === 'checkin' && !this.state.form) this.enterCheckin(); this.openPending(); });
  }
  /** In Trello mode, feedback typed into the (derived) campaigns is written back to live.fb / live.actions. */
  syncLive() {
    const st = this.state;
    if (this._lastCamps === st.campaigns) return;
    this._lastCamps = st.campaigns;
    if (st.source !== 'trello') return;
    if (this._skipSync) { this._skipSync = false; return; }
    const fb = { ...st.live.fb }, actions = { ...st.live.actions };
    st.campaigns.forEach(c => {
      const o = {};
      c.weeks.forEach(w => {
        const e = {};
        if (w.q != null) e.q = w.q; if (w.rec) e.rec = w.rec; if (w.klant) e.klant = w.klant; if (w.note) e.note = w.note;
        if (w.needsAction) e.needsAction = true; if (w.leads !== w.tr.nieuw) e.leads = w.leads; if (w.at) e.at = w.at;
        if (w.recBy) e.recBy = w.recBy; if (w.klantBy) e.klantBy = w.klantBy;
        MON_FIELDS.forEach(k => { if (w[k] !== undefined) e[k] = w[k]; });
        if (Object.keys(e).length) o[w.w] = e;
      });
      fb[c.id] = o; actions[c.id] = c.actions;
    });
    this.setState({ live: { ...st.live, fb, actions } });
  }
  setSource(src) {
    if (src === this.state.source) return;
    lsSet(SRC_KEY, src);
    if (src === 'trello') {
      this.setState(s => ({ source: 'trello', demoCampaigns: s.campaigns, campaigns: [], form: null, kform: null, view: s.view === 'detail' ? s.back : s.view }), () => { this.rebuildLive(); if (!this.state.boardList) this.startLive(); });
    } else {
      this.setState(s => ({ source: 'demo', campaigns: s.demoCampaigns || build(), form: null, kform: null, view: s.view === 'detail' ? s.back : s.view }), () => { if (this.state.view === 'checkin') this.enterCheckin(); });
    }
  }
  syncInfo() {
    const st = this.state, s = st.sync || {};
    if (st.source !== 'trello') return { text: 'Demo-data', dot: '#C0BDB9' };
    if (s.state === 'nocred') return { text: 'Niet verbonden met Trello', dot: '#D32F2F' };
    if (s.state === 'error') return { text: 'Trello-fout · opnieuw proberen', dot: '#D32F2F' };
    // Numbers from the snapshot: say from when (the oldest board shown; a time today, else the day) while the boards come in.
    const quick = st.campaigns.filter(c => c.quick).map(c => (this._quick[c.boardId] || {}).at).filter(Boolean);
    if (s.state === 'loading' && quick.length) {
      const t = new Date(Math.min(...quick)), today = t.toDateString() === new Date().toDateString();
      return { text: `Stand ${today ? `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` : `${t.getDate()} ${MON[t.getMonth()]}`} · bijwerken…`, dot: '#F9A800' };
    }
    if (s.state === 'loading') return { text: s.total ? `Trello laden… ${s.done}/${s.total}` : 'Trello verbinden…', dot: '#F9A800' };
    if (s.state === 'ok') { const t = s.at; return { text: `Trello bijgewerkt ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`, dot: '#1A7A4A' }; }
    return { text: 'Trello', dot: '#C0BDB9' };
  }

  // ── Toewijzing ───────────────────────────────────────────────────────
  // Every Trello board is a client and every function on it (an intake list "Nieuwe Sollicitant | Kok" or a label, see
  // lib/boardStats.js) has its own campaign (its own recruiter and client feedback). The recruiter and Recruitment Marketeer are chosen per client and cover all its functions.
  // New boards and new functions show up here by themselves; tick several clients to assign them at once.
  /** Recruiter names (as used in campaigns) and marketeer names, from the team's accounts. */
  recs() {
    const m = this.state.members.filter(x => x.recName && x.status !== 'deactivated').map(x => x.recName);
    return m.length ? m : [...new Set((this.state.campaigns || []).map(c => c.rec).filter(Boolean))];
  }
  mkts() {
    const m = this.state.members.filter(x => x.role === 'marketeer' && x.status !== 'deactivated').map(x => x.name);
    return m.length ? m : [...new Set(Object.values(this.state.mktDemo || {}))];
  }
  mktOf(c) { const M = this.mkts(); return this.state.source === 'trello' ? ((this.state.live.mkt || {})[c.boardId] || '') : (this.state.mktDemo[c.client] ?? (M[Math.floor(rnd(c.client) * M.length)] || '')); }
  /** The campaigns of cs in Weekoverzicht, Campagnes and Feedback klant: a Recruitment Marketeer only sees their own clients. */
  visible(cs, me = this.me()) { return visibleCampaigns(cs, me, c => this.mktOf(c)); }
  /** The functions on a loaded Trello board with its links (lib/boardStats.js). null while the board is loading. */
  boardFns(bd, links) { return bd && bd.cards ? boardFunctions(bd, links) : null; }
  /**
   * The clients in Toewijzing, each with its functions (fns, see lib/assignFunctions.js): a campaign ('linked'; noCol
   * when it misses its intake list), a function that has no campaign yet ('pending': it gets one with the client's
   * recruiter) or one set to Geen functie ('ignored'). rec is a recruiter, '' (none yet), '__multi' (older links with
   * different recruiters) or '__inactive'. whole: one campaign for the whole board (a board without functions, or
   * linked that way earlier), with split: the functions it could be split into. cols: the board has intake lists,
   * moveTo: the ones a campaign can be moved to. Quiet: not linked and no activity in 30 days, only shown on request.
   */
  assignItems() {
    const st = this.state, lim = Date.now() - 30 * 864e5;
    const recOf = (recs, inactive) => inactive ? '__inactive' : recs.length === 1 ? recs[0] : recs.length ? '__multi' : '';
    if (st.source === 'trello') {
      const L = st.live, by = {}, mk = L.mkt || {}, ina = L.inactive || {};
      L.links.forEach(k => { (by[k.boardId] = by[k.boardId] || []).push(k); });
      return st.boardList.map(b => {
        const links = by[b.id] || [], recs = [...new Set(links.map(k => k.rec))], ts = new Date(b.dateLastActivity).getTime(), linked = links.length > 0;
        const fns = this.boardFns(st.boardData[b.id], links);
        return { key: b.id, board: b, name: b.name, ts, last: agoTxt(b.dateLastActivity), linked, recs, ign: !!L.ignored[b.id], quiet: !linked && ts < lim, loaded: !!fns,
          ...clientFunctions(b.id, links, fns, L.ignored), rec: recOf(recs, ina[b.id]), mkt: mk[b.id] || '' };
      });
    }
    // Demo: the clients of the demo campaigns, plus labels "found in Trello": new functions, new boards and boards
    // without activity.
    const by = {}, found = {};
    st.campaigns.filter(c => !c.ended || c.inactive).forEach(c => { (by[c.client] = by[c.client] || []).push(c); });
    TR_EXTRA.forEach(x => { (found[x.board] = found[x.board] || { labels: [], days: 0 }).labels.push({ name: x.label, cards: x.cards }); });
    TR_INACTIVE.forEach(([board, labels, days]) => { if (!found[board]) found[board] = { labels: labels.map(name => ({ name, cards: 0 })), days }; });
    return [...new Set([...Object.keys(by), ...Object.keys(found)])].map(name => {
      const cs = by[name] || [], f = found[name] || { labels: [], days: 0 }, linked = cs.length > 0, recs = [...new Set(cs.map(c => c.rec))];
      const fns = [...cs.map(c => ({ key: c.id, name: c.vac, kind: 'linked', campaign: c, halt: c.halt })),
        ...f.labels.filter(l => !cs.some(c => c.vac === l.name)).map(l => ({ key: name + '|' + l.name, name: l.name, cards: l.cards, kind: st.trIgnored[name + '|' + l.name] ? 'ignored' : 'pending' }))];
      return { key: name, name, ts: linked ? 0 : -f.days, last: linked ? `${cs.length} ${cs.length === 1 ? 'campagne' : 'campagnes'}` : f.days ? daysTxt(f.days) : 'vandaag gevonden',
        linked, recs, ign: !linked && !!st.trIgnored[name], quiet: !linked && f.days > 30, loaded: true, whole: false, fns, split: [],
        rec: recOf(recs, cs.some(c => c.inactive)), mkt: linked ? this.mktOf(cs[0]) : st.mktDemo[name] || '' };
    });
  }
  assignData() {
    const st = this.state, A = st.asg, live = st.source === 'trello', sync = st.sync || {}, si = this.syncInfo();
    const head = { syncText: si.text, syncDot: si.dot };
    if (live && !st.boardList) {
      return { ...head, ready: false, open: 0, hasNotice: true, noticeLink: sync.state === 'nocred' || sync.state === 'error',
        notice: sync.state === 'nocred' ? 'Nog niet verbonden met Trello. Verbind eerst via de testpagina, daarna komen de borden hier vanzelf.' : sync.state === 'error' ? sync.msg : 'Borden laden uit Trello…' };
    }
    const all = this.assignItems(), items = all.filter(x => !x.ign), current = items.filter(x => !x.quiet), ignored = all.filter(x => x.ign);
    const vis = st.trShowInactive ? items : current, quiet = items.length - current.length;
    const pendingOf = x => x.fns.filter(f => f.kind === 'pending');
    // Open (lib/assignFunctions.js): no recruiter or marketeer yet, a function without a campaign, or a campaign that
    // misses its intake list. Niet actief counts as a recruiter choice.
    const open = current.filter(isOpen).length;
    // A recruiter and/or marketeer picked in the pills (lib/assignFilter.js) narrows the tabs and their counts too.
    const q = A.q.trim().toLowerCase(), who = A.who, mine = x => ofPeople(x, who), byWho = !!(who.rec || who.mkt), nMine = vis.filter(mine).length;
    const nameOf = v => v === '__inactive' ? 'Niet actief' : v, whoText = [who.rec, who.mkt].filter(Boolean).map(nameOf).join(' + ');
    const shown = (A.tab === 'ignored' ? ignored : A.tab === 'all' ? vis : vis.filter(isOpen)).filter(mine).filter(x => !q || x.name.toLowerCase().includes(q))
      .sort((a, b) => (isOpen(b) - isOpen(a)) || (!b.rec - !a.rec) || ((a.rec === '__inactive') - (b.rec === '__inactive')) || (b.ts - a.ts) || a.name.localeCompare(b.name));
    // Ticked clients stay ticked while you search or switch tabs, so you can gather them from several searches.
    const sel = A.sel, picked = items.filter(x => sel[x.key]), pickable = shown.filter(x => !x.ign), allOn = pickable.length > 0 && pickable.every(x => sel[x.key]);
    const setSel = (list, on) => this.setState(s => { const m = { ...s.asg.sel }; list.forEach(x => { if (on) m[x.key] = true; else delete m[x.key]; }); return { asg: { ...s.asg, sel: m } }; });
    const setA = p => this.setState(s => ({ asg: { ...s.asg, ...p } }));
    const opt = (list, cur, extra) => [
      ...(!cur ? [{ v: '', l: '— Kies —' }] : cur === '__multi' ? [{ v: '__multi', l: 'Meerdere' }] : cur !== '__inactive' && !list.includes(cur) ? [{ v: cur, l: cur }] : []),
      ...list.map(x => ({ v: x, l: x })), ...(extra ? [{ v: '__inactive', l: 'Niet actief' }] : [])];
    const cnt = (k, v) => current.filter(x => x[k] === v).length, nLinked = items.filter(x => x.linked).length;
    const tab = (k, label, n) => ({ label, n, bg: A.tab === k ? '#FFFFFF' : 'transparent', fg: A.tab === k ? '#1D1D1B' : '#5C5C5A', sh: A.tab === k ? '0 1px 4px rgba(29,29,27,.07)' : 'none', onClick: () => setA({ tab: k }) });
    const chip = (k, v) => {
      const on = who[k] === v;
      return { name: nameOf(v), n: cnt(k, v), on, bg: on ? '#1B1B63' : '#F5F2ED', fg: on ? '#FFFFFF' : '#1D1D1B', nfg: on ? 'rgba(255,255,255,.75)' : '#5C5C5A',
        title: on ? 'Filter uitzetten' : `Alleen de klanten van ${nameOf(v)}`, onClick: () => this.setState(s => ({ asg: { ...s.asg, ...pickPerson(s.asg, k, v) } })) };
    };
    const kaarten = n => n ? ` · ${n} ${n === 1 ? 'kaart' : 'kaarten'}` : '';
    return {
      ...head, ready: true, open,
      hasNotice: live && (sync.state === 'loading' || sync.state === 'error'), noticeLink: false,
      notice: sync.state === 'error' ? sync.msg : `Borden laden uit Trello… ${sync.done || 0} van ${sync.total || '?'}`,
      tabs: [tab('open', 'Niet volledig toegewezen', vis.filter(isOpen).filter(mine).length), tab('all', 'Alle klanten', nMine), ...(ignored.length || A.tab === 'ignored' ? [tab('ignored', 'Geen klant', ignored.filter(mine).length)] : [])],
      summary: byWho ? `Gefilterd op ${whoText} · ${shown.length} ${shown.length === 1 ? 'klant' : 'klanten'}`
        : live ? `${st.boardList.length} borden in Trello · ${nLinked} klanten gekoppeld` : `${nLinked} klanten gekoppeld`,
      byWho, clearWho: () => setA({ who: NOBODY }),
      quietText: !quiet ? '' : st.trShowInactive ? 'Borden zonder activiteit verbergen' : `${quiet} ${quiet === 1 ? 'bord' : 'borden'} zonder activiteit in 30 dagen verborgen · tonen`,
      toggleQuiet: () => { const on = !st.trShowInactive; this.setState({ trShowInactive: on }); if (on && live) this.loadInactive(); },
      recChips: [...this.recs().map(r => chip('rec', r)), chip('rec', '__inactive')], mktChips: this.mkts().map(m => chip('mkt', m)),
      empty: shown.length === 0,
      emptyText: A.tab === 'ignored' ? 'Geen borden op Geen klant.' : q ? 'Geen klant gevonden.'
        : byWho ? (nMine ? 'Alle gefilterde klanten hebben een recruiter en marketeer.' : who.rec === '__inactive' ? `Geen klanten op Niet actief${who.mkt ? ` bij ${who.mkt}` : ''}.`
          : who.rec && who.mkt ? `${who.rec} en ${who.mkt} hebben geen klanten samen.` : `${whoText} heeft nog geen klanten.`)
        : A.tab === 'open' ? 'Alle klanten en functies hebben een recruiter en marketeer.' : 'Nog geen klanten.',
      canPick: pickable.length > 0, allOn, someOn: !allOn && pickable.some(x => sel[x.key]), toggleAll: () => setSel(pickable, !allOn),
      rows: shown.map(x => {
        const ina = x.rec === '__inactive', on = !!sel[x.key], none = [{ v: '', l: 'Geen klant' }], exp = !!A.exp[x.key];
        const pend = pendingOf(x), linkedFns = x.fns.filter(f => f.kind === 'linked'), oneRec = x.linked && !!x.rec && x.rec !== '__multi';
        const fresh = newFns(x), lost = x.fns.filter(f => f.noCol), withRec = addWith(x), expand = () => setA({ exp: { ...A.exp, [x.key]: true } });
        const list = fs => fs.map(f => f.name + (f.halt ? ` (${HALT[f.halt.kind].done})` : '')).join(', ');
        const nFns = n => `+ ${n} ${n === 1 ? 'functie' : 'functies'}`;
        // The button in the row: first the campaigns that miss their intake list (Overzetten or Stoppen, in the
        // functions below), then splitting a whole-board campaign into the intake lists, then the new functions.
        const btn = lost.length ? { text: 'Overzetten', title: 'Een campagne heeft geen kolom meer in Trello: zet hem over naar een kolom of stop hem', onClick: expand }
          : x.whole && x.cols && x.split.length && oneRec ? { text: 'Splitsen', title: 'Per functie splitsen: één campagne per kolom, met dezelfde recruiter', onClick: () => this.splitBoard(x) }
          : pend.length && oneRec ? { text: nFns(pend.length), title: 'Nieuwe functies toevoegen, met dezelfde recruiter', onClick: () => this.addFunctions(x, pend) }
          : pend.length && withRec.length ? { text: nFns(pend.length), title: 'Kies per functie met welke recruiter', onClick: expand } : null;
        return { key: x.key, name: x.name, last: x.last, op: x.ign ? 0.55 : 1, bg: on ? '#FFF8E0' : 'transparent',
          funcs: ina ? 'Niet actief · alleen Recruitment Marketeer' : x.whole ? 'Alle functies · één campagne' : x.linked ? list(linkedFns)
            : ['Nog niet gekoppeld', x.loaded ? list(pend) : 'laden…'].filter(Boolean).join(' · '),
          newText: [x.linked && fresh.length ? `Nieuw: ${list(fresh)}` : '', lost.length ? `Geen kolom: ${list(lost)}` : ''].filter(Boolean).join(' · '),
          canExpand: !x.ign && (x.fns.length > 0 || x.split.length > 0), expanded: exp, toggleExp: () => setA({ exp: { ...A.exp, [x.key]: !exp } }),
          note: x.linked ? '' : 'Kies een recruiter: elke functie wordt een eigen campagne, met dezelfde recruiter.',
          fnRows: x.fns.map(f => f.kind === 'linked' ? (f.noCol ? this.lostRow(x, f, kaarten(f.cards)) : this.linkedRow(x, f, kaarten(f.cards)))
            : f.kind === 'pending' ? { name: f.name, meta: `Nog geen campagne${kaarten(f.cards)}`, fg: '#B45309',
              acts: [...withRec.map(r => ({ label: `Toevoegen · ${r === '__inactive' ? 'Niet actief' : r}`, strong: true, onClick: () => this.addFunctions(x, [f], r) })), { label: 'Geen functie', onClick: () => this.ignoreFunction(x, f, true) }] }
            : { name: f.name, meta: 'Geen functie, geen campagne', fg: '#8C8C8A', acts: [{ label: 'Herstel', onClick: () => this.ignoreFunction(x, f, false) }] }),
          split: x.split.length && oneRec ? { text: `Eén campagne voor het hele bord. In Trello staan de functies ${list(x.split)}.`, onClick: () => this.splitBoard(x) } : null,
          canPick: !x.ign, picked: on, togglePick: () => setSel([x], !on),
          ign: x.ign, rec: x.ign ? '' : x.rec, mkt: x.ign ? '' : x.mkt, recOpts: x.ign ? none : opt(this.recs(), x.rec, true), mktOpts: x.ign ? none : opt(this.mkts(), x.mkt),
          recBorder: x.rec || x.ign ? '#E4E1DE' : '#F9A800', mktBorder: x.mkt || x.ign ? '#E4E1DE' : '#F9A800',
          onRec: e => this.assignFlash(this.assign([x], { rec: e.target.value })), onMkt: e => this.assign([x], { mkt: e.target.value }),
          addText: btn ? btn.text : '', addTitle: btn ? btn.title : '', add: btn ? btn.onClick : null,
          canIgnore: !x.ign && !x.linked, ignore: () => this.ignoreClients([x], true), restore: () => this.ignoreClients([x], false) };
      }),
      bulk: {
        show: picked.length > 0, text: `${picked.length} ${picked.length === 1 ? 'klant' : 'klanten'} geselecteerd`,
        moreText: allOn ? '' : `Alle ${pickable.length} selecteren`, selectAll: () => setSel(pickable, true),
        rec: A.rec, mkt: A.mkt, setRec: e => setA({ rec: e.target.value }), setMkt: e => setA({ mkt: e.target.value }),
        recOpts: [{ v: '', l: 'Recruiter: niet wijzigen' }, ...this.recs().map(x => ({ v: x, l: x })), { v: '__inactive', l: 'Niet actief' }],
        mktOpts: [{ v: '', l: 'Marketeer: niet wijzigen' }, ...this.mkts().map(x => ({ v: x, l: x }))],
        apply: () => this.assignPicked(picked),
        canIgnore: picked.every(x => !x.linked), ignore: () => this.ignoreClients(picked, true),
        clear: () => setA({ sel: {}, rec: '', mkt: '' })
      }
    };
  }
  /**
   * Gives clients (from assignItems) a recruiter and/or marketeer; '' leaves that one as it is. A recruiter covers all
   * functions: each one without a campaign gets one. Niet actief ('__inactive') does the same without a recruiter:
   * the campaigns are only the Recruitment Marketeer's. Returns made: how many new campaigns there are (they start on
   * Pauze), and wait: the clients that are still loading from Trello. Until their functions are in, they can't be split
   * into functions, so they keep their recruiter for now.
   */
  assign(list, { rec = '', mkt = '' }) {
    if (rec === '__multi') rec = '';
    const on = !!rec && rec !== '__inactive';
    const wait = rec ? list.filter(x => !x.linked && !x.loaded) : [], go = list.filter(x => !wait.includes(x));
    // Who followed the client before (an inactive one: nobody); the new recruiter sees it as taken over from them.
    // New functions wait for their ads, so the recruiter hears of them once they're resumed (server/announce.js).
    const from = x => x.rec === '__inactive' ? '' : x.recs.includes(rec) ? rec : x.recs[0] || '';
    if (on) this.logAssigns(go.map(x => ({ client: x.name, from: from(x), to: rec, fns: [], wacht: !this.runs(x) })));
    const L = this.state.source === 'trello', made = {};
    if (rec && go.length) {
      const off = rec === '__inactive', r = off ? '' : rec, keys = new Set(go.map(x => x.key)), pend = x => x.fns.filter(f => f.kind === 'pending');
      const add = go.flatMap(x => { const a = L ? this.newLinks(x, pend(x), r) : this.newCampaigns(x, pend(x), r, off); made[x.key] = a.map(c => c.vac); return a; });
      if (L) this.setState(s => {
        const inactive = { ...(s.live.inactive || {}) };
        go.forEach(x => { if (off) inactive[x.key] = true; else delete inactive[x.key]; });
        const links = [...s.live.links.map(k => keys.has(k.boardId) ? { ...k, rec: r } : k), ...add];
        return { live: { ...s.live, inactive, links } };
      }, () => this.rebuildLive());
      else this.setState(s => ({ campaigns: [...s.campaigns.map(c => !keys.has(c.client) || (c.ended && !c.inactive) ? c : { ...c, rec: r, ended: false, inactive: off }), ...add] }));
    }
    if (mkt && list.length) {
      const set = m => ({ ...m, ...Object.fromEntries(list.map(x => [x.key, mkt])) });
      if (L) this.setState(s => ({ live: { ...s.live, mkt: set(s.live.mkt || {}) } }));
      else this.setState(s => ({ mktDemo: set(s.mktDemo) }));
    }
    // The marketeer hears of the campaigns that wait for their ads as soon as there are some and the client is theirs,
    // whichever of the two came first: a new marketeer of all of them, the same one of the ones made now.
    this.tellMarketeers(list.map(x => {
      const isNew = !!mkt && mkt !== x.mkt, waiting = isNew ? x.fns.filter(f => f.kind === 'linked' && waitsForAds(f.halt)).map(f => f.name) : [];
      return { client: x.name, to: mkt || x.mkt, fns: [...waiting, ...(made[x.key] || [])], isNew: isNew || !x.linked };
    }));
    return { made: Object.values(made).flat().length, wait };
  }
  /** Does client x (from assignItems) have a campaign that doesn't wait for its ads, so its recruiter sees it? */
  runs(x) {
    return this.state.source === 'trello' ? this.state.live.links.some(k => k.boardId === x.key && !waitsForAds(k.halt))
      : this.state.campaigns.some(c => c.client === x.key && !c.ended && !waitsForAds(c.halt));
  }
  /**
   * Lets Recruitment Marketeers know of the campaigns of their clients that wait on Pauze for their ads, one
   * notification per person. list: [{ client, to, fns, isNew }]; isNew: the client is new to them (else new functions).
   */
  tellMarketeers(list) {
    const au = this.author(), at = Date.now(), byTo = {};
    list.filter(x => x.to && x.fns.length).forEach(x => { (byTo[x.to] = byTo[x.to] || []).push(x); });
    const hint = n => `Hervat ${n === 1 ? 'hem' : 'ze'} onder Campagnes › Pauze zodra de ads live staan`;
    const notes = Object.entries(byTo).map(([to, l]) => {
      const x = l[0], n = l.reduce((s, y) => s + y.fns.length, 0);
      return { id: at + Math.random(), to, from: au, at: stamp(), read: false, kind: 'assign',
        ...(l.length === 1 ? { title: x.isNew ? `Nieuw bedrijf voor jou: ${x.client}` : `${n === 1 ? 'Nieuwe functie' : 'Nieuwe functies'} bij ${x.client}`,
          items: [`Op Pauze tot de ads live staan: ${names(x.fns)}`, hint(n)] }
          : { title: l.every(y => y.isNew) ? `${l.length} nieuwe bedrijven voor jou` : `Nieuwe campagnes bij ${l.length} klanten`,
            items: [...l.map(y => `${y.client} · op Pauze: ${names(y.fns)}`), hint(n)] }) };
    });
    if (notes.length) this.setState(s => ({ inbox: [...notes, ...s.inbox] }));
  }
  waitText(wait) { return wait.length ? `${names(wait.map(x => x.name))} ${wait.length === 1 ? 'wordt' : 'worden'} nog geladen uit Trello; probeer het zo opnieuw` : ''; }
  /** After assign: text, then how many new campaigns are on Pauze and which clients are still loading. */
  assignFlash({ made, wait }, text = '') {
    const t = [text, made ? pausedText(made) : '', this.waitText(wait)].filter(Boolean).join(' · ');
    if (t) this.flash(t);
  }
  /**
   * Trello links (campaigns) for functions fns of client x, or one for the whole board when it has no functions. A
   * function with a label is linked by its label, one that is only an intake list by that list (see linkKey). They
   * start with halt: on Pauze until the ads are live (lib/halt.js), unless halt is null.
   */
  newLinks(x, fns, rec, halt = startHalt(this.author(), CUR)) {
    const b = x.board, h = halt ? { halt } : {};
    if (fns.length) return fns.map(f => ({ id: `t-${b.id}-${f.fnId}`, boardId: b.id, boardName: b.name, labelId: f.labelId, ...(f.labelId ? {} : { listId: f.fnId }), labelName: f.name, vac: f.name, rec, ...h }));
    return x.linked ? [] : [{ id: 't-' + b.id + '-all', boardId: b.id, boardName: b.name, labelId: null, labelName: 'Hele bord', vac: 'Alle functies', rec, ...h }];
  }
  /** Demo campaigns for functions fns of client x, or one for all functions when it has none, on Pauze. off: on Niet actief. */
  newCampaigns(x, fns, rec, off = false) {
    const now = Date.now(), list = fns.length ? fns : x.linked ? [] : [{ name: 'Alle functies', cards: 0 }], halt = startHalt(this.author(), CUR);
    return list.map((f, i) => ({ id: `n${now}-${i}`, client: x.name, vac: f.name, rec, start: CUR, ended: false, inactive: off, halt, actions: [],
      weeks: [{ w: CUR, leads: f.cards, q: null, rec: '', klant: '', note: '', needsAction: false, at: '', tr: { nieuw: f.cards, gescreend: 0, voorgesteld: 0, gesprek: 0, geplaatst: 0, reasons: {} } }] }));
  }
  /**
   * New functions of an assigned client get a campaign, with the client's recruiter (none on Niet actief), or with
   * recruiter withRec when it has several, on Pauze. The marketeer hears of them now, the recruiter once they're
   * resumed (server/announce.js).
   */
  addFunctions(x, fns, withRec = x.rec) {
    const off = withRec === '__inactive', rec = off ? '' : withRec;
    this.tellMarketeers([{ client: x.name, to: x.mkt, fns: fns.map(f => f.name), isNew: false }]);
    if (this.state.source === 'trello') this.setState(s => ({ live: { ...s.live, links: [...s.live.links, ...this.newLinks(x, fns, rec)] } }), () => this.rebuildLive());
    else this.setState(s => ({ campaigns: [...s.campaigns, ...this.newCampaigns(x, fns, rec, off)] }));
    this.flash(`${x.name}: ${names(fns.map(f => f.name))} toegevoegd · ${off ? 'Niet actief' : rec} · op Pauze tot de ads live staan`);
  }
  /** The row in Toewijzing of function f of client x that has a campaign: Stoppen, or Hervatten / Opnieuw activeren. */
  linkedRow(x, f, cards) {
    const c = { id: f.link ? f.link.id : f.campaign.id, client: x.name, vac: f.name, halt: f.halt }, stop = { label: 'Stoppen', onClick: () => this.askHalt(c, 'stop') };
    if (!f.halt) return { name: f.name, meta: `Campagne${cards}`, fg: '#1D1D1B', acts: [stop] };
    return { name: f.name, meta: haltLine(f.halt) + cards, fg: '#8C8C8A',
      acts: f.halt.kind === 'pauze' ? [{ label: 'Hervatten', strong: true, onClick: () => this.setHalt(c, null) }, stop] : [{ label: 'Opnieuw activeren', strong: true, onClick: () => this.setHalt(c, null) }] };
  }
  /**
   * The row of campaign f of client x that misses its intake list (an older label, or an archived list): Overzetten
   * to each new intake list of the board, and Stoppen (or Hervatten) as for any campaign.
   */
  lostRow(x, f, cards) {
    const row = this.linkedRow(x, f, cards), what = f.link.labelId ? 'Label zonder kolom' : 'Kolom gearchiveerd';
    const hint = x.moveTo.length ? '' : ' · maak de kolom in Trello of stop de campagne';
    return { ...row, fg: '#B45309', meta: `${what}${f.halt ? ` · ${haltLine(f.halt)}` : ''}${hint}${cards}`,
      acts: [...x.moveTo.map(t => ({ label: `Overzetten naar ${t.name}`, strong: true, onClick: () => this.askMove(x, f, t) })), ...row.acts.map(a => ({ ...a, strong: false }))] };
  }
  /**
   * Overzetten, after "Weet je het zeker?": campaign f of client x continues in intake list t (joinList). It keeps
   * its id, so its feedback, recruiter and Pauze, and takes the name of t. The cards of its old label or list keep
   * counting for it (lib/boardStats.js).
   */
  askMove(x, f, t) {
    const name = `${x.name} – ${f.name}`, renamed = t.name !== f.name ? ` en heet voortaan ${t.name}` : '';
    this.setState({ confirm: {
      title: 'Overzetten naar een kolom?', okLabel: 'Overzetten',
      text: `${name} gaat verder in de kolom ‘Nieuwe Sollicitant | ${t.name}’${renamed}.`,
      note: 'De campagne houdt zijn feedback, recruiter en status. Nieuwe kandidaten uit die kolom tellen voortaan voor deze campagne, de kaarten van eerder ook.',
      onOk: () => {
        this.setState(s => ({ confirm: null, live: { ...s.live, links: s.live.links.map(k => k.id === f.link.id ? { ...k, joinList: t.listId, labelName: t.name, vac: t.name } : k) } }), () => this.rebuildLive());
        this.flash(`${name} overgezet naar ${t.name}`);
      }
    } });
  }
  /** Can `me` put campaign c on Pauze, resume or stop it? On their own clients (campaigns.pause), all with campaigns.all. */
  canHalt(c, me = this.me()) { return me.rights.has('campaigns.pause') && (me.rights.has('campaigns.all') || this.mktOf(c) === me.name); }
  /** Pauzeren or Stopzetten (kind) of campaign c, after "Weet je het zeker?". */
  askHalt(c, kind) {
    const name = `${c.client} – ${c.vac}`, back = this.me().rights.has('assign') ? 'Je activeert hem weer onder Toewijzing.' : 'Alleen de teamlead kan hem daarna weer activeren.';
    this.setState({ confirm: {
      title: 'Weet je het zeker?', text: 'De campagne verdwijnt uit je overzicht als je verdergaat.',
      note: `${kind === 'pauze' ? `${name} gaat op pauze. Je vindt hem terug onder Campagnes › Pauze en hervat hem daar.` : `${name} stopt. ${back}`} De recruiter houdt hem tot alle kandidaten gebeld zijn.`,
      onOk: () => { this.setState({ confirm: null }); this.setHalt(c, kind); }
    } });
  }
  /**
   * Puts campaign c on Pauze or stops it (kind 'pauze' | 'stop'; see HALT), or lets it run again (null). It stays
   * linked and keeps its feedback; the server stamps who did it.
   */
  setHalt(c, kind) {
    const put = o => { const n = { ...o }; if (kind) n.halt = { kind, by: this.author(), w: CUR }; else delete n.halt; return n; };
    if (this.state.source === 'trello') this.setState(s => ({ live: { ...s.live, links: s.live.links.map(k => k.id === c.id ? put(k) : k) } }), () => this.rebuildLive());
    else this.setState(s => ({ campaigns: s.campaigns.map(x => x.id === c.id ? put(x) : x) }));
    this.flash(`${c.client} – ${c.vac} ${kind ? HALT[kind].done : c.halt && c.halt.kind === 'stop' ? 'weer actief' : 'hervat'}`);
  }
  /** "Geen functie": a label or intake list that isn't a function (for example the label "Spoed") gets no campaign. */
  ignoreFunction(x, f, on) {
    const key = f.key, upd = m => { const o = { ...m }; if (on) o[key] = true; else delete o[key]; return o; };
    if (this.state.source === 'trello') this.setState(s => ({ live: { ...s.live, ignored: upd(s.live.ignored) } }));
    else this.setState(s => ({ trIgnored: upd(s.trIgnored) }));
    this.flash(on ? `${f.name} bij ${x.name}: geen functie` : `${f.name} bij ${x.name} hersteld`);
  }
  /** A board linked as one campaign earlier gets a campaign per function instead; they keep its Pauze, if any. */
  splitBoard(x) {
    if (!window.confirm(`${x.name} splitsen in ${x.split.length} campagnes (${names(x.split.map(f => f.name))})? De campagne ‘Alle functies’ stopt; eerdere feedback daarop blijft bewaard, maar is niet meer te zien.`)) return;
    const off = x.rec === '__inactive', rec = off ? '' : x.rec, isWhole = k => k.boardId === x.key && linkKey(k) === '*';
    this.setState(s => {
      const whole = s.live.links.find(isWhole);
      return { live: { ...s.live, links: [...s.live.links.filter(k => !isWhole(k)), ...this.newLinks(x, x.split, rec, (whole && whole.halt) || null)] } };
    }, () => this.rebuildLive());
    this.flash(`${x.name} gesplitst in ${x.split.length} campagnes · ${off ? 'Niet actief' : rec}`);
  }
  /** The button in the bar for ticked clients: the chosen recruiter and/or marketeer for all of them. */
  assignPicked(list) {
    const { rec, mkt } = this.state.asg;
    if (!rec && !mkt) { this.flash('Kies eerst een recruiter of Recruitment Marketeer'); return; }
    const res = this.assign(list, { rec, mkt }), done = list.length - res.wait.length;
    this.setState(s => ({ asg: { ...s.asg, sel: {}, rec: '', mkt: '' } }));
    const n = `${done} ${done === 1 ? 'klant' : 'klanten'}`;
    const text = rec === '__inactive' ? `${n} op Niet actief gezet${mkt ? ` · marketeer ${mkt}` : ''}` : `${n} toegewezen aan ${names([rec, mkt].filter(Boolean))}`;
    this.assignFlash(res, done ? text : '');
  }
  /** "Geen klant": a board that isn't a client leaves the list (Herstel brings it back). */
  ignoreClients(list, on) {
    const upd = m => { const o = { ...m }; list.forEach(x => { if (on) o[x.key] = true; else delete o[x.key]; }); return o; };
    this.setState(s => {
      const sel = { ...s.asg.sel }; list.forEach(x => { delete sel[x.key]; });
      return { asg: { ...s.asg, sel }, ...(s.source === 'trello' ? { live: { ...s.live, ignored: upd(s.live.ignored) } } : { trIgnored: upd(s.trIgnored) }) };
    });
    const what = list.length === 1 ? list[0].name : `${list.length} borden`;
    this.flash(on ? `${what} op Geen klant gezet` : `${what} hersteld`);
  }

  // ── Meldingen, nieuws, ideeën ────────────────────────────────────────
  panelVals(me) {
    const st = this.state, P = st.panel, au = this.author();
    const mineN = st.inbox.filter(n => n.to === me.name || (me.rec && n.to === me.rec));
    // A reminder is about the feedback week it was sent in: ○ still open, ✓ filled in, – expired or gone.
    const fbLine = (t, w) => {
      const c = st.campaigns.find(x => `${x.client} – ${x.vac}` === t), wk = c && c.weeks.find(x => x.w === w);
      return wk && wk.q != null ? { t: '✓ ' + t, fg: '#8C8C8A' } : c && openWeeks(c).includes(w) ? { t: '○ ' + t, fg: '#1D1D1B' } : { t: '– ' + t, fg: '#8C8C8A' };
    };
    const setP = p => () => {
      const upd = { panel: st.panel === p ? null : p, navOpen: false };
      if (p === 'inbox' && !me.isPreview) upd.inbox = st.inbox.map(n => mineN.includes(n) && !n.read ? { ...n, read: true } : n);
      if (p === 'news') { upd.newsSeen = NEWS[0].id; lsSet(NEWS_KEY, NEWS[0].id); }
      this.setState(upd);
    };
    const I = st.idea, saveIdeas = ideas => this.setState({ ideas });
    const canSet = me.rights.has('ideas.manage');
    const shown = st.ideas.filter(x => I.filter === 'all' || (I.filter === 'open' ? (x.status === 'nieuw' || x.status === 'opgepakt') : x.type === I.filter));
    const pill = (on) => ({ bg: on ? '#FFFFFF' : 'transparent', fg: on ? '#1D1D1B' : '#5C5C5A', sh: on ? '0 1px 4px rgba(29,29,27,.07)' : 'none' });
    return {
      hasPanel: !!P, isInbox: P === 'inbox', isNews: P === 'news', isIdea: P === 'idea',
      panelTitle: { inbox: 'Meldingen', news: 'Wat is er nieuw', idea: 'Bug of idee melden' }[P] || '',
      closePanel: () => this.setState({ panel: null }),
      openInbox: setP('inbox'), openNews: setP('news'), openIdea: setP('idea'),
      inboxBg: P === 'inbox' ? '#F5F2ED' : '#FFFFFF', newsBg: P === 'news' ? '#F5F2ED' : '#FFFFFF', ideaBg: P === 'idea' ? '#F5F2ED' : '#FFFFFF',
      inbox: {
        unread: mineN.filter(n => !n.read).length, hasUnread: mineN.some(n => !n.read), empty: mineN.length === 0,
        items: mineN.map(n => {
          const qa = n.kind === 'question' || n.kind === 'answer' || n.kind === 'update', isQ = n.kind === 'question', replying = !!st.reply && st.reply.id === n.id;
          return { from: `Van ${n.from}`, at: n.at, title: n.title, bg: n.read ? '#FFFFFF' : '#FFF8E0',
            lines: (n.items || []).map((t, j) => n.kind === 'reminder' ? fbLine(t, feedbackWeek(sentAt(n))) : { t, fg: qa && j === 0 ? '#1D1D1B' : '#5C5C5A' }),
            ...(n.kind === 'blacklist'
              ? { hasAction: this.viewOk('blacklist', me), actLabel: 'Naar de blacklist', act: () => { this.setState({ panel: null }); this.go('blacklist'); } }
              : { hasAction: me.rights.has('feedback.own') && n.kind === 'reminder', actLabel: 'Feedback invullen', act: () => { this.setState({ panel: null }); this.go('checkin'); } }),
            // Questions about a campaign: answer them here, or open the campaign.
            canReply: isQ && !n.answered && !replying && !me.isPreview, answered: isQ && !!n.answered, replying,
            replyText: replying ? st.reply.text : '', setReplyText: e => { const v = e.target.value; this.setState(s => ({ reply: { ...s.reply, text: v } })); },
            startReply: () => this.setState({ reply: { id: n.id, text: '' } }), cancelReply: () => this.setState({ reply: null }), sendReply: () => this.answer(n),
            canOpen: qa && this.viewOk('detail', me) && st.campaigns.some(c => c.id === n.campaign), openCampaign: () => { this.setState({ panel: null }); this.open(n.campaign); } };
        })
      },
      news: { hasNew: st.newsSeen < NEWS[0].id, items: NEWS.map(n => ({ ...n, tagBg: n.tag === 'Nieuw' ? '#FFF8E0' : '#E7E7F0', tagFg: n.tag === 'Nieuw' ? '#B45309' : '#1B1B63' })) },
      idea: {
        text: I.text, placeholder: IDEA_TYPES[I.type][3], page: VIEW_NAMES[st.view] || st.view, empty: shown.length === 0, mailsBack: !!(st.config && st.config.mail),
        types: Object.entries(IDEA_TYPES).map(([k, v]) => ({ label: v[0], ...pill(I.type === k), onClick: () => this.setState(s => ({ idea: { ...s.idea, type: k } })) })),
        filters: [['all', 'Alles'], ['open', 'Open'], ['bug', 'Bugs'], ['idee', 'Ideeën'], ['verbetering', 'Verbeteringen']].map(([k, l]) => ({ label: l,
          n: k === 'all' ? st.ideas.length : k === 'open' ? st.ideas.filter(x => x.status === 'nieuw' || x.status === 'opgepakt').length : st.ideas.filter(x => x.type === k).length,
          bg: I.filter === k ? '#F5F2ED' : '#FFFFFF', border: I.filter === k ? '#C0BDB9' : '#E4E1DE', onClick: () => this.setState(s => ({ idea: { ...s.idea, filter: k } })) })),
        items: shown.map(x => { const T = IDEA_TYPES[x.type], S = IDEA_STATUS[x.status], voted = (x.voters || []).includes(au);
          return { type: T[0], tBg: T[1], tFg: T[2], by: x.by, at: x.at, page: x.page, text: x.text, status: x.status, statusLabel: S[0], sFg: S[1], canSet, showStatus: !canSet,
            votes: (x.voters || []).length, vBg: voted ? '#1B1B63' : '#FFFFFF', vBorder: voted ? '#1B1B63' : '#E4E1DE', vFg: voted ? '#FFFFFF' : '#1D1D1B',
            setStatus: e => { const v = e.target.value; saveIdeas(this.state.ideas.map(y => y.id === x.id ? { ...y, status: v } : y)); },
            vote: () => saveIdeas(this.state.ideas.map(y => y.id !== x.id ? y : { ...y, voters: voted ? y.voters.filter(n => n !== au) : [...(y.voters || []), au] })) }; })
      },
      setIdeaText: e => { const v = e.target.value; this.setState(s => ({ idea: { ...s.idea, text: v } })); },
      submitIdea: () => {
        if (!I.text.trim()) { this.flash('Beschrijf eerst wat je wilt melden'); return; }
        saveIdeas([{ id: Date.now(), type: I.type, text: I.text.trim(), by: au, at: stamp(), page: VIEW_NAMES[st.view] || st.view, status: 'nieuw', voters: [] }, ...st.ideas]);
        this.setState(s => ({ idea: { ...s.idea, text: '', filter: 'all' } })); this.flash('Bedankt, je melding is doorgestuurd naar de ontwikkelaar');
      }
    };
  }
  /**
   * Logs assignments [{ client, from, to, fns, wacht }] and lets each recruiter know, with one notification per person.
   * fns: new functions (campaigns) of the client; for a client the recruiter already had, only those are announced.
   * wacht: all the client's campaigns wait for their ads; logged, but the recruiter hears of it once one is resumed
   * (server/announce.js), and Live campagnes skips it.
   */
  logAssigns(list) {
    const au = this.author(), at = Date.now();
    const es = list.filter(x => x.to && (x.to !== x.from || (x.fns || []).length))
      .map(x => ({ id: at + Math.random(), mode: this.state.source, client: x.client, from: x.from || '', to: x.to, at, by: au, fns: x.fns || [], ...(x.wacht ? { wacht: true } : {}) }));
    if (!es.length) return;
    const moved = es.filter(e => e.to !== e.from), fnsText = e => `${e.fns.length === 1 ? 'nieuwe functie' : 'nieuwe functies'}: ${e.fns.join(', ')}`;
    const byTo = {}; es.filter(e => !e.wacht).forEach(e => { (byTo[e.to] = byTo[e.to] || []).push(e); });
    const notes = Object.entries(byTo).map(([to, l]) => {
      const e = l[0], kept = e.to === e.from;
      return { id: e.id, to, from: au, at: stamp(), read: false, kind: 'assign',
        ...(l.length === 1 ? {
          title: kept ? `${e.fns.length === 1 ? 'Nieuwe functie' : 'Nieuwe functies'} bij ${e.client}` : e.from ? `${e.client} is aan jou overgedragen` : `Nieuw bedrijf voor jou: ${e.client}`,
          items: kept ? e.fns : [...(e.from ? [`Eerder opgevolgd door ${e.from}`] : []), ...(e.fns.length ? [fnsText(e)] : [])] }
        : { title: l.every(x => x.to !== x.from) ? `${l.length} bedrijven aan jou toegewezen` : `${l.length} klanten voor jou gewijzigd`,
          items: l.map(x => `${x.client} · ${x.to === x.from ? fnsText(x) : x.from ? `eerder opgevolgd door ${x.from}` : 'nieuw'}`) }) };
    });
    this.setState(s => ({ assignLog: [...moved.map(({ fns, ...e }) => e), ...s.assignLog].slice(0, 500), inbox: [...notes, ...s.inbox] }));
  }
  /** Who a question about campaign c can go to: its marketeer and recruiter (not yourself), or both at once. */
  askTargets(c) {
    const acc = this.state.account, self = new Set([acc.name, acc.recName].filter(Boolean)), mkt = this.mktOf(c);
    const who = [mkt && { name: mkt, role: 'marketeer' }, c.rec && c.rec !== mkt && { name: c.rec, role: 'recruiter' }].filter(x => x && !self.has(x.name));
    const opts = who.map(x => ({ v: x.name, l: `${x.name} (${x.role})`, to: [x.name] }));
    return who.length > 1 ? [{ v: 'all', l: who.map(x => x.name).join(' en '), to: who.map(x => x.name) }, ...opts] : opts;
  }
  askQuestion(c) {
    const A = this.state.ask, opts = this.askTargets(c), o = opts.find(x => x.v === A.to) || opts[0];
    if (!o) return;
    if (!A.text.trim()) { this.flash('Schrijf eerst je vraag'); return; }
    const au = this.author(), at = Date.now();
    const notes = o.to.map(to => ({ id: at + Math.random(), to, from: au, at: stamp(), read: false, kind: 'question', campaign: c.id, title: `Vraag over ${c.client} – ${c.vac}`, items: [A.text.trim()] }));
    this.setState(s => ({ inbox: [...notes, ...s.inbox], ask: { ...s.ask, text: '' } }));
    this.flash(`Vraag gestuurd naar ${o.to.join(' en ')}`);
  }
  /** Answers question note q; the answer goes back to whoever asked it. */
  answer(q) {
    const text = ((this.state.reply || {}).text || '').trim();
    if (!text) { this.flash('Schrijf eerst je antwoord'); return; }
    const note = { id: Date.now() + Math.random(), to: q.from, from: this.author(), at: stamp(), read: false, kind: 'answer', re: q.id, campaign: q.campaign,
      title: q.title.replace(/^Vraag over/, 'Antwoord over'), items: [text, `Je vroeg: “${q.items[0]}”`] };
    this.setState(s => ({ inbox: [note, ...s.inbox.map(n => n.id === q.id ? { ...n, answered: true } : n)], reply: null }));
    this.flash(`Antwoord gestuurd naar ${q.from}`);
  }
  placeholder() { return { id: 'none', client: '—', vac: 'Nog geen campagnes', rec: '', start: CUR, ended: false, actions: [], weeks: [{ w: CUR, leads: 0, q: null, rec: '', klant: '', note: '', needsAction: false, at: '', tr: { nieuw: 0, gescreend: 0, voorgesteld: 0, gesprek: 0, geplaatst: 0 } }] }; }

  // ── Gebruikers, navigatie ────────────────────────────────────────────
  touchLogin(uid) {
    this.setState(st => {
      const now = Date.now(), s = st.seen[uid] || {};
      const fresh = !s.last || now - s.last > 2 * 36e5;
      return { seen: { ...st.seen, [uid]: { ...s, prev: fresh ? (s.last || now - 864e5) : s.prev, last: now } } };
    });
  }
  /**
   * Who the app is shown for: the logged-in account, or with "Bekijk als" another team member (see canViewAs).
   * Saving always happens as the logged-in account; the server checks its real rights.
   */
  me() {
    const st = this.state, acc = st.account;
    const other = st.viewAs ? st.members.find(m => m.id === st.viewAs && m.rights && canViewAs(acc, m)) : null;
    const src = other || acc;
    return { id: src.id, name: src.name, role: src.role, rec: src.recName || null, rights: new Set(src.rights), isPreview: !!other,
      roleLabel: ROLES[src.role].label, levelLabel: LEVELS[ROLES[src.role].level].label };
  }
  /** Name written into what you save (feedback, notifications, ideas). */
  author() { return this.state.account.name; }
  homeView(me = this.me()) {
    if (me.rights.has('campaigns.all') || me.rights.has('campaigns.own')) return 'week';
    if (me.rec && me.rights.has('feedback.own')) return 'live';
    if (me.rights.has('feedback.client')) return 'klant';
    if (this.viewOk('blacklist', me)) return 'blacklist';
    return 'settings';
  }
  viewOk(view, me = this.me()) {
    const r = k => me.rights.has(k), rec = !!me.rec && r('feedback.own'), ov = r('campaigns.all') || r('campaigns.own');
    return ({ week: ov, campaigns: ov, history: HISTORY_ENABLED && ov, rules: ov,
      klant: r('feedback.client'), 'trello-test': r('trello.link') || r('integrations'), toewijzing: r('assign'),
      live: rec, checkin: rec || r('feedback.all'), mine: rec, detail: ov || rec,
      blacklist: r('blacklist.view') || r('blacklist.manage'), settings: true,
      dev: this.state.account.rights.includes('dev') })[view] || false; // your own right, also in Bekijk als
  }
  /** Can `me` fill in the recruiter feedback of campaign c? */
  canFeedback(c, me = this.me()) { return !c.inactive && !c.halt && (me.rights.has('feedback.all') || (me.rights.has('feedback.own') && !!me.rec && c.rec === me.rec)); }
  /**
   * Whether `me` sees that the recruiter's feedback on c is still missing: who follows it up (the teamlead, with
   * reminders.send) or can fill it in (the recruiter). The others, like the Recruitment Marketeer, only see the
   * feedback that was given.
   */
  seesMissing(c, me = this.me()) { return me.rights.has('reminders.send') || this.canFeedback(c, me); }
  go(view) {
    if (!this.viewOk(view)) view = this.homeView();
    this._hashOpen = null;
    this.setState({ view, navOpen: false, ...(view === 'checkin' ? { ciKeep: [], ciQ: '' } : {}), ...(view === 'klant' ? { kQ: '' } : {}) }); if (view === 'checkin') this.enterCheckin(); if (view === 'klant') this.enterKlant(); window.scrollTo(0, 0);
  }
  /** Campaign id from a link like #campagne=<id>, for example opened in a new tab from the Weekoverzicht. */
  hashId() { const m = /^#campagne=(.+)$/.exec(window.location.hash); return m ? decodeURIComponent(m[1]) : null; }
  /** Opens the campaign of such a link once it's loaded; with Trello live that can be after the boards come in. */
  openPending() {
    const id = this._hashOpen;
    if (!id || !this.state.loaded) return;
    if (!this.viewOk('detail')) { this._hashOpen = null; return; }
    if (!this.state.campaigns.some(c => c.id === id)) return;
    this._hashOpen = null;
    this.open(id);
  }
  /**
   * Every screen switch is a step in the browser history, so the browser's Back button returns to the previous screen
   * instead of leaving the app. The address bar follows the open campaign, so a reload or a copied link opens it again.
   * A step remembers its screen, the screen of the step before it (from) and how far down you were (y).
   */
  syncHistory() {
    if (!this._navOn || this._hashOpen) return;
    const st = this.state, n = this._nav, sel = st.view === 'detail' ? st.sel : null;
    if (n && n.view === st.view && n.sel === sel) return;
    const push = !!n && !this._navReplace;
    this._navReplace = false;
    if (push) this.stampY();
    this.writeNav({ view: st.view, sel, back: st.back, from: push ? n.view : n ? n.from : null }, push, sel ? '#campagne=' + encodeURIComponent(sel) : window.location.pathname + window.location.search);
  }
  writeNav(nav, push, url) {
    this._nav = nav;
    // Safari refuses history writes when there are too many in a short time; the next one catches up.
    try { window.history[push ? 'pushState' : 'replaceState']({ nav }, '', url); } catch (e) { /* see above */ }
  }
  /** Stores the scroll position in the current step, for when you come back to it. */
  stampY() { clearTimeout(this._yT); if (this._nav) this.writeNav({ ...this._nav, y: this._y }, false); }
  /** Back or Forward in the browser: that step's screen again, as far down as you left it. */
  restoreNav(nav) {
    clearTimeout(this._yT);
    this._nav = nav;
    this._hashOpen = null;
    const ok = this.viewOk(nav.view), view = ok ? nav.view : this.homeView();
    if (!ok) this._navReplace = true; // for example a screen you no longer see after "Bekijk als"
    this.setState(s => ({ view, sel: nav.sel || s.sel, back: nav.back || s.back, navOpen: false,
      ...(view === 'detail' ? { act: { ...s.act, text: '', w: CUR, ctl: '' }, ask: { to: '', text: '' }, upd: null } : {}) }), () => window.scrollTo(0, nav.y || 0));
    if (view === 'checkin') this.enterCheckin();
    if (view === 'klant') this.enterKlant();
  }
  /** "← Weekoverzicht" in a campaign: when that's the screen of the step before, it is the browser's Back, so the history stays the same either way. */
  navBack() {
    const to = this.state.back || 'campaigns';
    if (this._nav && this._nav.from === to) window.history.back(); else this.go(to);
  }
  setViewAs(id) {
    lsSet(VIEW_AS_KEY, id || null);
    api('POST', '/api/me/view-as', { id: id || null }).catch(() => {});
    this.setState({ viewAs: id || null }, () => {
      const me = this.me(), home = this.homeView(me);
      this.setState(s => ({ ci: { rec: me.rec || 'all' }, ciKeep: [], ciQ: '', kQ: '', f: { ...s.f, status: 'all' }, form: null, kform: null, view: home, back: home, panel: null, navOpen: false }));
      window.scrollTo(0, 0);
    });
  }
  /** Reloads the account and team (after changes in Instellingen). */
  async reloadMe() {
    try { const r = await api('GET', '/api/me'); this.setState({ account: r.account, members: r.members }); } catch (e) { /* keep what we have */ }
  }
  async reloadConfig() {
    try {
      const cfg = await api('GET', '/api/config');
      this.setState({ config: cfg }, () => { if (this.state.source === 'trello') this.startLive(); });
    } catch (e) { /* ignore */ }
  }

  // ── Feedback klant ───────────────────────────────────────────────────
  klantQueue() {
    return this.visible(this.state.campaigns.filter(c => !c.ended && !c.halt))
      .sort((a, b) => (a.weeks[a.weeks.length - 1].klant ? 1 : 0) - (b.weeks[b.weeks.length - 1].klant ? 1 : 0));
  }
  enterKlant(id) {
    const q = this.klantQueue();
    const t = id ? q.find(c => c.id === id) : (q.find(c => !c.weeks[c.weeks.length - 1].klant) || q[0]);
    if (t) this.loadKlant(t.id);
  }
  skipKlant() {
    const k = this.state.kform; if (!k) return;
    // Next: within the search, when there is one.
    const q = this.klantQueue(), i = q.findIndex(c => c.id === k.id), next = q.slice(i + 1).find(c => !c.weeks[c.weeks.length - 1].klant && matchesQ(c, this.state.kQ));
    if (next) this.loadKlant(next.id); else this.flash('Geen andere campagnes zonder klantfeedback');
  }
  startKlant(id) { this.setState({ view: 'klant', kQ: '' }, () => this.loadKlant(id)); window.scrollTo(0, 0); }
  loadKlant(id) { const c = this.state.campaigns.find(x => x.id === id); this.setState({ kform: { id, klant: c.weeks[c.weeks.length - 1].klant || '' } }); }
  saveKlant() {
    const k = this.state.kform; if (!k) return;
    if (!k.klant.trim()) { this.skipKlant(); return; }
    const campaigns = this.state.campaigns.map(c => {
      if (c.id !== k.id) return c;
      const ws = c.weeks.slice(); ws[ws.length - 1] = { ...ws[ws.length - 1], klant: k.klant.trim(), klantBy: this.author() };
      return { ...c, weeks: ws };
    });
    const c = campaigns.find(x => x.id === k.id);
    this.setState({ campaigns }, () => {
      this.flash(`Klantfeedback opgeslagen · ${c.client}`);
      const next = this.klantQueue().find(x => x.id !== k.id && !x.weeks[x.weeks.length - 1].klant && matchesQ(x, this.state.kQ));
      this.loadKlant(next ? next.id : k.id);
    });
  }

  // ── Wekelijkse feedback recruiter ────────────────────────────────────
  open(id) { this.setState(s => ({ view: 'detail', sel: id, back: s.view === 'detail' ? s.back : s.view, act: { ...s.act, text: '', w: CUR, ctl: '' }, ask: { to: '', text: '' }, upd: null })); window.scrollTo(0, 0); }
  flash(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null }), 2400); }
  /** The items { c, w, late, open } on Wekelijkse feedback recruiter: last week's open ones first (lib/checkin.js). */
  queue(st = this.state) {
    const me = this.me(), rec = me.rights.has('feedback.all') ? st.ci.rec : me.rec;
    return checkinQueue(st.campaigns, rec, { keep: st.ciKeep });
  }
  enterCheckin(id) {
    const q = this.queue(), own = id ? q.filter(i => i.c.id === id) : q;
    const target = own.find(i => i.open) || own[0];
    if (target) this.loadForm(target.c.id, target.w);
  }
  /** Opens the form on campaign id, week w; without w on its first open week (last week's before this week's). */
  startCheckin(id, w) {
    const c = this.state.campaigns.find(x => x.id === id);
    this.setState({ view: 'checkin', ciQ: '' }, () => this.loadForm(id, w ?? (c && openWeeks(c)[0])));
    window.scrollTo(0, 0);
  }
  /** The form for week w of campaign id (its last week if w is not given). */
  loadForm(id, w) {
    const c = this.state.campaigns.find(x => x.id === id), wk = c.weeks.find(x => x.w === w) || c.weeks[c.weeks.length - 1];
    this.setState({ form: { id, w: wk.w, leads: wk.leads, trello: wk.tr.nieuw, q: wk.q, rec: wk.rec, note: wk.note, needsAction: wk.needsAction, err: false } });
  }
  setForm(p) { this.setState(s => ({ form: { ...s.form, ...p } })); }
  saveForm() {
    const f = this.state.form;
    if (!f) return;
    if (f.q == null) { this.setForm({ err: true }); return; }
    const campaigns = this.state.campaigns.map(c => c.id !== f.id ? c : { ...c, weeks: c.weeks.map(w => w.w !== f.w ? w
      : { ...w, leads: +f.leads || 0, q: f.q, rec: f.rec.trim(), recBy: this.author(), note: f.note.trim(), needsAction: f.needsAction, at: stamp() }) });
    // Last week's feedback, caught up: it stays in the list (with ✓) for the rest of this visit.
    const c = campaigns.find(x => x.id === f.id), late = f.w < c.weeks[c.weeks.length - 1].w, key = f.id + '|' + f.w;
    this.setState(s => ({ campaigns, ...(late && !s.ciKeep.includes(key) ? { ciKeep: [...s.ciKeep, key] } : {}) }), () => {
      this.flash(`Opgeslagen · ${late ? `week ${wl(f.w)} · ` : ''}${c.client} – ${c.vac}`);
      const next = this.queue().find(i => i.open && !(i.c.id === f.id && i.w === f.w) && matchesQ(i.c, this.state.ciQ));
      if (next) this.loadForm(next.c.id, next.w); else this.loadForm(f.id, f.w);
    });
  }
  /** Records the campaign change in the form; with Controle in x dagen it also puts the campaign on Check until then. */
  addAction() {
    const a = this.state.act, days = ctlDays(a.ctl), c = this.state.campaigns.find(x => x.id === this.state.sel);
    if (!a.text.trim()) { this.flash('Beschrijf eerst de wijziging'); return; }
    if (a.ctl !== '' && !days) { this.flash(`Kies voor de controle 1 tot ${CTL_MAX} dagen, of geen controle`); return; }
    const id = c.id + 'a' + Date.now();
    const campaigns = this.state.campaigns.map(x => x !== c ? x : { ...x, actions: [...x.actions, { id, w: +a.w, type: a.type, text: a.text.trim() }] });
    this.setState({ campaigns, act: { ...a, text: '', ctl: '' } });
    if (days) this.putMon(c, 'check', { days, act: id });
    this.flash(`Campagnewijziging vastgelegd${days ? ` · controle ${dayShort(ctlDate(days))}` : ''}`);
  }
  /** Changes this week's entry of campaign id; fn(week, campaign) returns the fields to set. */
  setWeek(id, fn) {
    this.setState(s => ({ campaigns: s.campaigns.map(c => {
      if (c.id !== id) return c;
      const ws = c.weeks.slice(), cur = ws[ws.length - 1];
      ws[ws.length - 1] = { ...cur, ...fn(cur, c) };
      return { ...c, weeks: ws };
    }) }));
  }
  /**
   * Monitor status for this week: 'check' (with the signals seen at that moment, see monitor()), 'klant', or
   * 'open' to let the health rules decide again. With days it is Check with Controle in x dagen, for campaign change
   * act if given; a plain Check keeps a controle whose day hasn't come yet (lib/controle.js monFields).
   */
  putMon(c, mon, { days, act } = {}) {
    const R = this.state.rules;
    this.setWeek(c.id, (_, cc) => ({ ...monFields(cc, mon, health(cc, R).reasons.map(r => r.k), { days, act }), monBy: this.author() }));
  }
  setMon(c, mon) {
    this.putMon(c, mon);
    this.flash(mon === 'open' ? 'De health-regels bepalen de status weer' : `${c.client} – ${c.vac} staat op ${MONITOR[mon].label}`);
  }
  /** Controle in x dagen from the Weekoverzicht: the dialog for campaign c, and saving it. */
  askCtl(c) { this.setState({ ctlDlg: { id: c.id, title: `${c.client} – ${c.vac}`, days: '' } }); }
  saveCtl() {
    const dl = this.state.ctlDlg, days = dl ? ctlDays(dl.days) : 0, c = dl && this.state.campaigns.find(x => x.id === dl.id);
    if (!days || !c) return;
    this.setState({ ctlDlg: null });
    this.putMon(c, 'check', { days });
    this.flash(`${c.client} – ${c.vac} staat op Check · controle ${dayShort(ctlDate(days))}`);
  }
  /** Saves the update for the recruiter (this week) and lets the recruiter know under Meldingen. */
  saveUpd(c) {
    const cur = c.weeks[c.weeks.length - 1], u = this.state.upd, text = (u && u.id === c.id ? u.text : cur.upd || '').trim();
    if (text === (cur.upd || '')) { this.setState({ upd: null }); return; }
    this.setWeek(c.id, () => ({ upd: text || undefined, updBy: text ? this.author() : undefined }));
    const acc = this.state.account, notify = !!text && !!c.rec && c.rec !== acc.recName && c.rec !== acc.name;
    const note = notify && { id: Date.now() + Math.random(), to: c.rec, from: this.author(), at: stamp(), read: false, kind: 'update', campaign: c.id, title: `Update over ${c.client} – ${c.vac}`, items: [text] };
    this.setState(s => ({ upd: null, ...(note ? { inbox: [note, ...s.inbox] } : {}) }));
    this.flash(!text ? 'Update verwijderd' : notify ? `Update opgeslagen · ${c.rec} krijgt een melding` : 'Update opgeslagen');
  }
  /** The newest update for the recruiter on campaign c, from any week. */
  lastUpd(c) {
    const w = [...c.weeks].reverse().find(x => x.upd), cur = c.weeks[c.weeks.length - 1];
    return w ? { text: w.upd, by: w.updBy || 'de marketeer', cur: w === cur, meta: `Update van ${w.updBy || 'de marketeer'} · week ${wl(w.w)}` } : null;
  }
  /** Which recruiters with missing feedback can get a reminder now (at most one per REMIND_GAP_MS). */
  remindInfo(missingD) {
    const now = Date.now(), last = {};
    this.state.inbox.forEach(n => { if (n.kind === 'reminder') last[n.to] = Math.max(last[n.to] || 0, sentAt(n)); });
    const recs = [...new Set(missingD.map(d => d.rec).filter(Boolean))];
    const ok = recs.filter(r => now - (last[r] || 0) >= REMIND_GAP_MS), wait = recs.filter(r => !ok.includes(r));
    return { ok, wait, next: wait.length ? Math.min(...wait.map(r => last[r] + REMIND_GAP_MS)) : null };
  }
  setRule(k, v) { this.setState(s => ({ rules: { ...s.rules, [k]: v } })); }
  exportCsv() {
    if (this.state.campaigns.some(c => c.quick)) { this.flash('Trello wordt nog geladen; probeer het zo opnieuw'); return; }
    const period = +this.state.hist.period, first = CUR - period + 1;
    const rows = [['klant', 'vacature', 'recruiter', 'week', 'week_start', 'nieuwe_kandidaten', 'kwaliteit', 'feedback_recruitment', 'feedback_klant', 'actie_notitie', 'bijsturing_nodig', 'monitorstatus_gezet', 'update_recruiter', 'trello_voorgesteld', 'trello_gesprek', 'trello_geplaatst']];
    this.visible(this.state.campaigns).forEach(c => c.weeks.forEach(w => rows.push([c.client, c.vac, c.rec, wl(w.w), isoDate(mondayOf(w.w)), w.leads, w.q ?? '', w.rec, w.klant, w.note, w.needsAction ? 'ja' : 'nee', MONITOR[w.mon] ? MONITOR[w.mon].label : '', w.upd || '', w.tr.voorgesteld, w.tr.gesprek, w.tr.geplaatst])));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `campagnefeedback-week-${wl(first)}-${wl(CUR)}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  effect(c, act) {
    const by = w => c.weeks.find(x => x.w === w);
    const before = [act.w - 2, act.w - 1].map(by).filter(Boolean), after = [act.w + 1, act.w + 2].map(by).filter(Boolean);
    const qB = avgOf(before.filter(x => x.q != null).map(x => x.q)), qA = avgOf(after.filter(x => x.q != null).map(x => x.q));
    const lB = avgOf(before.map(x => x.leads)), lA = avgOf(after.map(x => x.leads));
    return { qB, qA, lB, lA };
  }
  deco(c, me = this.me()) {
    const R = this.state.rules, h = health(c, R), m = monitor(c, h), ws = c.weeks, cur = ws[ws.length - 1], prev = ws[ws.length - 2] || null;
    // On Niet actief there is no recruiter, so no feedback is missing; on Pauze or stopped none is asked. Those show
    // their halt instead of the monitor status. A week without new candidates and without calls asks none either (noFb).
    // Open feedback shows as missing only to who sees that (seesMissing); the others get the last feedback given.
    const H = c.halt && HALT[c.halt.kind], S = H || MONITOR[m.s], ina = !!c.inactive, noQ = cur.q == null;
    const noFb = noQ && !ina && !H && !needsFeedback(cur), open = noQ && !ina && !H && !noFb, missing = open && this.seesMissing(c, me);
    const qd = (!noQ && prev && prev.q != null) ? cur.q - prev.q : null;
    const ld = prev ? cur.leads - prev.leads : null;
    const l8 = ws.slice(-8), pts = [];
    l8.forEach((w, i) => { if (w.q != null) pts.push(`${(l8.length > 1 ? i / (l8.length - 1) * 72 : 36).toFixed(1)},${(22 - (w.q - 1) / 9 * 20).toFixed(1)}`); });
    const l6 = ws.slice(-6), mx = Math.max(...l6.map(w => w.leads), 1);
    const lastFb = [...ws].reverse().find(w => w.q != null);
    // Controle in x dagen (lib/controle.js): before its day "controle do 29 okt" with the check, on it what it was for.
    const ctl = !H && m.ctl ? m.ctl : null, ctlT = ctl ? ctlText(ctl, c.actions) : '', withCtl = ctl ? ` · ${ctlT}` : '';
    return {
      id: c.id, client: c.client, vac: c.vac, rec: ina ? 'Niet actief' : c.rec, inactive: ina, start: c.start, startLabel: wl(c.start), cur, lvl: h.lvl,
      ms: m.s, msRank: H ? -1 : S.rank, monBy: m.by, statusLabel: H ? haltLabel(c.halt) : S.label, sFg: S.fg, sBg: S.bg, halt: c.halt || null, haltTag: H ? haltLabel(c.halt) : '',
      monText: H ? haltLine(c.halt) : m.s === 'klant' ? `Sinds week ${wl(m.w)}${m.by ? ` · ${m.by}` : ''}` : m.s === 'check' ? `Gecheckt${m.by ? ` door ${m.by}` : ''}${withCtl}`
        : ctl && ctl.due ? ctlT : m.s === 'goed' ? 'Geen signalen deze week' : m.stale ? `Nieuw signaal na de check van ${(ctl && ctl.by) || cur.monBy || 'de marketeer'}${withCtl}` : '',
      ctl, ctlTag: ctlT, ctlDue: !!ctl && ctl.due,
      href: '#campagne=' + encodeURIComponent(c.id),
      reasons: H ? [] : h.reasons.map(r => ({ t: r.t, fg: STAT[r.l].fg, bg: STAT[r.l].bg })),
      missing, noFb, qText: noQ ? '—' : cur.q + '/10', qFg: qc(cur.q),
      qdText: noQ ? (ina ? 'geen recruiter' : noFb ? 'geen feedback nodig' : 'nog niet beoordeeld') : qd == null ? 'eerste week' : qd === 0 ? 'gelijk aan vorige week' : `${qd > 0 ? '▲' : '▼'} ${Math.abs(qd)} t.o.v. vorige week`,
      qdShort: qd == null || qd === 0 ? '' : `${qd > 0 ? '▲' : '▼'}${Math.abs(qd)}`,
      qdColor: qd == null || qd === 0 ? '#8C8C8A' : qd > 0 ? '#1A7A4A' : '#D32F2F',
      prevQText: prev && prev.q != null ? prev.q + '/10' : '—',
      ldText: ld == null ? '' : ld === 0 ? 'gelijk aan vorige week' : `${sgn(ld)} t.o.v. vorige week`,
      ldShort: ld == null ? '' : sgn(ld), ldColor: ld == null || ld === 0 ? '#8C8C8A' : ld > 0 ? '#1A7A4A' : '#B45309',
      spark: pts.join(' '),
      ...(() => { const qv = ws.filter(w => w.q != null).map(w => w.q), a = avgOf(qv); return { avgQ: a == null ? '—' : nl(a), avgFg: qc(a == null ? null : Math.round(a)), avgSub: qv.length ? `over ${qv.length} ${qv.length === 1 ? 'week' : 'weken'}` : '' }; })(),
      bars: l6.map(w => ({ h: Math.max(3, Math.round(w.leads / mx * 24)) + 'px', bg: w === cur ? '#FB8915' : 'rgba(27,27,99,.28)' })),
      lastAt: H || noFb ? 'Niet nodig' : ina ? 'Niet actief' : missing ? 'Ontbreekt' : open ? (lastFb ? 'Week ' + wl(lastFb.w) : '—') : (cur.at || 'Week ' + wl(cur.w)),
      atColor: missing ? '#D32F2F' : noFb || open ? '#8C8C8A' : '#3C3C3A', atWeight: missing ? 600 : 400,
      quote: ina ? 'Niet actief: geen recruiter, dus geen recruiterfeedback' : noFb ? 'Geen nieuwe kandidaten en niet gebeld: geen feedback nodig'
        : missing ? (lastFb ? `Nog geen feedback. Week ${wl(lastFb.w)}: ${lastFb.rec}` : 'Nog geen feedback')
        : open ? (lastFb ? `Week ${wl(lastFb.w)}: ${lastFb.rec || 'geen toelichting'}` : 'Nog geen recruiterfeedback') : (cur.rec || 'Geen toelichting'),
      hasQuote: true,
      open: () => this.open(c.id), check: () => this.setMon(c, 'check'), askCtl: () => this.askCtl(c)
    };
  }

  // ── Everything the views render ──────────────────────────────────────
  renderVals() {
    const st = this.state, R = st.rules, me = this.me(), acc = st.account, can = r => me.rights.has(r), recMode = !!me.rec && can('feedback.own');
    // Running: not on Pauze or stopped (halt). Only those count in the Weekoverzicht and the tabs of Campagnes.
    const active = st.campaigns.filter(c => !c.ended), running = active.filter(c => !c.halt), shown = this.visible(running, me);
    const ownOnly = can('campaigns.own') && !can('campaigns.all'), overview = can('campaigns.all') || can('campaigns.own');
    const D = shown.map(c => this.deco(c, me));
    const cnt = {}; MONITOR_KEYS.forEach(k => { cnt[k] = D.filter(d => d.ms === k).length; });
    // Feedback recruiters: only for who follows missing feedback up (the teamlead). Only campaigns with a recruiter
    // (not Niet actief) that ask feedback this week count.
    const track = can('reminders.send'), missingD = track ? D.filter(d => d.missing) : [], ri = this.remindInfo(missingD);
    const fbTotal = D.filter(d => !d.inactive && !d.noFb).length, done = fbTotal - missingD.length;
    const setF = p => this.setState(s => ({ f: { ...s.f, ...p } }));

    const klantOpen = shown.filter(c => !c.weeks[c.weeks.length - 1].klant).length;
    // Open feedback, last week's (still to catch up) included.
    const myOpen = active.filter(c => c.rec === me.rec).reduce((n, c) => n + openWeeks(c).length, 0);
    // Menu: one section per kind of work, each item only when you have the right for it.
    const navActive = st.view === 'detail' ? st.back : st.view;
    const navItem = ([k, label, badge]) => ({ label, badge, hasBadge: !!badge, bg: navActive === k ? '#F5F2ED' : 'transparent', fg: navActive === k ? '#1B1B63' : '#3C3C3A', fw: navActive === k ? 600 : 500, onClick: () => this.go(k) });
    const navSections = [
      recMode && { title: 'Recruiter', items: [['live', 'Live campagnes'], ['checkin', 'Wekelijkse feedback recruiter', myOpen], ['mine', 'Mijn campagnes']] },
      { title: 'Campagnemonitor', items: [
        ...(overview ? [['week', 'Weekoverzicht'], ['campaigns', 'Campagnes']] : []),
        ...(can('feedback.client') ? [['klant', 'Feedback klant']] : []),
        ...(can('assign') ? [['toewijzing', 'Toewijzing', this.assignData().open]] : []),
        ...(HISTORY_ENABLED && overview ? [['history', 'Historie & analyse']] : []),
        ...(overview ? [['rules', 'Health-regels']] : [])] },
      this.viewOk('blacklist', me) && { title: 'Kandidaten', items: [['blacklist', 'Blacklist', can('blacklist.manage') && st.blSum ? st.blSum.pending : 0]] },
      this.viewOk('dev', me) && { title: 'Dev', items: [['dev', 'Bugs & ideeën', this.unsortedIdeas()]] },
      { title: '', items: [['settings', 'Instellingen']] }
    ].filter(x => x && x.items.length).map(x => ({ title: x.title, items: x.items.map(navItem) }));

    const levels = MONITOR_KEYS.map(k => ({ n: cnt[k], label: MONITOR[k].label, fg: MONITOR[k].fg, bg: MONITOR[k].bg, pct: (cnt[k] / Math.max(D.length, 1) * 100) + '%', onClick: () => { setF({ status: k }); this.go('campaigns'); } }));
    // Feedback recruiters: a bar under the monitor status, closed by default (remembered in this browser). Open, it
    // lists per recruiter the campaigns still open this week or, overdue, last week.
    const fbOpen = track ? openByRecruiter(shown) : [];
    const fbBar = !track ? null : {
      open: !!st.fbBar, toggle: () => { lsSet(FB_BAR_KEY, !st.fbBar); this.setState({ fbBar: !st.fbBar }); },
      doneText: `${done} van ${fbTotal} ingevuld deze week`, donePct: (done / Math.max(fbTotal, 1) * 100) + '%',
      openText: fbOpen.length ? `${fbOpen.length} ${fbOpen.length === 1 ? 'recruiter' : 'recruiters'} met open feedback` : 'Alles ingevuld', hasOpen: fbOpen.length > 0,
      recs: fbOpen.map(r => ({
        rec: r.rec, counts: [r.now && `${r.now} deze week`, r.late && `${r.late} van vorige week`].filter(Boolean).join(' · '),
        items: r.items.map(i => ({ label: `${i.c.client} – ${i.c.vac}`, tag: i.late ? (i.now ? 'ook vorige week' : 'vorige week') : '', href: '#campagne=' + encodeURIComponent(i.c.id), open: () => this.open(i.c.id) }))
      }))
    };
    const sum = {
      active: D.length, levels,
      klantDone: shown.length - klantOpen,
      scope: ownOnly ? ' van jouw klanten' : ''
    };
    const byPrio = (a, b) => (a.cur.q ?? 5.5) - (b.cur.q ?? 5.5);
    const bySeverity = (a, b) => b.lvl - a.lvl || byPrio(a, b);
    // Campaigns without signals come up once a week as Wekelijkse controle; a Check button per row ticks them off, or
    // Controle in x dagen ticks them off until that day. A controle whose day has come goes on top.
    // Actie nodig shows cards or, by choice (remembered in this browser), a list with one line per campaign.
    const ctlFirst = (a, b) => b.ctlDue - a.ctlDue || bySeverity(a, b);
    const actieList = st.actieView === 'list';
    const actieViews = [['cards', 'Kaarten'], ['list', 'Lijst']].map(([k, label]) => {
      const on = st.actieView === k || (k === 'cards' && !actieList);
      return { label, on, bg: on ? '#FFFFFF' : 'transparent', fg: on ? '#1D1D1B' : '#5C5C5A', sh: on ? '0 1px 4px rgba(29,29,27,.07)' : 'none', onClick: () => { lsSet(ACTIE_VIEW_KEY, k); this.setState({ actieView: k }); } };
    });
    const groups = [
      { k: 'actie', sub: 'Bekijken en bijsturen deze week' }, { k: 'goed', sub: 'Geen signalen of een controle na een wijziging. Even nakijken en afvinken' },
      { k: 'klant', sub: 'Wacht op input van de klant, zoals saldo of foto’s' }, { k: 'check', sub: 'Beoordeeld deze week' }
    ].map(g => {
      const items = D.filter(d => d.ms === g.k).sort(g.k === 'goed' ? ctlFirst : bySeverity), compact = g.k === 'goed' || g.k === 'check', asList = g.k === 'actie' && actieList, any = items.length > 0;
      return { label: MONITOR[g.k].label, fg: MONITOR[g.k].fg, n: items.length, sub: g.sub, items, cards: !compact && !asList && any, rows: compact && any, list: asList && any,
        views: g.k === 'actie' ? actieViews : null, canCheck: g.k === 'goed' && can('campaigns.monitor') };
    }).filter(g => g.n > 0);

    // dashboard
    const q = st.f.q.trim().toLowerCase(), isMine = st.view === 'mine', found = d => !q || (d.client + ' ' + d.vac).toLowerCase().includes(q);
    // Campagnes: campaigns on Pauze under a tab of their own. Mijn campagnes: also paused and stopped ones while their
    // candidates still have to be called, with a tag.
    let list = isMine ? active.filter(c => c.rec === me.rec && recruiterSees(c)).map(c => this.deco(c, me)).filter(found) : D.filter(found);
    const paused = isMine ? [] : this.visible(active.filter(c => c.halt && c.halt.kind === 'pauze'), me).map(c => this.deco(c, me)).filter(found);
    // Geen feedback: for the recruiter's own campaigns and for who follows missing feedback up, not for the others.
    const missTab = isMine || track, fs = st.f.status === 'missing' && !missTab ? 'all' : st.f.status;
    const tabCount = k => k === 'all' ? list.length : k === 'missing' ? list.filter(d => d.missing).length : k === 'pauze' ? paused.length : list.filter(d => !d.halt && d.ms === k).length;
    const statusTabs = [['all', 'Alle', null], ...MONITOR_KEYS.map(k => [k, MONITOR[k].label, MONITOR[k].fg]), ...(missTab ? [['missing', 'Geen feedback', null]] : []),
      ...(paused.length || (!isMine && fs === 'pauze') ? [['pauze', HALT.pauze.label, HALT.pauze.fg]] : [])].map(([k, label, dot]) => ({
      label, dot, n: tabCount(k), bg: fs === k ? '#FFFFFF' : 'transparent', fg: fs === k ? '#1D1D1B' : '#5C5C5A', sh: fs === k ? '0 1px 4px rgba(29,29,27,.07)' : 'none', onClick: () => setF({ status: k })
    }));
    if (fs === 'missing') list = list.filter(d => d.missing);
    else if (fs === 'pauze') { if (!isMine) list = paused; }
    else if (fs !== 'all') list = list.filter(d => !d.halt && d.ms === fs);
    const sorters = {
      status: (a, b) => b.msRank - a.msRank || bySeverity(a, b),
      quality: (a, b) => byPrio(a, b),
      leadsMost: (a, b) => b.cur.leads - a.cur.leads,
      leads: (a, b) => a.cur.leads - b.cur.leads,
      client: (a, b) => a.client.localeCompare(b.client)
    };
    // Mijn campagnes (recruiters) sorts on instroom or name only; Campagnes also on priority and quality.
    const sortKeys = isMine ? [['leadsMost', 'meeste instroom'], ['leads', 'minste instroom'], ['client', 'klant A–Z']]
      : [['status', 'prioriteit'], ['quality', 'laagste kwaliteit'], ['leads', 'minste instroom'], ['client', 'klant A–Z']];
    const sortOptions = sortKeys.map(([v, l]) => ({ v, l: 'Sorteer: ' + l })), sortValue = isMine ? st.f.mineSort : st.f.sort;
    list = list.slice().sort(sorters[sortValue] || sorters[sortKeys[0][0]]);
    const recNames = this.recs(), recOptions = [{ v: 'all', l: 'Alle recruiters' }, ...recNames.map(r => ({ v: r, l: r }))];

    // check-in
    const queue = this.queue(), shownQ = queue.filter(i => matchesQ(i.c, st.ciQ));
    const f = st.form;
    const fcC = f ? st.campaigns.find(c => c.id === f.id) : null;
    let fc = {};
    if (fcC) {
      const fw = fcC.weeks.find(w => w.w === f.w) || fcC.weeks[fcC.weeks.length - 1], prev = fcC.weeks.find(w => w.w === fw.w - 1), late = fw.w < CUR;
      const edited = +f.leads !== f.trello, upd = this.lastUpd(fcC), rej = reasonList(fw.tr.reasons);
      fc = {
        client: fcC.client, vac: fcC.vac, wl: wl(fw.w), hasUpd: !!upd, upd: upd || {},
        late, lateText: `Je vult de feedback over week ${wl(fw.w)} (${rangeLong(fw.w)}) nog in. Dat kan tot en met ${dueTxt(fw.w)}.`,
        noNeed: !needsFeedback(fw), noNeedText: `Geen feedback nodig: ${late ? `in week ${wl(fw.w)}` : 'deze week'} zijn er geen nieuwe kandidaten binnengekomen en is er niet gebeld. Invullen mag wel.`,
        leadsLabel: late ? `Nieuwe kandidaten week ${wl(fw.w)}` : 'Nieuwe kandidaten deze week', rejLabel: late ? `Afgewezen week ${wl(fw.w)} · uit Trello` : 'Afgewezen deze week · uit Trello',
        prevLabel: late ? `Week ${wl(fw.w - 1)}` : 'Vorige week',
        prevLine: prev ? `${prev.leads} kandidaten · kwaliteit ${prev.q ?? '—'}/10${prev.rec ? ` · “${prev.rec}”` : ''}` : 'eerste week van deze campagne',
        trText: edited ? `Handmatig aangepast · Trello telde ${f.trello}` : `Automatisch uit Trello · ${f.trello} nieuwe kaarten ${range(fw.w)}`,
        trBg: edited ? '#FEF3C7' : '#E7E7F0', trFg: edited ? '#B45309' : '#1B1B63',
        rej, hasRej: rej.length > 0
      };
    }
    // The counts are about this week, without the campaigns that need no feedback; last week's open feedback is counted separately.
    const nowQ = queue.filter(i => !i.late && i.needed), qOpen = nowQ.filter(i => i.open).length, lateOpen = queue.filter(i => i.late && i.open).length;
    const isForm = i => !!f && i.c.id === f.id && i.w === f.w;
    const scoreBtns = Array.from({ length: 10 }, (_, i) => {
      const n = i + 1, on = f && f.q === n;
      return { n, onClick: () => this.setForm({ q: n, err: false }), bg: on ? qc(n) : '#FFFFFF', fg: on ? '#FFFFFF' : '#1D1D1B', border: on ? qc(n) : '#E4E1DE' };
    });

    // detail
    const selC = st.campaigns.find(c => c.id === st.sel) || active[0] || this.placeholder();
    const dd = this.deco(selC, me), seeMiss = this.seesMissing(selC, me);
    const ws = selC.weeks, n = ws.length;
    const maxL = Math.max(...ws.map(w => w.leads), 1);
    const actWeeks = new Set(selC.actions.map(a => a.w));
    const qws = ws.filter(w => w.q != null);
    const total = ws.reduce((s, w) => s + w.leads, 0);
    const tot = k => ws.reduce((s, w) => s + w.tr[k], 0);
    const funnelDefs = [['nieuw', 'Nieuw'], ['gescreend', 'Gescreend'], ['voorgesteld', 'Voorgesteld'], ['gesprek', 'Gesprek'], ['geplaatst', 'Geplaatst']];
    const cw = ws[n - 1];
    // Main button on a campaign: your own feedback if it's your campaign, else client feedback, else correcting the recruiter's.
    const canFb = this.canFeedback(selC, me), ownC = !!me.rec && selC.rec === me.rec;
    const fillMode = canFb && ownC ? 'rec' : can('feedback.client') ? 'klant' : canFb ? 'rec' : null, fbW = openWeeks(selC)[0] ?? CUR;
    // On Pauze or stopped: no monitor status and no feedback, only resuming (or activating, with Toewijzing).
    const halt = selC.halt, off = selC.ended || !!halt, canHalt = !selC.ended && selC.id !== 'none' && this.canHalt(selC, me);
    const canMon = can('campaigns.monitor') && !off && selC.id !== 'none';
    // variant: of components/Button.jsx; Stopzetten is red.
    const haltBtn = (label, onClick, variant = 'ghost') => ({ label, onClick, variant });
    const d = {
      // The line next to the label already says a new campaign is new.
      ...dd, mkt: this.mktOf(selC) || 'nog niet toegewezen', statusLabel: halt ? HALT[halt.kind].label : dd.statusLabel,
      haltActs: canHalt && !halt ? [haltBtn('Pauzeren', () => this.askHalt(selC, 'pauze')), haltBtn('Stopzetten', () => this.askHalt(selC, 'stop'), 'danger')] : [],
      halt: !halt ? { has: false } : {
        has: true, title: HALT[halt.kind].label, line: haltLine(halt),
        text: waitsForAds(halt) ? 'Nieuwe campagne: hervat hem zodra de ads live staan. Tot dan staat hij niet in het weekoverzicht, vraagt hij geen wekelijkse feedback en ziet de recruiter hem nog niet. Bij Hervatten krijgt de recruiter een melding.'
          : `Staat niet in het weekoverzicht en vraagt geen wekelijkse feedback. De recruiter ziet hem tot alle kandidaten gebeld zijn.${halt.kind === 'stop' && !can('assign') ? ' Alleen de teamlead kan hem weer activeren.' : ''}`,
        acts: halt.kind === 'pauze' ? (canHalt ? [haltBtn('Hervatten', () => this.setHalt(selC, null), 'accent'), haltBtn('Stopzetten', () => this.askHalt(selC, 'stop'), 'danger')] : [])
          : can('assign') ? [haltBtn('Opnieuw activeren', () => this.setHalt(selC, null), 'accent')] : []
      },
      kpis: [
        { label: 'Campagne loopt', value: n, unit: `van ${n > 6 ? 12 : 6} weken${n > 6 ? ' · verlengd' : ''}` },
        { label: 'Totale instroom', value: total, unit: 'kandidaten' },
        { label: 'Gemiddelde kwaliteit', value: qws.length ? nl(avgOf(qws.map(w => w.q))) : '—', unit: '/10' },
        { label: 'Deze week', value: cw.leads, unit: cw.q != null ? `kandidaten – ${cw.q}/10` : 'kandidaten – nog geen score' }
      ],
      chart: ws.map(w => ({ label: 'W' + wl(w.w), leads: w.leads, lh: Math.max(4, Math.round(w.leads / maxL * 128)) + 'px', lbg: w.w === CUR && !selC.ended ? 'linear-gradient(180deg,#F9CE00 0%,#FB8915 100%)' : '#1B1B63', act: actWeeks.has(w.w) })),
      qPoints: ws.map((w, i) => w.q == null ? null : `${((i + 0.5) / n * 100).toFixed(2)},${100 - w.q * 10}`).filter(Boolean).join(' '),
      qDots: ws.map((w, i) => w.q == null ? null : { x: ((i + 0.5) / n * 100) + '%', y: (w.q * 10) + '%', q: w.q, fg: qc(w.q) }).filter(Boolean),
      story: ws.slice().reverse().map(w => ({
        w: w.w, wl: wl(w.w), range: range(w.w), leads: w.leads, qBg: qb(w.q), qFg: qc(w.q),
        qText: w.q != null ? `Kwaliteit ${w.q}/10` : w.w < FB_START ? 'Voor start monitor' : !needsFeedback(w) ? 'Geen feedback nodig' : 'Geen score',
        // Missing feedback can still be given until the end of the week after; older weeks have expired. A week without
        // new candidates and without calls asks none. Only who sees missing feedback (seesMissing) gets these lines.
        missing: seeMiss && w.q == null && w.w >= FB_START && !selC.inactive && !halt && fbOpenWeek(w.w) && needsFeedback(w),
        expired: seeMiss && w.q == null && w.w >= FB_START && !selC.inactive && !fbOpenWeek(w.w) && needsFeedback(w),
        missText: `Recruiter heeft voor deze week nog geen feedback ingevuld.${w.w < CUR ? ` Dat kan nog tot en met ${dueTxt(w.w)}.` : ''}`, hasFb: w.q != null, rec: w.rec || '—',
        klant: w.klant || 'Nog geen terugkoppeling van klant', klantColor: w.klant ? '#1D1D1B' : '#8C8C8A',
        canFill: canFb && fbOpenWeek(w.w) && !off, canAddKlant: can('feedback.client') && !w.klant && w.w === CUR && !off, addKlant: () => this.startKlant(selC.id),
        note: w.note, hasNote: !!w.note, needsAction: w.needsAction, showTr: !!this.showTrello(),
        upd: w.upd || '', hasUpd: !!w.upd, updBy: w.updBy || 'marketeer',
        monTag: MONITOR[w.mon] ? `${MONITOR[w.mon].label}${w.monBy ? ` · ${w.monBy}` : ''}${w.ctl ? ` · controle ${dayShort(w.ctl)}` : ''}` : '', monFg: MONITOR[w.mon] ? MONITOR[w.mon].fg : '', monBg: MONITOR[w.mon] ? MONITOR[w.mon].bg : '',
        trText: selC.quick ? 'laden…' : `${w.tr.voorgesteld} voorgesteld · ${w.tr.gesprek} ${w.tr.gesprek === 1 ? 'gesprek' : 'gesprekken'}${w.tr.geplaatst ? ` · ${w.tr.geplaatst} geplaatst` : ''}`,
        reasons: reasonList(w.tr.reasons), hasReasons: reasonList(w.tr.reasons).length > 0, rejN: Object.values(w.tr.reasons || {}).reduce((a, b) => a + b, 0),
        acts: selC.actions.filter(a => a.w === w.w), fill: () => this.startCheckin(selC.id, w.w)
      })),
      actions: selC.actions.slice().sort((a, b) => b.w - a.w).map(a => {
        const e = this.effect(selC, a);
        let eff = 'Effect: nog te vroeg om te beoordelen', effFg = '#8C8C8A';
        if (e.qB != null && e.qA != null) { const dq = e.qA - e.qB; eff = `Kwaliteit ${nl(e.qB)} → ${nl(e.qA)} · instroom ${nl(e.lB)} → ${nl(e.lA)} p/w`; effFg = dq > 0 ? '#1A7A4A' : dq < 0 ? '#D32F2F' : '#5C5C5A'; }
        // The change the open controle belongs to says when it comes, or came, up again.
        const ctl = dd.ctl && dd.ctl.act === a.id ? `${dd.ctl.due ? 'Controle sinds' : 'Controle op'} ${dayShort(dd.ctl.at)}` : '';
        return { ...a, wl: wl(a.w), eff, effFg, ctl };
      }),
      noActions: selC.actions.length === 0,
      weekOpts: ws.slice().reverse().map(w => ({ v: w.w, l: 'Week ' + wl(w.w) })),
      ...(() => { const agg = {}; ws.forEach(w => Object.entries(w.tr.reasons || {}).forEach(([k, v]) => { agg[k] = (agg[k] || 0) + v; })); const l = reasonList(agg), mx = Math.max(1, ...l.map(x => x.n)), tot = l.reduce((a, x) => a + x.n, 0);
        return { rej: l.map(x => ({ ...x, pct: (x.n / mx * 100) + '%', share: Math.round(x.n / Math.max(tot, 1) * 100) + '%' })), hasRej: l.length > 0, rejTotal: tot }; })(),
      funnel: funnelDefs.map(([k, label]) => ({ label, n: tot(k), pct: (tot(k) / Math.max(tot('nieuw'), 1) * 100) + '%' })), pipeLoading: !!selC.quick,
      hasFill: !!fillMode && !off,
      fill: fillMode === 'rec' ? () => this.startCheckin(selC.id, fbW) : () => this.startKlant(selC.id),
      fillLabel: fillMode === 'rec' ? `${ownC ? 'Mijn feedback' : 'Recruiterfeedback'} week ${wl(fbW)}` : `Feedback klant week ${wl(CUR)}`,
      // Monitor status and the update for the recruiter: set by whoever has campaigns.monitor, seen by everyone here.
      canMon, monActs: !canMon ? [] : (dd.ms === 'klant' ? [['Check', 'check'], ['Wachten opheffen', 'open']]
        : dd.ms === 'check' ? [['In afwachting van klant', 'klant'], ...(dd.monBy ? [['Check ongedaan maken', 'open']] : [])]
        : [['Check', 'check'], ['In afwachting van klant', 'klant']]).map(([label, v]) => ({ label, primary: v === 'check', onClick: () => this.setMon(selC, v) })),
      upd: (() => {
        const text = st.upd && st.upd.id === selC.id ? st.upd.text : (cw.upd || ''), last = this.lastUpd(selC);
        return { text, dirty: text.trim() !== (cw.upd || ''), has: !!last, last: last || {},
          saved: !last ? '' : last.cur ? `Opgeslagen door ${last.by}` : `Laatste update: ${last.meta.replace('Update van ', '')}`,
          set: e => { const v = e.target.value; this.setState({ upd: { id: selC.id, text: v } }); }, save: () => this.saveUpd(selC),
          hint: selC.inactive ? 'Niet actief: deze campagne heeft geen recruiter.' : selC.rec ? `${selC.rec} ziet dit hier en bij de wekelijkse feedback, en krijgt een melding.` : 'Deze campagne heeft nog geen recruiter.' };
      })()
    };
    const canAsk = can('questions.ask') && selC.id !== 'none', askOpts = canAsk ? this.askTargets(selC) : [];
    const askTo = (askOpts.find(o => o.v === st.ask.to) || askOpts[0] || {}).v || '';
    const zone = {
      red: R.qRedOn ? ((R.qRed + 0.5) * 10) + '%' : '0%',
      green: ((10 - R.qOrange - 0.5) * 10) + '%',
      redText: `Rood signaal (≤ ${R.qRed})`, greenText: `Geen signaal (≥ ${R.qOrange + 1})`
    };

    // history
    const period = +st.hist.period;
    const hw = Array.from({ length: period }, (_, i) => CUR - period + 1 + i);
    const hc = this.visible(st.campaigns, me).filter(c => (st.hist.status === 'all' || (st.hist.status === 'ended' ? c.ended : !c.ended)) && (st.hist.rec === 'all' || c.rec === st.hist.rec));
    const histRows = hc.map(c => {
      const inP = c.weeks.filter(w => hw.includes(w.w));
      const qv = inP.filter(w => w.q != null).map(w => w.q);
      const a = avgOf(qv);
      const aw = new Set(c.actions.map(x => x.w));
      return {
        client: c.client, vac: c.vac + (c.ended ? ' (afgerond)' : ''),
        dot: c.ended ? '#C0BDB9' : MONITOR[monitor(c, health(c, R)).s].fg,
        cells: hw.map(w => { const e = c.weeks.find(x => x.w === w); return e ? { t: e.q ?? (w < FB_START ? '–' : '?'), bg: qb(e.q), fg: qc(e.q), act: aw.has(w) } : { t: '', bg: 'transparent', fg: '#8C8C8A', act: false }; }),
        total: inP.reduce((s, w) => s + w.leads, 0), avgN: a ?? 0, avg: a == null ? '—' : nl(a), avgFg: qc(a == null ? null : Math.round(a)),
        placed: inP.reduce((s, w) => s + w.tr.geplaatst, 0), acts: c.actions.filter(x => hw.includes(x.w)).length,
        open: () => this.open(c.id)
      };
    }).sort((a, b) => b.avgN - a.avgN);
    const allW = hc.flatMap(c => c.weeks.filter(w => hw.includes(w.w)));
    const allQ = allW.filter(w => w.q != null).map(w => w.q);
    const histKpis = [
      { label: 'Totale instroom', value: allW.reduce((s, w) => s + w.leads, 0).toLocaleString('nl-NL') },
      { label: 'Gem. instroom p/w', value: allW.length ? nl(avgOf(allW.map(w => w.leads))) : '—' },
      { label: 'Gem. kwaliteit', value: allQ.length ? nl(avgOf(allQ)) + '/10' : '—' },
      { label: 'Wijzigingen', value: hc.reduce((s, c) => s + c.actions.filter(a => hw.includes(a.w)).length, 0) }
    ];
    const effects = hc.flatMap(c => c.actions.filter(a => hw.includes(a.w)).map(a => {
      const e = this.effect(c, a), okQ = e.qB != null && e.qA != null, dq = okQ ? e.qA - e.qB : 0;
      return {
        w: a.w, wl: wl(a.w), client: c.client, vac: c.vac, type: a.type, text: a.text,
        q: okQ ? `${nl(e.qB)} → ${nl(e.qA)}` : 'nog te vroeg', qd: okQ ? sgn(dq) : '', qFg: dq > 0 ? '#1A7A4A' : dq < 0 ? '#D32F2F' : '#5C5C5A',
        l: e.lB != null && e.lA != null ? `${nl(e.lB)} → ${nl(e.lA)}` : '—', ld: e.lB != null && e.lA != null ? sgn(e.lA - e.lB) : '',
        open: () => this.open(c.id)
      };
    })).sort((a, b) => b.w - a.w);

    // rules
    const hits = k => { const n = running.filter(c => health(c, R).reasons.some(r => r.k === k)).length; return n === 1 ? '1 campagne' : `${n} campagnes`; };
    const lead = can('rules.edit');
    const rule = (lvl, onKey, pre, valKey, post, hitKey) => ({
      pre, post, hasVal: !!valKey, val: valKey ? R[valKey] : '', fg: R[onKey] ? '#1D1D1B' : '#8C8C8A', dot: STAT[lvl].fg,
      locked: !lead, cursor: lead ? 'pointer' : 'default', op: lead ? 1 : 0.6,
      setVal: e => { if (lead) this.setRule(valKey, Math.max(0, +e.target.value || 0)); },
      toggle: () => { if (lead) this.setRule(onKey, !R[onKey]); }, tBg: R[onKey] ? '#1B1B63' : '#C0BDB9', knob: R[onKey] ? '18px' : '2px',
      hits: R[onKey] ? hits(hitKey) : 'uit'
    });
    // Every rule puts a campaign on Actie nodig; red (2) signals come before orange (1) in the lists.
    const rules = [
      rule(2, 'qRedOn', 'Kwaliteit is', 'qRed', 'of lager', 'qRed'),
      rule(2, 'declOn', 'Kwaliteit daalt', 'declWeeks', 'weken achter elkaar', 'decl'),
      rule(2, 'minLeadsOn', 'Instroom vorige week was', 'minLeads', 'kandidaten of minder', 'minLeads'),
      rule(2, 'manualOn', 'Recruiter heeft ‘Bijsturing nodig’ aangevinkt', null, '', 'manual'),
      rule(1, 'qOrangeOn', 'Kwaliteit is', 'qOrange', 'of lager', 'qOrange'),
      rule(1, 'dropOn', 'Instroom vorige week lag', 'dropPct', '% of meer onder het gemiddelde van de 3 weken ervoor', 'drop')
    ];

    const tv = e => e.target.value;
    const kq0 = this.klantQueue(), kOpen = kq0.filter(c => !c.weeks[c.weeks.length - 1].klant).length, kShown = kq0.filter(c => matchesQ(c, st.kQ));
    // The search filters the list only; the counts stay about the whole week.
    const noneFor = q => `Geen campagnes voor “${q.trim()}”`;
    const kC = st.kform ? st.campaigns.find(c => c.id === st.kform.id) : null;
    let kc = {};
    if (kC) {
      const cw = kC.weeks[kC.weeks.length - 1], pw = kC.weeks[kC.weeks.length - 2];
      kc = { client: kC.client, vac: kC.vac, rec: kC.inactive ? 'Niet actief' : kC.rec, leads: cw.leads, qText: cw.q != null ? `kwaliteit ${cw.q}/10` : 'nog geen score',
        recText: cw.rec || (kC.inactive ? 'Niet actief: geen recruiterfeedback.' : this.seesMissing(kC, me) ? `${kC.rec} heeft nog geen feedback ingevuld.` : 'Geen recruiterfeedback deze week.'), recColor: cw.rec ? '#1D1D1B' : '#8C8C8A',
        prevKlant: pw && pw.klant ? `“${pw.klant}”` : 'geen' };
    }
    return {
      wk: { n: wl(CUR), today: todayLong(), range: rangeLong(CUR), histRange: `Week ${wl(hw[0])} – ${wl(CUR)}` },
      user: { id: me.id, name: me.name, roleLabel: me.roleLabel, isPreview: me.isPreview }, authorName: this.author(),
      account: { name: acc.name, roleLabel: ROLES[acc.role].label, levelLabel: LEVELS[ROLES[acc.role].level].label },
      viewAs: this.viewAsVals(), navSections, goSettings: () => { this.setState({ settingsTab: 'account' }); this.go('settings'); },
      navOpen: st.navOpen, openNav: () => this.setState({ navOpen: true }), closeNav: () => this.setState({ navOpen: false }),
      isSettings: st.view === 'settings', settings: this.settingsVals(me),
      isDev: st.view === 'dev' && this.viewOk('dev', me), dev: this.devVals(),
      recNames, isMine, sortOptions, sortValue,
      campTitle: isMine ? 'Mijn campagnes' : 'Actieve campagnes',
      isKlant: st.view === 'klant', goKlant: () => this.go('klant'), goMine: () => this.go('mine'),
      hasKform: !!kC, kform: st.kform || {}, kc, skipKlant: () => this.skipKlant(),
      sourceTabs: !acc.rights.includes('dev') ? [] : [['demo', 'Demo-data'], ['trello', 'Trello live']].map(([k, label]) => ({ label, bg: st.source === k ? '#FFFFFF' : 'transparent', fg: st.source === k ? '#1D1D1B' : '#5C5C5A', sh: st.source === k ? '0 1px 4px rgba(29,29,27,.07)' : 'none', onClick: () => this.setSource(k) })),
      syncText: this.syncInfo().text, syncDot: this.syncInfo().dot,
      reloadTrello: () => { if (st.source === 'trello') this.startLive(); },
      liveEmpty: (st.source === 'trello' || ownOnly) && shown.length === 0, goAssign: () => this.go('toewijzing'),
      emptyTitle: ownOnly ? 'Nog geen klanten voor jou' : 'Nog geen campagnes gekoppeld',
      emptyHint: ownOnly ? 'Er zijn nog geen klanten aan jou toegewezen. De teamlead doet dat onder Toewijzing.' : can('assign') ? 'Wijs eerst de actieve Trello-borden toe aan een recruiter.' : 'De teamlead wijst de Trello-borden toe aan recruiters. Daarna verschijnen ze hier.',
      canAssign: can('assign'), canRemind: can('reminders.send'), canActions: can('campaign.changes'),
      canTrelloTest: this.viewOk('trello-test', me), goTrelloTest: () => this.go('trello-test'),
      canIntegrations: acc.rights.includes('integrations'), goIntegrations: () => { this.setState({ settingsTab: 'integrations' }); this.go('settings'); },
      isTrelloTest: st.view === 'trello-test' && this.viewOk('trello-test', me), trelloConfigured: st.config.trello, goTrelloLive: () => { this.setSource('trello'); this.go('toewijzing'); },
      isAssign: st.view === 'toewijzing' && can('assign'), asg: this.assignData(), asgQ: st.asg.q,
      setAsgQ: e => { const v = e.target.value; this.setState(s => ({ asg: { ...s.asg, q: v } })); },
      isLive: st.view === 'live', live: this.liveData(me), goCheckin: () => this.go('checkin'),
      kq: { doneText: `${kq0.length - kOpen} van ${kq0.length} klanten gaven feedback deze week`, total: kq0.length, open: kOpen, done: kq0.length - kOpen, pct: ((kq0.length - kOpen) / Math.max(kq0.length, 1) * 100) + '%',
        none: kq0.length && !kShown.length ? noneFor(st.kQ) : '',
        items: kShown.map(c => { const has = !!c.weeks[c.weeks.length - 1].klant, sel = st.kform && st.kform.id === c.id;
          return { sel, client: c.client, vac: c.vac, bg: sel ? '#FFF8E0' : '#FFFFFF', mark: has ? '✓' : '', markBg: has ? '#E6F4ED' : '#F5F2ED', markBorder: '0', onClick: () => this.loadKlant(c.id) }; }) },
      kQ: st.kQ, setKQ: e => this.setState({ kQ: tv(e) }),
      setKformText: e => { const v = tv(e); this.setState(s => ({ kform: { ...s.kform, klant: v } })); },
      saveKlant: () => this.saveKlant(), kSaveLabel: kOpen > 1 ? 'Opslaan & volgende' : 'Feedback opslaan',
      sum, fbBar, groups, list, listCount: list.length, listEmpty: list.length === 0, statusTabs, recOptions, f: st.f,
      isWeek: st.view === 'week', isCampaigns: st.view === 'campaigns' || st.view === 'mine', isCheckin: st.view === 'checkin', isDetail: st.view === 'detail', isHistory: st.view === 'history', isRules: st.view === 'rules',
      goCampaigns: () => { setF({ status: 'all' }); this.go('campaigns'); }, goWeek: () => this.go('week'),
      goBack: () => this.navBack(), backLabel: { settings: 'Instellingen', toewijzing: 'Toewijzing', 'trello-test': 'Trello-koppeling testen', week: 'Weekoverzicht', campaigns: 'Campagnes', mine: 'Mijn campagnes', live: 'Live campagnes', klant: 'Feedback klant', history: 'Historie & analyse', checkin: `Feedback week ${wl(CUR)}`, rules: 'Health-regels' }[st.back] || 'Campagnes',
      // Reminders: only to recruiters who didn't get one in the last 48 hours.
      remind: () => {
        const byRec = {}, now = Date.now();
        missingD.filter(m => ri.ok.includes(m.rec)).forEach(m => { (byRec[m.rec] = byRec[m.rec] || []).push(`${m.client} – ${m.vac}`); });
        const add = Object.entries(byRec).map(([rec, items]) => ({ id: now + rec, ts: now, to: rec, from: this.author(), at: stamp(), read: false, kind: 'reminder', title: `Nog ${items.length} ${items.length === 1 ? 'campagne' : 'campagnes'} zonder feedback voor week ${wl(CUR)}`, items }));
        if (!add.length) return;
        this.setState(s => ({ inbox: [...add, ...s.inbox] })); this.flash(`Herinnering gestuurd naar ${names(Object.keys(byRec))}`);
      },
      canSendRemind: ri.ok.length > 0, remindLabel: ri.ok.length ? 'Herinnering sturen' : 'Herinnering verstuurd ✓',
      remindNote: !ri.wait.length ? '' : `${names(ri.wait)} ${ri.wait.length === 1 ? 'kreeg' : 'kregen'} de afgelopen 48 uur al een herinnering${ri.ok.length ? '' : `. Weer mogelijk vanaf ${when(ri.next)}`}.`,
      setSearch: e => setF({ q: tv(e) }), setSort: e => setF(isMine ? { mineSort: tv(e) } : { sort: tv(e) }),
      ci: st.ci, ciRecOptions: [{ v: 'all', l: 'Alle recruiters' }, ...recNames.map(r => ({ v: r, l: 'Ingevuld door ' + r }))],
      setCiRec: e => { const v = tv(e); this.setState(s => ({ ci: { ...s.ci, rec: v } }), () => this.enterCheckin()); },
      ciQ: st.ciQ, setCiQ: e => this.setState({ ciQ: tv(e) }), ciNone: queue.length && !shownQ.length ? noneFor(st.ciQ) : '',
      // Last week's items come first, under their own heading, when there are any (among the search results). Campaigns
      // that need no feedback this week come last, greyed, under their own heading; they can still be filled in.
      queue: shownQ.map((i, k) => {
        const part = x => x.late ? 'late' : x.needed ? 'now' : 'none';
        const wk = i.c.weeks.find(x => x.w === i.w), filled = wk.q != null, doneQ = !i.open, sel = isForm(i), first = k === 0 || part(shownQ[k - 1]) !== part(i);
        const head = !first ? '' : i.late ? `Nog open van week ${wl(i.w)} · vervalt ${dueTxt(i.w)}` : !i.needed ? 'Geen feedback nodig · geen nieuwe kandidaten, niet gebeld' : shownQ[0].late ? `Week ${wl(CUR)}` : '';
        return { sel, client: i.c.client, vac: i.late ? `${i.c.vac} · week ${wl(i.w)}` : i.c.vac, vacFg: i.late ? '#B45309' : !i.needed ? '#8C8C8A' : '#5C5C5A', head,
          qText: filled ? wk.q + '/10' : '', qFg: qc(wk.q), bg: sel ? '#FFF8E0' : '#FFFFFF',
          mark: filled ? '✓' : !i.needed ? '–' : '', markBg: filled ? '#E6F4ED' : !i.needed ? '#F5F2ED' : '#FFFFFF', markFg: filled ? '#1A7A4A' : '#8C8C8A',
          markBorder: doneQ ? '0' : `1.5px solid ${i.late ? '#F9A800' : '#C0BDB9'}`, onClick: () => this.loadForm(i.c.id, i.w) };
      }),
      queueTotal: nowQ.length, queueOpen: qOpen, queueDone: nowQ.length - qOpen, queuePct: ((nowQ.length - qOpen) / Math.max(nowQ.length, 1) * 100) + '%',
      queueComplete: queue.length > 0 && qOpen === 0 && lateOpen === 0, queueDoneTitle: nowQ.length ? `Alles ingevuld voor week ${wl(CUR)}` : `Geen feedback nodig voor week ${wl(CUR)}`,
      hasLate: lateOpen > 0, lateText: `+ ${lateOpen} van week ${wl(CUR - 1)} · vervalt ${dueTxt(CUR - 1)}`,
      hasForm: !!fcC, form: f || {}, fc, scoreBtns,
      saveLabel: shownQ.some(i => i.open && !isForm(i)) ? 'Opslaan & volgende' : 'Feedback opslaan',
      setLeads: e => this.setForm({ leads: tv(e).replace(/\D/g, '') }), decLeads: () => this.setForm({ leads: Math.max(0, (+f.leads || 0) - 1) }), incLeads: () => this.setForm({ leads: (+f.leads || 0) + 1 }),
      setRecText: e => this.setForm({ rec: tv(e) }), setKlantText: e => this.setForm({ klant: tv(e) }), setNote: e => this.setForm({ note: tv(e) }),
      toggleNeeds: () => this.setForm({ needsAction: !f.needsAction }), needsBg: f && f.needsAction ? '#D32F2F' : '#C0BDB9', needsKnob: f && f.needsAction ? '18px' : '2px',
      saveForm: () => this.saveForm(),
      d, zone, showTrello: this.showTrello(), act: st.act, actTypes: ACT_TYPES,
      setActType: e => { const v = tv(e); this.setState(s => ({ act: { ...s.act, type: v } })); },
      setActWeek: e => { const v = +tv(e); this.setState(s => ({ act: { ...s.act, w: v } })); },
      setActText: e => { const v = tv(e); this.setState(s => ({ act: { ...s.act, text: v } })); },
      // Controle in x dagen with a change: only who may set the monitor status, on a running campaign.
      canCtl: d.canMon, setActCtl: v => this.setState(s => ({ act: { ...s.act, ctl: v } })),
      addAction: () => this.addAction(),
      canAsk, ask: { text: st.ask.text, to: askTo, opts: askOpts, hasOpts: askOpts.length > 0 },
      setAskTo: e => { const v = tv(e); this.setState(s => ({ ask: { ...s.ask, to: v } })); },
      setAskText: e => { const v = tv(e); this.setState(s => ({ ask: { ...s.ask, text: v } })); },
      askQuestion: () => this.askQuestion(selC),
      hist: st.hist, histWeeks: hw.map(w => 'W' + wl(w)), histN: hw.length, histCols: `${hw.length * 40}px`, histRows, histKpis, effects,
      setHistStatus: e => { const v = tv(e); this.setState(s => ({ hist: { ...s.hist, status: v } })); },
      setHistRec: e => { const v = tv(e); this.setState(s => ({ hist: { ...s.hist, rec: v } })); },
      setHistPeriod: e => { const v = tv(e); this.setState(s => ({ hist: { ...s.hist, period: v } })); },
      exportCsv: () => this.exportCsv(),
      rules, rulesLocked: !lead, resetRules: () => { this.setState({ rules: { ...DEF_RULES } }); this.flash('Standaardregels hersteld'); },
      isBlacklist: st.view === 'blacklist',
      bl: { canManage: can('blacklist.manage'), me: { id: me.id, name: me.name }, isLocal: this.sync.mode === 'local',
        campaigns: active.map(c => ({ client: c.client, vac: c.vac })).sort((a, b) => a.client.localeCompare(b.client) || a.vac.localeCompare(b.vac)),
        flash: t => this.flash(t), onCounts: s => this.setState({ blSum: s }) },
      canResetDemo: st.source === 'demo' && can('dev'),
      resetDemo: () => {
        if (!window.confirm('Demo-data en health-regels terugzetten naar de beginstand? Dit geldt voor het hele team.')) return;
        this.setState({ campaigns: build(), rules: { ...DEF_RULES }, form: null }); this.flash('Demo-data hersteld');
      },
      saveOffline: st.saveState === 'offline', isLocal: this.sync.mode === 'local',
      ...this.panelVals(me),
      hasToast: !!st.toast, toast: st.toast,
      hasConfirm: !!st.confirm, confirm: st.confirm ? { ...st.confirm, onCancel: () => this.setState({ confirm: null }) } : null,
      hasCtlDlg: !!st.ctlDlg, ctlDlg: !st.ctlDlg ? null : {
        title: st.ctlDlg.title, value: st.ctlDlg.days, onOk: () => this.saveCtl(), onCancel: () => this.setState({ ctlDlg: null }),
        onChange: v => this.setState(s => ({ ctlDlg: s.ctlDlg && { ...s.ctlDlg, days: v } }))
      }
    };
  }
  /** The "Bekijk als" picker: the team members whose view you may open, grouped by role. */
  viewAsVals() {
    const st = this.state, acc = st.account;
    const list = st.members.filter(m => m.rights && m.status !== 'deactivated' && canViewAs(acc, m));
    return {
      enabled: list.length > 0, value: st.viewAs || '', active: !!st.viewAs,
      onChange: e => this.setViewAs(e.target.value),
      groups: Object.keys(ROLES).map(r => ({ label: ROLES[r].label, members: list.filter(m => m.role === r) })).filter(g => g.members.length)
    };
  }
  /** Open bugs and ideas the Dev hasn't put in a group yet (Dev › Bugs & ideeën). */
  unsortedIdeas() { return this.state.ideas.filter(x => !x.prio && (x.status === 'nieuw' || x.status === 'opgepakt')).length; }
  devVals() {
    const st = this.state;
    return {
      ideas: st.ideas, email: st.account.email, isLocal: this.sync.mode === 'local', flash: t => this.flash(t),
      canIntegrations: st.account.rights.includes('integrations'), goIntegrations: () => { this.setState({ settingsTab: 'integrations' }); this.go('settings'); },
      setIdea: (id, p) => this.setState(s => ({ ideas: s.ideas.map(x => x.id === id ? { ...x, ...p } : x) })),
      // '' is Ongesorteerd: the field goes, so the report looks like a new one.
      setPrio: (id, k) => this.setState(s => ({ ideas: s.ideas.map(x => { if (x.id !== id) return x; const { prio, ...rest } = x; return k ? { ...rest, prio: k } : rest; }) })),
      removeIdea: id => this.setState(s => ({ ideas: s.ideas.filter(x => x.id !== id) }))
    };
  }
  settingsVals(me) {
    const st = this.state;
    return {
      tab: st.settingsTab, setTab: t => { this.setState({ settingsTab: t }); window.scrollTo(0, 0); },
      account: st.account, members: st.members, canReal: r => st.account.rights.includes(r),
      flash: t => this.flash(t), reloadMe: () => this.reloadMe(), reloadConfig: () => this.reloadConfig(),
      isPreview: me.isPreview, previewName: me.name, isLocal: this.sync.mode === 'local',
      campaigns: st.campaigns, onDemo: st.source !== 'trello'
    };
  }
  /** Ermee bezig / Done for the client with this key (Trello board, or client in demo): s is 'bezig', 'done' or ''. */
  setLiveStatus(key, s) {
    this.setState(st => {
      const { [key]: was, ...rest } = st.live.status || {};
      return { live: { ...st.live, status: s ? { ...rest, [key]: { s, by: this.author(), at: Date.now() } } : rest } };
    });
  }
  liveData(me) {
    const R = this.state.rules;
    // A campaign on Pauze or stopped stays here, tagged, until all its candidates are called. A new one waiting for its
    // ads only shows up once it's resumed.
    const mine = this.state.campaigns.filter(c => !c.ended && c.rec === me.rec && recruiterSees(c));
    const now = Date.now(), recent = {}, S = this.state.seen[me.id] || {}, since = S.prev ?? now - 864e5, dis = S.dismissed || 0;
    // An assignment while all its campaigns waited for their ads (wacht) counts from when one was resumed.
    const log = this.state.assignLog.filter(e => e.mode === this.state.source && !e.wacht);
    log.filter(e => e.at > dis && (e.at > since || now - e.at < 864e5)).sort((a, b) => b.at - a.at).forEach(e => { if (!recent[e.client]) recent[e.client] = e; });
    const hhmm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    const mineNew = Object.values(recent).filter(e => e.to === me.rec), gone = Object.values(recent).filter(e => e.from === me.rec && e.to !== me.rec);
    const changes = [
      ...mineNew.map(e => ({ client: e.client, text: e.from ? `overgenomen van ${e.from}` : 'nieuw bedrijf', tag: e.from ? 'Overgenomen' : 'Nieuw', tBg: e.from ? '#E7E7F0' : '#FFF8E0', tFg: e.from ? '#1B1B63' : '#B45309', at: `${new Date(e.at).toDateString() === new Date().toDateString() ? 'vandaag' : new Date(e.at).getDate() + ' ' + MON[new Date(e.at).getMonth()]} ${hhmm(e.at)} · door ${e.by}` })),
      ...gone.map(e => ({ client: e.client, text: `overgedragen aan ${e.to}`, tag: 'Overgedragen', tBg: '#F5F2ED', tFg: '#5C5C5A', at: `vandaag ${hhmm(e.at)} · door ${e.by}` }))
    ];
    const nN = mineNew.filter(e => !e.from).length, nO = mineNew.filter(e => e.from).length;
    const chTitle = [nN ? `${nN} ${nN === 1 ? 'nieuw bedrijf' : 'nieuwe bedrijven'}` : '', nO ? `${nO} overgenomen` : '', gone.length ? `${gone.length} overgedragen` : ''].filter(Boolean).join(' · ');
    // Added: when the client was last assigned to me; without that in the log, when its Trello board was made (that's earlier).
    const added = {};
    log.forEach(e => { if (e.to === me.rec && e.at > (added[e.client] || 0)) added[e.client] = e.at; });
    // One row per client (Trello board): recruiters call per board. A client with several functions folds open.
    const sort = this.state.liveSort, groups = groupByClient(mine.map(c => {
      // Wekelijkse controle is the marketeer's to-do; for the recruiter it is a campaign without signals, like Check.
      // noFb: nothing open and this week needs no feedback (no new candidates, not called).
      const ms = monitor(c, health(c, R)).s, { nieuw, contact, gebeld } = callList(c), cw = c.weeks[c.weeks.length - 1], open = openWeeks(c).length > 0;
      return { id: c.id, key: c.boardId || c.client, client: c.client, vac: c.vac, mkt: this.mktOf(c), nieuw, contact, gebeld, total: nieuw + contact, open,
        noFb: !c.halt && !open && cw.q == null && !needsFeedback(cw),
        rank: MONITOR[ms === 'goed' ? 'check' : ms].rank, tag: c.halt ? haltLabel(c.halt) : '', added: added[c.client] || trelloCreated(c.boardId) };
    }), sort);
    const mx = Math.max(...groups.map(g => g.total), 1), exp = this.state.liveExp;
    const dotOf = rank => MONITOR[MONITOR_KEYS.find(k => MONITOR[k].rank === rank)].fg;
    // Feedback: open ones link to Wekelijkse feedback recruiter, on the first open function. off: all on Pauze or stopped,
    // or needing no feedback; n: the functions that do.
    const cells = (x, n, openN, openId, off) => ({
      dot: dotOf(x.rank), nieuw: x.nieuw, contact: x.contact, total: x.total, nPct: (x.nieuw / mx * 100) + '%', cPct: (x.contact / mx * 100) + '%',
      nFg: x.nieuw ? '#1B1B63' : '#C0BDB9', cFg: x.contact ? '#B45309' : '#C0BDB9',
      fbText: off ? 'Niet nodig' : !openN ? '✓ Ingevuld' : openN === n ? 'Open' : `${openN} van ${n} open`, fbOpen: openN > 0, fbFg: off ? '#8C8C8A' : '#1A7A4A',
      fill: e => { e.stopPropagation(); this.startCheckin(openId); }
    });
    // Ermee bezig / Done per client, today only. Anyone can set it, also in Bekijk als (under their own name).
    const status = this.state.live.status || {};
    const rows = groups.map(g => {
      const ev = recent[g.client], mineEv = ev && ev.to === me.rec, multi = g.fns.length > 1, on = multi && !!exp[g.key];
      const e = status[g.key], st = statusToday(e, now);
      const asks = g.fns.filter(f => !f.tag && !f.noFb).length;
      return { ...cells(g, asks, g.open, g.firstOpen, !asks), key: g.key, client: g.client, vac: multi ? `${g.fns.length} functies` : g.fns[0].vac, mkt: g.fns[0].mkt || '—',
        st, stBy: st ? e.by : '', stAt: st ? hhmm(e.at) : '', setSt: x => { x.stopPropagation(); this.setLiveStatus(g.key, nextStatus(st)); },
        tag: multi ? '' : g.fns[0].tag, multi, expanded: on, open: multi ? () => this.setState(s => ({ liveExp: { ...s.liveExp, [g.key]: !on } })) : () => this.open(g.fns[0].id),
        fns: on ? g.fns.map(f => ({ ...cells(f, 1, f.open ? 1 : 0, f.id, !!f.tag || f.noFb), vac: f.vac, tag: f.tag, open: () => this.open(f.id) })) : [],
        hasBadge: !!mineEv, badge: mineEv ? (ev.from ? `Overgenomen van ${ev.from}` : 'Nieuw') : '', bBg: mineEv && ev.from ? '#E7E7F0' : '#FFF8E0', bFg: mineEv && ev.from ? '#1B1B63' : '#B45309' };
    });
    // Open feedback: last week's (catching up, expires on Sunday) first, then this week's.
    const ow = mine.map(c => openWeeks(c)), lateN = ow.filter(x => x.some(w => w < CUR)).length, curN = ow.filter(x => x.includes(CUR)).length;
    const sum = k => groups.reduce((s, g) => s + g[k], 0);
    return {
      sinceText: (() => { const d = new Date(since); const today = new Date().toDateString() === d.toDateString(); return `Sinds je vorige login (${today ? 'vandaag' : d.getDate() + ' ' + MON[d.getMonth()]} ${hhmm(since)}) · minstens 24 uur zichtbaar`; })(),
      markSeen: () => { if (me.isPreview) { this.flash('Dat kan niet in Bekijk als'); return; } this.setState(s => ({ seen: { ...s.seen, [me.id]: { ...(s.seen[me.id] || {}), dismissed: Date.now() } } })); },
      count: mine.length, rows, isEmpty: mine.length === 0, changes,
      sortOptions: LIVE_SORTS.map(([v, l]) => ({ v, l: 'Sorteer: ' + l })), sortValue: LIVE_SORTS.some(([k]) => k === sort) ? sort : LIVE_SORTS[0][0],
      setSort: e => { const k = e.target.value; lsSet(LIVE_SORT_KEY, k); this.setState({ liveSort: k }); }, hasChanges: changes.length > 0, chTitle, hasOpen: lateN + curN > 0,
      openText: lateN ? `${lateN} ${lateN === 1 ? 'campagne' : 'campagnes'} van week ${wl(CUR - 1)} ${lateN === 1 ? 'staat' : 'staan'} nog open` : curN === 1 ? '1 campagne wacht op je feedback' : `${curN} campagnes wachten op je feedback`,
      openSub: lateN ? `· vervalt ${dueTxt(CUR - 1)}${curN ? ` · nog ${curN} voor week ${wl(CUR)}` : ''}` : `voor week ${wl(CUR)}`,
      kpis: [
        { label: 'Vandaag te bellen', value: sum('total'), sub: 'nieuw + contactpogingen', fg: '#FFFFFF', lfg: 'rgba(255,255,255,.8)', bg: '#1B1B63', border: '#1B1B63' },
        { label: 'Nieuwe kandidaten', value: sum('nieuw'), sub: 'eerste keer bellen', fg: '#1B1B63', lfg: '#5C5C5A', bg: '#FFFFFF', border: '#E4E1DE' },
        { label: 'Contactpogingen', value: sum('contact'), sub: sum('gebeld') ? `opnieuw bellen · ${sum('gebeld')} vandaag gebeld` : 'opnieuw bellen', fg: '#B45309', lfg: '#5C5C5A', bg: '#FFFFFF', border: '#E4E1DE' }
      ]
    };
  }
  showTrello() { return this.props.showTrello ?? true; }

  render() {
    if (this.state.bootError) return <div className="boot"><img src="/logo.png" alt="Horeca Toppers" /><div>{this.state.bootError}</div></div>;
    if (!this.state.loaded) return <div className="boot"><img src="/logo.png" alt="Horeca Toppers" /><div>Laden…</div></div>;
    const v = this.renderVals();
    return (
      <>
        <div className={v.navOpen ? 'app-shell nav-open' : 'app-shell'} inert={v.hasConfirm ? '' : undefined}>
          <MobileBar v={v} />
          <Sidebar v={v} />
          <div className="nav-backdrop" onClick={v.closeNav} aria-hidden="true" />
          <main className="app-main" inert={v.navOpen ? '' : undefined}>
            <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
              {v.isLocal ? <div style={{ background: '#FFF8E0', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', marginBottom: '20px' }}><b>Lokale demo zonder server.</b> Inloggen en rechten staan uit, en wat je invult blijft alleen in deze browser; het team ziet het niet.</div> : null}
              {v.saveOffline ? <div style={{ background: '#FDECEA', color: '#D32F2F', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', fontWeight: 500, marginBottom: '20px' }}>Geen verbinding met de server. Je wijzigingen worden opgeslagen zodra de verbinding terug is; sluit dit tabblad nog niet.</div> : null}
              {v.user.isPreview ? <div style={{ background: '#FFF8E0', borderRadius: '12px', padding: '10px 16px', fontSize: '14px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Je bekijkt de app als <b>{v.user.name}</b> ({v.user.roleLabel}). Wat je opslaat, wordt opgeslagen als {v.authorName}, met je eigen rechten.</span>
                <button onClick={() => this.setViewAs('')} className="link-btn">Stoppen</button>
              </div> : null}
              <TopActions v={v} />
              {v.isWeek ? <WeekView v={v} /> : null}
              {v.isCampaigns ? <CampaignsView v={v} /> : null}
              {v.isCheckin ? <CheckinView v={v} /> : null}
              {v.isLive ? <LiveView v={v} /> : null}
              {v.isTrelloTest ? <TrelloTestView v={v} tget={p => this.tget(p)} /> : null}
              {v.isAssign ? <AssignView v={v} /> : null}
              {v.isKlant ? <KlantView v={v} /> : null}
              {v.isDetail ? <DetailView v={v} /> : null}
              {v.isHistory ? <HistoryView v={v} /> : null}
              {v.isRules ? <RulesView v={v} /> : null}
              {v.isBlacklist ? <BlacklistView b={v.bl} /> : null}
              {v.isSettings ? <SettingsView s={v.settings} /> : null}
              {v.isDev ? <DevView d={v.dev} /> : null}
            </div>
          </main>
        </div>
        {v.hasPanel ? <SidePanel v={v} /> : null}
        {v.hasConfirm ? <ConfirmDialog {...v.confirm} /> : null}
        {v.hasCtlDlg ? <CtlDialog {...v.ctlDlg} /> : null}
        {v.hasToast ? <div role="status" className="toast" style={{ position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', background: '#1B1B63', color: '#FFFFFF', padding: '12px 18px', borderRadius: '10px', fontSize: '14px', boxShadow: '0 8px 32px rgba(29,29,27,.15)', zIndex: 10 }}>{v.toast}</div> : null}
      </>
    );
  }
}
