import React from 'react';
import Button from '../components/Button.jsx';

export default function RulesView({ v }) {
  const { resetRules, ruleGroups, rulesLocked, sum } = v;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '860px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Instellingen</div>
          <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Campagne health</h1>
          <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px', maxWidth: '560px', textWrap: 'pretty' }}>Eén regel die afgaat zet een campagne op Actie nodig, tot een marketeer hem op Check of In afwachting van klant zet. Rood staat in de lijsten vóór oranje. Wijzigingen gelden direct voor alle schermen.</div>
          {rulesLocked ? <div style={{ marginTop: '12px', display: 'inline-flex', background: '#F5F2ED', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#3C3C3A' }}>Je hebt geen recht om de regels aan te passen.</div> : null}
        </div>
        {!rulesLocked ? <Button variant="ghost" onClick={resetRules}>Standaard herstellen</Button> : null}
      </header>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {sum.levels.map((l, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', padding: '8px 14px', borderRadius: '999px', background: l.bg, color: l.fg, fontWeight: '600' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.fg }} />{l.n} {l.label}</span>)}
      </div>
      {ruleGroups.map((g, i) => <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="rule-head" style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #E4E1DE' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: g.fg }} />
            <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '17px' }}>{g.label}</span>
            <span style={{ fontSize: '13px', color: '#8C8C8A' }}>{g.sub}</span>
          </div>
          {g.rules.map((r, j) => <div key={j} className="rule-row" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 22px', borderTop: '1px solid #F5F2ED', fontSize: '14px', flexWrap: 'wrap' }}>
              <button onClick={r.toggle} disabled={r.locked} style={{ width: '36px', height: '20px', borderRadius: '999px', border: '0', background: r.tBg, position: 'relative', cursor: r.cursor, opacity: r.op, flex: 'none', padding: '0' }}>
                <span style={{ position: 'absolute', top: '2px', left: r.knob, width: '16px', height: '16px', borderRadius: '50%', background: '#FFFFFF', transition: 'left 150ms' }} />
              </button>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', color: r.fg }}>{r.pre}{r.hasVal ? <input value={r.val ?? ''} onChange={r.setVal} disabled={r.locked} type="number" style={{ background: '#FFFFFF', width: '64px', height: '34px', border: '1px solid #E4E1DE', borderRadius: '6px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }} /> : null}{r.post}</span>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#8C8C8A' }}>{r.hits}</span>
            </div>)}
        </div>)}
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
        {[['#B45309', 'In afwachting van klant', 'Gezet door een marketeer als de klant nog iets moet aanleveren, zoals saldo of foto’s. Blijft staan tot iemand het wijzigt.'],
          ['#1A7A4A', 'Check', 'Gezet door een marketeer als de campagne is beoordeeld, of vanzelf als er geen regel afgaat.']].map(([fg, label, sub], i) => <div key={i} className="rule-head" style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: i ? '1px solid #F5F2ED' : '0' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: fg, flex: 'none' }} />
            <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '17px', flex: 'none' }}>{label}</span>
            <span style={{ fontSize: '13px', color: '#8C8C8A' }}>{sub}</span>
          </div>)}
      </div>
    </div>
  );
}
