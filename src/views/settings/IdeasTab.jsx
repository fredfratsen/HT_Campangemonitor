// Bugs & ideeën: everything people sent with ‘Bug of idee melden’, to sort out. With the Dev right you also choose
// where a mail about each new one goes (server/mail.js).
import React, { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import { api, fmtDateTime } from '../../lib/api.js';
import { IDEA_TYPES, IDEA_STATUS } from '../../lib/constants.js';
import { Section, Badge, Notice, Err, useAction, input, select, muted, row, linkBtn, dangerBtn } from './ui.jsx';

const OPEN = new Set(['nieuw', 'opgepakt']);
const FILTERS = [['open', 'Open', x => OPEN.has(x.status)], ['done', 'Afgehandeld', x => !OPEN.has(x.status)], ['all', 'Alles', () => true]];
const KIND = { bug: 'een bug', idee: 'een idee', verbetering: 'een verbetering', test: 'de testmail' };

function MailSettings({ s }) {
  const [cfg, setCfg] = useState(null);
  const [to, setTo] = useState('');
  const a = useAction(s.flash);
  const load = () => a.run(async () => { const r = await api('GET', '/api/admin/idea-mail'); setCfg(r); setTo(r.to || s.account.email || ''); });
  useEffect(() => { if (!s.isLocal) load(); }, []);
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
      {s.isLocal ? <Notice>In de lokale demo zonder server gaat er geen mail uit.</Notice> : null}
      {cfg && !cfg.smtp ? <Notice tone="warn">Er is nog geen mailserver ingesteld, dus er gaat nog geen mail uit.{s.canReal('integrations') ? <> <button onClick={() => s.setTab('integrations')} style={{ ...linkBtn, textDecoration: 'underline' }}>Mailserver instellen</button></> : null}</Notice> : null}
      {cfg ? <form onSubmit={save} style={{ ...row, alignItems: 'stretch' }}>
          <input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="naam@voorbeeld.nl" aria-label="E-mailadres voor nieuwe meldingen" style={{ ...input, flex: '1 1 260px', width: 'auto' }} />
          <Button type="submit" variant="accent" size="sm" disabled={a.busy || to.trim().toLowerCase() === (cfg.to || '')}>Opslaan</Button>
        </form> : null}
      {cfg && cfg.to ? <div style={{ ...row, gap: '16px' }}>
          <span style={muted}>Mail gaat naar <b>{cfg.to}</b></span>
          <button onClick={test} style={linkBtn} disabled={a.busy || !cfg.smtp}>{a.busy ? 'Bezig…' : 'Testmail sturen'}</button>
        </div> : null}
      {last ? last.ok
        ? <div style={{ fontSize: '12px', color: '#8C8C8A' }}>Laatste mail: {KIND[last.kind] || 'een melding'} naar {last.to}, {fmtDateTime(last.at)}.</div>
        : <Notice tone="error">Laatste mail ({KIND[last.kind] || 'een melding'}, {fmtDateTime(last.at)}) is niet aangekomen: {last.error}</Notice> : null}
      <Err>{a.error}</Err>
    </Section>
  );
}

export default function IdeasTab({ s }) {
  const [filter, setFilter] = useState('open');
  const [type, setType] = useState('');
  const ofType = s.ideas.filter(x => !type || x.type === type);
  const shown = ofType.filter(FILTERS.find(f => f[0] === filter)[2]);
  const remove = x => { if (window.confirm(`Deze melding van ${x.by} verwijderen? Dat kan niet ongedaan worden.`)) { s.removeIdea(x.id); s.flash('Melding verwijderd'); } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px' }}>
      {s.canReal('dev') ? <MailSettings s={s} /> : null}
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
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
        {shown.map((x, i) => { const T = IDEA_TYPES[x.type] || ['Melding', '#F5F2ED', '#3C3C3A'], votes = (x.voters || []).length; return (
          <div key={x.id} style={{ padding: '14px 20px', borderTop: i ? '1px solid #F5F2ED' : 0, display: 'flex', flexDirection: 'column', gap: '8px', background: x.status === 'nieuw' ? '#FFF8E0' : '#FFFFFF' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: T[1], color: T[2] }}>{T[0]}</span>
              <span style={{ fontSize: '13px' }}><b>{x.by}</b></span>
              <span style={{ fontSize: '12px', color: '#8C8C8A' }}>{[x.at, x.page, votes ? `+${votes}` : ''].filter(Boolean).join(' · ')}</span>
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{x.text}</div>
            <div style={{ ...row, gap: '16px' }}>
              <select value={x.status} onChange={e => s.setIdea(x.id, { status: e.target.value })} aria-label="Status" style={{ ...select, width: 'auto', height: '32px', fontSize: '13px', color: (IDEA_STATUS[x.status] || [])[1] }}>
                {Object.entries(IDEA_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
              </select>
              <button onClick={() => remove(x)} style={dangerBtn}>Verwijderen</button>
            </div>
          </div>); })}
        {!shown.length ? <div style={{ padding: '32px', textAlign: 'center', fontSize: '14px', color: '#8C8C8A' }}>{filter === 'open' ? 'Niets open.' : 'Niets gevonden.'}</div> : null}
      </div>
    </div>
  );
}
