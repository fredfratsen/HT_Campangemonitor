// "Weet je het zeker?" before a step with consequences, with Doorgaan and Annuleren. Escape or a click beside it cancels.
import React, { useEffect, useRef } from 'react';
import Button from './Button.jsx';

export default function ConfirmDialog({ title, text, note, okLabel = 'Doorgaan', onOk, onCancel }) {
  const box = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    // Focus starts on Annuleren, so Enter right away does no harm.
    const btn = box.current && box.current.querySelector('button');
    if (btn) btn.focus();
    const key = e => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); };
  }, []);
  return (
    <>
      <div onClick={onCancel} className="panel-backdrop" style={{ position: 'fixed', inset: '0', background: 'rgba(29,29,27,.38)', zIndex: '30' }} />
      <div ref={box} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text" style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(440px,calc(100vw - 32px))', background: '#FFFFFF', borderRadius: '12px', boxShadow: '0 8px 32px rgba(29,29,27,.18)', zIndex: '31', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 id="confirm-title" style={{ margin: '0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '20px' }}>{title}</h2>
        <div id="confirm-text" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', lineHeight: '1.5', color: '#3C3C3A', textWrap: 'pretty' }}>
          <span>{text}</span>
          {note ? <span style={{ color: '#5C5C5A' }}>{note}</span> : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
          <Button variant="ghost" onClick={onCancel}>Annuleren</Button>
          <Button variant="primary" onClick={onOk}>{okLabel}</Button>
        </div>
      </div>
    </>
  );
}
