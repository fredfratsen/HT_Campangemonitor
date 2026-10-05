// Kandidaten › Blacklist. Loads its own data from /api/blacklist: candidates' personal data are never part of the
// shared state (see server/blacklist.js). With blacklist.view you search and propose; with blacklist.manage you
// see the whole list and decide on proposals. Under "Bekijk als" it shows what that person would see; the server
// still acts on your own rights.
import React, { useEffect, useRef, useState } from 'react';
import Button from '../components/Button.jsx';
import { api, download, fmtDate } from '../lib/api.js';
import { BL_REASONS, BL_MONTHS, BL_DEF_MONTHS, BL_PROPOSAL_DAYS } from '../lib/constants.js';
import { Section, Badge, Notice, Err, useAction, input, select, label, muted, row, linkBtn, dangerBtn, h2 } from './settings/ui.jsx';

const eyebrow = { fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' };
const box = { background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' };
const check = { width: '16px', height: '16px', margin: '0', accentColor: '#1B1B63', flex: 'none' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px' };
// Client and function in one select value.
const SEP = '\u001f';
const at = (client, vac) => client ? `${client}${SEP}${vac || ''}` : '';

/** A new entry from what was searched: an email address, a phone number or a name. */
function seedFrom(q) {
  const t = q.trim();
  return t.includes('@') ? { email: t } : t.replace(/\D/g, '').length >= 6 ? { phone: t } : { name: t };
}

/** Add or propose an entry (no entry), or correct one. */
function EntryForm({ b, entry, seed, propose, onSaved, onCancel }) {
  const [f, setF] = useState(() => entry
    ? { name: entry.name, email: entry.email || '', phone: entry.phone || '', reason: entry.reason, note: entry.note || '', at: at(entry.client, entry.vac), only: entry.scope === 'client', months: entry.status === 'voorstel' ? entry.months : '' }
    : { name: '', email: '', phone: '', reason: '', note: '', at: '', only: false, months: BL_DEF_MONTHS, ...seed });
  const a = useAction(b.flash);
  const set = k => e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setF(x => ({ ...x, [k]: v })); };
  const opts = b.campaigns.map(c => ({ v: at(c.client, c.vac), l: `${c.client} – ${c.vac}` }));
  if (f.at && !opts.some(o => o.v === f.at)) opts.unshift({ v: f.at, l: f.at.split(SEP).filter(Boolean).join(' – ') });
  const extend = entry && entry.status === 'actief';
  const save = async e => {
    e.preventDefault();
    const [client = '', vac = ''] = f.at ? f.at.split(SEP) : [];
    const body = { name: f.name, email: f.email, phone: f.phone, reason: f.reason, note: f.note, client, vac, scope: client && f.only ? 'client' : 'all', months: f.months, propose };
    const r = await a.run(() => entry ? api('PATCH', `/api/blacklist/${entry.id}`, body) : api('POST', '/api/blacklist', body));
    if (r) onSaved(r, entry ? `${r.entry.name} bijgewerkt` : r.entry.status === 'voorstel' ? `${r.entry.name} voorgedragen; de teamlead krijgt een melding` : `${r.entry.name} staat op de blacklist`);
  };
  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={grid}>
        <label style={label}>Naam<input value={f.name} onChange={set('name')} required maxLength={80} autoComplete="off" style={input} /></label>
        <label style={label}>E-mailadres<input type="email" value={f.email} onChange={set('email')} maxLength={200} autoComplete="off" style={input} /></label>
        <label style={label}>Telefoonnummer<input type="tel" value={f.phone} onChange={set('phone')} maxLength={30} autoComplete="off" style={input} /></label>
      </div>
      <div style={{ fontSize: '12px', color: '#8C8C8A', marginTop: '-6px' }}>Vul naast de naam een e-mailadres of telefoonnummer in, zodat niemand met een naamgenoot wordt verward.</div>
      <div style={grid}>
        <label style={label}>Reden
          <select value={f.reason} onChange={set('reason')} required style={select}>
            <option value="">— Kies —</option>
            {BL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label style={label}>Sollicitatie bij (optioneel)
          <select value={f.at} onChange={set('at')} style={select}>
            <option value="">— Geen —</option>
            {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </label>
        <label style={label}>Bewaren
          <select value={f.months} onChange={set('months')} style={select}>
            {extend ? <option value="">Niet wijzigen · tot {fmtDate(entry.until)}</option> : null}
            {BL_MONTHS.map(m => <option key={m} value={m}>{extend ? `Verlengen: ${m} maanden vanaf vandaag` : `${m} maanden`}</option>)}
          </select>
        </label>
      </div>
      <label style={{ ...row, gap: '8px', fontSize: '14px', cursor: f.at ? 'pointer' : 'default', color: f.at ? '#1D1D1B' : '#8C8C8A' }}>
        <input type="checkbox" checked={!!f.at && f.only} disabled={!f.at} onChange={set('only')} style={check} />
        Geldt alleen voor deze klant; bij andere klanten mag de kandidaat wel solliciteren
      </label>
      <label style={label}>{f.reason === 'Overig' ? 'Toelichting' : 'Toelichting (optioneel)'}
        <textarea value={f.note} onChange={set('note')} rows="3" maxLength={500} placeholder="Wat gebeurde er, en wanneer?" style={{ ...input, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical' }} />
      </label>
      <Notice tone="warn">Schrijf alleen op wat er feitelijk gebeurde. Geen gegevens over gezondheid, afkomst, geloof of andere gevoelige zaken, en geen vermoedens van strafbare feiten. De kandidaat kan deze gegevens opvragen.</Notice>
      <div style={row}>
        <Button type="submit" variant="accent" size="sm" disabled={a.busy}>{entry ? 'Opslaan' : propose ? 'Voordragen' : 'Op de blacklist zetten'}</Button>
        <button type="button" onClick={onCancel} style={linkBtn}>Annuleren</button>
      </div>
      <Err>{a.error}</Err>
    </form>
  );
}

function EntryRow({ b, e, first, onChanged }) {
  const [editing, setEditing] = useState(false);
  const a = useAction(b.flash);
  const prop = e.status === 'voorstel', mine = e.addedById === b.me.id;
  const act = async (fn, ok, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    if (await a.run(fn, ok)) onChanged();
  };
  const approve = () => act(() => api('POST', `/api/blacklist/${e.id}/approve`), `${e.name} staat op de blacklist`);
  const remove = () => act(() => api('DELETE', `/api/blacklist/${e.id}`),
    prop ? (mine ? 'Voordracht ingetrokken' : 'Voordracht afgewezen') : `${e.name} is van de blacklist gehaald`,
    prop ? (mine ? `Je voordracht voor ${e.name} intrekken?` : `De voordracht voor ${e.name} afwijzen? De gegevens worden verwijderd en ${e.addedBy} krijgt een melding.`)
      : `${e.name} van de blacklist halen? De vermelding wordt definitief verwijderd.`);
  const where = [e.client, e.vac].filter(Boolean).join(' – ');
  const meta = [where && `Sollicitatie bij ${where}`, `${prop || e.approvedBy ? 'Voorgedragen' : 'Toegevoegd'} door ${e.addedBy} op ${fmtDate(e.addedAt)}`,
    e.approvedBy && `bevestigd door ${e.approvedBy}`, e.updatedBy && `gewijzigd door ${e.updatedBy}`,
    prop ? `vervalt ${fmtDate(e.until)} als niemand beslist` : `staat erop tot ${fmtDate(e.until)}`].filter(Boolean).join(' · ');
  const contact = [e.email, e.phone].filter(Boolean).join(' · ');
  return (
    <div style={{ borderTop: first ? 0 : '1px solid #F5F2ED', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '6px', background: prop ? '#FFFDF5' : '#FFFFFF' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: '15px' }}>{e.name}</span>
        {prop ? <Badge tone="gold">Voorgedragen · nog niet bevestigd</Badge> : null}
        {e.scope === 'client' ? <Badge tone="navy">Alleen bij {e.client}</Badge> : <Badge>Alle klanten</Badge>}
      </div>
      {contact ? <div style={{ fontSize: '13px', color: '#5C5C5A', overflowWrap: 'anywhere' }}>{contact}</div> : null}
      <div style={{ fontSize: '14px', lineHeight: 1.5 }}><span style={{ fontWeight: 600 }}>{e.reason}</span>{e.note ? <span style={{ color: '#3C3C3A', whiteSpace: 'pre-wrap' }}> · {e.note}</span> : null}</div>
      <div style={{ fontSize: '12px', color: '#8C8C8A', lineHeight: 1.5 }}>{meta}</div>
      {editing ? <div style={{ marginTop: '8px' }}><EntryForm b={b} entry={e} onSaved={(r, msg) => { setEditing(false); b.flash(msg); onChanged(); }} onCancel={() => setEditing(false)} /></div>
        : b.canManage || (prop && mine) ? <div style={{ ...row, gap: '8px 16px', marginTop: '2px' }}>
            {b.canManage && prop ? <button onClick={approve} disabled={a.busy} style={{ ...linkBtn, fontWeight: 600 }}>Bevestigen</button> : null}
            {b.canManage ? <button onClick={() => setEditing(true)} style={linkBtn}>Wijzigen</button> : null}
            {b.canManage ? <button onClick={() => a.run(() => download(`/api/blacklist/${e.id}/export`), 'Download gestart')} style={linkBtn}>Gegevens downloaden</button> : null}
            <button onClick={remove} disabled={a.busy} style={dangerBtn}>{prop ? (mine ? 'Intrekken' : 'Afwijzen') : 'Verwijderen'}</button>
          </div> : null}
      <Err>{a.error}</Err>
    </div>
  );
}

function Group({ title, n, sub, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <span style={h2}>{title}</span> <span style={{ fontSize: '14px', color: '#8C8C8A' }}>{n}</span>
        {sub ? <div style={{ ...muted, marginTop: '2px' }}>{sub}</div> : null}
      </div>
      <div style={box}>{children}</div>
    </div>
  );
}

export default function BlacklistView({ b }) {
  const [data, setData] = useState(null); // { entries, total, pending }: the whole list (blacklist.manage), else your own entries
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null); // { q, entries }
  const [adding, setAdding] = useState(null); // the seed of the new entry's form, while it is open
  const [tick, setTick] = useState(0);
  const latest = useRef('');
  const a = useAction(b.flash);
  const propose = !b.canManage, term = q.trim(), searching = term.length >= 3;
  const changed = () => setTick(t => t + 1);
  // The server's rule (api.js), applied here too so "Bekijk als" shows what that person would see.
  const visible = e => b.canManage || e.status === 'actief' || e.addedById === b.me.id;

  useEffect(() => {
    if (b.isLocal) return;
    a.run(async () => { const r = await api('GET', '/api/blacklist'); setData(r); b.onCounts({ total: r.total, pending: r.pending }); });
  }, [tick]);
  useEffect(() => {
    latest.current = term;
    if (!searching || b.isLocal) { setFound(null); return undefined; }
    const id = setTimeout(() => a.run(async () => {
      const r = await api('GET', `/api/blacklist?q=${encodeURIComponent(term)}`);
      if (latest.current === term) setFound({ q: term, entries: r.entries });
    }), 250);
    return () => clearTimeout(id);
  }, [term, tick]);

  const head = (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
      <div>
        <div style={eyebrow}>Kandidaten</div>
        <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Blacklist</h1>
        <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px', maxWidth: '640px', textWrap: 'pretty' }}>Kandidaten die we niet (meer) voorstellen, met de reden. Zoek iemand op voordat je een gesprek of proefdag inplant.{propose ? ' Iemand op de blacklist zetten gaat via een voordracht: de teamlead beslist.' : ''}</div>
      </div>
      {data ? <div style={{ fontSize: '13px', color: '#5C5C5A' }}>{data.total} {data.total === 1 ? 'kandidaat' : 'kandidaten'} op de blacklist</div> : null}
    </header>
  );
  if (b.isLocal) return <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '980px' }}>{head}<Notice>De blacklist werkt alleen met de server: gegevens van kandidaten worden nooit in de browser bewaard.</Notice></div>;

  const entries = data ? data.entries.filter(visible) : [];
  const pending = entries.filter(e => e.status === 'voorstel'), listed = entries.filter(e => e.status === 'actief');
  const own = entries.filter(e => e.addedById === b.me.id);
  const results = found && found.q === term ? found.entries.filter(visible) : null;
  const rows = list => list.map((e, i) => <EntryRow key={e.id} b={b} e={e} first={i === 0} onChanged={changed} />);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '980px' }}>
      {head}
      <div className="m-filters" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Zoek op naam, e-mailadres of telefoonnummer" aria-label="Zoek in de blacklist" autoComplete="off"
          style={{ flex: '1 1 320px', minWidth: '200px', height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 14px', fontSize: '14px', background: '#FFFFFF' }} />
        {!adding ? <Button variant="accent" onClick={() => setAdding(searching ? seedFrom(q) : {})}>{propose ? 'Kandidaat voordragen' : 'Kandidaat toevoegen'}</Button> : null}
      </div>
      {adding ? <Section title={propose ? 'Kandidaat voordragen' : 'Kandidaat op de blacklist zetten'}
          sub={propose ? `De teamlead bevestigt of wijst af; tot dan staat de kandidaat niet op de blacklist. Beslist niemand, dan vervalt de voordracht na ${BL_PROPOSAL_DAYS} dagen.` : 'De vermelding verdwijnt vanzelf na de gekozen termijn.'}>
          <EntryForm b={b} seed={adding} propose={propose} onSaved={(r, msg) => { setAdding(null); b.flash(msg); changed(); }} onCancel={() => setAdding(null)} />
        </Section> : null}
      {searching ? <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={h2}>Zoekresultaat</div>
          {results == null ? <div style={muted}>Zoeken…</div>
            : results.length ? <div style={box}>{rows(results)}</div>
            : <Notice tone="ok">Niemand gevonden voor “{term}”. Zoek voor de zekerheid ook op e-mailadres of telefoonnummer: een naam kan anders gespeld zijn.</Notice>}
        </div>
        : !data ? null
        : b.canManage ? <>
            {pending.length ? <Group title="Te beoordelen" n={pending.length} sub="Voorgedragen door een collega. Bevestig of wijs af.">{rows(pending)}</Group> : null}
            <Group title="Op de blacklist" n={listed.length}>{listed.length ? rows(listed) : <div style={{ padding: '32px', textAlign: 'center', fontSize: '14px', color: '#8C8C8A' }}>Nog niemand op de blacklist.</div>}</Group>
          </>
        : own.length ? <Group title="Jouw voordrachten" n={own.length}>{rows(own)}</Group>
        : <div style={muted}>Typ minstens 3 tekens om te zoeken.</div>}
      <div style={{ fontSize: '12px', color: '#8C8C8A', lineHeight: 1.5, maxWidth: '720px' }}>Alleen wie de blacklist mag raadplegen, ziet deze gegevens; ze staan nergens anders in de app. Elke wijziging komt in de auditlog. Vraagt een kandidaat om inzage, correctie of verwijdering, dan regelt de teamlead dat hier.</div>
      <Err>{a.error}</Err>
    </div>
  );
}
