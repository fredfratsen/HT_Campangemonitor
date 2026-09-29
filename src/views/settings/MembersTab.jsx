import React, { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import { api, fmtDate, fmtDateTime } from '../../lib/api.js';
import { ROLES, ROLE_KEYS, LEVELS, RIGHTS, RIGHT_GROUPS, rightsOf, manageError } from '../../lib/permissions.js';
import { Section, Badge, Notice, Toggle, CopyLink, Err, useAction, input, select, label, muted, row, linkBtn, dangerBtn, eyebrow } from './ui.jsx';

const STATUS = { active: ['Actief', 'green'], invited: ['Uitgenodigd', 'gold'], deactivated: ['Gedeactiveerd', 'neutral'] };
const days = ms => Math.round(ms / 864e5);

/** Roles the actor may hand out (same rule as the server). */
const assignable = actor => ROLE_KEYS.filter(r => !manageError(actor, null, { role: r }));

function InviteForm({ s, onDone }) {
  const roles = assignable(s.account);
  const [f, setF] = useState({ name: '', role: roles.includes('recruiter') ? 'recruiter' : roles[0], email: '', recName: '' });
  const [link, setLink] = useState(null);
  const a = useAction(s.flash);
  const set = k => e => { const v = e.target.value; setF(x => ({ ...x, [k]: v, ...(k === 'name' && x.role === 'recruiter' && (!x.recName || x.recName === x.name) ? { recName: v } : {}) })); };
  const save = async e => {
    e.preventDefault();
    const r = await a.run(() => api('POST', '/api/admin/members', { ...f, recName: f.recName || (f.role === 'recruiter' ? f.name : '') }));
    if (r) { setLink({ link: r.link, name: r.member.name }); onDone(); }
  };
  if (link) return (
    <Section title={`Uitnodiging voor ${link.name}`} right={<button onClick={() => { setLink(null); setF({ ...f, name: '', email: '', recName: '' }); }} style={linkBtn}>Nog iemand uitnodigen</button>}>
      <CopyLink link={link.link} note={`Stuur deze link zelf door (bijvoorbeeld via WhatsApp of Teams). Hij werkt ${days(s.ttl.invite)} dagen en één keer. Wie hem opent, kiest een e-mailadres en wachtwoord.`} />
    </Section>
  );
  return (
    <Section title="Iemand uitnodigen" sub="Maak een account aan en stuur de uitnodigingslink door. E-mail versturen kan de app nog niet.">
      <form onSubmit={save} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px', alignItems: 'end' }}>
        <label style={label}>Naam<input value={f.name} onChange={set('name')} required maxLength={60} style={input} /></label>
        <label style={label}>Rol<select value={f.role} onChange={set('role')} style={select}>{roles.map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}</select></label>
        <label style={label}>Recruiternaam<input value={f.recName} onChange={set('recName')} placeholder={f.role === 'recruiter' ? f.name : 'Alleen voor recruiters'} maxLength={60} style={input} /></label>
        <label style={label}>E-mailadres (optioneel)<input type="email" value={f.email} onChange={set('email')} style={input} /></label>
        <div><Button type="submit" variant="primary" disabled={a.busy}>Uitnodiging maken</Button></div>
      </form>
      <div style={{ fontSize: '12px', color: '#8C8C8A' }}>De recruiternaam koppelt iemand aan campagnes en Trello-borden; laat hem leeg voor wie geen recruiterwerk doet.</div>
      <Err>{a.error}</Err>
    </Section>
  );
}

function Editor({ s, m, reload }) {
  const actor = s.account, block = manageError(actor, m);
  const [role, setRole] = useState(m.role);
  const [rights, setRights] = useState(new Set(m.rights));
  const [name, setName] = useState(m.name);
  const [recName, setRecName] = useState(m.recName || '');
  const [link, setLink] = useState(null);
  const a = useAction(s.flash);
  const roles = [...new Set([m.role, ...assignable(actor)])];
  const defaults = new Set(ROLES[role].rights), own = rightsOf(actor), before = new Set(m.rights);
  const changed = role !== m.role || name !== m.name || recName !== (m.recName || '') || rights.size !== before.size || [...rights].some(r => !before.has(r));
  const pickRole = r => { setRole(r); setRights(new Set(ROLES[r].rights)); };
  const toggle = (k, on) => setRights(x => { const n = new Set(x); if (on) n.add(k); else n.delete(k); return n; });
  const save = async () => { if (await a.run(() => api('PATCH', `/api/admin/members/${m.id}`, { role, rights: [...rights], name, recName }), `${name} bijgewerkt`)) reload(); };
  const act = async (path, ok, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    if (await a.run(() => api('POST', `/api/admin/members/${m.id}/${path}`), ok)) reload();
  };
  const makeLink = async type => { const r = await a.run(() => api('POST', `/api/admin/members/${m.id}/link`, { type })); if (r) setLink({ ...r, type }); };
  const withdraw = async () => { if (window.confirm(`Uitnodiging voor ${m.name} intrekken? Het account wordt verwijderd.`) && await a.run(() => api('DELETE', `/api/admin/members/${m.id}`), 'Uitnodiging ingetrokken')) reload(); };

  if (block) return <div style={{ padding: '4px 0 8px' }}><Notice>{block}</Notice></div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '6px 0 10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
        <label style={label}>Naam<input value={name} onChange={e => setName(e.target.value)} maxLength={60} style={input} /></label>
        <label style={label}>Rol<select value={role} onChange={e => pickRole(e.target.value)} style={select}>{roles.map(r => <option key={r} value={r}>{ROLES[r].label} · {LEVELS[ROLES[r].level].label}</option>)}</select></label>
        <label style={label}>Recruiternaam<input value={recName} onChange={e => setRecName(e.target.value)} placeholder="Geen" maxLength={60} style={input} /></label>
      </div>
      {name !== m.name ? <Notice tone="warn">Eerder vastgelegde feedback en toewijzingen blijven onder de oude naam staan.</Notice> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '14px' }}>
        {Object.entries(RIGHT_GROUPS).map(([g, gl]) => <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={eyebrow}>{gl}</div>
            {RIGHTS.filter(r => r.group === g).map(r => { const on = rights.has(r.key), custom = on !== defaults.has(r.key), locked = !own.has(r.key) && !before.has(r.key);
              return <div key={r.key} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }} title={r.desc}>
                <Toggle on={on} onChange={v => toggle(r.key, v)} disabled={locked} label={r.label} />
                <span style={{ fontSize: '13px', lineHeight: 1.35, color: on ? '#1D1D1B' : '#8C8C8A' }}>{r.label}{custom ? <> <Badge tone="amber">{on ? 'extra' : 'uit'}</Badge></> : null}</span>
              </div>; })}
          </div>)}
      </div>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <div style={row}>
          <Button variant="accent" size="sm" onClick={save} disabled={!changed || a.busy}>Opslaan</Button>
          {changed ? <button onClick={() => { setRole(m.role); setRights(new Set(m.rights)); setName(m.name); setRecName(m.recName || ''); }} style={linkBtn}>Wijzigingen weggooien</button> : null}
        </div>
        <div style={{ ...row, gap: '16px' }}>
          {m.status === 'invited' ? <>
            <button onClick={() => makeLink('invite')} style={linkBtn}>{m.hasOpenInvite ? 'Nieuwe uitnodigingslink' : 'Uitnodigingslink maken'}</button>
            {!m.joinedAt ? <button onClick={withdraw} style={dangerBtn}>Uitnodiging intrekken</button> : null}
          </> : null}
          {m.status === 'active' ? <>
            <button onClick={() => makeLink('reset')} style={linkBtn}>Wachtwoord-resetlink</button>
            {m.twoFactor ? <button onClick={() => act('reset-2fa', 'Tweestapsverificatie gereset', `Tweestapsverificatie van ${m.name} resetten? ${m.name} wordt uitgelogd en stelt het bij de volgende login opnieuw in.`)} style={linkBtn}>2FA resetten</button> : null}
            <button onClick={() => act('logout', `${m.name} is overal uitgelogd`)} style={linkBtn}>Overal uitloggen</button>
          </> : null}
          {m.status === 'deactivated'
            ? <button onClick={() => act('reactivate', `${m.name} is weer actief`)} style={linkBtn}>Heractiveren</button>
            : <button onClick={() => act('deactivate', `${m.name} is gedeactiveerd`, `${m.name} deactiveren? ${m.name} wordt direct uitgelogd en kan niet meer inloggen. De historie blijft bewaard.${m.openWork ? `\n\nLet op: ${m.name} is nog recruiter van ${m.openWork} actieve campagne${m.openWork === 1 ? '' : 's'}. Wijs die eerst opnieuw toe.` : ''}`)} style={dangerBtn}>Deactiveren</button>}
        </div>
      </div>
      {link ? <CopyLink link={link.link} note={link.type === 'reset'
        ? `Resetlink voor ${m.name}: werkt ${days(s.ttl.reset * 1) || 1} dag en één keer. ${m.name} wordt daarna overal uitgelogd.`
        : `Uitnodigingslink voor ${m.name}: werkt ${days(s.ttl.invite)} dagen en één keer. Een eerdere link werkt niet meer.`} /> : null}
      <Err>{a.error}</Err>
    </div>
  );
}

export default function MembersTab({ s }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('all');
  const a = useAction(s.flash);
  const load = () => a.run(async () => { const d = await api('GET', '/api/admin/members'); setData(d); s.reloadMe(); });
  useEffect(() => { load(); }, []);
  if (!data) return <Err>{a.error}</Err>;
  s = { ...s, ttl: data.ttl };
  const count = st => data.members.filter(m => m.status === st).length;
  const shown = data.members.filter(m => filter === 'all' || m.status === filter);
  const tab = (k, l, n) => { const on = filter === k; return <button key={k} onClick={() => setFilter(k)} style={{ border: 0, borderRadius: '999px', padding: '6px 12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: on ? '#FFFFFF' : 'transparent', color: on ? '#1D1D1B' : '#5C5C5A', boxShadow: on ? '0 1px 4px rgba(29,29,27,.07)' : 'none' }}>{l} <span style={{ color: '#8C8C8A' }}>{n}</span></button>; };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <InviteForm s={s} onDone={load} />
      <div style={{ display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px', alignSelf: 'flex-start', flexWrap: 'wrap' }}>
        {[tab('all', 'Iedereen', data.members.length), tab('active', 'Actief', count('active')), tab('invited', 'Uitgenodigd', count('invited')), tab('deactivated', 'Gedeactiveerd', count('deactivated'))]}
      </div>
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
        {shown.map((m, i) => { const isOpen = open === m.id, S = STATUS[m.status], custom = m.grants.length + m.revokes.length; return (
          <div key={m.id} style={{ borderTop: i ? '1px solid #F5F2ED' : 0, padding: '0 20px', background: isOpen ? '#FDFBF8' : '#FFFFFF' }}>
            <button onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen} className="member-row" style={{ width: '100%', border: 0, background: 'none', padding: '14px 0', display: 'grid', gap: '12px', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontWeight: 600, fontSize: '14px' }}>{m.name}</span>{m.id === s.account.id ? <Badge tone="navy">Jij</Badge> : null}</span>
                <span style={{ display: 'block', fontSize: '12px', color: '#5C5C5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email || 'nog geen e-mailadres'}{m.recName ? ` · recruiter ${m.recName}` : ''}</span>
              </span>
              <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge tone="navy">{ROLES[m.role].label}</Badge>
                {custom ? <Badge tone="amber">{custom} aangepast</Badge> : null}
              </span>
              <span style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {m.status === 'active' ? <span style={{ fontSize: '12px', color: '#8C8C8A' }}>{m.lastLoginAt ? `ingelogd ${fmtDateTime(m.lastLoginAt)}` : ''}{m.twoFactor ? ' · 2FA' : ''}</span> : null}
                {m.status === 'deactivated' ? <span style={{ fontSize: '12px', color: '#8C8C8A' }}>sinds {fmtDate(m.deactivatedAt)}</span> : null}
                <Badge tone={S[1]}>{S[0]}</Badge>
              </span>
            </button>
            {isOpen ? <Editor key={m.id + m.role + m.rights.join()} s={s} m={m} reload={load} /> : null}
          </div>); })}
      </div>
      <div style={muted}>Klik op iemand om rol en rechten te wijzigen. {data.anonymised ? `${data.anonymised} oud-teamlid${data.anonymised === 1 ? '' : 'en'} geanonimiseerd.` : ''}</div>
      <Err>{a.error}</Err>
    </div>
  );
}
