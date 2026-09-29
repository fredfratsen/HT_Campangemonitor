import React from 'react';
import { ROLES, ROLE_KEYS, LEVELS, RIGHTS, RIGHT_GROUPS } from '../../lib/permissions.js';
import { Section, Badge, muted, eyebrow } from './ui.jsx';

export default function RolesTab({ s }) {
  const mine = new Set(s.account.rights);
  const cols = `minmax(220px,1.6fr) repeat(${ROLE_KEYS.length}, minmax(92px,1fr)) 80px`;
  const cell = { textAlign: 'center', fontSize: '15px' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Section title="Hoe rechten werken" sub="Net als in Trello en Notion heeft iedereen een rol. De rol geeft een standaardpakket rechten; wie leden beheert kan per persoon rechten aan- of uitzetten onder Leden. Je kunt alleen rechten uitdelen die je zelf hebt.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px' }}>
          {Object.entries(LEVELS).map(([k, l]) => <div key={k} style={{ background: '#FDFBF8', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Badge>{l.label}</Badge><span style={{ fontSize: '13px', fontWeight: 600 }}>{ROLE_KEYS.filter(r => ROLES[r].level === k).map(r => ROLES[r].label).join(', ')}</span></div>
              <div style={{ ...muted, marginTop: '6px' }}>{k === 'owner' ? 'Kan alles, ook andere Eigenaren beheren. Er blijft altijd minstens één.' : k === 'admin' ? 'Beheert leden (behalve Eigenaren en andere Beheerders). Tweestapsverificatie verplicht.' : 'Doet het dagelijkse werk, met de rechten van de rol.'}</div>
            </div>)}
        </div>
      </Section>
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflowX: 'auto' }}>
        <div style={{ minWidth: '760px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '8px', padding: '14px 20px', borderBottom: '1px solid #E4E1DE', alignItems: 'end' }}>
            <div style={eyebrow}>Recht</div>
            {ROLE_KEYS.map(r => <div key={r} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: r === s.account.role ? '#1B1B63' : '#1D1D1B' }}>{ROLES[r].label}</div>
                <div style={{ fontSize: '11px', color: '#8C8C8A' }}>{LEVELS[ROLES[r].level].label}</div>
              </div>)}
            <div style={{ ...eyebrow, textAlign: 'center' }}>Jij</div>
          </div>
          {Object.entries(RIGHT_GROUPS).map(([g, gl]) => <React.Fragment key={g}>
              <div style={{ ...eyebrow, padding: '12px 20px 4px', background: '#FDFBF8' }}>{gl}</div>
              {RIGHTS.filter(r => r.group === g).map(r => <div key={r.key} style={{ display: 'grid', gridTemplateColumns: cols, gap: '8px', padding: '10px 20px', borderTop: '1px solid #F5F2ED', alignItems: 'center' }}>
                  <div><div style={{ fontSize: '14px', fontWeight: 600 }}>{r.label}</div><div style={{ fontSize: '12px', color: '#5C5C5A', lineHeight: 1.4 }}>{r.desc}</div></div>
                  {ROLE_KEYS.map(role => <div key={role} style={{ ...cell, color: ROLES[role].rights.includes(r.key) ? '#1A7A4A' : '#C0BDB9', background: role === s.account.role ? '#F5F2ED' : 'transparent', borderRadius: '6px', padding: '4px 0' }}>{ROLES[role].rights.includes(r.key) ? '✓' : '–'}</div>)}
                  <div style={{ ...cell, color: mine.has(r.key) ? '#1B1B63' : '#C0BDB9', fontWeight: 700 }}>{mine.has(r.key) ? '✓' : '–'}</div>
                </div>)}
            </React.Fragment>)}
        </div>
      </div>
    </div>
  );
}
