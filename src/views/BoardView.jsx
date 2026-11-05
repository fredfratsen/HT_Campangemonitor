import React from 'react';
import { StatusPill } from './LiveView.jsx';

// Recruiter › Bord: the candidates of one campaign switched to the ATS, in columns like the Trello board, with a search
// on name, e-mail or phone, and a drawer over it for the candidate you clicked. Every action goes to the server (App.bordAct); see lib/ats.js. Cards can
// be dragged to another column, or onto the Afgewezen tile (with a mouse; on a phone Verplaatsen naar does the same).
const eyebrow = { fontSize: '11px', fontWeight: '600', letterSpacing: '.08em', textTransform: 'uppercase', color: '#5C5C5A' };
const plainBtn = { height: '40px', padding: '0 14px', border: '1px solid #E4E1DE', background: '#FFFFFF', borderRadius: '10px', fontSize: '13px', fontWeight: '500', color: '#1B1B63', cursor: 'pointer' };
const outcome = { minHeight: '44px', border: '1px solid #E4E1DE', background: '#FFFFFF', borderRadius: '10px', fontSize: '13px', fontWeight: '600', color: '#1D1D1B', cursor: 'pointer', padding: '0 10px' };
const field = { height: '40px', boxSizing: 'border-box', border: '1px solid #E4E1DE', borderRadius: '10px', padding: '0 12px', fontSize: '14px', background: '#FFFFFF', minWidth: '0' };

const TONES = { amber: ['#B45309', '#FEF3C7'], navy: ['#1B1B63', '#E7E7F0'], red: ['#D32F2F', '#FDECEA'] };
const tagStyle = tone => ({ alignSelf: 'flex-start', fontSize: '11px', fontWeight: '600', color: TONES[tone][0], background: TONES[tone][1], borderRadius: '6px', padding: '2px 7px' });

function Card({ c }) {
  return (
    <button type="button" onClick={c.onClick} aria-pressed={c.sel} aria-label={c.label} draggable={c.draggable ? 'true' : 'false'}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); c.dragStart(); }} onDragEnd={c.dragEnd}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: '12px', cursor: c.draggable ? 'grab' : 'pointer', background: '#FFFFFF', color: '#1D1D1B',
      border: c.sel ? '2px solid #1B1B63' : '1px solid #E4E1DE', boxShadow: c.sel ? '0 4px 16px rgba(27,27,99,.16)' : '0 1px 2px rgba(29,29,27,.05)', opacity: c.dragging ? 0.4 : c.dim ? 0.6 : 1 }}>
      <span style={{ fontSize: '14px', fontWeight: '600' }}>{c.name}</span>
      {c.tags.map(t => <span key={t.text} style={tagStyle(t.tone)}>{t.text}</span>)}
      {c.bl ? <span style={{ alignSelf: 'flex-start', fontSize: '11px', fontWeight: '600', color: '#D32F2F', background: '#FDECEA', borderRadius: '6px', padding: '2px 7px' }}>Blacklist</span> : null}
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px', color: '#5C5C5A' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '0' }}>
          {c.dots.map((on, i) => <span key={i} aria-hidden="true" style={{ width: '10px', height: '10px', boxSizing: 'border-box', borderRadius: '3px', background: on ? '#FB8915' : '#FFFFFF', border: `1.5px solid ${on ? '#FB8915' : '#C0BDB9'}` }} />)}
          <span>{c.meta}</span>
        </span>
        <span style={{ whiteSpace: 'nowrap' }}>{c.age}</span>
      </span>
    </button>
  );
}

/**
 * The candidate you clicked, in a drawer over the board: the cross, a click beside it or Escape closes it and the focus
 * goes back to the cards. Escape in an open step (TBA, reject, note…) first cancels that step.
 */
function Panel({ p }) {
  const box = React.useRef(null), cur = React.useRef(p);
  cur.current = p;
  React.useEffect(() => {
    const prev = document.activeElement;
    if (box.current) box.current.focus();
    const key = e => { if (e.key !== 'Escape') return; if (cur.current.mode) cur.current.cancel(); else cur.current.close(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (prev && prev.isConnected && prev.focus) prev.focus(); };
  }, []);
  const gate = p.gate && !p.readOnly ? <form onSubmit={p.gate.submit} style={{ margin: p.gate.low ? '0' : '14px 24px 0', padding: '16px', background: '#E7E7F0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <span style={{ fontSize: '13px', fontWeight: '600' }}>Naar {p.gate.to}: dan ziet de klant {p.name}</span>
      <span style={{ fontSize: '12px', color: '#3C3C3A' }}>Controleer de gegevens en vul {p.gate.low ? 'hierboven' : 'hieronder'} de screening in.</span>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#5C5C5A' }}>Naam
        <input value={p.gate.name} onChange={p.gate.setName} maxLength={80} style={{ ...field, color: '#1D1D1B' }} /></label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#5C5C5A' }}>Telefoon
        <input type="tel" value={p.gate.phone} onChange={p.gate.setPhone} maxLength={30} style={{ ...field, color: '#1D1D1B' }} /></label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#5C5C5A' }}>E-mail
        <input type="email" value={p.gate.email} onChange={p.gate.setEmail} style={{ ...field, color: '#1D1D1B' }} /></label>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" disabled={p.busy || !p.gate.ok} style={{ ...outcome, background: '#1B1B63', color: '#FFFFFF', border: '0', padding: '0 16px', opacity: p.gate.ok ? 1 : 0.5, cursor: p.gate.ok ? 'pointer' : 'not-allowed' }}>Doorzetten naar klant</button>
        <button type="button" onClick={p.cancel} className="link-btn">Annuleren</button>
      </div>
      {p.gate.ok ? null : <span style={{ fontSize: '12px', color: '#B45309' }}>Nog in te vullen: {p.gate.missing.join(', ')}</span>}
    </form> : null;
  return (<>
    <div onClick={p.close} className="panel-backdrop" aria-hidden="true" style={{ position: 'fixed', inset: '0', background: 'rgba(29,29,27,.38)', zIndex: '20' }} />
    <aside ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Kandidaat ${p.name}`} className="side-panel" style={{ position: 'fixed', top: '16px', right: '16px', bottom: '16px', width: 'min(480px,calc(100vw - 32px))', zIndex: '21', background: '#FFFFFF', borderRadius: '16px', boxShadow: '0 8px 32px rgba(29,29,27,.18)', display: 'flex', flexDirection: 'column', overflowY: 'auto', overscrollBehavior: 'contain', outline: 'none' }}>
      <div style={{ position: 'sticky', top: '0', zIndex: '1', background: '#FFFFFF', padding: '22px 24px 18px', display: 'flex', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid #E4E1DE' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '0' }}>
          <h2 style={{ margin: '0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '22px', lineHeight: '1.2' }}>{p.name}</h2>
          <div style={{ fontSize: '13px', color: '#5C5C5A' }}>{p.sub}</div>
        </div>
        <button type="button" onClick={p.close} aria-label="Paneel sluiten" title="Sluiten (Esc)" style={{ flex: 'none', alignSelf: 'flex-start', width: '36px', height: '36px', border: '0', background: '#F5F2ED', borderRadius: '8px', cursor: 'pointer', color: '#1D1D1B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid #E4E1DE' }}>
        {p.phone ? <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <a href={p.tel} style={{ fontFamily: 'Poppins,sans-serif', fontSize: '20px', fontWeight: '600', color: '#1B1B63' }}>{p.phone}</a>
            <button type="button" onClick={p.copy} className="link-btn" style={{ textDecoration: 'underline' }}>Kopieer</button>
          </div> : null}
        {p.email ? <a href={p.mailto} style={{ fontSize: '14px', overflowWrap: 'anywhere' }}>{p.email}</a> : null}
        <span style={{ alignSelf: 'flex-start', fontSize: '12px', fontWeight: '500', borderRadius: '6px', padding: '3px 8px', color: p.bl ? '#D32F2F' : '#1A7A4A', background: p.bl ? '#FDECEA' : '#E6F4ED' }}>{p.blText}</span>
      </div>

      {p.canUndo && !p.readOnly ? <div style={{ margin: '14px 24px 0', padding: '10px 14px', background: '#E7E7F0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#1B1B63' }}>
          <span>{p.undoText}</span>
          <button type="button" onClick={p.undo} disabled={p.busy} style={{ border: '0', background: 'none', padding: '0', fontSize: '13px', fontWeight: '600', color: '#1B1B63', textDecoration: 'underline', cursor: 'pointer' }}>Ongedaan maken</button>
        </div> : null}

      {p.isCall && !p.readOnly ? <div style={{ margin: '14px 24px 0', padding: '16px', background: '#FFF8E0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ ...eyebrow, whiteSpace: 'nowrap' }}>Belpoging loggen</span>
            <span style={{ fontSize: '12px', color: '#5C5C5A', textAlign: 'right' }}>{p.attText}</span>
          </div>
          {p.mode === 'tba' ? <form onSubmit={p.submitTba} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <label htmlFor="bord-tba" style={{ position: 'absolute', left: '-9999px' }}>Wanneer terugbellen</label>
              <input id="bord-tba" autoFocus value={p.text} onChange={p.setText} placeholder="Bijvoorbeeld: bel 16:00" maxLength={120} style={{ ...field, flex: '1 1 160px' }} />
              <button type="submit" disabled={p.busy} style={{ ...outcome, background: '#1B1B63', color: '#FFFFFF', border: '0' }}>Opslaan</button>
              <button type="button" onClick={p.cancel} className="link-btn">Annuleren</button>
            </form>
            : p.mode === 'reject' ? <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Waarom niet geschikt?</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {p.reasons.map(r => <button key={r.text} type="button" onClick={r.pick} disabled={p.busy} style={{ border: '1px solid #E4E1DE', background: '#FFFFFF', borderRadius: '999px', padding: '7px 12px', fontSize: '12px', fontWeight: '500', color: '#1D1D1B', cursor: 'pointer' }}>{r.text}</button>)}
              </div>
              <button type="button" onClick={p.cancel} className="link-btn" style={{ alignSelf: 'flex-start' }}>Annuleren</button>
            </div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(112px,1fr))', gap: '8px' }}>
              <button type="button" onClick={p.geenGehoor} disabled={p.busy} style={outcome}>Geen gehoor</button>
              <button type="button" onClick={p.startTba} disabled={p.busy} style={outcome}>TBA afspraak</button>
              <button type="button" onClick={p.startReject} disabled={p.busy} style={{ ...outcome, color: '#D32F2F', borderColor: '#F3C2C2' }}>Niet geschikt</button>
              {p.canNb ? <button type="button" onClick={p.toNb} disabled={p.busy} style={{ ...outcome, gridColumn: '1 / -1', borderColor: '#FB8915', color: '#B45309' }}>{p.nbText}</button> : null}
            </div>}
        </div> : null}

      {p.mode === 'reject' && !p.isCall && !p.readOnly ? <div style={{ margin: '14px 24px 0', padding: '16px', background: '#FDECEA', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600' }}>Waarom afwijzen?</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {p.reasons.map(r => <button key={r.text} type="button" onClick={r.pick} disabled={p.busy} style={{ border: '1px solid #E4E1DE', background: '#FFFFFF', borderRadius: '999px', padding: '7px 12px', fontSize: '12px', fontWeight: '500', color: '#1D1D1B', cursor: 'pointer' }}>{r.text}</button>)}
          </div>
          <button type="button" onClick={p.cancel} className="link-btn" style={{ alignSelf: 'flex-start' }}>Annuleren</button>
        </div> : null}

      {p.mode === 'gesprek' ? <form onSubmit={p.submitGesprek} style={{ margin: '14px 24px 0', padding: '16px', background: '#F5F2ED', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label htmlFor="bord-gesprek" style={{ fontSize: '13px', fontWeight: '600' }}>Wanneer is het gesprek?</label>
          <input id="bord-gesprek" type="datetime-local" autoFocus value={p.at} onChange={p.setAt} style={field} />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button type="submit" disabled={p.busy || !p.at} style={{ ...outcome, background: '#1B1B63', color: '#FFFFFF', border: '0', padding: '0 16px' }}>Naar Gesprek</button>
            <button type="button" onClick={p.cancel} className="link-btn">Annuleren</button>
          </div>
        </form> : null}

      {p.mode === 'note' ? <form onSubmit={p.submitNote} style={{ margin: '14px 24px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="bord-note" style={{ position: 'absolute', left: '-9999px' }}>Notitie</label>
          <textarea id="bord-note" autoFocus rows={3} value={p.text} onChange={p.setText} maxLength={1000} placeholder="Notitie…" style={{ border: '1px solid #E4E1DE', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button type="submit" disabled={p.busy} style={{ ...plainBtn, background: '#1B1B63', color: '#FFFFFF', border: '0' }}>Notitie opslaan</button>
            <button type="button" onClick={p.cancel} className="link-btn">Annuleren</button>
          </div>
        </form> : null}

      <div style={{ padding: '14px 24px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #E4E1DE' }}>
        <button type="button" onClick={p.startNote} style={plainBtn}>Notitie</button>
        {p.canReject && !p.isCall && !p.readOnly ? <button type="button" onClick={p.startReject} style={{ ...plainBtn, color: '#D32F2F', borderColor: '#F3C2C2' }}>Afwijzen</button> : null}
        {p.readOnly ? null : <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5C5C5A' }}>
          <span style={{ position: 'absolute', left: '-9999px' }}>Verplaatsen naar</span>
          <select value="" onChange={p.move} disabled={p.busy} aria-label="Verplaatsen naar" style={{ ...field, color: '#1B1B63', fontWeight: '500', fontSize: '13px' }}>
            <option value="">Verplaatsen naar…</option>
            {p.moveOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </label>}
      </div>

      {p.gate && !p.gate.low ? gate : null}

      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid #E4E1DE' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <span style={eyebrow}>Screening</span>
          <button type="button" onClick={p.screening.copy} className="link-btn" style={{ textDecoration: 'underline' }}>Kopieer als tekst</button>
        </div>
        {p.screening.fields.map(f => {
          const id = 'scr-' + f.key, lab = <label htmlFor={id} style={{ fontSize: '12px', color: '#5C5C5A' }}>{f.emoji} {f.label}{f.required ? ' *' : ''}</label>;
          const v = f.value;
          return <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {f.kind === 'choice' || p.readOnly ? <span id={id} style={{ fontSize: '12px', color: '#5C5C5A' }}>{f.emoji} {f.label}{f.required && !p.readOnly ? ' *' : ''}</span> : lab}
            {p.readOnly ? <span style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{(f.kind === 'choice' ? [v.keuze, v.keuze === f.other ? v.tekst : ''].filter(Boolean).join(': ') : String(v ?? '')) || '—'}</span>
              : f.kind === 'text' ? <input id={id} value={v} onChange={e => f.set(e.target.value)} onBlur={p.screening.save} maxLength={200} placeholder={f.placeholder} style={field} />
              : f.kind === 'long' ? <textarea id={id} rows={3} value={v} onChange={e => f.set(e.target.value)} onBlur={p.screening.save} maxLength={1000} style={{ border: '1px solid #E4E1DE', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', minWidth: '0' }} />
              : f.kind === 'age' ? <input id={id} type="number" min={14} max={99} value={v} onChange={e => f.set(e.target.value)} onBlur={p.screening.save} style={{ ...field, width: '100px' }} />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div role="group" aria-labelledby={id} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {f.options.map(o => <button key={o} type="button" aria-pressed={v.keuze === o} onClick={() => f.set({ keuze: o, tekst: o === f.other ? v.tekst : '' })}
                    style={{ border: `1px solid ${v.keuze === o ? '#1B1B63' : '#E4E1DE'}`, background: v.keuze === o ? '#1B1B63' : '#FFFFFF', color: v.keuze === o ? '#FFFFFF' : '#1D1D1B', borderRadius: '999px', padding: '7px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>{o}</button>)}
                </div>
                {v.keuze === f.other ? <input aria-label={f.otherLabel} value={v.tekst} onChange={e => f.set({ keuze: v.keuze, tekst: e.target.value })} onBlur={p.screening.save} maxLength={200} placeholder={f.otherLabel} style={field} /> : null}
              </div>}
          </div>;
        })}
        {p.canDoorzetten && !p.readOnly ? <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
            <button type="button" onClick={p.doorzetten} disabled={p.busy || !!p.screening.missing.length} style={{ ...outcome, background: '#1B1B63', color: '#FFFFFF', border: '0', padding: '0 16px', opacity: p.screening.missing.length ? 0.5 : 1, cursor: p.screening.missing.length ? 'not-allowed' : 'pointer' }}>{p.screening.missing.length ? 'Screening invullen' : 'Doorzetten naar klant'}</button>
            {p.screening.missing.length ? <span style={{ fontSize: '12px', color: '#B45309' }}>Nog in te vullen: {p.screening.missing.join(', ')}</span> : null}
          </div> : null}
        {/* Reached: only here, once every required question is answered; it first checks the contact details (gate). */}
        {p.gate && p.gate.low ? gate
          : p.isCall && !p.readOnly && !p.gate && !p.screening.missing.length ? <button type="button" onClick={p.toGescreend} disabled={p.busy} style={{ ...outcome, alignSelf: 'flex-start', background: '#1B1B63', color: '#FFFFFF', border: '0', padding: '0 16px' }}>Bereikt · gescreend</button> : null}
      </div>

      {p.answers.length ? <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid #E4E1DE' }}>
          <span style={eyebrow}>Uit het formulier</span>
          {p.answers.map((a, i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
              <span style={{ color: '#5C5C5A' }}>{a.q}</span>
              <span style={{ fontWeight: '500' }}>{a.a}</span>
            </div>)}
        </div> : null}

      {p.questions.length ? <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '14px', borderBottom: '1px solid #E4E1DE' }}>
          <span style={eyebrow}>Vragen van de klant</span>
          {p.questions.map(q => <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              <span style={{ color: '#5C5C5A' }}>{q.at} · <span style={{ color: '#1B1B63', fontWeight: '600' }}>{q.door}</span></span>
              <span style={{ fontWeight: '500', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{q.tekst}</span>
              {q.antwoord ? <div style={{ background: '#E6F4ED', borderRadius: '10px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{q.antwoord}</span>
                  <span style={{ fontSize: '12px', color: '#1A7A4A' }}>Beantwoord · {q.antwoordBy}</span>
                </div>
                : q.canAnswer ? <form onSubmit={q.submit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor={'ans-' + q.id} style={{ position: 'absolute', left: '-9999px' }}>Antwoord aan de klant</label>
                  <textarea id={'ans-' + q.id} rows={3} value={q.text} onChange={q.setText} maxLength={1000} placeholder="Je antwoord aan de klant…" style={{ border: '1px solid #E4E1DE', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', minWidth: '0' }} />
                  <button type="submit" disabled={p.busy || !q.text.trim()} style={{ ...outcome, alignSelf: 'flex-start', background: '#1B1B63', color: '#FFFFFF', border: '0', padding: '0 16px', opacity: q.text.trim() ? 1 : 0.5 }}>Antwoord versturen</button>
                </form>
                : <span style={{ fontSize: '12px', color: '#B45309' }}>Nog niet beantwoord</span>}
            </div>)}
        </div> : null}

      <div style={{ padding: '16px 24px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={eyebrow}>Historie</span>
        {p.log.map((h, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr)', gap: '12px', fontSize: '13px' }}>
            <span style={{ color: '#5C5C5A' }}>{h.at}</span>
            <span><span style={{ fontWeight: '600' }}>{h.what}</span> <span style={h.klant ? { color: '#1B1B63', fontWeight: '500' } : { color: '#5C5C5A' }}>· {h.by}</span>{h.klant ? <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '600', letterSpacing: '.04em', textTransform: 'uppercase', color: '#1B1B63', background: '#E7E7F0', borderRadius: '4px', padding: '1px 5px' }}>klant</span> : null}</span>
          </div>)}
      </div>
    </aside>
  </>);
}

/**
 * Done, clicked on the Bord: the whole screen flashes green with a beam of light rolling across (as a client row does in
 * Live campagnes), confetti rains down, and the-office.gif (from /public) celebrates in the card. Gone after a few
 * seconds (App.celebrate); it never catches clicks.
 */
const CONFETTI_COLORS = ['#F9CE00', '#FB8915', '#1B1B63', '#3CC27F', '#1A7A4A', '#D32F2F', '#7FB8FF'];
function confetti(n = 90) {
  return Array.from({ length: n }, (_, i) => {
    const r = Math.random, round = r() < 0.3, w = 6 + r() * 7;
    return { key: i, style: { left: `${r() * 100}%`, width: `${w}px`, height: `${round ? w : w * (1.4 + r())}px`, borderRadius: round ? '50%' : '2px',
      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], animationDelay: `${r() * 0.6}s`, animationDuration: `${2.2 + r() * 1.2}s`,
      '--dx': `${(r() - 0.5) * 220}px`, '--rot': `${(r() < 0.5 ? -1 : 1) * (360 + r() * 720)}deg` } };
  });
}
function Celebrate({ client }) {
  const [bits] = React.useState(confetti);
  return (
    <div className="bord-done" role="status" aria-live="polite">
      <div className="bord-done-flash" aria-hidden="true" />
      <div className="bord-done-confetti" aria-hidden="true">{bits.map(b => <span key={b.key} style={b.style} />)}</div>
      <div className="bord-done-card">
        <img className="bord-done-fig" src="/the-office.gif" width="220" height="182" alt="" />
        <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '26px', color: '#14603A' }}>Done! Top gedaan</div>
        <div style={{ fontSize: '14px', color: '#3C3C3A' }}>{client} staat op Done voor vandaag</div>
      </div>
    </div>
  );
}

/** A column (or the Afgewezen tile) a dragged card can be dropped on: not the column it's in. */
function drop(b, key) {
  const ok = () => b.dragFrom && b.dragFrom !== key;
  return {
    onDragOver: e => { if (!ok()) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (b.over !== key) b.setOver(key); },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget) && b.over === key) b.setOver(null); },
    onDrop: e => { if (!ok()) return; e.preventDefault(); b.drop(key); }
  };
}

export default function BoardView({ b }) {
  if (b.empty) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ margin: '0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', letterSpacing: '-.02em' }}>Bord</h1>
      <div style={{ background: '#FFFFFF', border: '1px dashed #C0BDB9', borderRadius: '12px', padding: '22px 24px', fontSize: '14px', color: '#5C5C5A' }}>{b.emptyText}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '0' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>{b.today} · belronde</div>
          <h1 style={{ margin: '0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>{b.client}</h1>
          <div style={{ color: '#5C5C5A', fontSize: '15px' }}>{b.subline}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ position: 'relative', display: 'flex', flex: '1 1 200px', minWidth: '0' }}>
            <span style={{ position: 'absolute', left: '-9999px' }}>Zoek een kandidaat op dit bord</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8C8C8A" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '12px', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" value={b.search.q} onChange={b.search.set} onKeyDown={e => { if (e.key === 'Escape' && b.search.q) { e.preventDefault(); b.search.clear(); } }}
              placeholder="Zoek kandidaat…" style={{ ...field, width: '100%', paddingLeft: '36px', fontSize: '14px' }} />
          </label>
          {b.clientOpts.length > 1 ? <select value={b.clientValue} onChange={b.setClient} aria-label="Klant" style={{ ...field, fontSize: '14px' }}>
              {b.clientOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select> : null}
          <StatusPill r={b.status} />
        </div>
      </header>

      {b.tabs.length > 1 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', background: '#F5F2ED', borderRadius: '999px', padding: '4px', alignSelf: 'flex-start' }}>
          {b.tabs.map(t => <button key={t.id} type="button" onClick={t.onClick} aria-pressed={t.on} style={{ border: '0', borderRadius: '999px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#1D1D1B', background: t.on ? '#FFFFFF' : 'transparent', fontWeight: t.on ? '600' : '400', boxShadow: t.on ? '0 1px 4px rgba(29,29,27,.07)' : 'none' }}>
              {t.label} <span style={{ color: '#5C5C5A', fontWeight: '400' }}>{t.n}</span>
            </button>)}
        </div> : null}

      {b.err ? <div style={{ background: '#FDECEA', color: '#D32F2F', borderRadius: '12px', padding: '12px 16px', fontSize: '14px' }}>{b.err}</div> : null}

      {b.search.text ? <div role="status" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '13px', color: '#3C3C3A' }}>
          <span>{b.search.text}</span>
          <button type="button" onClick={b.search.clear} className="link-btn" style={{ textDecoration: 'underline' }}>Zoeken wissen</button>
        </div> : null}

      <div>
        <div style={{ minWidth: '0', overflowX: 'auto', paddingBottom: '8px' }}>
          {b.loading ? <div style={{ fontSize: '14px', color: '#5C5C5A', padding: '12px 0' }}>Kandidaten laden…</div> : null}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', width: 'max-content' }}>
            {b.cols.map(col => <section key={col.key} aria-label={`${col.label}, ${col.n}`} {...drop(b, col.key)}
                style={{ width: '212px', boxSizing: 'border-box', background: b.over === col.key ? '#E7E7F0' : '#F5F2ED', outline: b.over === col.key ? '2px dashed #1B1B63' : 'none', outlineOffset: '-2px', borderRadius: '14px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '420px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px 6px' }}>
                  <span style={{ ...eyebrow, color: '#3C3C3A' }}>{col.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#5C5C5A' }}>{col.n}</span>
                </div>
                {col.cards.map(c => <Card key={c.id} c={c} />)}
              </section>)}
            <button type="button" onClick={b.rejected.toggle} aria-pressed={b.rejected.open} {...drop(b, 'afgewezen')} style={{ width: '150px', boxSizing: 'border-box', border: `1.5px dashed ${b.over === 'afgewezen' ? '#D32F2F' : '#C0BDB9'}`, background: b.over === 'afgewezen' ? '#FDECEA' : b.rejected.open ? '#F5F2ED' : 'transparent', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left', color: '#5C5C5A', cursor: 'pointer' }}>
              <span style={eyebrow}>Afgewezen</span>
              <span style={{ fontFamily: 'Poppins,sans-serif', fontSize: '24px', fontWeight: '600', color: '#3C3C3A' }}>{b.rejected.n}</span>
              <span style={{ fontSize: '12px' }}>{b.rejected.open ? 'Verbergen' : 'Laatste 4 weken · tonen'}</span>
            </button>
          </div>
        </div>
      </div>
      {b.panel ? <Panel p={b.panel} /> : null}
      {b.celebrate ? <Celebrate key={b.celebrate.at} client={b.celebrate.client} /> : null}
      {/* While dragging, rejecting is always in reach, also when the Afgewezen tile is scrolled out of view. */}
      {b.dragFrom && b.dragFrom !== 'afgewezen' ? <div {...drop(b, 'afgewezen')} style={{ position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: '20', width: 'min(420px,calc(100vw - 32px))', boxSizing: 'border-box',
          padding: '18px 20px', borderRadius: '14px', border: '2px dashed #D32F2F', background: b.over === 'afgewezen' ? '#FBD5D2' : '#FDECEA', color: '#D32F2F', fontSize: '14px', fontWeight: '600', textAlign: 'center', boxShadow: '0 8px 32px rgba(29,29,27,.15)' }}>
          Sleep hierheen om af te wijzen
        </div> : null}
    </div>
  );
}
