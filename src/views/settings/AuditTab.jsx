import React, { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import { api, fmtDateTime } from '../../lib/api.js';
import { RIGHTS, ROLES } from '../../lib/permissions.js';
import { Badge, Err, useAction, select, muted, row } from './ui.jsx';

export const EVENTS = {
  'login.ok': 'Ingelogd', 'login.fail': 'Mislukte inlogpoging', 'login.locked': 'Tijdelijk geblokkeerd na te veel pogingen', 'login.2fa_fail': 'Verkeerde code bij inloggen', logout: 'Uitgelogd',
  '2fa.enabled': 'Tweestapsverificatie aangezet', '2fa.disabled': 'Tweestapsverificatie uitgezet', '2fa.reset': 'Tweestapsverificatie gereset', '2fa.recovery_used': 'Ingelogd met herstelcode', '2fa.recovery_new': 'Nieuwe herstelcodes gemaakt',
  'password.changed': 'Wachtwoord gewijzigd', 'password.reset': 'Wachtwoord gereset via link', 'password.reset_link': 'Wachtwoord-resetlink gemaakt',
  'member.invited': 'Uitgenodigd', 'member.invite_link': 'Uitnodigingslink gemaakt', 'member.joined': 'Account geactiveerd', 'member.updated': 'Rol of rechten gewijzigd',
  'member.deactivated': 'Gedeactiveerd', 'member.reactivated': 'Heractiveerd', 'member.invite_withdrawn': 'Uitnodiging ingetrokken', 'member.anonymised': 'Geanonimiseerd',
  'account.email': 'E-mailadres gewijzigd', 'session.revoke_all': 'Overal uitgelogd',
  'integration.updated': 'API-sleutels gewijzigd', 'integration.removed': 'API-sleutels verwijderd',
  'privacy.export': 'Gegevens gedownload', 'privacy.settings': 'Bewaartermijn gewijzigd',
  'data.rules': 'Health-regels gewijzigd', 'data.assign': 'Toewijzing gewijzigd', 'data.trello_link': 'Trello-koppeling gewijzigd', 'data.campaign_removed': 'Campagne verwijderd', 'data.denied': 'Wijziging geweigerd: geen rechten',
  'dev.view_as': 'Bekijk als', 'setup.link_issued': 'Setuplink gemaakt', 'owner.recovery': 'Eigenaarsherstel gestart',
};
const TYPES = [['', 'Alles'], ['login', 'Inloggen'], ['member', 'Leden'], ['2fa', 'Tweestapsverificatie'], ['password', 'Wachtwoorden'], ['integration', 'Integraties'], ['privacy', 'Privacy'], ['data', 'Regels & toewijzing'], ['dev', 'Dev']];
const TONE = t => /fail|locked|denied|removed|deactivated|anonymised|reset$|disabled/.test(t) ? 'red' : /^login|logout/.test(t) ? 'neutral' : /^member|^2fa|^password|^account|^session/.test(t) ? 'navy' : 'amber';

const rightLabel = k => (RIGHTS.find(r => r.key === k) || {}).label || k;
const roleLabel = k => (ROLES[k] || {}).label || k;
const val = v => v == null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'aan' : 'uit') : String(v);

/** Human-readable lines for an event's details. */
function detailLines(e) {
  const d = e.details || {}, out = [];
  for (const [k, v] of Object.entries(d)) {
    if (k === 'rights' && v && typeof v === 'object') {
      if (v.added && v.added.length) out.push('Rechten erbij: ' + v.added.map(rightLabel).join(', '));
      if (v.removed && v.removed.length) out.push('Rechten eraf: ' + v.removed.map(rightLabel).join(', '));
    } else if (v && typeof v === 'object' && ('from' in v || 'van' in v)) {
      const from = 'from' in v ? v.from : v.van, to = 'to' in v ? v.to : v.naar, lab = { role: 'Rol', name: 'Naam', recName: 'Recruiternaam' }[k] || k;
      out.push(`${lab}: ${k === 'role' ? roleLabel(from) : val(from)} → ${k === 'role' ? roleLabel(to) : val(to)}`);
    } else if (Array.isArray(v)) out.push(`${k}: ${v.join(', ')}`);
    else out.push(`${k}: ${val(v)}`);
  }
  return out;
}

export default function AuditTab({ s }) {
  const [type, setType] = useState('');
  const [person, setPerson] = useState('');
  const [entries, setEntries] = useState([]);
  const [more, setMore] = useState(false);
  const a = useAction(s.flash);
  const load = async (append = false) => {
    const before = append && entries.length ? entries[entries.length - 1].at : '';
    const r = await a.run(() => api('GET', `/api/admin/audit?limit=100&type=${encodeURIComponent(type)}&person=${encodeURIComponent(person)}${before ? `&before=${before}` : ''}`));
    if (r) { setEntries(append ? [...entries, ...r.entries] : r.entries); setMore(r.entries.length === 100); }
  };
  useEffect(() => { load(false); }, [type, person]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <div style={row}>
          <select value={type} onChange={e => setType(e.target.value)} aria-label="Soort" style={{ ...select, width: 'auto' }}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select value={person} onChange={e => setPerson(e.target.value)} aria-label="Persoon" style={{ ...select, width: 'auto' }}>
            <option value="">Iedereen</option>
            {s.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <span style={muted}>Bewaard: 12 maanden</span>
      </div>
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
        {entries.map((e, i) => { const lines = detailLines(e); return (
          <div key={e.at + e.type + i} style={{ display: 'grid', gridTemplateColumns: '130px minmax(0,1fr)', gap: '14px', padding: '12px 20px', borderTop: i ? '1px solid #F5F2ED' : 0, fontSize: '14px' }}>
            <span style={{ fontSize: '13px', color: '#5C5C5A' }}>{fmtDateTime(e.at)}</span>
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone={TONE(e.type)}>{EVENTS[e.type] || e.type}</Badge>
                <span>{e.actorName ? <b>{e.actorName}</b> : <span style={{ color: '#8C8C8A' }}>systeem</span>}{e.targetName && e.targetId !== e.actorId ? <> → <b>{e.targetName}</b></> : null}</span>
                {e.ip ? <span style={{ fontSize: '12px', color: '#8C8C8A' }}>{e.ip}</span> : null}
              </span>
              {lines.map((l, j) => <span key={j} style={{ fontSize: '13px', color: '#3C3C3A', overflowWrap: 'anywhere' }}>{l}</span>)}
            </span>
          </div>); })}
        {!entries.length && !a.busy ? <div style={{ padding: '32px', textAlign: 'center', fontSize: '14px', color: '#8C8C8A' }}>Niets gevonden.</div> : null}
      </div>
      {more ? <div><Button variant="ghost" size="sm" onClick={() => load(true)} disabled={a.busy}>Meer laden</Button></div> : null}
      <Err>{a.error}</Err>
    </div>
  );
}
