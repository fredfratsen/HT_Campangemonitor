// This app is the old version: shown on every page load, with the new address. Sluiten, Escape or a click beside it closes it.
import React, { useEffect, useRef, useState } from 'react';
import Button from './Button.jsx';

const NEW_URL = 'https://campagnes.werfenconnect.nl';

export default function OutdatedNotice() {
  const [open, setOpen] = useState(true);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const link = box.current && box.current.querySelector('a');
    if (link) link.focus();
    const key = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open]);
  if (!open) return null;
  const close = () => setOpen(false);
  return (
    <>
      <div onClick={close} style={{ position: 'fixed', inset: '0', background: 'rgba(29,29,27,.5)', zIndex: '40' }} />
      <div ref={box} role="alertdialog" aria-modal="true" aria-labelledby="outdated-title" aria-describedby="outdated-text" style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(460px,calc(100vw - 32px))', background: '#FFFFFF', borderRadius: '12px', boxShadow: '0 8px 32px rgba(29,29,27,.18)', zIndex: '41', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 id="outdated-title" style={{ margin: '0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '20px' }}>Deze versie is verouderd</h2>
        <div id="outdated-text" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', lineHeight: '1.5', color: '#3C3C3A', textWrap: 'pretty' }}>
          <span>De Campagnemonitor is verhuisd naar <b>campagnes.werfenconnect.nl</b>.</span>
          <span style={{ color: '#D32F2F', fontWeight: 500 }}>Alles wat je hier doet, wordt niet opgeslagen.</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
          <Button variant="ghost" onClick={close}>Sluiten</Button>
          <a href={NEW_URL} style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600, fontSize: 14, padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg, #F9CE00 0%, #FB8915 100%)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>Naar de nieuwe versie</a>
        </div>
      </div>
    </>
  );
}
