import React, { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import { api, download, fmtDate, fmtDateTime, deviceOf } from '../../lib/api.js';
import { ROLES, LEVELS } from '../../lib/permissions.js';
import { Section, Badge, Notice, Err, useAction, input, label, muted, mono, row, linkBtn } from './ui.jsx';

function Codes({ codes }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '6px' }}>
        {codes.map(c => <span key={c} style={{ ...mono, background: '#F5F2ED', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>{c}</span>)}
      </div>
      <Notice tone="warn">Bewaar deze herstelcodes op een veilige plek, bijvoorbeeld in je wachtwoordmanager. Elke code werkt één keer. Je ziet ze nu voor het laatst.</Notice>
    </div>
  );
}

function Password({ s }) {
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const a = useAction(s.flash);
  const save = async e => {
    e.preventDefault();
    if (f.next !== f.again) { a.setError('De nieuwe wachtwoorden zijn niet hetzelfde.'); return; }
    const r = await a.run(() => api('POST', '/api/me/password', { current: f.current, next: f.next }));
    if (r) { setF({ current: '', next: '', again: '' }); s.flash(r.loggedOut ? `Wachtwoord gewijzigd. Uitgelogd op ${r.loggedOut} ander${r.loggedOut === 1 ? '' : 'e'} apparaat${r.loggedOut === 1 ? '' : 'en'}.` : 'Wachtwoord gewijzigd'); }
  };
  const set = k => e => { const v = e.target.value; setF(x => ({ ...x, [k]: v })); };
  return (
    <Section title="Wachtwoord" sub={`Laatst gewijzigd ${fmtDate(s.account.pwChangedAt)}. Na het wijzigen word je op je andere apparaten uitgelogd.`}>
      <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px', alignItems: 'end' }}>
        <label style={label}>Huidig wachtwoord<input type="password" autoComplete="current-password" value={f.current} onChange={set('current')} required style={input} /></label>
        <label style={label}>Nieuw wachtwoord<input type="password" autoComplete="new-password" minLength={12} value={f.next} onChange={set('next')} required style={input} /></label>
        <label style={label}>Herhaal nieuw<input type="password" autoComplete="new-password" minLength={12} value={f.again} onChange={set('again')} required style={input} /></label>
        <div><Button type="submit" variant="accent" disabled={a.busy}>Wijzigen</Button></div>
      </form>
      <div style={{ fontSize: '12px', color: '#8C8C8A' }}>Minstens 12 tekens. Een zin van een paar woorden werkt goed.</div>
      <Err>{a.error}</Err>
    </Section>
  );
}

function Email({ s }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: '', password: '' });
  const a = useAction(s.flash);
  const save = async e => {
    e.preventDefault();
    if (await a.run(() => api('POST', '/api/me/email', f), 'E-mailadres gewijzigd')) { setOpen(false); setF({ email: '', password: '' }); s.reloadMe(); }
  };
  if (!open) return <button onClick={() => setOpen(true)} style={linkBtn}>E-mailadres wijzigen</button>;
  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px' }}>
        <label style={label}>Nieuw e-mailadres<input type="email" autoComplete="username" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required style={input} /></label>
        <label style={label}>Je wachtwoord<input type="password" autoComplete="current-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required style={input} /></label>
      </div>
      <div style={row}><Button type="submit" variant="accent" size="sm" disabled={a.busy}>Opslaan</Button><button type="button" onClick={() => setOpen(false)} style={linkBtn}>Annuleren</button></div>
      <Err>{a.error}</Err>
    </form>
  );
}

function TwoFactor({ s }) {
  const acc = s.account;
  const [setup, setSetup] = useState(null); // { secret, qr }
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);
  const [pw, setPw] = useState({ mode: null, value: '' });
  const a = useAction(s.flash);
  const start = async () => { const r = await a.run(() => api('POST', '/api/me/2fa/start')); if (r) { setSetup(r); setCodes(null); } };
  const confirm = async e => {
    e.preventDefault();
    const r = await a.run(() => api('POST', '/api/me/2fa/confirm', { code }), 'Tweestapsverificatie staat aan');
    if (r) { setCodes(r.codes); setSetup(null); setCode(''); s.reloadMe(); }
  };
  const withPassword = async e => {
    e.preventDefault();
    if (pw.mode === 'recovery') {
      const r = await a.run(() => api('POST', '/api/me/2fa/recovery', { password: pw.value }), 'Nieuwe herstelcodes gemaakt');
      if (r) { setCodes(r.codes); setPw({ mode: null, value: '' }); s.reloadMe(); }
    } else if (await a.run(() => api('POST', '/api/me/2fa/disable', { password: pw.value }), 'Tweestapsverificatie staat uit')) { setPw({ mode: null, value: '' }); s.reloadMe(); }
  };
  return (
    <Section title="Tweestapsverificatie" sub="Na je wachtwoord vraagt de app een code uit een authenticator-app op je telefoon (Google Authenticator, Microsoft Authenticator, 1Password, …)."
      right={acc.twoFactor ? <Badge tone="green">Aan</Badge> : acc.twoFactorRequired ? <Badge tone="red">Verplicht voor je rol</Badge> : <Badge>Uit</Badge>}>
      {codes ? <Codes codes={codes} /> : null}
      {acc.twoFactor ? <>
        <div style={muted}>{acc.recoveryLeft} herstelcode{acc.recoveryLeft === 1 ? '' : 's'} over.{acc.twoFactorRequired ? ' Voor jouw rol kan tweestapsverificatie niet uit.' : ''}</div>
        {pw.mode ? <form onSubmit={withPassword} style={{ ...row, alignItems: 'end' }}>
            <label style={{ ...label, flex: '1 1 220px' }}>Bevestig met je wachtwoord<input type="password" autoComplete="current-password" value={pw.value} onChange={e => setPw({ ...pw, value: e.target.value })} required autoFocus style={input} /></label>
            <Button type="submit" variant={pw.mode === 'disable' ? 'ghost' : 'accent'} size="sm" disabled={a.busy}>{pw.mode === 'disable' ? 'Uitzetten' : 'Nieuwe codes maken'}</Button>
            <button type="button" onClick={() => setPw({ mode: null, value: '' })} style={linkBtn}>Annuleren</button>
          </form> : <div style={{ ...row, gap: '18px' }}>
            <button onClick={() => setPw({ mode: 'recovery', value: '' })} style={linkBtn}>Nieuwe herstelcodes maken</button>
            {!acc.twoFactorRequired ? <button onClick={() => setPw({ mode: 'disable', value: '' })} style={{ ...linkBtn, color: '#5C5C5A' }}>Uitzetten</button> : null}
          </div>}
      </> : setup ? <form onSubmit={confirm} style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <img src={setup.qr} alt="QR-code voor je authenticator-app" width="168" height="168" style={{ imageRendering: 'pixelated', border: '1px solid #E4E1DE', borderRadius: '8px' }} />
          <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={muted}>1. Scan de QR-code met je authenticator-app. Lukt dat niet, voer dan deze sleutel in:</div>
            <div style={{ ...mono, background: '#F5F2ED', borderRadius: '8px', padding: '8px 10px', overflowWrap: 'anywhere' }}>{setup.secret.match(/.{1,4}/g).join(' ')}</div>
            <label style={label}>2. Vul de code uit de app in<input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={e => setCode(e.target.value)} required style={{ ...input, maxWidth: '160px', ...mono, fontSize: '16px' }} /></label>
            <div style={row}><Button type="submit" variant="accent" size="sm" disabled={a.busy}>Bevestigen</Button><button type="button" onClick={() => setSetup(null)} style={linkBtn}>Annuleren</button></div>
          </div>
        </form> : <div><Button variant="accent" size="sm" onClick={start} disabled={a.busy}>Instellen</Button></div>}
      <Err>{a.error}</Err>
    </Section>
  );
}

function Sessions({ s }) {
  const [list, setList] = useState(null);
  const a = useAction(s.flash);
  const load = () => a.run(async () => setList((await api('GET', '/api/me/sessions')).sessions));
  useEffect(() => { load(); }, []);
  const others = async () => { const r = await a.run(() => api('POST', '/api/me/sessions/revoke-others')); if (r) { s.flash(`Uitgelogd op ${r.loggedOut} ander${r.loggedOut === 1 ? '' : 'e'} apparaat${r.loggedOut === 1 ? '' : 'en'}`); load(); } };
  return (
    <Section title="Waar je bent ingelogd" sub="Een sessie blijft 30 dagen geldig."
      right={list && list.length > 1 ? <Button variant="ghost" size="sm" onClick={others} disabled={a.busy}>Overal anders uitloggen</Button> : null}>
      {(list || []).map((x, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '8px 0', borderTop: i ? '1px solid #F5F2ED' : 0, fontSize: '14px' }}>
          <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span style={{ fontWeight: 600 }}>{deviceOf(x.ua)}</span>{x.current ? <Badge tone="navy">Dit apparaat</Badge> : null}</span>
          <span style={{ color: '#5C5C5A', fontSize: '13px' }}>actief {fmtDateTime(x.lastSeenAt)} · ingelogd {fmtDate(x.createdAt)}</span>
        </div>)}
      <Err>{a.error}</Err>
    </Section>
  );
}

export default function AccountTab({ s }) {
  const acc = s.account, a = useAction(s.flash);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px' }}>
      <Section title={acc.name} right={<div style={row}><Badge tone="navy">{ROLES[acc.role].label}</Badge><Badge>{LEVELS[acc.level].label}</Badge></div>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px', fontSize: '14px' }}>
          <div><div style={{ ...muted, fontSize: '12px' }}>E-mailadres</div><div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{acc.email}</div></div>
          <div><div style={{ ...muted, fontSize: '12px' }}>Recruiternaam</div><div style={{ fontWeight: 600 }}>{acc.recName || '—'}</div></div>
          <div><div style={{ ...muted, fontSize: '12px' }}>Lid sinds</div><div style={{ fontWeight: 600 }}>{fmtDate(acc.joinedAt)}</div></div>
          <div><div style={{ ...muted, fontSize: '12px' }}>Rechten</div><div style={{ fontWeight: 600 }}>{acc.rights.length} · <button onClick={() => s.setTab('roles')} style={linkBtn}>bekijk</button></div></div>
        </div>
        <Email s={s} />
      </Section>
      <Password s={s} />
      <TwoFactor s={s} />
      <Sessions s={s} />
      <Section title="Mijn gegevens" sub="Download alles wat de Campagnemonitor over je bewaart: je account, sessies, wat je hebt vastgelegd en de auditlog over jou.">
        <div style={row}>
          <Button variant="ghost" size="sm" onClick={() => a.run(() => download('/api/me/export'), 'Download gestart')} disabled={a.busy}>Mijn gegevens downloaden</Button>
          <a href="/privacy" style={{ fontSize: '13px', fontWeight: 500 }}>Hoe we met je gegevens omgaan</a>
        </div>
        <Err>{a.error}</Err>
      </Section>
    </div>
  );
}
