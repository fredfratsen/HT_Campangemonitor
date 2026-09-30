import React from 'react';

const eyebrow = { fontSize: '11px', fontWeight: '500', letterSpacing: '.08em', textTransform: 'uppercase', color: '#8C8C8A' };
const linkish = { border: '0', background: 'none', padding: '0', fontSize: '12px', color: '#8C8C8A', textAlign: 'left', cursor: 'pointer' };
const navBtn = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', border: '0', fontSize: '14px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' };

// On desktop this is the fixed left column. On phones it is a slide-in menu (see .app-aside in styles/app.css);
// the close button and the "Wat is er nieuw" / "Bug of idee melden" items (the top-right buttons on desktop) only show there.
export default function Sidebar({ v }) {
  const { account, canResetDemo, canTrelloTest, closeNav, goSettings, goTrelloTest, navSections, news, openIdea, openNews, reloadTrello, resetDemo, sourceTabs, syncDot, syncText, viewAs } = v;
  return (
    <aside id="app-nav" className="app-aside">
      <div className="app-aside-head">
        <img src="/logo.png" alt="Horeca Toppers" style={{ height: '34px', width: 'auto', alignSelf: 'flex-start', marginLeft: '10px' }} />
        <button className="nav-close" onClick={closeNav} aria-label="Menu sluiten">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      {navSections.map((sec, si) => <nav key={si} className="app-nav">
          {sec.title ? <div style={{ ...eyebrow, padding: '0 12px 8px' }}>{sec.title}</div> : null}
          {sec.items.map((n, i) => <button key={i} onClick={n.onClick} style={{ ...navBtn, background: n.bg, color: n.fg, fontWeight: n.fw }}>
              <span>{n.label}</span>
              {n.hasBadge ? <span style={{ fontSize: '11px', fontWeight: '600', background: '#FDECEA', color: '#D32F2F', borderRadius: '999px', padding: '2px 7px' }}>{n.badge}</span> : null}
            </button>)}
        </nav>)}
      <nav className="app-nav nav-extra">
        <button onClick={openNews} style={{ ...navBtn, background: 'transparent', color: '#3C3C3A', fontWeight: 500 }}>
          <span>Wat is er nieuw</span>
          {news.hasNew ? <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg,#F9CE00 0%,#FB8915 100%)' }} /> : null}
        </button>
        <button onClick={openIdea} style={{ ...navBtn, background: 'transparent', color: '#3C3C3A', fontWeight: 500 }}><span>Bug of idee melden</span></button>
      </nav>
      <div className="app-aside-foot">
        {canTrelloTest ? <button onClick={goTrelloTest} className="link-btn">Trello-koppeling testen →</button> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={eyebrow}>Databron</div>
          <div style={{ display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px' }}>
            {sourceTabs.map((t, i) => <button key={i} onClick={t.onClick} style={{ flex: '1', border: '0', borderRadius: '999px', padding: '6px 8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', background: t.bg, color: t.fg, boxShadow: t.sh }}>{t.label}</button>)}
          </div>
          <button onClick={reloadTrello} title="Opnieuw laden" style={{ border: '0', background: 'none', padding: '0', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5C5C5A', cursor: 'pointer', textAlign: 'left' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', flex: 'none', background: syncDot }} />{syncText}</button>
        </div>
        <div style={{ borderTop: '1px solid #E4E1DE', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={eyebrow}>Ingelogd als</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>{account.name}</div>
            <div style={{ fontSize: '12px', color: '#5C5C5A' }}>{account.roleLabel} · {account.levelLabel}</div>
          </div>
          {viewAs.enabled ? <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#5C5C5A' }}>
              Bekijk als
              <select value={viewAs.value} onChange={viewAs.onChange} aria-label="Bekijk als" style={{ height: '34px', border: `1px solid ${viewAs.active ? '#F9A800' : '#E4E1DE'}`, borderRadius: '8px', padding: '0 8px', fontSize: '13px', fontWeight: '600', background: viewAs.active ? '#FFF8E0' : '#FFFFFF' }}>
                <option value="">Mezelf ({account.name})</option>
                {viewAs.groups.map(g => <optgroup key={g.label} label={g.label}>
                    {g.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </optgroup>)}
              </select>
            </label> : null}
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={goSettings} style={{ ...linkish, color: '#1B1B63', fontWeight: 500 }}>Mijn account</button>
            <form method="post" action="/logout" style={{ margin: 0 }}><button type="submit" style={linkish}>Uitloggen</button></form>
          </div>
        </div>
        {canResetDemo ? <button onClick={resetDemo} style={linkish}>Demo-data herstellen</button> : null}
      </div>
    </aside>
  );
}
