// Opening a campaign in a new browser tab. The app opens the campaign in a link like #campagne=<id> on load.
import React from 'react';

/** Icon link for a card or row that opens `href` in a new tab, without also triggering the row's own click. */
export default function NewTabLink({ href, label }) {
  const stop = e => e.stopPropagation();
  return (
    <a href={href} target="_blank" rel="noopener" onClick={stop} onAuxClick={stop} className="tab-link" aria-label={label} title="Openen in nieuw tabblad">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
    </a>
  );
}

/** Click handlers for a clickable card: a plain click opens it here, Cmd/Ctrl-click or middle-click in a new tab. */
export function cardClick(href, open) {
  const newTab = () => window.open(href, '_blank', 'noopener');
  return {
    onClick: e => { if (e.metaKey || e.ctrlKey) newTab(); else open(); },
    onAuxClick: e => { if (e.button === 1) newTab(); }
  };
}
