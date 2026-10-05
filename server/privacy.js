// GDPR tools: export everything the app holds about one person (right of access), and anonymise a former team
// member (right to erasure) by replacing their name everywhere with a pseudonym. Free text that someone typed
// (feedback, ideas) is kept as it is; it may mention names and has to be checked by hand if someone asks.

const eq = (names, v) => typeof v === 'string' && names.has(v);

export function createPrivacy({ accounts, store, audit }) {
  /** Everything about one account, as a JSON-able object. */
  async function exportFor(a, currentSessionId = null) {
    const names = new Set([a.name, a.recName].filter(Boolean)), D = store.docs;
    const camps = Object.values(D.campaigns || {}), links = D['live.links'] || {}, fb = D['live.fb'] || {};
    const label = c => `${c.client} – ${c.vac}`;
    const recFb = [], klantFb = [], monFb = [];
    const mon = (bron, campagne, week, e) => {
      if (eq(names, e.monBy)) monFb.push({ bron, campagne, week, monitorstatus: e.mon });
      if (eq(names, e.updBy)) monFb.push({ bron, campagne, week, updateVoorRecruiter: e.upd });
    };
    for (const c of camps) for (const w of c.weeks || []) {
      if (eq(names, w.recBy) || (w.recBy == null && w.rec && eq(names, c.rec))) recFb.push({ bron: 'demo', campagne: label(c), week: w.w, kwaliteit: w.q, kandidaten: w.leads, feedback: w.rec, notitie: w.note, bijsturing: !!w.needsAction });
      if (eq(names, w.klantBy)) klantFb.push({ bron: 'demo', campagne: label(c), week: w.w, klantfeedback: w.klant });
      mon('demo', label(c), w.w, w);
    }
    for (const [id, weeks] of Object.entries(fb)) {
      const l = links[id], name = l ? `${l.boardName} – ${l.vac}` : id;
      for (const [w, e] of Object.entries(weeks || {})) {
        if (eq(names, e.recBy)) recFb.push({ bron: 'trello', campagne: name, week: +w, kwaliteit: e.q, feedback: e.rec, notitie: e.note, bijsturing: !!e.needsAction });
        if (eq(names, e.klantBy)) klantFb.push({ bron: 'trello', campagne: name, week: +w, klantfeedback: e.klant });
        mon('trello', name, +w, e);
      }
    }
    return {
      toelichting: 'Alle gegevens die de Campagnemonitor over deze persoon bewaart. Vrije tekst van anderen kan je naam ook noemen; die staat hier niet in.',
      geexporteerdOp: new Date().toISOString(),
      account: { ...accounts.selfView(a), createdAt: a.createdAt, deactivatedAt: a.deactivatedAt },
      sessies: accounts.sessionsOf(a.id, currentSessionId),
      laatstGezien: (D.seen || {})[a.id] || null,
      campagnesAlsRecruiter: [...camps.filter(c => eq(names, c.rec)).map(c => ({ bron: 'demo', campagne: label(c), afgerond: !!c.ended })),
        ...Object.values(links).filter(l => eq(names, l.rec)).map(l => ({ bron: 'trello', campagne: `${l.boardName} – ${l.vac}` }))],
      klantenAlsMarketeer: [...Object.entries(D.mktDemo || {}).filter(([, v]) => eq(names, v)).map(([k]) => k),
        ...Object.entries(D['live.mkt'] || {}).filter(([, v]) => eq(names, v)).map(([k]) => (Object.values(links).find(l => l.boardId === k) || {}).boardName || k)],
      recruiterfeedback: recFb,
      klantfeedback: klantFb,
      monitorstatusEnUpdates: monFb,
      meldingen: Object.values(D.inbox || {}).filter(n => eq(names, n.to) || eq(names, n.from)),
      toewijzingen: Object.values(D.assignLog || {}).filter(e => eq(names, e.to) || eq(names, e.from) || eq(names, e.by)),
      ideeen: Object.values(D.ideas || {}).filter(i => eq(names, i.by)),
      stemmen: Object.values(D.ideas || {}).filter(i => (i.voters || []).some(v => eq(names, v))).map(i => ({ id: i.id, tekst: i.text })),
      auditlog: await audit.query({ person: a.id, limit: 5000 }),
    };
  }

  /** How many active campaigns still have this person as recruiter (they should be reassigned first). */
  function openWork(a) {
    const names = new Set([a.name, a.recName].filter(Boolean)), D = store.docs;
    const inactive = D['live.inactive'] || {};
    return Object.values(D.campaigns || {}).filter(c => !c.ended && eq(names, c.rec)).length
      + Object.values(D['live.links'] || {}).filter(l => !inactive[l.boardId] && eq(names, l.rec)).length;
  }

  async function anonymise(actor, a) {
    if (a.status !== 'deactivated') throw new Error('Deactiveer het account eerst.');
    const n = accounts.all().filter(x => x.status === 'anonymised').length + 1;
    let pseudonym = `Oud-teamlid ${n}`;
    while (accounts.all().some(x => x.name === pseudonym)) pseudonym += '*';
    const names = new Set([a.name, a.recName].filter(Boolean)), sub = v => eq(names, v) ? pseudonym : v;
    const subWeek = w => { for (const f of ['recBy', 'klantBy', 'monBy', 'updBy']) if (w[f]) w[f] = sub(w[f]); };
    store.mutate(D => {
      for (const c of Object.values(D.campaigns || {})) {
        c.rec = sub(c.rec);
        for (const w of c.weeks || []) subWeek(w);
      }
      for (const l of Object.values(D['live.links'] || {})) l.rec = sub(l.rec);
      for (const weeks of Object.values(D['live.fb'] || {})) for (const e of Object.values(weeks || {})) subWeek(e);
      for (const doc of ['live.mkt', 'mktDemo']) for (const k of Object.keys(D[doc] || {})) D[doc][k] = sub(D[doc][k]);
      for (const e of Object.values(D.assignLog || {})) { e.from = sub(e.from); e.to = sub(e.to); e.by = sub(e.by); }
      for (const m of Object.values(D.inbox || {})) { m.from = sub(m.from); m.to = sub(m.to); }
      for (const i of Object.values(D.ideas || {})) { i.by = sub(i.by); if (i.voters) i.voters = i.voters.map(sub); }
      if (D.seen) delete D.seen[a.id];
    });
    const oldName = a.name;
    accounts.anonymise(a, pseudonym);
    await audit.rename(a.id, pseudonym);
    audit.log('member.anonymised', { actor, target: a, details: actor ? {} : { automatisch: true } });
    return { pseudonym, oldName };
  }

  /** Anonymises accounts that have been deactivated longer than the retention setting. */
  async function autoAnonymise() {
    const months = accounts.settings.anonymiseAfterMonths;
    if (!months) return;
    const cut = Date.now() - months * 30.44 * 864e5;
    for (const a of accounts.all()) if (a.status === 'deactivated' && a.deactivatedAt && a.deactivatedAt < cut) await anonymise(null, a);
  }

  return { exportFor, openWork, anonymise, autoAnonymise };
}
