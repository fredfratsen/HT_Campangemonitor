// Controle in x dagen (lib/controle.js): in how many days a campaign comes up again in the monitor. The dialog opens
// from the Weekoverzicht; the picker is also in Acties & campagnewijzigingen on the campaign page. Escape or a click
// beside the dialog cancels, Enter in the number field saves.
import React, { useEffect, useRef } from 'react';
import Button from './Button.jsx';
import { CTL_PICKS, CTL_MAX, ctlDate, ctlDays, dayLong } from '../lib/controle.js';

/** Quick picks plus a number field. value is the days as typed ('' for none); a quick pick that is on turns it off. */
export function CtlPicker({ value, onChange, onEnter, noneText = 'Geen controle' }) {
  const n = ctlDays(value);
  const hint = n ? `Komt terug op ${dayLong(ctlDate(n))}` : value !== '' ? `Kies 1 tot ${CTL_MAX} dagen` : noneText;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        {CTL_PICKS.map(d => <button key={d} type="button" onClick={() => onChange(n === d ? '' : String(d))} aria-pressed={n === d}
            style={{ height: '32px', border: `1.5px solid ${n === d ? '#1B1B63' : '#E4E1DE'}`, background: n === d ? '#1B1B63' : '#FFFFFF', color: n === d ? '#FFFFFF' : '#1D1D1B', borderRadius: '999px', padding: '0 12px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            {d} {d === 1 ? 'dag' : 'dagen'}
          </button>)}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          <input type="number" min="1" max={CTL_MAX} step="1" inputMode="numeric" value={value} placeholder="anders" aria-label="Aantal dagen"
            onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
            style={{ width: '64px', height: '32px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 8px', fontSize: '13px', background: '#FFFFFF' }} />
          <span style={{ fontSize: '13px', color: '#5C5C5A' }}>dagen</span>
        </span>
      </div>
      <span aria-live="polite" style={{ fontSize: '12px', color: n ? '#3C3C3A' : value !== '' ? '#D32F2F' : '#8C8C8A' }}>{hint}</span>
    </div>
  );
}

export default function CtlDialog({ title, value, onChange, onOk, onCancel }) {
  const box = useRef(null), ok = ctlDays(value) > 0;
  useEffect(() => {
    const prev = document.activeElement;
    const input = box.current && box.current.querySelector('input');
    if (input) input.focus();
    const key = e => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); };
  }, []);
  return (
    <>
      <div onClick={onCancel} className="panel-backdrop" style={{ position: 'fixed', inset: '0', background: 'rgba(29,29,27,.38)', zIndex: '30' }} />
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="ctl-title" aria-describedby="ctl-text" style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 'min(440px,calc(100vw - 32px))', background: '#FFFFFF', borderRadius: '12px', boxShadow: '0 8px 32px rgba(29,29,27,.18)', zIndex: '31', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 id="ctl-title" style={{ margin: '0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '20px' }}>Controle in x dagen</h2>
        <div id="ctl-text" style={{ fontSize: '14px', lineHeight: '1.5', color: '#3C3C3A', textWrap: 'pretty' }}>
          Over hoeveel dagen moet <strong>{title}</strong> weer omhoog komen? Tot dan staat hij op Check. Een nieuw signaal haalt hem eerder terug.
        </div>
        <CtlPicker value={value} onChange={onChange} onEnter={() => { if (ok) onOk(); }} noneText="Kies het aantal dagen" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
          <Button variant="ghost" onClick={onCancel}>Annuleren</Button>
          <Button variant="primary" onClick={onOk} disabled={!ok}>Vastleggen</Button>
        </div>
      </div>
    </>
  );
}
