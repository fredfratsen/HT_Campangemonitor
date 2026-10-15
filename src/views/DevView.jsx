// Dev › Bugs & ideeën: everything people sent with ‘Bug of idee melden’, on a board for the developer only (the dev
// right). Each report goes into a column of IDEA_PRIO by dragging it or with the dropdown on the card (phones).
// Colleagues keep seeing the reports in the panel, without these groups. Here you also choose where a mail about
// each new one goes (server/mail.js).
import React, { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import { api, fmtDateTime } from '../lib/api.js';
import { IDEA_TYPES, IDEA_STATUS, IDEA_PRIO } from '../lib/constants.js';
import { Section, Badge, Notice, Err, useAction, input, select, row, linkBtn, dangerBtn } from './settings/ui.jsx';

const OPEN = new Set(['nieuw', 'opgepakt']);
const FILTERS = [['open', 'Open', x => OPEN.has(x.status)], ['done', 'Afgehandeld', x => !OPEN.has(x.status)], ['all', 'Alles', () => true]];
const KIND = { bug: 'een bug', idee: 'een idee', verbetering: 'een verbetering', test: 'de testmail' };
const small = { ...select, width: '100%', height: '30px', fontSize: '12px', padding: '0 6px' };

function MailSettings({ d }) {
  const [cfg, setCfg] = useState(null);
  const [to, setTo] = useState('');
  const a = useAction(d.flash);
  const load = () => a.run(async () => { const r = await api('GET', '/api/admin/idea-mail'); setCfg(r); setTo(r.to || d.email || ''); });
  useEffect(() => { if (!d.isLocal) load(); }, []);
  const save = async e => {
    e.preventDefault();
    const r = await a.run(() => api('PUT', '/api/admin/idea-mail', { to }), to.trim() ? 'E-mailadres opgeslagen' : 'Mailen staat uit');
    if (r) load();
  };
  const test = async () => { if (await a.run(() => api('POST', '/api/admin/idea-mail/test'), `Testmail verstuurd naar ${cfg.to}`)) load(); };
  const last = cfg && cfg.last;
  return (
    <Section title="E-mail bij nieuwe meldingen" sub="Elke nieuwe bug, elk idee en elke verbetering komt hieronder binnen, en gaat ook per mail naar dit adres. Laat het leeg om niet te mailen."
      right={cfg ? cfg.to && cfg.smtp ? <Badge tone="green">Aan</Badge> : <Badge tone="gold">Uit</Badge> : null}>
      {d.isLocal ? <Notice>In de lokale demo zonder server gaat er geen mail uit.</Notice> : null}
      {cfg && !cfg.smtp ? <Notice tone="warn">Er is nog geen mailserver ingesteld, dus er gaat nog geen mail uit.{d.canIntegrations ? <> <button onClick={d.goIntegrations} style={{ ...linkBtn, textDecoration: 'underline' }}>Mailserver instellen</button></> : null}</Notice> : null}
      {cfg ? <form onSubmit={save} style={{ ...row, alignItems: 'stretch' }}>
          <input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="naam@voorbeeld.nl" aria-label="E-mailadres voor nieuwe meldingen" style={{ ...input, flex: '1 1 260px', width: 'auto' }} />
          <Button type="submit" variant="accent" size="sm" disabled={a.busy || to.trim().toLowerCase() === (cfg.to || '')}>Opslaan</Button>
        </form> : null}
      {cfg && cfg.to ? <div style={{ ...row, gap: '16px' }}>
          <span style={{ fontSize: '13px', color: '#5C5C5A' }}>Mail gaat naar <b>{cfg.to}</b></span>
          <button onClick={test} style={linkBtn} disabled={a.busy || !cfg.smtp}>{a.busy ? 'Bezig…' : 'Testmail sturen'}</button>
        </div> : null}
      {last ? last.ok
        ? <div style={{ fontSize: '12px', color: '#8C8C8A' }}>Laatste mail: {KIND[last.kind] || 'een melding'} naar {last.to}, {fmtDateTime(last.at)}.</div>
        : <Notice tone="error">Laatste mail ({KIND[last.kind] || 'een melding'}, {fmtDateTime(last.at)}) is niet aangekomen: {last.error}</Notice> : null}
      <Err>{a.error}</Err>
    </Section>
  );
}

function Card({ x, d, dragging, onDrag }) {
  const [open, setOpen] = useState(false);
  const T = IDEA_TYPES[x.type] || ['Melding', '#F5F2ED', '#3C3C3A'], votes = (x.voters || []).length;
  const remove = () => { if (window.confirm(`Deze melding van ${x.by} verwijderen? Dat kan niet ongedaan worden.`)) { d.removeIdea(x.id); d.flash('Melding verwijderd'); } };
  return (
    <article draggable onDragStart={e => { e.dataTransfer.setData('text/plain', String(x.id)); e.dataTransfer.effectAllowed = 'move'; onDrag(x.id); }} onDragEnd={() => onDrag(null)}
      style={{ background: x.status === 'nieuw' && !x.prio ? '#FFF8E0' : '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'grab', opacity: dragging ? 0.4 : 1, boxShadow: '0 1px 2px rgba(29,29,27,.04)' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '6px', background: T[1], color: T[2] }}>{T[0]}</span>
        {votes ? <span style={{ fontSize: '11px', fontWeight: 600, color: '#1B1B63' }}>+{votes}</span> : null}
      </div>
      <div style={{ fontSize: '12px', color: '#5C5C5A' }}><b style={{ color: '#1D1D1B' }}>{x.by}</b> · {x.at}</div>
      <div style={{ fontSize: '13px', lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>{x.text}</div>
      {open ? <div style={{ fontSize: '12px', color: '#8C8C8A' }}>{x.page ? `Gemeld op ${x.page}` : null}{votes ? `${x.page ? ' · ' : ''}+1 van ${x.voters.join(', ')}` : null}</div> : null}
      <select value={x.prio || ''} onChange={e => d.setPrio(x.id, e.target.value)} aria-label="Groep" style={small}>
        {Object.entries(IDEA_PRIO).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
      </select>
      <select value={x.status} onChange={e => d.setIdea(x.id, { status: e.target.value })} aria-label="Status" style={{ ...small, color: (IDEA_STATUS[x.status] || [])[1] }}>
        {Object.entries(IDEA_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
      </select>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        <button onClick={() => setOpen(!open)} style={{ ...linkBtn, fontSize: '12px' }}>{open ? 'Minder' : 'Meer'}</button>
        {open ? <button onClick={remove} style={{ ...dangerBtn, fontSize: '12px' }}>Verwijderen</button> : null}
      </div>
    </article>
  );
}

export default function DevView({ d }) {
  const [filter, setFilter] = useState('open');
  const [type, setType] = useState('');
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const ofType = d.ideas.filter(x => !type || x.type === type);
  const shown = ofType.filter(FILTERS.find(f => f[0] === filter)[2]);
  const drop = (e, k) => {
    e.preventDefault(); setOver(null);
    const id = e.dataTransfer.getData('text/plain'), x = d.ideas.find(y => String(y.id) === id);
    if (x && (x.prio || '') !== k) d.setPrio(x.id, k);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header>
        <div style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Dev</div>
        <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: 600, fontSize: '40px', lineHeight: 1.1, letterSpacing: '-.02em' }}>Bugs & ideeën</h1>
        <div style={{ marginTop: '8px', fontSize: '14px', color: '#5C5C5A' }}>Alleen jij ziet deze groepen. Collega’s zien de meldingen onder Bug of idee melden.</div>
      </header>
      <div style={{ maxWidth: '860px' }}><MailSettings d={d} /></div>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px' }}>
          {FILTERS.map(([k, l, fn]) => { const on = k === filter; return (
            <button key={k} onClick={() => setFilter(k)} style={{ border: 0, borderRadius: '999px', padding: '6px 12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: on ? '#FFFFFF' : 'transparent', color: on ? '#1D1D1B' : '#5C5C5A', boxShadow: on ? '0 1px 4px rgba(29,29,27,.07)' : 'none' }}>
              {l} <span style={{ color: '#8C8C8A' }}>{ofType.filter(fn).length}</span></button>); })}
        </div>
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Soort" style={{ ...select, width: 'auto' }}>
          <option value="">Alle soorten</option>
          {Object.entries(IDEA_TYPES).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
        </select>
      </div>
      <div className="dev-board">
        {Object.entries(IDEA_PRIO).map(([k, [label, fg]]) => { const items = shown.filter(x => (x.prio || '') === k); return (
          <section key={k} aria-label={label} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== k) setOver(k); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }} onDrop={e => drop(e, k)}
            style={{ background: over === k ? '#EFEBE4' : '#F5F2ED', outline: over === k ? '2px dashed #C0BDB9' : 0, borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '160px', transition: 'background 120ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 2px 4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: fg }}>{label}</span>
              <span style={{ fontSize: '12px', color: '#8C8C8A' }}>{items.length}</span>
            </div>
            {items.map(x => <Card key={x.id} x={x} d={d} dragging={drag === x.id} onDrag={setDrag} />)}
            {!items.length ? <div style={{ fontSize: '12px', color: '#8C8C8A', textAlign: 'center', padding: '16px 4px' }}>{drag != null ? 'Hierheen slepen' : 'Leeg'}</div> : null}
          </section>); })}
      </div>
    </div>
  );
}
