// Instellingen: like Notion's "Settings & members". Which tabs you see depends on your own rights (not on
// "Bekijk als"); the server checks them again for every action.
import React from 'react';
import AccountTab from './AccountTab.jsx';
import MembersTab from './MembersTab.jsx';
import RolesTab from './RolesTab.jsx';
import IntegrationsTab from './IntegrationsTab.jsx';
import AuditTab from './AuditTab.jsx';
import PrivacyTab from './PrivacyTab.jsx';
import IdeasTab from './IdeasTab.jsx';

// count: a number shown on the tab, such as new bugs and ideas.
export const SETTINGS_TABS = [
  { key: 'account', label: 'Mijn account', right: null, C: AccountTab },
  { key: 'members', label: 'Leden', right: 'members.manage', C: MembersTab },
  { key: 'roles', label: 'Rollen & rechten', right: null, C: RolesTab },
  { key: 'ideas', label: 'Bugs & ideeën', right: 'ideas.manage', C: IdeasTab, count: s => s.newIdeas },
  { key: 'integrations', label: 'Integraties', right: 'integrations', C: IntegrationsTab },
  { key: 'audit', label: 'Auditlog', right: 'audit.view', C: AuditTab },
  { key: 'privacy', label: 'Privacy', right: 'privacy', C: PrivacyTab },
];

export default function SettingsView({ s }) {
  const tabs = SETTINGS_TABS.filter(t => !t.right || s.canReal(t.right));
  const cur = tabs.find(t => t.key === s.tab) || tabs[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header>
        <div style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Instellingen</div>
        <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: 600, fontSize: '40px', lineHeight: 1.1, letterSpacing: '-.02em' }}>{cur.label}</h1>
      </header>
      {s.isPreview ? <div style={{ background: '#FFF8E0', borderRadius: '12px', padding: '12px 16px', fontSize: '14px' }}>Je bekijkt de app als {s.previewName}. Instellingen gaan altijd over je eigen account, met je eigen rechten.</div> : null}
      {tabs.length > 1 ? <div style={{ display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px', alignSelf: 'flex-start', flexWrap: 'wrap', maxWidth: '100%' }}>
          {tabs.map(t => { const on = t.key === cur.key, n = t.count ? t.count(s) : 0; return (
            <button key={t.key} onClick={() => s.setTab(t.key)} style={{ border: 0, borderRadius: '999px', padding: '7px 14px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: on ? '#FFFFFF' : 'transparent', color: on ? '#1D1D1B' : '#5C5C5A', boxShadow: on ? '0 1px 4px rgba(29,29,27,.07)' : 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {t.label}{n ? <span style={{ fontSize: '11px', fontWeight: 600, background: '#FDECEA', color: '#D32F2F', borderRadius: '999px', padding: '2px 7px' }}>{n}</span> : null}</button>); })}
        </div> : null}
      <cur.C s={s} />
    </div>
  );
}
