import React from 'react';
import { StatusPill } from './LiveView.jsx';

// Kandidaten › Bord: the candidates of one campaign switched to the ATS, in columns like the Trello board, with a panel
// next to it for the candidate you clicked. Every action goes to the server (App.bordAct); see lib/ats.js. Cards can
// be dragged to another column, or onto the Afgewezen tile (with a mouse; on a phone Verplaatsen naar does the same).
const eyebrow = { fontSize: '11px', fontWeight: '600', letterSpacing: '.08em', textTransform: 'uppercase', color: '#5C5C5A' };
const plainBtn = { height: '40px', padding: '0 14px', border: '1px solid #E4E1DE', background: '#FFFFFF', borderRadius: '10px', fontSize: '13px', fontWeight: '500', color: '#1B1B63', cursor: 'pointer' };
const outcome = { minHeight: '44px', border: '1px solid #E4E1DE', background: '#FFFFFF', borderRadius: '10px', fontSize: '13px', fontWeight: '600', color: '#1D1D1B', cursor: 'pointer', padding: '0 10px' };
const field = { height: '40px', boxSizing: 'border-box', border: '1px solid #E4E1DE', borderRadius: '10px', padding: '0 12px', fontSize: '14px', background: '#FFFFFF', minWidth: '0' };

function Card({ c }) {
  return (
    <button type="button" onClick={c.onClick} aria-pressed={c.sel} aria-label={c.label} draggable="true"
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); c.dragStart(); }} onDragEnd={c.dragEnd}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: '12px', cursor: 'grab', background: '#FFFFFF', color: '#1D1D1B',
      border: c.sel ? '2px solid #1B1B63' : '1px solid #E4E1DE', boxShadow: c.sel ? '0 4px 16px rgba(27,27,99,.16)' : '0 1px 2px rgba(29,29,27,.05)', opacity: c.dragging ? 0.4 : c.dim ? 0.6 : 1 }}>
      <span style={{ fontSize: '14px', fontWeight: '600' }}>{c.name}</span>
      {c.tag ? <span style={{ alignSelf: 'flex-start', fontSize: '11px', fontWeight: '600', color: '#B45309', background: '#FEF3C7', borderRadius: '6px', padding: '2px 7px' }}>{c.tag}</span> : null}
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

function Panel({ p }) {
  return (
    <aside aria-label={`Kandidaat ${p.name}`} style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '16px', display: 'flex', flexDirection: 'column', position: 'sticky', top: '16px' }}>
      <div style={{ padding: '22px 24px 18px', display: 'flex', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid #E4E1DE' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '0' }}>
          <h2 style={{ margin: '0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '22px', lineHeight: '1.2' }}>{p.name}</h2>
          <div style={{ fontSize: '13px', color: '#5C5C5A' }}>{p.sub}</div>
        </div>
        <button type="button" onClick={p.close} aria-label="Paneel sluiten" style={{ flex: 'none', alignSelf: 'flex-start', width: '36px', height: '36px', border: '0', background: 'none', borderRadius: '8px', cursor: 'pointer', color: '#5C5C5A' }}>
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

      {p.canUndo ? <div style={{ margin: '14px 24px 0', padding: '10px 14px', background: '#E7E7F0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#1B1B63' }}>
          <span>{p.undoText}</span>
          <button type="button" onClick={p.undo} disabled={p.busy} style={{ border: '0', background: 'none', padding: '0', fontSize: '13px', fontWeight: '600', color: '#1B1B63', textDecoration: 'underline', cursor: 'pointer' }}>Ongedaan maken</button>
        </div> : null}

      {p.isCall ? <div style={{ margin: '14px 24px 0', padding: '16px', background: '#FFF8E0', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '8px' }}>
              <button type="button" onClick={p.geenGehoor} disabled={p.busy} style={outcome}>Geen gehoor</button>
              <button type="button" onClick={p.startTba} disabled={p.busy} style={outcome}>TBA afspraak</button>
              <button type="button" onClick={p.bereikt} disabled={p.busy} style={{ ...outcome, background: '#1B1B63', color: '#FFFFFF', border: '0' }}>Bereikt · gescreend</button>
              <button type="button" onClick={p.startReject} disabled={p.busy} style={{ ...outcome, color: '#D32F2F', borderColor: '#F3C2C2' }}>Niet geschikt</button>
              {p.canNb ? <button type="button" onClick={p.toNb} disabled={p.busy} style={{ ...outcome, gridColumn: '1 / -1', borderColor: '#FB8915', color: '#B45309' }}>{p.nbText}</button> : null}
            </div>}
        </div> : null}

      {p.mode === 'reject' && !p.isCall ? <div style={{ margin: '14px 24px 0', padding: '16px', background: '#FDECEA', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
        {p.canReject && !p.isCall ? <button type="button" onClick={p.startReject} style={{ ...plainBtn, color: '#D32F2F', borderColor: '#F3C2C2' }}>Afwijzen</button> : null}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5C5C5A' }}>
          <span style={{ position: 'absolute', left: '-9999px' }}>Verplaatsen naar</span>
          <select value="" onChange={p.move} disabled={p.busy} aria-label="Verplaatsen naar" style={{ ...field, color: '#1B1B63', fontWeight: '500', fontSize: '13px' }}>
            <option value="">Verplaatsen naar…</option>
            {p.moveOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </label>
      </div>

      {p.answers.length ? <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid #E4E1DE' }}>
          <span style={eyebrow}>Uit het formulier</span>
          {p.answers.map((a, i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
              <span style={{ color: '#5C5C5A' }}>{a.q}</span>
              <span style={{ fontWeight: '500' }}>{a.a}</span>
            </div>)}
        </div> : null}

      <div style={{ padding: '16px 24px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={eyebrow}>Historie</span>
        {p.log.map((h, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr)', gap: '12px', fontSize: '13px' }}>
            <span style={{ color: '#5C5C5A' }}>{h.at}</span>
            <span><span style={{ fontWeight: '600' }}>{h.what}</span> <span style={{ color: '#5C5C5A' }}>· {h.by}</span></span>
          </div>)}
      </div>
    </aside>
  );
}

/**
 * Done, clicked on the Bord: the whole screen flashes green with a beam of light rolling across (as a client row does in
 * Live campagnes), confetti rains down, and a winking face in a party hat gives a thumbs up. Our own drawing, so nothing
 * is loaded from elsewhere. Gone after a few seconds (App.celebrate); it never catches clicks.
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
        <svg className="bord-done-fig" width="220" height="250" viewBox="0 -50 220 250" aria-hidden="true">
          <defs>
            <linearGradient id="bord-done-face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F9CE00" /><stop offset="1" stopColor="#FB8915" /></linearGradient>
          </defs>
          <circle cx="92" cy="100" r="72" fill="url(#bord-done-face)" />
          <circle cx="52" cy="122" r="11" fill="#FB8915" opacity=".45" />
          <circle cx="132" cy="122" r="11" fill="#FB8915" opacity=".45" />
          <ellipse cx="66" cy="86" rx="8" ry="11" fill="#1D1D1B" />
          <ellipse className="bord-done-wink" cx="118" cy="86" rx="8" ry="11" fill="#1D1D1B" />
          <path d="M104 64 q14 -8 28 0" fill="none" stroke="#1D1D1B" strokeWidth="5" strokeLinecap="round" />
          <path d="M56 120 q36 34 72 0" fill="none" stroke="#1D1D1B" strokeWidth="6" strokeLinecap="round" />
          <g className="bord-done-hat">
            <path d="M62 36 L96 -40 L128 34 Z" fill="#1B1B63" />
            <path d="M84 -14 L106 -18 M76 4 L114 -2 M68 22 L122 16" stroke="#F9CE00" strokeWidth="6" strokeLinecap="round" />
            <path d="M58 36 Q95 48 132 34" fill="none" stroke="#FB8915" strokeWidth="8" strokeLinecap="round" />
            <circle cx="96" cy="-42" r="11" fill="#FB8915" />
            <circle cx="92" cy="-46" r="4" fill="#FFE2BD" />
          </g>
          <g className="bord-done-thumb">
            <rect x="150" y="160" width="58" height="16" rx="5" fill="#1B1B63" />
            <rect x="152" y="112" width="54" height="52" rx="13" fill="#FFE2BD" stroke="#1D1D1B" strokeWidth="4" />
            <rect x="158" y="70" width="20" height="50" rx="10" fill="#FFE2BD" stroke="#1D1D1B" strokeWidth="4" />
            <path d="M180 128 h24 M180 141 h24 M180 154 h22" stroke="#1D1D1B" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 480px', minWidth: '0', overflowX: 'auto', paddingBottom: '8px' }}>
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
        {b.panel ? <div style={{ flex: '1 1 360px', minWidth: '0', maxWidth: '440px' }}><Panel p={b.panel} /></div> : null}
      </div>
      {b.celebrate ? <Celebrate key={b.celebrate.at} client={b.celebrate.client} /> : null}
      {/* While dragging, rejecting is always in reach, also when the Afgewezen tile is scrolled out of view. */}
      {b.dragFrom && b.dragFrom !== 'afgewezen' ? <div {...drop(b, 'afgewezen')} style={{ position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: '20', width: 'min(420px,calc(100vw - 32px))', boxSizing: 'border-box',
          padding: '18px 20px', borderRadius: '14px', border: '2px dashed #D32F2F', background: b.over === 'afgewezen' ? '#FBD5D2' : '#FDECEA', color: '#D32F2F', fontSize: '14px', fontWeight: '600', textAlign: 'center', boxShadow: '0 8px 32px rgba(29,29,27,.15)' }}>
          Sleep hierheen om af te wijzen
        </div> : null}
    </div>
  );
}
