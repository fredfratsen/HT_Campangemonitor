import React, { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import { api, fmtDateTime } from '../../lib/api.js';
import { Section, Badge, Notice, Err, useAction, input, label, muted, mono, row, linkBtn, dangerBtn } from './ui.jsx';

const code = { ...mono, fontSize: '12.5px', background: '#F5F2ED', padding: '2px 6px', borderRadius: '4px', wordBreak: 'break-all' };

function TrelloHelp() {
  return (
    <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', lineHeight: 1.55, color: '#3C3C3A' }}>
      <li>Open <a href="https://trello.com/power-ups/admin" target="_blank" rel="noreferrer">trello.com/power-ups/admin</a>, maak een Power-Up aan in de workspace met de klantborden en kopieer onder <em>API-sleutel</em> de key.</li>
      <li>Log in met een Trello-account dat alle klantborden kan zien en maak een token met alleen leesrechten: <span style={code}>https://trello.com/1/authorize?expiration=never&amp;name=Campagnemonitor&amp;scope=read&amp;response_type=token&amp;key=JOUW_KEY</span></li>
      <li>Plak beide hieronder. De server test ze direct.</li>
    </ol>
  );
}

function SmtpHelp() {
  return (
    <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', lineHeight: 1.55, color: '#3C3C3A' }}>
      <li><b>Brevo</b> (Europees, gratis tot 300 mails per dag): mailserver <span style={code}>smtp-relay.brevo.com</span>, poort 587, en de SMTP-login en SMTP-sleutel onder <em>SMTP &amp; API</em>. Het afzenderadres moet in Brevo bevestigd zijn.</li>
      <li><b>Gmail of Google Workspace</b>: mailserver <span style={code}>smtp.gmail.com</span>, poort 465, je e-mailadres als gebruikersnaam en een app-wachtwoord (Google-account › Beveiliging, met tweestapsverificatie aan). Afzender is hetzelfde adres.</li>
      <li>De server logt direct in om de gegevens te testen; er gaat dan nog geen mail uit. Een testmail stuur je onder Bugs &amp; ideeën.</li>
    </ul>
  );
}

function Integration({ s, it, reload }) {
  const [edit, setEdit] = useState(false);
  const [vals, setVals] = useState({});
  const [test, setTest] = useState(null);
  const [failed, setFailed] = useState('');
  const a = useAction(s.flash);
  const save = async skipTest => {
    setFailed(''); a.setError('');
    try {
      const r = await api('PUT', `/api/admin/integrations/${it.name}`, { values: vals, skipTest });
      s.flash(`${it.label} opgeslagen`); setEdit(false); setVals({}); setTest(r.test); reload(); s.reloadConfig();
    } catch (e) { if (e.body && e.body.error === 'test_failed') setFailed(e.message); else a.setError(e.message); }
  };
  const runTest = async () => { const r = await a.run(() => api('POST', `/api/admin/integrations/${it.name}/test`)); if (r) setTest(r.test); };
  const remove = async () => {
    if (!window.confirm(`De gegevens van ${it.label} uit de app verwijderen?${it.fields.some(f => f.env) ? ' Staan er environment variabelen, dan worden die weer gebruikt.' : ''}`)) return;
    if (await a.run(() => api('DELETE', `/api/admin/integrations/${it.name}`), `${it.label} verwijderd`)) { setTest(null); reload(); s.reloadConfig(); }
  };
  // Plain fields (not secret) start with what is set now, so you only retype the password.
  const startEdit = () => { setVals(it.state === 'set' ? Object.fromEntries(it.fields.filter(f => f.plain).map(f => [f.key, it.masked[f.key]])) : {}); setEdit(true); };
  const status = it.state === 'set' ? <Badge tone="green">Ingesteld</Badge> : it.state === 'unreadable' ? <Badge tone="red">Onleesbaar</Badge> : <Badge tone="gold">Niet ingesteld</Badge>;
  return (
    <Section title={it.label} sub={it.desc} right={status}>
      {it.state === 'unreadable' ? <Notice tone="error">De opgeslagen sleutels kunnen niet worden ontsleuteld. Is SECRETS_KEY gewijzigd? Voer ze opnieuw in.</Notice> : null}
      {it.state === 'set' ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px', fontSize: '14px' }}>
          {it.fields.map(f => <div key={f.key}><div style={{ ...muted, fontSize: '12px' }}>{f.label}</div><div style={{ ...mono, fontWeight: 600 }}>{it.masked[f.key]}</div></div>)}
          <div><div style={{ ...muted, fontSize: '12px' }}>Bron</div><div style={{ fontWeight: 600 }}>{it.source === 'app' ? `In de app · ${it.updatedBy}, ${fmtDateTime(it.updatedAt)}` : `Environment (${it.fields.map(f => f.env).join(', ')})`}</div></div>
        </div> : null}
      {test ? test.ok
        ? <Notice tone="ok">{test.message || <>Verbonden als {test.fullName} (@{test.username}){test.boards != null ? ` · ${test.boards} open borden` : ''}.</>}</Notice>
        : <Notice tone="error">{test.error}</Notice> : null}
      {edit ? <form onSubmit={e => { e.preventDefault(); save(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {it.name === 'trello' ? <TrelloHelp /> : it.name === 'smtp' ? <SmtpHelp /> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '12px' }}>
            {it.fields.map(f => <label key={f.key} style={label}>{f.label}
                <input type={f.plain ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={vals[f.key] || ''} onChange={e => { const v = e.target.value; setVals(x => ({ ...x, [f.key]: v })); }} required style={{ ...input, ...mono }} />
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#8C8C8A' }}>{f.hint}</span>
              </label>)}
          </div>
          {failed ? <Notice tone="error">{failed} <button type="button" onClick={() => save(true)} style={{ ...linkBtn, color: '#D32F2F', textDecoration: 'underline' }}>Toch opslaan</button></Notice> : null}
          <div style={row}><Button type="submit" variant="accent" size="sm" disabled={a.busy}>Testen en opslaan</Button><button type="button" onClick={() => { setEdit(false); setVals({}); setFailed(''); }} style={linkBtn}>Annuleren</button></div>
        </form> : <div style={{ ...row, gap: '16px' }}>
          <Button variant={it.state === 'set' ? 'ghost' : 'accent'} size="sm" onClick={startEdit}>{it.state !== 'set' ? 'Instellen' : it.fields.some(f => f.plain) ? 'Wijzigen' : 'Sleutels vervangen'}</Button>
          {it.state === 'set' ? <button onClick={runTest} style={linkBtn} disabled={a.busy}>{a.busy ? 'Testen…' : 'Verbinding testen'}</button> : null}
          {it.source === 'app' ? <button onClick={remove} style={dangerBtn}>Verwijderen</button> : null}
        </div>}
      <Err>{a.error}</Err>
    </Section>
  );
}

export default function IntegrationsTab({ s }) {
  const [list, setList] = useState(null);
  const a = useAction(s.flash);
  const load = () => a.run(async () => setList((await api('GET', '/api/admin/integrations')).integrations));
  useEffect(() => { load(); }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px' }}>
      <Notice>API-sleutels en wachtwoorden worden versleuteld op de server bewaard en komen nooit in de browser: je ziet alleen de laatste 4 tekens. Elke wijziging staat in de auditlog.</Notice>
      {(list || []).map(it => <Integration key={it.name} s={s} it={it} reload={load} />)}
      <Err>{a.error}</Err>
    </div>
  );
}
