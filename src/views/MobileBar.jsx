import React from 'react';

// Top bar on phones and small tablets (hidden on desktop, see .m-bar in styles/app.css): the menu button opens the
// sidebar as a slide-in menu; the bell opens Meldingen. The dot on the menu button means something inside wants attention.
export default function MobileBar({ v }) {
  const { inbox, navOpen, navSections, news, openInbox, openNav } = v;
  const alert = news.hasNew || navSections.some(s => s.items.some(n => n.hasBadge));
  return (
    <header className="m-bar" inert={navOpen ? '' : undefined}>
      <button className="nav-toggle" onClick={openNav} aria-label="Menu openen" aria-expanded={navOpen} aria-controls="app-nav">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
        {alert ? <span className="m-dot" /> : null}
      </button>
      <img src="/logo.png" alt="Horeca Toppers" className="m-logo" />
      <button className="m-bell" onClick={openInbox} aria-label={inbox.hasUnread ? `Meldingen, ${inbox.unread} ongelezen` : 'Meldingen'}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {inbox.hasUnread ? <span className="m-badge">{inbox.unread}</span> : null}
      </button>
    </header>
  );
}
