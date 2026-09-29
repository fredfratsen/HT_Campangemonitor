import React from 'react';

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
            <span style={{ color: '#3C3C3A', whiteSpace: 'nowrap' }}>voor week {wk.n}</span>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px' }}>
        {live.kpis.map((k, i) => <div key={i} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: k.lfg }}>{k.label}</div>
            <div style={{ marginTop: '6px', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '34px', lineHeight: '1.1', color: k.fg }}>{k.value}</div>
            <div style={{ fontSize: '12px', color: k.lfg, marginTop: '2px' }}>{k.sub}</div>
          </div>)}
      </div>
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflowX: 'auto' }}>
        <div style={{ minWidth: '560px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.4fr) 96px 120px 64px minmax(0,1fr)', gap: '16px', padding: '12px 20px', fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#8C8C8A', borderBottom: '1px solid #E4E1DE', alignItems: 'end' }}>
            <div>Klant · vacature</div>
            <div style={{ textAlign: 'right' }}>Nieuw bellen</div>
            <div style={{ textAlign: 'right' }}>Contactpogingen</div>
            <div style={{ textAlign: 'right' }}>Totaal</div>
            <div />
          </div>
          {live.rows.map((r, i) => <div key={i} className="hov-row" onClick={r.open} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.4fr) 96px 120px 64px minmax(0,1fr)', gap: '16px', padding: '12px 20px', borderBottom: '1px solid #F5F2ED', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
              <div style={{ minWidth: '0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: r.dot }} />
                <span style={{ minWidth: '0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontWeight: '600' }}>{r.client}{r.hasBadge ? <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 7px', borderRadius: '6px', background: r.bBg, color: r.bFg }}>{r.badge}</span> : null}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: '#5C5C5A' }}>{r.vac}</span>
                </span>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '18px', color: r.nFg }}>{r.nieuw}</div>
              <div style={{ textAlign: 'right', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '18px', color: r.cFg }}>{r.contact}</div>
              <div style={{ textAlign: 'right', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '18px' }}>{r.total}</div>
              <div style={{ display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden', background: '#F5F2ED' }}>
                <div style={{ width: r.nPct, background: '#1B1B63' }} />
                <div style={{ width: r.cPct, background: '#FB8915' }} />
              </div>
            </div>)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#5C5C5A' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#1B1B63' }} />Nieuw: kaarten in lijst ‘Nieuw’, nog niet gebeld</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#FB8915' }} />Contactpogingen: kaarten in lijst ‘Contactpoging’, opnieuw bellen</span>
      </div>
    </div>
  );
}
