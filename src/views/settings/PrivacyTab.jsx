import React, { useEffect, useState } from 'react';
import { api, download } from '../../lib/api.js';
import { ROLES } from '../../lib/permissions.js';
import { Section, Badge, Notice, Err, useAction, select, muted, row, linkBtn, dangerBtn } from './ui.jsx';

const FIXED = [
  ['Sessies', '30 dagen'], ['Uitnodigingslinks', '7 dagen'], ['Wachtwoord-resetlinks', '24 uur'], ['Setuplink eerste account', '1 uur'],
  ['Auditlog', '12 maanden'], ['Back-ups van de data', '14 dagen'],
];

export default function PrivacyTab({ s }) {
  const [cfg, setCfg] = useState(null);
  const a = useAction(s.flash);
  useEffect(() => { a.run(async () => setCfg(await api('GET', '/api/admin/privacy'))); }, []);
  const setMonths = async e => {
    const m = +e.target.value;
    const r = await a.run(() => api('PUT', '/api/admin/privacy', { anonymiseAfterMonths: m }), 'Bewaartermijn opgeslagen');
    if (r) setCfg({ ...cfg, settings: r.settings });
  };
  const anonymise = async m => {
    const typed = window.prompt(`${m.name} anonimiseren? Overal in de app (feedback, toewijzingen, meldingen, ideeën, auditlog) wordt de naam vervangen door een pseudoniem, en e-mailadres en wachtwoord worden gewist. Dit kan niet ongedaan worden.\n\nTyp de naam om te bevestigen:`);
    if (typed == null) return;
    if (typed.trim() !== m.name) { a.setError('De naam klopt niet; er is niets gewijzigd.'); return; }
    const r = await a.run(() => api('POST', `/api/admin/privacy/anonymise/${m.id}`));
    if (r) { s.flash(`${m.name} is nu ${r.pseudonym}`); s.reloadMe(); }
  };
  const people = s.members.filter(m => m.status !== 'anonymised');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px' }}>
      <Section title="Bewaartermijnen" sub="Wat de app automatisch opruimt.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '10px 16px', fontSize: '14px' }}>
          {FIXED.map(([k, v]) => <div key={k}><div style={{ ...muted, fontSize: '12px' }}>{k}</div><div style={{ fontWeight: 600 }}>{v}</div></div>)}
        </div>
        {cfg ? <label style={{ ...row, fontSize: '14px', fontWeight: 600 }}>Gedeactiveerde accounts anonimiseren na
            <select value={cfg.settings.anonymiseAfterMonths} onChange={setMonths} style={{ ...select, width: 'auto' }}>
              {cfg.monthOptions.map(m => <option key={m} value={m}>{m ? `${m} maanden` : 'nooit automatisch'}</option>)}
            </select>
          </label> : null}
      </Section>
      <Section title="Gegevens per persoon" sub="Inzageverzoek: download alles over iemand. Verwijderverzoek of uit dienst: deactiveer het account onder Leden en anonimiseer het hier.">
        {people.map((m, i) => <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '8px 0', borderTop: i ? '1px solid #F5F2ED' : 0 }}>
            <span style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' }}><b>{m.name}</b><span style={{ fontSize: '12px', color: '#5C5C5A' }}>{ROLES[m.role].label}</span>{m.status === 'deactivated' ? <Badge>Gedeactiveerd</Badge> : m.status === 'invited' ? <Badge tone="gold">Uitgenodigd</Badge> : null}</span>
            <span style={{ ...row, gap: '16px' }}>
              <button onClick={() => a.run(() => download(`/api/admin/privacy/export/${m.id}`), 'Download gestart')} style={linkBtn}>Gegevens downloaden</button>
              {m.status === 'deactivated' ? <button onClick={() => anonymise(m)} style={dangerBtn}>Anonimiseren</button> : null}
            </span>
          </div>)}
        <Notice>Vrije tekst (feedback, ideeën) blijft staan zoals hij is getypt en kan namen bevatten. Controleer die bij een verzoek met de hand.</Notice>
      </Section>
      <Section title="Buiten de app" sub="Dit regelt de app niet zelf, maar hoort bij de AVG.">
        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', lineHeight: 1.5 }}>
          <li>De <a href="/privacy">privacytekst</a> laten controleren en de contactpersoon invullen (in <code>server/pages.js</code>).</li>
          <li>De Campagnemonitor opnemen in het verwerkingsregister van Horeca Toppers.</li>
          <li>Verwerkersovereenkomsten met de hostingpartij (Render of Netlify) en Atlassian (Trello).</li>
        </ul>
      </Section>
      <Err>{a.error}</Err>
    </div>
  );
}
