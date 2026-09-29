import React from 'react';

export default function Sidebar({ v }) {
  const { authEnabled, canResetDemo, goTrelloTest, isLead, nav, navTitle, reloadTrello, resetDemo, setUser, sourceTabs, syncDot, syncText, user } = v;
  return (
    <aside className="app-aside">
      <img src="/logo.png" alt="Horeca Toppers" style={{ height: '34px', width: 'auto', alignSelf: 'flex-start', marginLeft: '10px' }} />
      <nav className="app-nav">
        <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.08em', textTransform: 'uppercase', color: '#8C8C8A', padding: '0 12px 8px' }}>{navTitle}</div>
        {nav.map((n, i) => <button key={i} onClick={n.onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', border: '0', background: n.bg, color: n.fg, fontWeight: n.fw, fontSize: '14px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
            <span>{n.label}</span>
            {n.hasBadge ? <span style={{ fontSize: '11px', fontWeight: '600', background: '#FDECEA', color: '#D32F2F', borderRadius: '999px', padding: '2px 7px' }}>{n.badge}</span> : null}
          </button>)}
      </nav>
      <div className="app-aside-foot">
        {isLead ? <button onClick={goTrelloTest} className="link-btn">Trello-koppeling testen →</button> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.08em', textTransform: 'uppercase', color: '#8C8C8A' }}>Databron</div>
          <div style={{ display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px' }}>
            {sourceTabs.map((t, i) => <button key={i} onClick={t.onClick} style={{ flex: '1', border: '0', borderRadius: '999px', padding: '6px 8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', background: t.bg, color: t.fg, boxShadow: t.sh }}>{t.label}</button>)}
          </div>
          <button onClick={reloadTrello} title="Opnieuw laden" style={{ border: '0', background: 'none', padding: '0', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5C5C5A', cursor: 'pointer', textAlign: 'left' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', flex: 'none', background: syncDot }} />{syncText}</button>
        </div>
        <div style={{ borderTop: '1px solid #E4E1DE', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.08em', textTransform: 'uppercase', color: '#8C8C8A' }}>Ingelogd als</div>
          <select value={user.id ?? ''} onChange={setUser} aria-label="Ingelogd als" style={{ height: '36px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 8px', fontSize: '13px', fontWeight: '600', background: '#FFFFFF' }}>
            <optgroup label="Teamlead">
              <option value="robbin">Robbin</option>
            </optgroup>
            <optgroup label="Recruitment Marketeers">
              <option value="danielle">Danielle</option>
              <option value="molina">Molina</option>
              <option value="mare">Mare</option>
            </optgroup>
            <optgroup label="Recruiters">
              <option value="r-robin">Robin</option>
              <option value="r-tsjerk">Tsjerk</option>
              <option value="r-kim">Kim</option>
              <option value="r-juul">Juul</option>
            </optgroup>
          </select>
          <div style={{ fontSize: '12px', color: '#5C5C5A' }}>{user.roleLabel}</div>
        </div>
        {canResetDemo || authEnabled ? <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {canResetDemo ? <button onClick={resetDemo} style={{ border: '0', background: 'none', padding: '0', fontSize: '12px', color: '#8C8C8A', textAlign: 'left', cursor: 'pointer' }}>Demo-data herstellen</button> : null}
            {authEnabled ? <form method="post" action="/logout" style={{ margin: 0 }}><button type="submit" style={{ border: '0', background: 'none', padding: '0', fontSize: '12px', color: '#8C8C8A', textAlign: 'left', cursor: 'pointer' }}>Uitloggen</button></form> : null}
          </div> : null}
      </div>
    </aside>
  );
}
