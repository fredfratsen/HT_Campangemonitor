import React from 'react';
import Button from '../components/Button.jsx';

export default function HistoryView({ v }) {
  const { effects, exportCsv, hist, histCols, histKpis, histN, histRows, histWeeks, recOptions, setHistPeriod, setHistRec, setHistStatus, wk } = v;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>{wk.histRange}</div>
          <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Historie & analyse</h1>
        </div>
        <div className="m-filters" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={hist.status ?? ''} onChange={setHistStatus} style={{ height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 10px', fontSize: '14px', background: '#FFFFFF' }}>
            <option value="all">Alle campagnes</option>
            <option value="active">Actief</option>
            <option value="ended">Afgerond</option>
          </select>
          <select value={hist.rec ?? ''} onChange={setHistRec} style={{ height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 10px', fontSize: '14px', background: '#FFFFFF' }}>
            {recOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <select value={hist.period ?? ''} onChange={setHistPeriod} style={{ height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 10px', fontSize: '14px', background: '#FFFFFF' }}>
            <option value="12">Laatste 12 weken</option>
            <option value="8">Laatste 8 weken</option>
            <option value="4">Laatste 4 weken</option>
          </select>
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
        </div>
      </header>
      <div className="m-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
        {histKpis.map((k, i) => <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>{k.label}</div>
            <div style={{ marginTop: '6px', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '26px', lineHeight: '1.1' }}>{k.value}</div>
          </div>)}
      </div>
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflowX: 'auto' }}>
        <div className="m-table" style={{ minWidth: '1000px', padding: '8px 0' }}>
          <div className="hist-head" style={{ display: 'grid', gridTemplateColumns: `minmax(230px,1.6fr) minmax(0,${histCols}) 64px 64px 64px 56px`, gap: '12px', padding: '10px 20px', fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#8C8C8A', alignItems: 'end' }}>
            <div>Kwaliteit per week</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${histN},minmax(0,1fr))`, gap: '3px' }}>
              {histWeeks.map((w, i) => <div key={i} style={{ textAlign: 'center' }}>{w}</div>)}
            </div>
            <div style={{ textAlign: 'right' }}>Instroom</div>
            <div style={{ textAlign: 'right' }}>Gem. kw.</div>
            <div style={{ textAlign: 'right' }}>Geplaatst</div>
            <div style={{ textAlign: 'right' }}>Acties</div>
          </div>
          {histRows.map((r, i) => <div key={i} className="hov-row hist-row" onClick={r.open} style={{ display: 'grid', gridTemplateColumns: `minmax(230px,1.6fr) minmax(0,${histCols}) 64px 64px 64px 56px`, gap: '12px', padding: '6px 20px', alignItems: 'center', cursor: 'pointer', fontSize: '13px' }}>
              <div style={{ minWidth: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', flex: 'none', background: r.dot }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong>{r.client}</strong>
                  {' '}
                  <span style={{ color: '#5C5C5A' }}>– {r.vac}</span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${histN},minmax(0,1fr))`, gap: '3px' }}>
                {r.cells.map((x, j) => <div key={j} style={{ height: '30px', borderRadius: '5px', background: x.bg, color: x.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', position: 'relative' }}>{x.t}{x.act ? <span style={{ position: 'absolute', top: '3px', right: '3px', width: '5px', height: '5px', borderRadius: '1px', background: '#FB8915', transform: 'rotate(45deg)' }} /> : null}</div>)}
              </div>
              <div data-label="Instroom" style={{ textAlign: 'right', fontWeight: '600' }}>{r.total}</div>
              <div data-label="Gem. kw." style={{ textAlign: 'right', fontWeight: '600', color: r.avgFg }}>{r.avg}</div>
              <div data-label="Geplaatst" style={{ textAlign: 'right' }}>{r.placed}</div>
              <div data-label="Acties" style={{ textAlign: 'right', color: '#5C5C5A' }}>{r.acts}</div>
            </div>)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#5C5C5A', marginTop: '-10px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#E6F4ED' }} />7–10</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#FEF3C7' }} />5–6</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#FDECEA' }} />1–4</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '6px', height: '6px', borderRadius: '1px', background: '#FB8915', transform: 'rotate(45deg)' }} />Campagnewijziging</span>
      </div>
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ margin: '0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '20px' }}>Wat gebeurde er na een wijziging?</h2>
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflowX: 'auto' }}>
          <div className="m-table" style={{ minWidth: '860px' }}>
            <div className="m-thead" style={{ display: 'grid', gridTemplateColumns: '56px minmax(200px,1.2fr) 110px minmax(220px,2fr) 150px 150px', gap: '14px', padding: '12px 20px', fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#8C8C8A', borderBottom: '1px solid #E4E1DE' }}>
              <div>Week</div>
              <div>Campagne</div>
              <div>Type</div>
              <div>Wijziging</div>
              <div>Kwaliteit vóór → na</div>
              <div>Instroom vóór → na</div>
            </div>
            {effects.map((e, i) => <div key={i} className="hov-row eff-row" onClick={e.open} style={{ display: 'grid', gridTemplateColumns: '56px minmax(200px,1.2fr) 110px minmax(220px,2fr) 150px 150px', gap: '14px', padding: '12px 20px', borderBottom: '1px solid #F5F2ED', fontSize: '13px', alignItems: 'baseline', cursor: 'pointer' }}>
                <div style={{ fontWeight: '600' }}>W{e.wl}</div>
                <div>
                  <strong>{e.client}</strong>
                  <div style={{ color: '#5C5C5A' }}>{e.vac}</div>
                </div>
                <div style={{ color: '#3C3C3A' }}>{e.type}</div>
                <div style={{ lineHeight: '1.45' }}>{e.text}</div>
                <div data-label="Kwaliteit vóór → na">
                  <span>{e.q}</span>
                  {' '}
                  <span style={{ fontWeight: '600', color: e.qFg }}>{e.qd}</span>
                </div>
                <div data-label="Instroom vóór → na">
                  <span>{e.l}</span>
                  {' '}
                  <span style={{ fontWeight: '600', color: '#5C5C5A' }}>{e.ld}</span>
                </div>
              </div>)}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: '#8C8C8A' }}>Vóór = gemiddelde van de 2 weken vóór de wijziging. Na = gemiddelde van de 2 weken erna.</div>
      </section>
    </div>
  );
}
