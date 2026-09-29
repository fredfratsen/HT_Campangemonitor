// Building blocks for the settings screens, in the same style as the rest of the app.
import React, { useState } from 'react';

export const card = { background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' };
export const h2 = { margin: 0, fontFamily: 'Poppins,sans-serif', fontWeight: 600, fontSize: '17px' };
export const eyebrow = { fontSize: '11px', fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8C8C8A' };
export const muted = { fontSize: '13px', color: '#5C5C5A', lineHeight: 1.5 };
export const input = { height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#FFFFFF', width: '100%', minWidth: 0 };
export const select = { ...input, padding: '0 8px' };
export const label = { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600, minWidth: 0 };
export const mono = { fontFamily: "'SF Mono','Fira Code',Consolas,monospace", fontSize: '13px' };
export const row = { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' };
export const linkBtn = { border: 0, background: 'none', padding: 0, fontSize: '13px', fontWeight: 500, color: '#1B1B63', cursor: 'pointer', textAlign: 'left' };
export const dangerBtn = { ...linkBtn, color: '#D32F2F' };

export function Section({ title, sub, right, children }) {
  return (
    <section style={card}>
      {title ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}><h2 style={h2}>{title}</h2>{sub ? <div style={{ ...muted, marginTop: '4px' }}>{sub}</div> : null}</div>
          {right}
        </div> : null}
      {children}
    </section>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  const t = { neutral: ['#F5F2ED', '#3C3C3A'], navy: ['#E7E7F0', '#1B1B63'], green: ['#E6F4ED', '#1A7A4A'], amber: ['#FEF3C7', '#B45309'], red: ['#FDECEA', '#D32F2F'], gold: ['#FFF8E0', '#B45309'] }[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: t[0], color: t[1], whiteSpace: 'nowrap' }}>{children}</span>;
}

export function Notice({ tone = 'info', children }) {
  const t = { info: ['#F5F2ED', '#3C3C3A'], warn: ['#FFF8E0', '#3C3C3A'], error: ['#FDECEA', '#D32F2F'], ok: ['#E6F4ED', '#1A7A4A'] }[tone];
  return <div style={{ background: t[0], color: t[1], borderRadius: '8px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.5 }}>{children}</div>;
}

export function Toggle({ on, onChange, disabled, label: aria }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={aria} onClick={() => !disabled && onChange(!on)} disabled={disabled}
      style={{ width: '36px', height: '20px', borderRadius: '999px', border: 0, background: on ? '#1B1B63' : '#C0BDB9', position: 'relative', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, flex: 'none', padding: 0 }}>
      <span style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#FFFFFF', transition: 'left 150ms' }} />
    </button>
  );
}

/** A one-time link with a copy button. */
export function CopyLink({ link, note }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (e) { window.prompt('Kopieer de link:', link); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#FFF8E0', borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input readOnly value={link} onFocus={e => e.target.select()} aria-label="Link" style={{ ...input, ...mono, height: '36px', background: '#FFFFFF' }} />
        <button type="button" onClick={copy} style={{ height: '36px', border: 0, borderRadius: '8px', background: '#1B1B63', color: '#FFFFFF', padding: '0 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flex: 'none' }}>{copied ? 'Gekopieerd ✓' : 'Kopieer'}</button>
      </div>
      {note ? <div style={{ fontSize: '12px', color: '#5C5C5A', lineHeight: 1.5 }}>{note}</div> : null}
    </div>
  );
}

/** Runs an async action with a busy flag and error message. */
export function useAction(flash) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn, ok) => {
    setBusy(true); setError('');
    try { const r = await fn(); if (ok) flash(ok); return r; }
    catch (e) { setError(e.message); return undefined; }
    finally { setBusy(false); }
  };
  return { busy, error, setError, run };
}

export const Err = ({ children }) => children ? <Notice tone="error">{children}</Notice> : null;
