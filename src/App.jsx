// Campagnemonitor — app logic. Ported from the Claude Design prototype: renderVals() computes everything the
// views show; the views in ./views are plain markup. Shared data is kept in sync with the server by ./lib/sync.js.
import React from 'react';
import { CUR, MON, wl, range, rangeLong, todayLong, stamp, weekOf, isoDate, mondayOf } from './lib/weeks.js';
import {
  RECS, MKTS, RENAME, USERS, STAT, DEF_RULES, LABEL_COLORS, TR_EXTRA, TR_INACTIVE, TCOL, TCOLHEX, RANK, stageOf, cardTs,
  NEWS, IDEA_TYPES, IDEA_STATUS, VIEW_NAMES, ACT_TYPES
} from './lib/constants.js';
import { qc, qb, nl, avgOf, sgn, reasonList, agoTxt, lsGet, lsSet, rnd, health } from './lib/helpers.js';
import { build, ensureReasons, rollForward, seedAssign } from './lib/demoData.js';
import { Sync, fromDocs } from './lib/sync.js';

import Sidebar from './views/Sidebar.jsx';
import TopActions from './views/TopActions.jsx';
import WeekView from './views/WeekView.jsx';
import CampaignsView from './views/CampaignsView.jsx';
import CheckinView from './views/CheckinView.jsx';
import LiveView from './views/LiveView.jsx';
import TrelloView from './views/TrelloView.jsx';
import TrelloTestView from './views/TrelloTestView.jsx';
import AssignView from './views/AssignView.jsx';
import KlantView from './views/KlantView.jsx';
import DetailView from './views/DetailView.jsx';
import HistoryView from './views/HistoryView.jsx';
import RulesView from './views/RulesView.jsx';
import SidePanel from './views/SidePanel.jsx';

// Per-browser settings (who you are, chosen data source, news read)
const USER_KEY = 'ht-cm-user', SRC_KEY = 'ht-cm-source', NEWS_KEY = 'ht-cm-news-seen';
const prepCampaigns = cs => rollForward(cs.map(c => RENAME[c.rec] ? { ...c, rec: RENAME[c.rec] } : c).map(ensureReasons));

class TrelloError extends Error {}

export default class App extends React.Component {
  static defaultProps = { startView: 'week', showTrello: true };
  state = this.initState();

  initState() {
    const uid = lsGet(USER_KEY, 'robbin'), u = USERS.find(x => x.id === uid) || USERS[0];
    return {
      loaded: false, saveState: 'ok', config: { trello: false, auth: false },
      user: u.id, view: u.role === 'recruiter' ? 'live' : (this.props.startView || 'week'), sel: 'c1', back: u.role === 'recruiter' ? 'live' : 'week', kform: null,
      campaigns: null, rules: { ...DEF_RULES },
      f: { q: '', status: 'all', rec: 'all', sort: 'status' },
      ci: { rec: u.rec || 'all' }, form: null,
      hist: { status: 'all', rec: 'all', period: '12' },
      act: { type: 'Advertentie', text: '', w: CUR },
      toast: null, reminded: false, trTab: 'open', trSel: {}, trVac: {}, asg: { tab: 'open', q: '' }, mktDemo: null, seen: null, panel: null,
      assignLog: null, inbox: null, ideas: null, newsSeen: lsGet(NEWS_KEY, 0), idea: { type: 'bug', text: '', filter: 'all' }, trShowInactive: false,
      source: lsGet(SRC_KEY, null), live: null, boardList: null, boardData: {}, sync: { state: 'idle' }, demoCampaigns: null, trIgnored: null, meta: null
    };
  }

  // ── Loading & syncing ────────────────────────────────────────────────
  async componentDidMount() {
    this._k = e => {
      if (this.state.view === 'klant' && this.state.kform && (e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); this.saveKlant(); return; }
      if (this.state.view !== 'checkin' || !this.state.form) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); this.saveForm(); return; }
      const t = e.target.tagName;
      if (t === 'TEXTAREA' || t === 'INPUT' || t === 'SELECT') return;
      if (/^[0-9]$/.test(e.key)) this.setForm({ q: e.key === '0' ? 10 : +e.key, err: false });
    };
    window.addEventListener('keydown', this._k);

    this.sync = new Sync({ getState: () => this.state, apply: (docs, done) => this.applyShared(docs, done), onStatus: s => this.setState({ saveState: s }) });
    let docs;
    try { docs = await this.sync.start(); } catch (e) { this.setState({ bootError: 'De server is niet bereikbaar. Probeer het zo opnieuw.' }); return; }
    if (!docs) return; // redirected to login
    const sh = fromDocs(docs), cfg = this.sync.config;
    const meta = sh.meta || {};
    let campaigns = sh.campaigns, assignLog = sh.assignLog;
    if (!meta.seeded) {
      if (!campaigns.length) campaigns = build();
      if (!assignLog.length) assignLog = seedAssign();
    }
    campaigns = prepCampaigns(campaigns);
    const source = this.state.source || (cfg.trello ? 'trello' : 'demo');
    this.setState({
      loaded: true, config: cfg, source, rules: sh.rules, trIgnored: sh.trIgnored, mktDemo: sh.mktDemo, live: sh.live,
      assignLog, inbox: sh.inbox, ideas: sh.ideas, seen: sh.seen, meta: { ...meta, seeded: true },
      ...(source === 'trello' ? { demoCampaigns: campaigns, campaigns: [] } : { campaigns })
    }, () => {
      this.sync.begin();
      this.touchLogin(this.state.user);
      this._seenTimer = setInterval(() => this.setState(s => { const me = s.seen[s.user]; return me ? { seen: { ...s.seen, [s.user]: { ...me, last: Date.now() } } } : null; }), 60000);
      if (this.state.view === 'checkin') this.enterCheckin();
      if (this.state.view === 'klant') this.enterKlant();
      if (this.state.source === 'trello') this.startLive();
    });
  }

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
    });
  }

  componentDidUpdate() {
    if (!this.state.loaded) return;
    this.syncLive();
    this.sync.changed();
  }

  componentWillUnmount() { window.removeEventListener('keydown', this._k); clearInterval(this._seenTimer); if (this.sync) this.sync.stop(); }

  // ── Trello ───────────────────────────────────────────────────────────
  async tget(path, q = '') {
    let r;
    try { r = await fetch(`/api/trello${path}?${q.replace(/^&/, '')}`, { credentials: 'same-origin' }); } catch (e) { throw new TrelloError('Kon de server niet bereiken.'); }
    if (r.status === 401) { window.location.href = '/login'; throw new TrelloError('Sessie verlopen.'); }
    if (r.status === 429) { await new Promise(res => setTimeout(res, 2000)); return this.tget(path, q); }
    if (r.ok) return r.json();
    const body = await r.json().catch(() => ({}));
    if (body.error === 'trello_unauthorized') throw new TrelloError('Trello-token ongeldig of verlopen. Maak een nieuw token aan via de testpagina.');
    if (body.error === 'trello_not_configured') throw new TrelloError('Trello is nog niet ingesteld op de server.');
    if (body.error === 'trello_unreachable') throw new TrelloError('Kon Trello niet bereiken.');
    throw new TrelloError(`Trello gaf een fout (${body.status || r.status}).`);
  }
  async startLive() {
    if (!this.state.config.trello) { this.setState({ sync: { state: 'nocred' } }); return; }
    this._bd = this._bd || {};
    const run = (this._run || 0) + 1; this._run = run;
    this.setState({ sync: { state: 'loading', done: 0, total: 0 } });
    try {
      const boards = await this.tget('/members/me/boards', '&filter=open&fields=name,dateLastActivity');
      if (this._run !== run) return;
      const lim = Date.now() - 30 * 864e5, linked = new Set(this.state.live.links.map(l => l.boardId));
      const todo = boards.filter(b => linked.has(b.id) || new Date(b.dateLastActivity).getTime() >= lim).sort((a, b) => linked.has(b.id) - linked.has(a.id));
      this.setState({ boardList: boards, sync: { state: 'loading', done: 0, total: todo.length } });
      await this.loadBoards(todo, run);
      if (this._run !== run) return;
      this.setState({ boardData: { ...this._bd }, sync: { state: 'ok', at: new Date() } }, () => this.rebuildLive());
    } catch (e) { this.setState({ sync: { state: 'error', msg: e.message } }); }
  }
  async loadBoards(list, run) {
    let i = 0, n = 0; const total = list.length;
    const worker = async () => {
      while (i < list.length) {
        if (this._run !== run) return;
        const b = list[i++];
        try { this._bd[b.id] = await this.tget(`/boards/${b.id}`, '&fields=name&lists=open&list_fields=name&labels=all&label_fields=name,color&cards=all&card_fields=idList,idLabels,closed&card_customFieldItems=true&customFields=true'); }
        catch (e) { this._bd[b.id] = { error: e.message }; }
        n++;
        if (n % 6 === 0 || n === total) this.setState({ boardData: { ...this._bd }, sync: { state: 'loading', done: n, total } }, () => this.rebuildLive());
        await new Promise(r => setTimeout(r, 180));
      }
    };
    await Promise.all([worker(), worker()]);
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
  buildLive(k, bd, f, acts) {
    if (!bd || bd.error || !bd.cards) return null;
    const stg = {}; bd.lists.forEach(l => { stg[l.id] = stageOf(l.name); });
    const cards = bd.cards.filter(c => stg[c.idList] !== 'info' && (!k.labelId || c.idLabels.includes(k.labelId)));
    const cfs = bd.customFields || [], rf = cfs.find(f => /reden\s*afgewezen/i.test(f.name)), sd = cfs.find(f => /sollicitatiedatum/i.test(f.name)), ropt = {};
    ((rf && rf.options) || []).forEach(o => { ropt[o.id] = o.value && o.value.text; });
    const cw = cards.map(c => {
      const it = c.customFieldItems || [], dv = sd && it.find(i => i.idCustomField === sd.id), rv = rf && it.find(i => i.idCustomField === rf.id);
      const ts = dv && dv.value && dv.value.date ? Date.parse(dv.value.date) : cardTs(c.id);
      return { c, w: weekOf(ts), r: RANK[stg[c.idList]] || 0, reason: rv ? (ropt[rv.idValue] || (rv.value && rv.value.text) || null) : null };
    });
    let minW = CUR; cw.forEach(x => { if (x.w < minW) minW = x.w; });
    const start = Math.max(CUR - 11, Math.min(minW, CUR)), weeks = [];
    for (let w = start; w <= CUR; w++) {
      const inW = cw.filter(x => x.w === w);
      const tr = { nieuw: inW.length, gescreend: inW.filter(x => x.r >= 1).length, gesprek: inW.filter(x => x.r >= 2).length, voorgesteld: inW.filter(x => x.r >= 3).length, geplaatst: inW.filter(x => x.r >= 4).length, reasons: inW.reduce((o, x) => { if (x.reason) o[x.reason] = (o[x.reason] || 0) + 1; return o; }, {}) };
      const e = f[w] || {};
      weeks.push({ w, leads: e.leads ?? tr.nieuw, q: e.q ?? null, rec: e.rec || '', klant: e.klant || '', note: e.note || '', needsAction: !!e.needsAction, at: e.at || '', recBy: e.recBy, klantBy: e.klantBy, tr });
    }
    const open = cards.filter(c => !c.closed);
    return { id: k.id, boardId: k.boardId, client: k.boardName, vac: k.vac, rec: k.rec, start, ended: false, weeks, actions: acts, trello: true,
      live: { nieuw: open.filter(c => stg[c.idList] === 'nieuw').length, contact: open.filter(c => stg[c.idList] === 'contact').length } };
  }
  rebuildLive() {
    if (this.state.source !== 'trello') return;
    const L = this.state.live, bd = this._bd || {};
    const campaigns = L.links.filter(k => !(L.inactive || {})[k.boardId]).map(k => this.buildLive(k, bd[k.boardId], L.fb[k.id] || {}, L.actions[k.id] || [])).filter(Boolean);
    this._skipSync = true;
    this.setState({ campaigns }, () => { if (this.state.view === 'checkin' && !this.state.form) this.enterCheckin(); });
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
      this.setState(s => ({ source: 'trello', demoCampaigns: s.campaigns, campaigns: [], form: null, kform: null, view: s.view === 'detail' ? s.back : s.view }), () => { if (this.state.boardList) this.rebuildLive(); else this.startLive(); });
    } else {
      this.setState(s => ({ source: 'demo', campaigns: s.demoCampaigns || build(), form: null, kform: null, view: s.view === 'detail' ? s.back : s.view }), () => { if (this.state.view === 'checkin') this.enterCheckin(); });
    }
  }
  linkLive(b, o, vac, rec) {
    if (!vac || !vac.trim()) { this.flash('Vul eerst de functie in'); return; }
    if (!rec) { this.flash('Kies eerst een recruiter'); return; }
    const prevL = this.state.live.links.find(k => k.boardId === b.id);
    this.logAssign(b.name, prevL ? prevL.rec : '', rec);
    const id = 't-' + b.id + '-' + (o.labelId || 'all');
    const link = { id, boardId: b.id, boardName: b.name, labelId: o.labelId, labelName: o.name, vac: vac.trim(), rec };
    this.setState(s => ({ live: { ...s.live, links: [...s.live.links.filter(x => x.id !== id), link] } }), () => this.rebuildLive());
    this.flash(`${b.name} – ${vac.trim()} staat live · ${rec}`);
  }
  unlinkLive(id) { this.setState(s => ({ live: { ...s.live, links: s.live.links.filter(x => x.id !== id) } }), () => this.rebuildLive()); this.flash('Ontkoppeld'); }
  ignoreBoard(id, v) { this.setState(s => { const ig = { ...s.live.ignored }; if (v) ig[id] = true; else delete ig[id]; return { live: { ...s.live, ignored: ig } }; }); }
  syncInfo() {
    const st = this.state, s = st.sync || {};
    if (st.source !== 'trello') return { text: 'Demo-data', dot: '#C0BDB9' };
    if (s.state === 'nocred') return { text: 'Niet verbonden met Trello', dot: '#D32F2F' };
    if (s.state === 'error') return { text: 'Trello-fout · opnieuw proberen', dot: '#D32F2F' };
    if (s.state === 'loading') return { text: s.total ? `Trello laden… ${s.done}/${s.total}` : 'Trello verbinden…', dot: '#F9A800' };
    if (s.state === 'ok') { const t = s.at; return { text: `Trello bijgewerkt ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`, dot: '#1A7A4A' }; }
    return { text: 'Trello', dot: '#C0BDB9' };
  }

  // ── Toewijzing ───────────────────────────────────────────────────────
  mktOf(c) { return this.state.source === 'trello' ? ((this.state.live.mkt || {})[c.boardId] || '') : (this.state.mktDemo[c.client] ?? MKTS[Math.floor(rnd(c.client) * MKTS.length)]); }
  assignData() {
    const st = this.state, live = st.source === 'trello', A = st.asg;
    const opt = (list, cur, extra) => [{ v: '', l: '— Kies —' }, ...(cur === '__multi' ? [{ v: '__multi', l: 'Meerdere' }] : []), ...list.map(x => ({ v: x, l: x })), ...(extra ? [{ v: '__inactive', l: 'Niet actief' }] : [])];
    let items = [];
    if (live) {
      if (!st.boardList) return { open: 0, rows: [], tabs: [], recChips: [], mktChips: [], hasNotice: true, notice: this.syncInfo().text, empty: false };
      const lim = Date.now() - 30 * 864e5, by = {}, mk = st.live.mkt || {}, ina = st.live.inactive || {};
      st.live.links.forEach(k => { (by[k.boardId] = by[k.boardId] || []).push(k); });
      items = st.boardList.filter(b => !st.live.ignored[b.id] && (by[b.id] || new Date(b.dateLastActivity).getTime() >= lim)).map(b => {
        const links = by[b.id] || [], recs = [...new Set(links.map(k => k.rec))];
        return { key: b.id, name: b.name, ts: new Date(b.dateLastActivity).getTime(), last: agoTxt(b.dateLastActivity),
          funcs: links.length ? links.map(k => k.vac).join(', ') : 'Nog niet gekoppeld', rec: ina[b.id] ? '__inactive' : recs.length === 1 ? recs[0] : recs.length ? '__multi' : '', mkt: mk[b.id] || '',
          setRec: v => this.assignRecLive(b, v), setMkt: v => this.setState(s => ({ live: { ...s.live, mkt: { ...(s.live.mkt || {}), [b.id]: v } } })) };
      });
    } else {
      const by = {};
      st.campaigns.filter(c => !c.ended || c.inactive).forEach(c => { (by[c.client] = by[c.client] || []).push(c); });
      items = Object.entries(by).map(([client, cs]) => {
        const recs = [...new Set(cs.map(c => c.rec))];
        return { key: client, name: client, ts: 0, last: `${cs.length} ${cs.length === 1 ? 'campagne' : 'campagnes'}`, funcs: cs.map(c => c.vac).join(', '),
          rec: cs.some(c => c.inactive) ? '__inactive' : recs.length === 1 ? recs[0] : '__multi', mkt: this.mktOf(cs[0]),
          setRec: v => { if (!v || v === '__multi') return; this.logAssign(client, recs.length === 1 && !cs.some(c => c.inactive) ? recs[0] : '', v); this.setState(s => ({ campaigns: s.campaigns.map(c => c.client !== client || (c.ended && !c.inactive) ? c : v === '__inactive' ? { ...c, ended: true, inactive: true } : { ...c, rec: v, ended: false, inactive: false }) })); },
          setMkt: v => this.setState(s => ({ mktDemo: { ...s.mktDemo, [client]: v } })) };
      });
    }
    const isOpen = x => x.rec !== '__inactive' && (!x.rec || !x.mkt), open = items.filter(isOpen).length;
    const q = A.q.trim().toLowerCase();
    const shown = items.filter(x => (A.tab === 'all' || isOpen(x)) && (!q || x.name.toLowerCase().includes(q)))
      .sort((a, b) => (isOpen(b) - isOpen(a)) || ((a.rec === '__inactive') - (b.rec === '__inactive')) || (b.ts - a.ts) || a.name.localeCompare(b.name));
    const cnt = (k, v) => items.filter(x => x[k] === v).length;
    const tab = (k, label, n) => ({ label, n, bg: A.tab === k ? '#FFFFFF' : 'transparent', fg: A.tab === k ? '#1D1D1B' : '#5C5C5A', sh: A.tab === k ? '0 1px 4px rgba(29,29,27,.07)' : 'none', onClick: () => this.setState(s => ({ asg: { ...s.asg, tab: k } })) });
    return {
      open, empty: shown.length === 0, hasNotice: live && st.sync.state === 'loading', notice: this.syncInfo().text,
      tabs: [tab('open', 'Niet volledig toegewezen', open), tab('all', 'Alle klanten', items.length)],
      recChips: [...RECS.map(r => ({ name: r, n: cnt('rec', r) })), { name: 'Niet actief', n: cnt('rec', '__inactive') }], mktChips: MKTS.map(m => ({ name: m, n: cnt('mkt', m) })),
      rows: shown.map(x => { const ina = x.rec === '__inactive'; return { name: x.name, funcs: ina ? 'Niet actief · geen opvolging' : x.funcs, last: x.last, rec: x.rec, mkt: x.mkt,
        recOpts: opt(RECS, x.rec, true), mktOpts: opt(MKTS, x.mkt), op: ina ? 0.55 : 1,
        recBorder: x.rec ? '#E4E1DE' : '#F9A800', mktBorder: x.mkt || ina ? '#E4E1DE' : '#F9A800',
        onRec: e => x.setRec(e.target.value), onMkt: e => x.setMkt(e.target.value) }; })
    };
  }
  assignRecLive(b, rec) {
    if (!rec || rec === '__multi') return;
    if (rec === '__inactive') { this.setState(s => ({ live: { ...s.live, inactive: { ...(s.live.inactive || {}), [b.id]: true } } }), () => this.rebuildLive()); return; }
    const prevL = this.state.live.links.find(k => k.boardId === b.id);
    this.logAssign(b.name, prevL && !(this.state.live.inactive || {})[b.id] ? prevL.rec : '', rec);
    this.setState(s => {
      const inactive = { ...(s.live.inactive || {}) }; delete inactive[b.id];
      const has = s.live.links.some(k => k.boardId === b.id);
      const links = has ? s.live.links.map(k => k.boardId === b.id ? { ...k, rec } : k)
        : [...s.live.links, { id: 't-' + b.id + '-all', boardId: b.id, boardName: b.name, labelId: null, labelName: 'Hele bord', vac: 'Alle functies', rec }];
      return { live: { ...s.live, links, inactive } };
    }, () => this.rebuildLive());
  }

  // ── Meldingen, nieuws, ideeën ────────────────────────────────────────
  panelVals(me, isRec) {
    const st = this.state, P = st.panel;
    const mineN = st.inbox.filter(n => n.to === (isRec ? me.rec : me.name));
    const openFb = new Set(st.campaigns.filter(c => !c.ended && c.weeks[c.weeks.length - 1].q == null).map(c => `${c.client} – ${c.vac}`));
    const setP = p => () => {
      const upd = { panel: st.panel === p ? null : p };
      if (p === 'inbox') upd.inbox = st.inbox.map(n => mineN.includes(n) && !n.read ? { ...n, read: true } : n);
      if (p === 'news') { upd.newsSeen = NEWS[0].id; lsSet(NEWS_KEY, NEWS[0].id); }
      this.setState(upd);
    };
    const I = st.idea, saveIdeas = ideas => this.setState({ ideas });
    const canSet = me.role === 'teamlead';
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
        items: mineN.map(n => ({ from: `Van ${n.from}`, at: n.at, title: n.title, bg: n.read ? '#FFFFFF' : '#FFF8E0',
          lines: (n.items || []).map(t => n.kind === 'reminder' ? { t: (openFb.has(t) ? '○ ' : '✓ ') + t, fg: openFb.has(t) ? '#1D1D1B' : '#8C8C8A' } : { t, fg: '#5C5C5A' }),
          hasAction: isRec && n.kind === 'reminder', actLabel: 'Feedback invullen', act: () => { this.setState({ panel: null }); this.go('checkin'); } }))
      },
      news: { hasNew: st.newsSeen < NEWS[0].id, items: NEWS.map(n => ({ ...n, tagBg: n.tag === 'Nieuw' ? '#FFF8E0' : '#E7E7F0', tagFg: n.tag === 'Nieuw' ? '#B45309' : '#1B1B63' })) },
      idea: {
        text: I.text, placeholder: IDEA_TYPES[I.type][3], page: VIEW_NAMES[st.view] || st.view, empty: shown.length === 0,
        types: Object.entries(IDEA_TYPES).map(([k, v]) => ({ label: v[0], ...pill(I.type === k), onClick: () => this.setState(s => ({ idea: { ...s.idea, type: k } })) })),
        filters: [['all', 'Alles'], ['open', 'Open'], ['bug', 'Bugs'], ['idee', 'Ideeën'], ['verbetering', 'Verbeteringen']].map(([k, l]) => ({ label: l,
          n: k === 'all' ? st.ideas.length : k === 'open' ? st.ideas.filter(x => x.status === 'nieuw' || x.status === 'opgepakt').length : st.ideas.filter(x => x.type === k).length,
          bg: I.filter === k ? '#F5F2ED' : '#FFFFFF', border: I.filter === k ? '#C0BDB9' : '#E4E1DE', onClick: () => this.setState(s => ({ idea: { ...s.idea, filter: k } })) })),
        items: shown.map(x => { const T = IDEA_TYPES[x.type], S = IDEA_STATUS[x.status], voted = (x.voters || []).includes(me.name);
          return { type: T[0], tBg: T[1], tFg: T[2], by: x.by, at: x.at, page: x.page, text: x.text, status: x.status, statusLabel: S[0], sFg: S[1], canSet, showStatus: !canSet,
            votes: (x.voters || []).length, vBg: voted ? '#1B1B63' : '#FFFFFF', vBorder: voted ? '#1B1B63' : '#E4E1DE', vFg: voted ? '#FFFFFF' : '#1D1D1B',
            setStatus: e => { const v = e.target.value; saveIdeas(this.state.ideas.map(y => y.id === x.id ? { ...y, status: v } : y)); },
            vote: () => saveIdeas(this.state.ideas.map(y => y.id !== x.id ? y : { ...y, voters: voted ? y.voters.filter(n => n !== me.name) : [...(y.voters || []), me.name] })) }; })
      },
      setIdeaText: e => { const v = e.target.value; this.setState(s => ({ idea: { ...s.idea, text: v } })); },
      submitIdea: () => {
        if (!I.text.trim()) { this.flash('Beschrijf eerst wat je wilt melden'); return; }
        saveIdeas([{ id: Date.now(), type: I.type, text: I.text.trim(), by: me.name, at: stamp(), page: VIEW_NAMES[st.view] || st.view, status: 'nieuw', voters: [] }, ...st.ideas]);
        this.setState(s => ({ idea: { ...s.idea, text: '', filter: 'all' } })); this.flash('Bedankt, je melding is opgeslagen');
      }
    };
  }
  logAssign(client, from, to) {
    if (!to || to === from || to === '__inactive' || to === '__multi') return;
    const me = this.me(), at = Date.now();
    const e = { id: at + Math.random(), mode: this.state.source, client, from: from && from !== '__multi' ? from : '', to, at, by: me.name };
    const note = { id: e.id, to, from: me.name, at: stamp(), read: false, kind: 'assign', title: e.from ? `${client} is aan jou overgedragen` : `Nieuw bedrijf voor jou: ${client}`, items: e.from ? [`Eerder opgevolgd door ${e.from}`] : [] };
    this.setState(s => ({ assignLog: [e, ...s.assignLog].slice(0, 500), inbox: [note, ...s.inbox] }));
  }
  placeholder() { return { id: 'none', client: '—', vac: 'Nog geen campagnes', rec: '', start: CUR, ended: false, actions: [], weeks: [{ w: CUR, leads: 0, q: null, rec: '', klant: '', note: '', needsAction: false, at: '', tr: { nieuw: 0, gescreend: 0, voorgesteld: 0, gesprek: 0, geplaatst: 0 } }] }; }

  // ── Klanten uit Trello ───────────────────────────────────────────────
  trelloLive() {
    const st = this.state, L = st.live, sync = st.sync || {}, si = this.syncInfo();
    const base = { tabs: [], boards: [], empty: false, open: 0, summary: '', inactiveText: '', toggleInactive: () => {}, syncText: si.text };
    if (!st.boardList) {
      const notice = sync.state === 'nocred' ? 'Nog niet verbonden met Trello. Verbind eerst via de testpagina, daarna komen de borden hier vanzelf.' : sync.state === 'error' ? sync.msg : 'Borden laden uit Trello…';
      return { ...base, hasNotice: true, notice, noticeLink: sync.state === 'nocred' || sync.state === 'error' };
    }
    const lim = Date.now() - 30 * 864e5, linksBy = {};
    L.links.forEach(k => { (linksBy[k.boardId] = linksBy[k.boardId] || []).push(k); });
    let open = 0;
    const all = st.boardList.map(b => {
      const links = linksBy[b.id] || [], inactive = !links.length && new Date(b.dateLastActivity).getTime() < lim, ign = !!L.ignored[b.id];
      const needs = !inactive && !ign && !links.length && !(L.inactive || {})[b.id]; if (needs) open++;
      return { b, links, inactive, ign, needs };
    });
    const vis = all.filter(x => !x.inactive || st.trShowInactive);
    const shown = (st.trTab === 'open' ? vis.filter(x => x.needs) : vis).sort((a, b) => (b.needs - a.needs) || (new Date(b.b.dateLastActivity) - new Date(a.b.dateLastActivity)));
    const boards = shown.map(({ b, links, inactive, ign, needs }) => {
      const bd = st.boardData[b.id];
      let rows = [];
      if (bd && bd.cards) {
        const stg = {}; bd.lists.forEach(l => { stg[l.id] = stageOf(l.name); });
        const cards = bd.cards.filter(c => stg[c.idList] !== 'info');
        const opts = [{ labelId: null, name: 'Hele bord', cards: cards.length }];
        bd.labels.forEach(l => { const n = cards.filter(c => c.idLabels.includes(l.id)).length; if (n) opts.push({ labelId: l.id, name: l.name || ('Label ' + (TCOL[(l.color || '').split('_')[0]] || 'zonder kleur')), color: l.color, cards: n, unnamed: !l.name }); });
        const hasLabelLink = links.some(k => k.labelId), whole = links.some(k => !k.labelId);
        rows = opts.filter(o => o.labelId ? !whole : !hasLabelLink).map(o => {
          const key = b.id + '|' + (o.labelId || 'all'), link = links.find(k => (k.labelId || null) === o.labelId);
          const dv = o.labelId && !o.unnamed ? o.name : '', vac = st.trVac[key] ?? dv;
          return {
            name: o.name, cards: o.cards, color: o.labelId ? (TCOLHEX[(o.color || '').split('_')[0]] || '#E4E1DE') : '#1B1B63', fg: o.unnamed ? '#5C5C5A' : '#1D1D1B',
            isLinked: !!link, isEnded: false, isIgnored: false, isInactive: false, isOpen: !link && !ign, showIgnore: false,
            rec: link ? `${link.vac} · ${link.rec}` : '', canUnlink: !!link, unlink: () => link && this.unlinkLive(link.id),
            open: () => link && this.open(link.id),
            sel: st.trSel[key] || '', setRec: e => { const v = e.target.value; this.setState(s => ({ trSel: { ...s.trSel, [key]: v } })); },
            vac, setVac: e => { const v = e.target.value; this.setState(s => ({ trVac: { ...s.trVac, [key]: v } })); },
            link: () => this.linkLive(b, o, this.state.trVac[key] ?? dv, this.state.trSel[key])
          };
        });
      }
      return {
        name: b.name, isNew: false, found: '', isInactive: inactive, inactiveText: 'Geen activiteit in 30 dagen', labels: rows, nOpen: needs ? 1 : 0,
        meta: !bd ? 'laden…' : bd.error ? 'kon niet laden' : agoTxt(b.dateLastActivity),
        canIgnore: !ign && !links.length, ignoreBoard: () => this.ignoreBoard(b.id, true), isIgnoredBoard: ign, restoreBoard: () => this.ignoreBoard(b.id, false)
      };
    });
    const tab = (k, label, n) => ({ label, n, bg: st.trTab === k ? '#FFFFFF' : 'transparent', fg: st.trTab === k ? '#1D1D1B' : '#5C5C5A', sh: st.trTab === k ? '0 1px 4px rgba(29,29,27,.07)' : 'none', onClick: () => this.setState({ trTab: k }) });
    const hidden = all.filter(x => x.inactive).length;
    return {
      ...base, open, boards, empty: boards.length === 0,
      hasNotice: sync.state === 'loading' || sync.state === 'error', notice: sync.state === 'error' ? sync.msg : `Borden laden uit Trello… ${sync.done || 0} van ${sync.total || '?'}`, noticeLink: false,
      tabs: [tab('open', 'Te koppelen', open), tab('all', 'Alle borden', vis.length)],
      summary: `${st.boardList.length} borden in Trello · ${L.links.length} campagnes gekoppeld`,
      inactiveText: st.trShowInactive ? 'Inactieve borden verbergen' : `${hidden} borden zonder activiteit in 30 dagen verborgen · tonen`,
      toggleInactive: () => { const on = !st.trShowInactive; this.setState({ trShowInactive: on }); if (on) this.loadInactive(); }
    };
  }
  trelloData() {
    if (this.state.source === 'trello') return this.trelloLive();
    const st = this.state, boards = {};
    const add = (board, o) => { (boards[board] = boards[board] || { name: board, labels: [], isNew: false }).labels.push(o); };
    st.campaigns.forEach(c => add(c.client, { name: c.vac, cards: c.weeks.reduce((s, w) => s + w.leads, 0), c }));
    TR_EXTRA.forEach(x => {
      const c = st.campaigns.find(k => k.client === x.board && k.vac === x.label);
      if (!c) { add(x.board, { name: x.label, cards: x.cards, c: null }); if (x.isNew) boards[x.board].isNew = true; }
    });
    TR_INACTIVE.forEach(([board, labels, days]) => { boards[board] = { name: board, isNew: false, inactive: days, labels: labels.map((l, i) => ({ name: l, cards: 8 + ((days + i * 7) % 30), c: null })) }; });
    let open = 0, linked = 0;
    const list = Object.values(boards).filter(b => !b.inactive || st.trShowInactive).map((b, bi) => {
      const labels = b.labels.map((l, li) => {
        const key = b.name + '|' + l.name, ign = !!st.trIgnored[key];
        const isOpen = !l.c && !ign && !b.inactive; if (isOpen) open++; if (l.c && !l.c.ended) linked++;
        return {
          name: l.name, cards: l.cards, color: LABEL_COLORS[(bi * 3 + li) % LABEL_COLORS.length], fg: ign ? '#8C8C8A' : '#1D1D1B',
          isLinked: !!(l.c && !l.c.ended), isEnded: !!(l.c && l.c.ended), isIgnored: ign && !b.inactive, isOpen, isInactive: !!b.inactive && !l.c, rec: l.c ? l.c.rec : '',
          sel: st.trSel[key] || '', open: () => l.c && this.open(l.c.id), showIgnore: true, canUnlink: false,
          vac: st.trVac[key] ?? l.name, setVac: e => { const v = e.target.value; this.setState(s => ({ trVac: { ...s.trVac, [key]: v } })); },
          setRec: e => { const v = e.target.value; this.setState(s => ({ trSel: { ...s.trSel, [key]: v } })); },
          link: () => this.linkLabel(b.name, this.state.trVac[key] ?? l.name, l.cards, this.state.trSel[key]),
          ignore: () => this.setState(s => ({ trIgnored: { ...s.trIgnored, [key]: true } })),
          unignore: () => this.setState(s => { const t = { ...s.trIgnored }; delete t[key]; return { trIgnored: t }; })
        };
      });
      const nOpen = labels.filter(l => l.isOpen).length;
      return { name: b.name, isNew: b.isNew && nOpen > 0, found: 'vandaag gevonden', labels, nOpen, isInactive: !!b.inactive, inactiveText: b.inactive ? `Geen activiteit sinds ${b.inactive} dagen` : '', meta: `${labels.length} ${labels.length === 1 ? 'label' : 'labels'}${nOpen ? ` · ${nOpen} te koppelen` : ''}` };
    }).sort((a, b) => (b.isNew - a.isNew) || (b.nOpen - a.nOpen) || a.name.localeCompare(b.name));
    const shown = st.trTab === 'open' ? list.filter(b => b.nOpen > 0) : list;
    const tab = (k, label, n) => ({ label, n, bg: st.trTab === k ? '#FFFFFF' : 'transparent', fg: st.trTab === k ? '#1D1D1B' : '#5C5C5A', sh: st.trTab === k ? '0 1px 4px rgba(29,29,27,.07)' : 'none', onClick: () => this.setState({ trTab: k }) });
    return {
      open, boards: shown, empty: shown.length === 0,
      tabs: [tab('open', 'Te koppelen', open), tab('all', 'Alle borden', list.length)],
      syncText: 'Demo · workspace gecontroleerd 09:15', hasNotice: false,
      summary: `${list.length} borden · ${linked} campagnes live`,
      inactiveText: st.trShowInactive ? `Inactieve borden verbergen` : `${TR_INACTIVE.length} borden zonder activiteit in 30 dagen verborgen · tonen`,
      toggleInactive: () => this.setState(s => ({ trShowInactive: !s.trShowInactive }))
    };
  }
  linkLabel(board, label, cards, rec) {
    if (!rec) { this.flash('Kies eerst een recruiter'); return; }
    const prevC = this.state.campaigns.find(c => c.client === board && !c.ended);
    this.logAssign(board, prevC ? prevC.rec : '', rec);
    const id = 'n' + Date.now();
    const c = { id, client: board, vac: label, rec, start: CUR, ended: false, actions: [],
      weeks: [{ w: CUR, leads: cards, q: null, rec: '', klant: '', note: '', needsAction: false, at: '', tr: { nieuw: cards, gescreend: 0, voorgesteld: 0, gesprek: 0, geplaatst: 0 } }] };
    this.setState(s => ({ campaigns: [...s.campaigns, c] }));
    this.flash(`${board} – ${label} staat live · ${rec}`);
  }

  // ── Gebruikers, navigatie ────────────────────────────────────────────
  touchLogin(uid) {
    this.setState(st => {
      const now = Date.now(), s = st.seen[uid] || {};
      const fresh = !s.last || now - s.last > 2 * 36e5;
      return { seen: { ...st.seen, [uid]: { ...s, prev: fresh ? (s.last || now - 864e5) : s.prev, last: now } } };
    });
  }
  me() { return USERS.find(x => x.id === this.state.user) || USERS[0]; }
  go(view) { this.setState({ view }); if (view === 'checkin') this.enterCheckin(); if (view === 'klant') this.enterKlant(); window.scrollTo(0, 0); }
  setUser(id) {
    const u = USERS.find(x => x.id === id); if (!u) return;
    const rec = u.role === 'recruiter';
    lsSet(USER_KEY, id);
    this.touchLogin(id);
    this.setState(s => ({ user: id, ci: { rec: u.rec || 'all' }, f: { ...s.f, rec: 'all', status: 'all' }, form: null, kform: null, view: rec ? 'live' : 'week', back: rec ? 'live' : 'week' }));
    window.scrollTo(0, 0);
  }

  // ── Feedback klant ───────────────────────────────────────────────────
  klantQueue() {
    return this.state.campaigns.filter(c => !c.ended)
      .sort((a, b) => (a.weeks[a.weeks.length - 1].klant ? 1 : 0) - (b.weeks[b.weeks.length - 1].klant ? 1 : 0));
  }
  enterKlant(id) {
    const q = this.klantQueue();
    const t = id ? q.find(c => c.id === id) : (q.find(c => !c.weeks[c.weeks.length - 1].klant) || q[0]);
    if (t) this.loadKlant(t.id);
  }
  skipKlant() {
    const k = this.state.kform; if (!k) return;
    const q = this.klantQueue(), i = q.findIndex(c => c.id === k.id), next = q.slice(i + 1).find(c => !c.weeks[c.weeks.length - 1].klant);
    if (next) this.loadKlant(next.id); else this.flash('Geen andere campagnes zonder klantfeedback');
  }
  startKlant(id) { this.setState({ view: 'klant' }, () => this.loadKlant(id)); window.scrollTo(0, 0); }
  loadKlant(id) { const c = this.state.campaigns.find(x => x.id === id); this.setState({ kform: { id, klant: c.weeks[c.weeks.length - 1].klant || '' } }); }
  saveKlant() {
    const k = this.state.kform; if (!k) return;
    if (!k.klant.trim()) { this.skipKlant(); return; }
    const me = this.me();
    const campaigns = this.state.campaigns.map(c => {
      if (c.id !== k.id) return c;
      const ws = c.weeks.slice(); ws[ws.length - 1] = { ...ws[ws.length - 1], klant: k.klant.trim(), klantBy: me.name };
      return { ...c, weeks: ws };
    });
    const c = campaigns.find(x => x.id === k.id);
    this.setState({ campaigns }, () => {
      this.flash(`Klantfeedback opgeslagen · ${c.client}`);
      const next = this.klantQueue().find(x => x.id !== k.id && !x.weeks[x.weeks.length - 1].klant);
      this.loadKlant(next ? next.id : k.id);
    });
  }

  // ── Wekelijkse feedback recruiter ────────────────────────────────────
  open(id) { this.setState(s => ({ view: 'detail', sel: id, back: s.view === 'detail' ? s.back : s.view, act: { ...s.act, text: '', w: CUR } })); window.scrollTo(0, 0); }
  flash(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null }), 2400); }
  queue(st = this.state) {
    return st.campaigns.filter(c => !c.ended && (st.ci.rec === 'all' || c.rec === st.ci.rec))
      .sort((a, b) => (a.weeks[a.weeks.length - 1].q == null ? 0 : 1) - (b.weeks[b.weeks.length - 1].q == null ? 0 : 1));
  }
  enterCheckin(id) {
    const q = this.queue();
    const target = id ? q.find(c => c.id === id) : (q.find(c => c.weeks[c.weeks.length - 1].q == null) || q[0]);
    if (target) this.loadForm(target.id);
  }
  startCheckin(id) {
    this.setState({ view: 'checkin' }, () => this.loadForm(id));
    window.scrollTo(0, 0);
  }
  loadForm(id) {
    const c = this.state.campaigns.find(x => x.id === id), cur = c.weeks[c.weeks.length - 1];
    this.setState({ form: { id, leads: cur.leads, trello: cur.tr.nieuw, q: cur.q, rec: cur.rec, note: cur.note, needsAction: cur.needsAction, err: false } });
  }
  setForm(p) { this.setState(s => ({ form: { ...s.form, ...p } })); }
  saveForm() {
    const f = this.state.form;
    if (!f) return;
    if (f.q == null) { this.setForm({ err: true }); return; }
    const campaigns = this.state.campaigns.map(c => {
      if (c.id !== f.id) return c;
      const ws = c.weeks.slice(), cur = ws[ws.length - 1];
      ws[ws.length - 1] = { ...cur, leads: +f.leads || 0, q: f.q, rec: f.rec.trim(), recBy: this.me().name, note: f.note.trim(), needsAction: f.needsAction, at: stamp() };
      return { ...c, weeks: ws };
    });
    const c = campaigns.find(x => x.id === f.id);
    this.setState({ campaigns }, () => {
      this.flash(`Opgeslagen · ${c.client} – ${c.vac}`);
      const next = this.queue().find(x => x.id !== f.id && x.weeks[x.weeks.length - 1].q == null);
      if (next) this.loadForm(next.id); else this.loadForm(f.id);
    });
  }
  addAction() {
    const a = this.state.act;
    if (!a.text.trim()) { this.flash('Beschrijf eerst de wijziging'); return; }
    const campaigns = this.state.campaigns.map(c => c.id !== this.state.sel ? c : { ...c, actions: [...c.actions, { id: c.id + 'a' + Date.now(), w: +a.w, type: a.type, text: a.text.trim() }] });
    this.setState({ campaigns, act: { ...a, text: '' } });
    this.flash('Campagnewijziging vastgelegd');
  }
  setRule(k, v) { this.setState(s => ({ rules: { ...s.rules, [k]: v } })); }
  exportCsv() {
    const period = +this.state.hist.period, first = CUR - period + 1;
    const rows = [['klant', 'vacature', 'recruiter', 'week', 'week_start', 'nieuwe_kandidaten', 'kwaliteit', 'feedback_recruitment', 'feedback_klant', 'actie_notitie', 'bijsturing_nodig', 'trello_voorgesteld', 'trello_gesprek', 'trello_geplaatst']];
    this.state.campaigns.forEach(c => c.weeks.forEach(w => rows.push([c.client, c.vac, c.rec, wl(w.w), isoDate(mondayOf(w.w)), w.leads, w.q ?? '', w.rec, w.klant, w.note, w.needsAction ? 'ja' : 'nee', w.tr.voorgesteld, w.tr.gesprek, w.tr.geplaatst])));
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
  deco(c) {
    const R = this.state.rules, h = health(c, R), ws = c.weeks, cur = ws[ws.length - 1], prev = ws[ws.length - 2] || null;
    const S = STAT[h.lvl], missing = cur.q == null;
    const qd = (!missing && prev && prev.q != null) ? cur.q - prev.q : null;
    const ld = prev ? cur.leads - prev.leads : null;
    const l8 = ws.slice(-8), pts = [];
    l8.forEach((w, i) => { if (w.q != null) pts.push(`${(l8.length > 1 ? i / (l8.length - 1) * 72 : 36).toFixed(1)},${(22 - (w.q - 1) / 9 * 20).toFixed(1)}`); });
    const l6 = ws.slice(-6), mx = Math.max(...l6.map(w => w.leads), 1);
    const lastFb = [...ws].reverse().find(w => w.q != null);
    return {
      id: c.id, client: c.client, vac: c.vac, rec: c.rec, start: c.start, startLabel: wl(c.start), cur, lvl: h.lvl,
      statusLabel: S.label, sFg: S.fg, sBg: S.bg,
      reasons: h.reasons.map(r => ({ t: r.t, fg: STAT[r.l].fg, bg: STAT[r.l].bg })),
      missing, qText: missing ? '—' : cur.q + '/10', qFg: qc(cur.q),
      qdText: missing ? 'nog niet beoordeeld' : qd == null ? 'eerste week' : qd === 0 ? 'gelijk aan vorige week' : `${qd > 0 ? '▲' : '▼'} ${Math.abs(qd)} t.o.v. vorige week`,
      qdShort: qd == null || qd === 0 ? '' : `${qd > 0 ? '▲' : '▼'}${Math.abs(qd)}`,
      qdColor: qd == null || qd === 0 ? '#8C8C8A' : qd > 0 ? '#1A7A4A' : '#D32F2F',
      prevQText: prev && prev.q != null ? prev.q + '/10' : '—',
      ldText: ld == null ? '' : ld === 0 ? 'gelijk aan vorige week' : `${sgn(ld)} t.o.v. vorige week`,
      ldShort: ld == null ? '' : sgn(ld), ldColor: ld == null || ld === 0 ? '#8C8C8A' : ld > 0 ? '#1A7A4A' : '#B45309',
      spark: pts.join(' '),
      ...(() => { const qv = ws.filter(w => w.q != null).map(w => w.q), a = avgOf(qv); return { avgQ: a == null ? '—' : nl(a), avgFg: qc(a == null ? null : Math.round(a)), avgSub: qv.length ? `over ${qv.length} ${qv.length === 1 ? 'week' : 'weken'}` : '' }; })(),
      bars: l6.map(w => ({ h: Math.max(3, Math.round(w.leads / mx * 24)) + 'px', bg: w === cur ? '#FB8915' : 'rgba(27,27,99,.28)' })),
      lastAt: missing ? 'Ontbreekt' : (cur.at || 'Week ' + wl(cur.w)), atColor: missing ? '#D32F2F' : '#3C3C3A', atWeight: missing ? 600 : 400,
      quote: missing ? (lastFb ? `Nog geen feedback. Week ${wl(lastFb.w)}: ${lastFb.rec}` : 'Nog geen feedback') : (cur.rec || 'Geen toelichting'),
      hasQuote: true,
      open: () => this.open(c.id)
    };
  }

  // ── Everything the views render ──────────────────────────────────────
  renderVals() {
    const st = this.state, R = st.rules, me = this.me(), isRec = me.role === 'recruiter';
    const active = st.campaigns.filter(c => !c.ended);
    const D = active.map(c => this.deco(c));
    const cnt = [0, 1, 2].map(l => D.filter(d => d.lvl === l).length);
    const missingD = D.filter(d => d.missing);
    const done = D.length - missingD.length;
    const setF = p => this.setState(s => ({ f: { ...s.f, ...p } }));

    const klantOpen = active.filter(c => !c.weeks[c.weeks.length - 1].klant).length;
    const myOpen = active.filter(c => c.rec === me.rec && c.weeks[c.weeks.length - 1].q == null).length;
    const navDefs = isRec
      ? [['live', 'Live campagnes'], ['checkin', 'Wekelijkse feedback recruiter', myOpen], ['mine', 'Mijn campagnes']]
      : [['week', 'Weekoverzicht'], ['campaigns', 'Campagnes'], ['klant', 'Feedback klant'], ...(me.role === 'teamlead' ? [['trello', 'Klanten uit Trello', this.trelloData().open], ['toewijzing', 'Toewijzing', this.assignData().open]] : []), ['history', 'Historie & analyse'], ['rules', 'Health-regels']];
    const navActive = st.view === 'detail' ? st.back : st.view;
    const nav = navDefs.map(([k, label, badge]) => ({ label, badge, hasBadge: !!badge, bg: navActive === k ? '#F5F2ED' : 'transparent', fg: navActive === k ? '#1B1B63' : '#3C3C3A', fw: navActive === k ? 600 : 500, onClick: () => this.go(k) }));

    const levels = [2, 1, 0].map(l => ({ n: cnt[l], label: STAT[l].label, fg: STAT[l].fg, bg: STAT[l].bg, pct: (cnt[l] / Math.max(D.length, 1) * 100) + '%', onClick: () => { setF({ status: String(l) }); this.go('campaigns'); } }));
    const sum = {
      active: D.length, done, donePct: (done / Math.max(D.length, 1) * 100) + '%', levels,
      hasMissing: missingD.length > 0,
      missingList: missingD.map(d => ({ client: d.client, vac: d.vac, rec: d.rec, fill: () => this.open(d.id) })),
      klantDone: active.length - klantOpen
    };
    const byPrio = (a, b) => (a.cur.q ?? 5.5) - (b.cur.q ?? 5.5);
    const groups = [
      { lvl: 2, sub: 'Bijsturen deze week' }, { lvl: 1, sub: 'In de gaten houden' }, { lvl: 0, sub: 'Geen actie nodig' }
    ].map(g => {
      const items = D.filter(d => d.lvl === g.lvl).sort(byPrio);
      return { label: STAT[g.lvl].label, fg: STAT[g.lvl].fg, n: items.length, sub: g.sub, items, cards: g.lvl > 0 && items.length > 0, rows: g.lvl === 0 && items.length > 0 };
    }).filter(g => g.n > 0);

    // dashboard
    const q = st.f.q.trim().toLowerCase();
    const recF = isRec ? me.rec : st.f.rec;
    let list = D.filter(d => (!q || (d.client + ' ' + d.vac).toLowerCase().includes(q)) && (recF === 'all' || d.rec === recF));
    const tabCount = k => k === 'all' ? list.length : k === 'missing' ? list.filter(d => d.missing).length : list.filter(d => d.lvl === +k).length;
    const statusTabs = [['all', 'Alle', null], ['2', 'Actie nodig', STAT[2].fg], ['1', 'Monitoren', STAT[1].fg], ['0', 'Goed', STAT[0].fg], ['missing', 'Geen feedback', null]].map(([k, label, dot]) => ({
      label, dot, n: tabCount(k), bg: st.f.status === k ? '#FFFFFF' : 'transparent', fg: st.f.status === k ? '#1D1D1B' : '#5C5C5A', sh: st.f.status === k ? '0 1px 4px rgba(29,29,27,.07)' : 'none', onClick: () => setF({ status: k })
    }));
    if (st.f.status === 'missing') list = list.filter(d => d.missing);
    else if (st.f.status !== 'all') list = list.filter(d => d.lvl === +st.f.status);
    const sorters = {
      status: (a, b) => b.lvl - a.lvl || byPrio(a, b),
      quality: (a, b) => byPrio(a, b),
      leads: (a, b) => a.cur.leads - b.cur.leads,
      client: (a, b) => a.client.localeCompare(b.client)
    };
    list = list.slice().sort(sorters[st.f.sort] || sorters.status);
    const recOptions = [{ v: 'all', l: 'Alle recruiters' }, ...RECS.map(r => ({ v: r, l: r }))];

    // check-in
    const queue = this.queue();
    const f = st.form;
    const fcC = f ? st.campaigns.find(c => c.id === f.id) : null;
    let fc = {};
    if (fcC) {
      const prev = fcC.weeks[fcC.weeks.length - 2];
      const edited = +f.leads !== f.trello;
      fc = {
        client: fcC.client, vac: fcC.vac,
        prevLine: prev ? `${prev.leads} kandidaten · kwaliteit ${prev.q ?? '—'}/10${prev.rec ? ` · “${prev.rec}”` : ''}` : 'eerste week van deze campagne',
        trText: edited ? `Handmatig aangepast · Trello telde ${f.trello}` : `Automatisch uit Trello · ${f.trello} nieuwe kaarten ${range(CUR)}`,
        trBg: edited ? '#FEF3C7' : '#E7E7F0', trFg: edited ? '#B45309' : '#1B1B63',
        rej: reasonList(fcC.weeks[fcC.weeks.length - 1].tr.reasons), hasRej: reasonList(fcC.weeks[fcC.weeks.length - 1].tr.reasons).length > 0
      };
    }
    const qOpen = queue.filter(c => c.weeks[c.weeks.length - 1].q == null).length;
    const scoreBtns = Array.from({ length: 10 }, (_, i) => {
      const n = i + 1, on = f && f.q === n;
      return { n, onClick: () => this.setForm({ q: n, err: false }), bg: on ? qc(n) : '#FFFFFF', fg: on ? '#FFFFFF' : '#1D1D1B', border: on ? qc(n) : '#E4E1DE' };
    });

    // detail
    const selC = st.campaigns.find(c => c.id === st.sel) || active[0] || this.placeholder();
    const dd = this.deco(selC);
    const ws = selC.weeks, n = ws.length;
    const maxL = Math.max(...ws.map(w => w.leads), 1);
    const actWeeks = new Set(selC.actions.map(a => a.w));
    const qws = ws.filter(w => w.q != null);
    const total = ws.reduce((s, w) => s + w.leads, 0);
    const tot = k => ws.reduce((s, w) => s + w.tr[k], 0);
    const funnelDefs = [['nieuw', 'Nieuw'], ['gescreend', 'Gescreend'], ['voorgesteld', 'Voorgesteld'], ['gesprek', 'Gesprek'], ['geplaatst', 'Geplaatst']];
    const cw = ws[n - 1];
    const d = {
      ...dd, mkt: this.mktOf(selC) || 'nog niet toegewezen',
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
        w: w.w, wl: wl(w.w), range: range(w.w), leads: w.leads, qText: w.q == null ? 'Geen score' : `Kwaliteit ${w.q}/10`, qBg: qb(w.q), qFg: qc(w.q),
        missing: w.q == null, hasFb: w.q != null, rec: w.rec || '—',
        klant: w.klant || 'Nog geen terugkoppeling van klant', klantColor: w.klant ? '#1D1D1B' : '#8C8C8A',
        canFill: isRec && w.w === CUR && selC.rec === me.rec, canAddKlant: !isRec && !w.klant && w.w === CUR && !selC.ended, addKlant: () => this.startKlant(selC.id),
        note: w.note, hasNote: !!w.note, needsAction: w.needsAction, showTr: !!this.showTrello(),
        trText: `${w.tr.voorgesteld} voorgesteld · ${w.tr.gesprek} ${w.tr.gesprek === 1 ? 'gesprek' : 'gesprekken'}${w.tr.geplaatst ? ` · ${w.tr.geplaatst} geplaatst` : ''}`,
        reasons: reasonList(w.tr.reasons), hasReasons: reasonList(w.tr.reasons).length > 0, rejN: Object.values(w.tr.reasons || {}).reduce((a, b) => a + b, 0),
        acts: selC.actions.filter(a => a.w === w.w), fill: () => this.startCheckin(selC.id)
      })),
      actions: selC.actions.slice().sort((a, b) => b.w - a.w).map(a => {
        const e = this.effect(selC, a);
        let eff = 'Effect: nog te vroeg om te beoordelen', effFg = '#8C8C8A';
        if (e.qB != null && e.qA != null) { const dq = e.qA - e.qB; eff = `Kwaliteit ${nl(e.qB)} → ${nl(e.qA)} · instroom ${nl(e.lB)} → ${nl(e.lA)} p/w`; effFg = dq > 0 ? '#1A7A4A' : dq < 0 ? '#D32F2F' : '#5C5C5A'; }
        return { ...a, wl: wl(a.w), eff, effFg };
      }),
      noActions: selC.actions.length === 0,
      weekOpts: ws.slice().reverse().map(w => ({ v: w.w, l: 'Week ' + wl(w.w) })),
      ...(() => { const agg = {}; ws.forEach(w => Object.entries(w.tr.reasons || {}).forEach(([k, v]) => { agg[k] = (agg[k] || 0) + v; })); const l = reasonList(agg), mx = Math.max(1, ...l.map(x => x.n)), tot = l.reduce((a, x) => a + x.n, 0);
        return { rej: l.map(x => ({ ...x, pct: (x.n / mx * 100) + '%', share: Math.round(x.n / Math.max(tot, 1) * 100) + '%' })), hasRej: l.length > 0, rejTotal: tot }; })(),
      funnel: funnelDefs.map(([k, label]) => ({ label, n: tot(k), pct: (tot(k) / Math.max(tot('nieuw'), 1) * 100) + '%' })),
      fill: isRec ? () => this.startCheckin(selC.id) : () => this.startKlant(selC.id),
      fillLabel: isRec ? `Mijn feedback week ${wl(CUR)}` : `Feedback klant week ${wl(CUR)}`
    };
    const zone = {
      red: R.qRedOn ? ((R.qRed + 0.5) * 10) + '%' : '0%',
      green: ((10 - R.qOrange - 0.5) * 10) + '%',
      redText: `Actie nodig (≤ ${R.qRed})`, greenText: `Goed (≥ ${R.qOrange + 1})`
    };

    // history
    const period = +st.hist.period;
    const hw = Array.from({ length: period }, (_, i) => CUR - period + 1 + i);
    const hc = st.campaigns.filter(c => (st.hist.status === 'all' || (st.hist.status === 'ended' ? c.ended : !c.ended)) && (st.hist.rec === 'all' || c.rec === st.hist.rec));
    const histRows = hc.map(c => {
      const inP = c.weeks.filter(w => hw.includes(w.w));
      const qv = inP.filter(w => w.q != null).map(w => w.q);
      const a = avgOf(qv);
      const aw = new Set(c.actions.map(x => x.w));
      const lvl = c.ended ? null : health(c, R).lvl;
      return {
        client: c.client, vac: c.vac + (c.ended ? ' (afgerond)' : ''),
        dot: c.ended ? '#C0BDB9' : STAT[lvl].fg,
        cells: hw.map(w => { const e = c.weeks.find(x => x.w === w); return e ? { t: e.q ?? '?', bg: qb(e.q), fg: qc(e.q), act: aw.has(w) } : { t: '', bg: 'transparent', fg: '#8C8C8A', act: false }; }),
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
    const hits = k => { const n = active.filter(c => health(c, R).reasons.some(r => r.k === k)).length; return n === 1 ? '1 campagne' : `${n} campagnes`; };
    const lead = me.role === 'teamlead';
    const rule = (onKey, pre, valKey, post, hitKey) => ({
      pre, post, hasVal: !!valKey, val: valKey ? R[valKey] : '', fg: R[onKey] ? '#1D1D1B' : '#8C8C8A',
      locked: !lead, cursor: lead ? 'pointer' : 'default', op: lead ? 1 : 0.6,
      setVal: e => { if (lead) this.setRule(valKey, Math.max(0, +e.target.value || 0)); },
      toggle: () => { if (lead) this.setRule(onKey, !R[onKey]); }, tBg: R[onKey] ? '#1B1B63' : '#C0BDB9', knob: R[onKey] ? '18px' : '2px',
      hits: R[onKey] ? hits(hitKey) : 'uit'
    });
    const ruleGroups = [
      { label: 'Actie nodig', fg: STAT[2].fg, sub: 'Minimaal één van deze regels', rules: [
        rule('qRedOn', 'Kwaliteit is', 'qRed', 'of lager', 'qRed'),
        rule('declOn', 'Kwaliteit daalt', 'declWeeks', 'weken achter elkaar', 'decl'),
        rule('minLeadsOn', 'Instroom deze week is', 'minLeads', 'kandidaten of minder', 'minLeads'),
        rule('manualOn', 'Recruiter heeft ‘Bijsturing nodig’ aangevinkt', null, '', 'manual')
      ] },
      { label: 'Monitoren', fg: STAT[1].fg, sub: 'Als geen rode regel afgaat', rules: [
        rule('qOrangeOn', 'Kwaliteit is', 'qOrange', 'of lager', 'qOrange'),
        rule('dropOn', 'Instroom ligt', 'dropPct', '% of meer onder het gemiddelde van de 3 weken ervoor', 'drop'),
        rule('missingOn', 'Er is nog geen feedback ingevuld voor deze week', null, '', 'missing')
      ] }
    ];

    const tv = e => e.target.value;
    const kq0 = this.klantQueue(), kOpen = kq0.filter(c => !c.weeks[c.weeks.length - 1].klant).length;
    const kC = st.kform ? st.campaigns.find(c => c.id === st.kform.id) : null;
    let kc = {};
    if (kC) {
      const cw = kC.weeks[kC.weeks.length - 1], pw = kC.weeks[kC.weeks.length - 2];
      kc = { client: kC.client, vac: kC.vac, rec: kC.rec, leads: cw.leads, qText: cw.q != null ? `kwaliteit ${cw.q}/10` : 'nog geen score',
        recText: cw.rec || `${kC.rec} heeft nog geen feedback ingevuld.`, recColor: cw.rec ? '#1D1D1B' : '#8C8C8A',
        prevKlant: pw && pw.klant ? `“${pw.klant}”` : 'geen' };
    }
    return {
      wk: { n: wl(CUR), today: todayLong(), range: rangeLong(CUR), histRange: `Week ${wl(hw[0])} – ${wl(CUR)}` },
      user: { id: me.id, name: me.name, roleLabel: { recruiter: 'Recruiter', marketeer: 'Recruitment Marketeer', teamlead: 'Teamlead' }[me.role] }, isMarketeer: !isRec,
      setUser: e => this.setUser(tv(e)), navTitle: isRec ? 'Recruiter' : 'Campagnemonitor',
      campTitle: isRec ? 'Mijn campagnes' : 'Actieve campagnes',
      isKlant: st.view === 'klant', goKlant: () => this.go('klant'), goMine: () => this.go('mine'),
      hasKform: !!kC, kform: st.kform || {}, kc, skipKlant: () => this.skipKlant(),
      sourceTabs: [['demo', 'Demo-data'], ['trello', 'Trello live']].map(([k, label]) => ({ label, bg: st.source === k ? '#FFFFFF' : 'transparent', fg: st.source === k ? '#1D1D1B' : '#5C5C5A', sh: st.source === k ? '0 1px 4px rgba(29,29,27,.07)' : 'none', onClick: () => this.setSource(k) })),
      syncText: this.syncInfo().text, syncDot: this.syncInfo().dot,
      reloadTrello: () => { if (st.source === 'trello') this.startLive(); },
      liveEmpty: st.source === 'trello' && active.length === 0, emptyHint: me.role === 'teamlead' ? 'Koppel eerst de actieve Trello-borden aan een functie en recruiter.' : 'De teamlead koppelt de Trello-borden aan klanten en recruiters. Daarna verschijnen ze hier.', goTrello: () => this.go('trello'),
      isLead: me.role === 'teamlead', goTrelloTest: () => this.go('trello-test'),
      isTrello: st.view === 'trello' && me.role === 'teamlead', tr: this.trelloData(),
      isTrelloTest: st.view === 'trello-test' && me.role === 'teamlead', trelloConfigured: st.config.trello, goTrelloLive: () => { this.setSource('trello'); this.go('trello'); },
      isAssign: st.view === 'toewijzing' && me.role === 'teamlead', asg: this.assignData(), asgQ: st.asg.q,
      setAsgQ: e => { const v = e.target.value; this.setState(s => ({ asg: { ...s.asg, q: v } })); },
      isLive: st.view === 'live', live: this.liveData(me), goCheckin: () => this.go('checkin'),
      kq: { doneText: `${kq0.length - kOpen} van ${kq0.length} klanten gaven feedback deze week`, total: kq0.length, open: kOpen, done: kq0.length - kOpen, pct: ((kq0.length - kOpen) / Math.max(kq0.length, 1) * 100) + '%',
        items: kq0.map(c => { const has = !!c.weeks[c.weeks.length - 1].klant, sel = st.kform && st.kform.id === c.id;
          return { client: c.client, vac: c.vac, bg: sel ? '#FFF8E0' : '#FFFFFF', mark: has ? '✓' : '', markBg: has ? '#E6F4ED' : '#F5F2ED', markBorder: '0', onClick: () => this.loadKlant(c.id) }; }) },
      setKformText: e => { const v = tv(e); this.setState(s => ({ kform: { ...s.kform, klant: v } })); },
      saveKlant: () => this.saveKlant(), kSaveLabel: kOpen > 1 ? 'Opslaan & volgende' : 'Feedback opslaan',
      nav, sum, groups, list, listCount: list.length, listEmpty: list.length === 0, statusTabs, recOptions, f: st.f,
      isWeek: st.view === 'week', isCampaigns: st.view === 'campaigns' || st.view === 'mine', isCheckin: st.view === 'checkin', isDetail: st.view === 'detail', isHistory: st.view === 'history', isRules: st.view === 'rules',
      goCampaigns: () => { setF({ status: 'all' }); this.go('campaigns'); }, goWeek: () => this.go('week'),
      goBack: () => this.go(st.back || 'campaigns'), backLabel: { toewijzing: 'Toewijzing', trello: 'Klanten uit Trello', 'trello-test': 'Trello-koppeling testen', week: 'Weekoverzicht', campaigns: 'Campagnes', mine: 'Mijn campagnes', live: 'Live campagnes', klant: 'Feedback klant', history: 'Historie & analyse', checkin: 'Mijn feedback', rules: 'Health-regels' }[st.back] || 'Campagnes',
      remind: () => {
        const byRec = {};
        missingD.forEach(m => { (byRec[m.rec] = byRec[m.rec] || []).push(`${m.client} – ${m.vac}`); });
        const add = Object.entries(byRec).map(([rec, items]) => ({ id: Date.now() + rec, to: rec, from: me.name, at: stamp(), read: false, kind: 'reminder', title: `Nog ${items.length} ${items.length === 1 ? 'campagne' : 'campagnes'} zonder feedback voor week ${wl(CUR)}`, items }));
        this.setState(s => ({ reminded: true, inbox: [...add, ...s.inbox] })); this.flash(`Herinnering gestuurd naar ${Object.keys(byRec).join(', ')}`);
      },
      remindLabel: st.reminded ? 'Herinnering verstuurd ✓' : 'Herinnering sturen',
      setSearch: e => setF({ q: tv(e) }), setRecFilter: e => setF({ rec: tv(e) }), setSort: e => setF({ sort: tv(e) }),
      ci: st.ci, ciRecOptions: [{ v: 'all', l: 'Alle recruiters' }, ...RECS.map(r => ({ v: r, l: 'Ingevuld door ' + r }))],
      setCiRec: e => { const v = tv(e); this.setState(s => ({ ci: { ...s.ci, rec: v } }), () => this.enterCheckin()); },
      queue: queue.map(c => {
        const cur = c.weeks[c.weeks.length - 1], doneQ = cur.q != null, sel = f && f.id === c.id;
        return { client: c.client, vac: c.vac, qText: doneQ ? cur.q + '/10' : '', qFg: qc(cur.q), bg: sel ? '#FFF8E0' : '#FFFFFF', mark: doneQ ? '✓' : '', markBg: doneQ ? '#E6F4ED' : '#FFFFFF', markFg: '#1A7A4A', markBorder: doneQ ? '0' : '1.5px solid #C0BDB9', onClick: () => this.loadForm(c.id) };
      }),
      queueTotal: queue.length, queueOpen: qOpen, queueDone: queue.length - qOpen, queuePct: ((queue.length - qOpen) / Math.max(queue.length, 1) * 100) + '%', queueComplete: queue.length > 0 && qOpen === 0,
      hasForm: !!fcC, form: f || {}, fc, scoreBtns,
      saveLabel: qOpen > 1 || (qOpen === 1 && fcC && fcC.weeks[fcC.weeks.length - 1].q != null) ? 'Opslaan & volgende' : 'Feedback opslaan',
      setLeads: e => this.setForm({ leads: tv(e).replace(/\D/g, '') }), decLeads: () => this.setForm({ leads: Math.max(0, (+f.leads || 0) - 1) }), incLeads: () => this.setForm({ leads: (+f.leads || 0) + 1 }),
      setRecText: e => this.setForm({ rec: tv(e) }), setKlantText: e => this.setForm({ klant: tv(e) }), setNote: e => this.setForm({ note: tv(e) }),
      toggleNeeds: () => this.setForm({ needsAction: !f.needsAction }), needsBg: f && f.needsAction ? '#D32F2F' : '#C0BDB9', needsKnob: f && f.needsAction ? '18px' : '2px',
      saveForm: () => this.saveForm(),
      d, zone, showTrello: this.showTrello(), act: st.act, actTypes: ACT_TYPES,
      setActType: e => { const v = tv(e); this.setState(s => ({ act: { ...s.act, type: v } })); },
      setActWeek: e => { const v = +tv(e); this.setState(s => ({ act: { ...s.act, w: v } })); },
      setActText: e => { const v = tv(e); this.setState(s => ({ act: { ...s.act, text: v } })); },
      addAction: () => this.addAction(),
      hist: st.hist, histWeeks: hw.map(w => 'W' + wl(w)), histN: hw.length, histCols: `${hw.length * 40}px`, histRows, histKpis, effects,
      setHistStatus: e => { const v = tv(e); this.setState(s => ({ hist: { ...s.hist, status: v } })); },
      setHistRec: e => { const v = tv(e); this.setState(s => ({ hist: { ...s.hist, rec: v } })); },
      setHistPeriod: e => { const v = tv(e); this.setState(s => ({ hist: { ...s.hist, period: v } })); },
      exportCsv: () => this.exportCsv(),
      ruleGroups, rulesLocked: me.role !== 'teamlead', resetRules: () => { this.setState({ rules: { ...DEF_RULES } }); this.flash('Standaardregels hersteld'); },
      canResetDemo: st.source === 'demo',
      resetDemo: () => {
        if (!window.confirm('Demo-data en health-regels terugzetten naar de beginstand? Dit geldt voor het hele team.')) return;
        this.setState({ campaigns: build(), rules: { ...DEF_RULES }, form: null, reminded: false }); this.flash('Demo-data hersteld');
      },
      authEnabled: st.config.auth, saveOffline: st.saveState === 'offline',
      ...this.panelVals(me, isRec),
      hasToast: !!st.toast, toast: st.toast
    };
  }
  liveData(me) {
    const R = this.state.rules;
    const mine = this.state.campaigns.filter(c => !c.ended && c.rec === me.rec);
    const now = Date.now(), recent = {}, S = this.state.seen[me.id] || {}, since = S.prev ?? now - 864e5, dis = S.dismissed || 0;
    this.state.assignLog.filter(e => e.mode === this.state.source && e.at > dis && (e.at > since || now - e.at < 864e5)).sort((a, b) => b.at - a.at).forEach(e => { if (!recent[e.client]) recent[e.client] = e; });
    const hhmm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    const mineNew = Object.values(recent).filter(e => e.to === me.rec), gone = Object.values(recent).filter(e => e.from === me.rec && e.to !== me.rec);
    const changes = [
      ...mineNew.map(e => ({ client: e.client, text: e.from ? `overgenomen van ${e.from}` : 'nieuw bedrijf', tag: e.from ? 'Overgenomen' : 'Nieuw', tBg: e.from ? '#E7E7F0' : '#FFF8E0', tFg: e.from ? '#1B1B63' : '#B45309', at: `${new Date(e.at).toDateString() === new Date().toDateString() ? 'vandaag' : new Date(e.at).getDate() + ' ' + MON[new Date(e.at).getMonth()]} ${hhmm(e.at)} · door ${e.by}` })),
      ...gone.map(e => ({ client: e.client, text: `overgedragen aan ${e.to}`, tag: 'Overgedragen', tBg: '#F5F2ED', tFg: '#5C5C5A', at: `vandaag ${hhmm(e.at)} · door ${e.by}` }))
    ];
    const nN = mineNew.filter(e => !e.from).length, nO = mineNew.filter(e => e.from).length;
    const chTitle = [nN ? `${nN} ${nN === 1 ? 'nieuw bedrijf' : 'nieuwe bedrijven'}` : '', nO ? `${nO} overgenomen` : '', gone.length ? `${gone.length} overgedragen` : ''].filter(Boolean).join(' · ');
    const rows = mine.map(c => {
      const cur = c.weeks[c.weeks.length - 1], ev = recent[c.client], mineEv = ev && ev.to === me.rec;
      const nieuw = c.live ? c.live.nieuw : Math.floor(rnd(c.id + 'today') * (cur.leads / 4 + 1.5)) + Math.round(rnd(c.id + 'bl') * 1.4);
      const contact = c.live ? c.live.contact : Math.round(rnd(c.id + 'cp') * 3) + Math.round(cur.leads / 4);
      return { client: c.client, vac: c.vac, dot: STAT[health(c, R).lvl].fg, open: () => this.open(c.id), nieuw, contact, total: nieuw + contact,
        hasBadge: !!mineEv, badge: mineEv ? (ev.from ? `Overgenomen van ${ev.from}` : 'Nieuw') : '', bBg: mineEv && ev.from ? '#E7E7F0' : '#FFF8E0', bFg: mineEv && ev.from ? '#1B1B63' : '#B45309',
        nFg: nieuw ? '#1B1B63' : '#C0BDB9', cFg: contact ? '#B45309' : '#C0BDB9' };
    });
    const mx = Math.max(...rows.map(r => r.total), 1);
    rows.forEach(r => { r.nPct = (r.nieuw / mx * 100) + '%'; r.cPct = (r.contact / mx * 100) + '%'; });
    rows.sort((a, b) => b.total - a.total);
    const open = mine.filter(c => c.weeks[c.weeks.length - 1].q == null).length;
    const sum = k => rows.reduce((s, r) => s + r[k], 0);
    return {
      sinceText: (() => { const d = new Date(since); const today = new Date().toDateString() === d.toDateString(); return `Sinds je vorige login (${today ? 'vandaag' : d.getDate() + ' ' + MON[d.getMonth()]} ${hhmm(since)}) · minstens 24 uur zichtbaar`; })(),
      markSeen: () => this.setState(s => ({ seen: { ...s.seen, [me.id]: { ...(s.seen[me.id] || {}), dismissed: Date.now() } } })),
      count: mine.length, rows, isEmpty: mine.length === 0, changes, hasChanges: changes.length > 0, chTitle, hasOpen: open > 0, openText: open === 1 ? '1 campagne wacht op je feedback' : `${open} campagnes wachten op je feedback`,
      kpis: [
        { label: 'Vandaag te bellen', value: sum('total'), sub: 'nieuw + contactpogingen', fg: '#FFFFFF', lfg: 'rgba(255,255,255,.8)', bg: '#1B1B63', border: '#1B1B63' },
        { label: 'Nieuwe kandidaten', value: sum('nieuw'), sub: 'eerste keer bellen', fg: '#1B1B63', lfg: '#5C5C5A', bg: '#FFFFFF', border: '#E4E1DE' },
        { label: 'Contactpogingen', value: sum('contact'), sub: 'opnieuw bellen', fg: '#B45309', lfg: '#5C5C5A', bg: '#FFFFFF', border: '#E4E1DE' }
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
        <div className="app-shell">
          <Sidebar v={v} />
          <main className="app-main">
            <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
              {v.saveOffline ? <div style={{ background: '#FDECEA', color: '#D32F2F', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', fontWeight: 500, marginBottom: '20px' }}>Geen verbinding met de server. Je wijzigingen worden opgeslagen zodra de verbinding terug is; sluit dit tabblad nog niet.</div> : null}
              <TopActions v={v} />
              {v.isWeek ? <WeekView v={v} /> : null}
              {v.isCampaigns ? <CampaignsView v={v} /> : null}
              {v.isCheckin ? <CheckinView v={v} /> : null}
              {v.isLive ? <LiveView v={v} /> : null}
              {v.isTrello ? <TrelloView v={v} /> : null}
              {v.isTrelloTest ? <TrelloTestView v={v} tget={(p, q) => this.tget(p, q)} /> : null}
              {v.isAssign ? <AssignView v={v} /> : null}
              {v.isKlant ? <KlantView v={v} /> : null}
              {v.isDetail ? <DetailView v={v} /> : null}
              {v.isHistory ? <HistoryView v={v} /> : null}
              {v.isRules ? <RulesView v={v} /> : null}
            </div>
          </main>
        </div>
        {v.hasPanel ? <SidePanel v={v} /> : null}
        {v.hasToast ? <div role="status" style={{ position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', background: '#1B1B63', color: '#FFFFFF', padding: '12px 18px', borderRadius: '10px', fontSize: '14px', boxShadow: '0 8px 32px rgba(29,29,27,.15)', zIndex: 10 }}>{v.toast}</div> : null}
      </>
    );
  }
}
