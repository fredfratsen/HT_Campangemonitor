import React from 'react';
import HaltTag from '../components/HaltTag.jsx';

// Narrow enough to fit next to the menu from 1280 px wide, Status column included.
const COLS = 'minmax(160px,1.4fr) 100px 96px 120px 56px 112px minmax(40px,1fr) 108px';
const ROW = { display: 'grid', gridTemplateColumns: COLS, gap: '14px', alignItems: 'center', cursor: 'pointer', fontSize: '14px' };
const NUM = { textAlign: 'right', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '18px' };

/** The numbers, feedback and bar of a client row or a function row. Open feedback leads to Wekelijkse feedback recruiter. */
function Cells({ r }) {
  return (
    <>
      <div data-label="Nieuw bellen" style={{ ...NUM, color: r.nFg }}>{r.nieuw}</div>
      <div data-label="Contactpogingen" style={{ ...NUM, color: r.cFg }}>{r.contact}</div>
      <div data-label="Totaal" style={NUM}>{r.total}</div>
      <div data-label="Feedback" style={{ fontSize: '13px' }}>
        {r.fbOpen ? <button onClick={r.fill} title="Feedback invullen" style={{ border: '0', background: 'none', padding: '0', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#B45309', textAlign: 'left' }}>{r.fbText} →</button>
          : <span style={{ color: r.fbFg }}>{r.fbText}</span>}
      </div>
      <div style={{ display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden', background: '#F5F2ED' }}>
        <div style={{ width: r.nPct, background: '#1B1B63' }} />
        <div style={{ width: r.cPct, background: '#FB8915' }} />
      </div>
    </>
  );
}

const ST = { bezig: 'Ermee bezig', done: 'Done' };
const NEXT = { '': 'Ermee bezig', bezig: 'Done', done: 'geen status' };

/**
 * The Ermee bezig / Done toggle of a client: nothing → Ermee bezig → Done → nothing. Same size in every state; who set
 * it and when is in the tooltip.
 */
function StatusPill({ r }) {
  const now = r.st ? `${ST[r.st]}, door ${r.stBy} om ${r.stAt}` : 'nog niet opgepakt';
  return (
    <button type="button" className={`live-pill live-pill-${r.st || 'none'}`} onClick={r.setSt} aria-label={`${r.client}: ${now}. Klik voor ${NEXT[r.st]}.`} title={`${r.st ? `${ST[r.st]} · ${r.stBy} ${r.stAt}\n` : ''}Klik voor ${NEXT[r.st]}`}>
      {r.st === 'done' ? <span className="live-check" aria-hidden="true">✓</span> : null}
      {r.st ? ST[r.st] : 'Oppakken'}
    </button>
  );
}

/**
 * One client, and its functions when folded open. Ermee bezig / Done colours the whole block; the colour sweeps in
 * when it changes while the screen is open (also when a colleague changed it), not when the screen opens.
 */
function ClientBlock({ r }) {
  const [prev, setPrev] = React.useState(r.st), [moved, setMoved] = React.useState(false);
  if (prev !== r.st) { setPrev(r.st); setMoved(true); }
  const cls = ['live-block', r.st && `live-st-${r.st}`, moved && 'live-st-anim'].filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ borderBottom: '1px solid #F5F2ED' }}>
      <div className="hov-row live-row" onClick={r.open} aria-expanded={r.multi ? r.expanded : undefined} style={{ ...ROW, padding: '12px 20px' }}>
        <div style={{ minWidth: '0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: r.dot }} />
          <span style={{ minWidth: '0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontWeight: '600' }}>{r.client}{r.hasBadge ? <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 7px', borderRadius: '6px', background: r.bBg, color: r.bFg }}>{r.badge}</span> : null}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: r.multi ? '#1B1B63' : '#5C5C5A', fontWeight: r.multi ? '500' : '400' }}>{r.vac}{r.tag ? <HaltTag t={r.tag} /> : null}{r.multi ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1B1B63" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', transform: r.expanded ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg> : null}</span>
          </span>
        </div>
        <div data-label="Marketeer" style={{ color: '#3C3C3A' }}>{r.mkt}</div>
        <Cells r={r} />
        <div><StatusPill r={r} /></div>
      </div>
      {/* Under a status the function rows take its colour (app.css), instead of their own grey. */}
      {r.fns.map((f, j) => <div key={j} className="hov-row live-row live-fn" onClick={f.open} style={{ ...ROW, padding: '9px 20px', background: r.st ? undefined : '#FAF8F5', borderTop: '1px solid #F5F2ED' }}>
          <div style={{ minWidth: '0', display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '19px', fontSize: '13px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', flex: 'none', background: f.dot }} />
            <span style={{ fontWeight: '500' }}>{f.vac}</span>
            {f.tag ? <HaltTag t={f.tag} /> : null}
          </div>
          <div />
          <Cells r={f} />
          <div />
        </div>)}
    </div>
  );
}

export default function LiveView({ v }) {
  const { goCheckin, live, syncDot, syncText, wk } = v;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>{wk.today}</div>
          <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Live campagnes</h1>
          <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px' }}>Belwerk vandaag voor {live.count} live campagnes · uit Trello</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5C5C5A' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: syncDot }} />{syncText}</div>
      </header>
      {live.hasOpen ? <button onClick={goCheckin} style={{ border: '0', background: '#FFF8E0', borderRadius: '12px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' }}>
          <span style={{ flex: '1', minWidth: '0' }}>
            <strong>{live.openText}</strong>
            {' '}
            <span style={{ color: '#3C3C3A' }}>{live.openSub}</span>
          </span>
          <span style={{ fontWeight: '600', color: '#1B1B63', whiteSpace: 'nowrap' }}>Feedback invullen →</span>
        </button> : null}
      {live.hasChanges ? <div style={{ background: '#FFFFFF', border: '1.5px solid #F9A800', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '17px' }}>{live.chTitle}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#8C8C8A' }}>{live.sinceText}</span>
              <button onClick={live.markSeen} style={{ border: '1px solid #E4E1DE', background: '#FFFFFF', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Gezien</button>
            </span>
          </div>
          {live.changes.map((ch, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: ch.tBg, color: ch.tFg }}>{ch.tag}</span>
              <span>
                <strong>{ch.client}</strong>
                {' '}
                <span style={{ color: '#3C3C3A' }}>{ch.text}</span>
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#8C8C8A' }}>{ch.at}</span>
            </div>)}
        </div> : null}
      {live.isEmpty ? <div style={{ background: '#FFFFFF', border: '1px dashed #C0BDB9', borderRadius: '12px', padding: '22px 24px' }}>
          <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '17px' }}>Nog geen klanten aan jou toegewezen</div>
          <div style={{ fontSize: '14px', color: '#5C5C5A', marginTop: '4px' }}>Zodra de teamlead je aan klanten koppelt via Toewijzing, zie je hier je belwerk van vandaag.</div>
        </div> : null}
      <div className="m-kpis m-kpis-lead" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px' }}>
        {live.kpis.map((k, i) => <div key={i} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: k.lfg }}>{k.label}</div>
            <div style={{ marginTop: '6px', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '34px', lineHeight: '1.1', color: k.fg }}>{k.value}</div>
            <div style={{ fontSize: '12px', color: k.lfg, marginTop: '2px' }}>{k.sub}</div>
          </div>)}
      </div>
      {live.rows.length > 1 ? <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-12px' }}>
          <select value={live.sortValue} onChange={live.setSort} aria-label="Volgorde van de live campagnes" style={{ height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 10px', fontSize: '14px', background: '#FFFFFF' }}>
            {live.sortOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div> : null}
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflowX: 'auto' }}>
        <div className="m-table" style={{ minWidth: '940px' }}>
          <div className="m-thead" style={{ display: 'grid', gridTemplateColumns: COLS, gap: '14px', padding: '12px 20px', fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#8C8C8A', borderBottom: '1px solid #E4E1DE', alignItems: 'end' }}>
            <div>Klant · vacature</div>
            <div>Marketeer</div>
            <div style={{ textAlign: 'right' }}>Nieuw bellen</div>
            <div style={{ textAlign: 'right' }}>Contactpogingen</div>
            <div style={{ textAlign: 'right' }}>Totaal</div>
            <div>Feedback</div>
            <div />
            <div>Status</div>
          </div>
          {/* One row per client; a client with several functions folds open to one row per function. Keyed by
              client, so a row that moves (sort, new numbers) keeps its own colour and doesn't replay the sweep. */}
          {live.rows.map(r => <ClientBlock key={r.key} r={r} />)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#5C5C5A' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#1B1B63' }} />Nieuw: kaarten in ‘Nieuw’ of ‘Nieuwe Sollicitant | …’, nog niet gebeld</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#FB8915' }} />Contactpogingen: kaarten in lijst ‘Contactpoging’, opnieuw bellen</span>
        <span>📵 Kreeg een kaart vandaag ‘Geen gehoor’ in Trello, dan telt hij pas morgen weer mee</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="live-swatch live-swatch-bezig" />Ermee bezig</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="live-swatch live-swatch-done" />Done vandaag · om middernacht begint iedereen weer blanco</span>
      </div>
    </div>
  );
}
