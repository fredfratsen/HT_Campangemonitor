import React from 'react';
import Button from '../components/Button.jsx';
import useCenterCurrent from '../lib/useCenterCurrent.js';

export default function KlantView({ v }) {
  const { hasKform, kc, kform, kq, saveKlant, setKformText, skipKlant, wk } = v;
  const listRef = useCenterCurrent(kform.id);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header>
        <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Feedback klant · week {wk.n}</div>
        <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Feedback klant</h1>
        <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px' }}>Optioneel. Vul alleen in wanneer een klant iets heeft teruggekoppeld. Wordt apart bewaard van de feedback van de recruiter.</div>
      </header>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="q-card" style={{ flex: '1 1 260px', maxWidth: '320px', background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #E4E1DE', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', color: '#5C5C5A' }}>{kq.doneText}</div>
          </div>
          <div className="q-list" ref={listRef} style={{ maxHeight: '640px', overflowY: 'auto' }}>
            {kq.items.map((qi, i) => <button key={i} onClick={qi.onClick} aria-current={qi.sel ? 'true' : undefined} style={{ width: '100%', border: '0', borderBottom: '1px solid #F5F2ED', background: qi.bg, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: '22px', height: '22px', flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', background: qi.markBg, color: '#1A7A4A', border: qi.markBorder }}>{qi.mark}</span>
                <span style={{ minWidth: '0', flex: '1' }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: '600' }}>{qi.client}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: '#5C5C5A' }}>{qi.vac}</span>
                </span>
              </button>)}
          </div>
        </div>
        <div style={{ flex: '3 1 480px', minWidth: '0' }}>
          {hasKform ? <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', boxShadow: '0 2px 8px rgba(29,29,27,.09)' }}>
              <div className="f-pad" style={{ padding: '24px 28px', borderBottom: '1px solid #E4E1DE' }}>
                <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '22px', lineHeight: '1.3' }}>Week {wk.n} – {kc.client} – {kc.vac}</div>
                <div style={{ marginTop: '6px', fontSize: '13px', color: '#5C5C5A' }}>Recruiter {kc.rec} · {kc.leads} kandidaten deze week</div>
              </div>
              <div className="f-pad" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <div style={{ background: '#FDFBF8', borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#5C5C5A' }}><span style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#1B1B63' }} />Feedback recruitment · {kc.qText}</span>
                  <span style={{ fontSize: '14px', lineHeight: '1.5', color: kc.recColor }}>{kc.recText}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#FB8915' }} />Feedback vanuit klant <span style={{ fontWeight: '400', color: '#8C8C8A' }}>(optioneel)</span></label>
                  <textarea value={kform.klant ?? ''} onChange={setKformText} rows="5" placeholder="Wat geeft de klant terug over de kandidaten en gesprekken?" style={{ border: '1px solid #E4E1DE', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', lineHeight: '1.5', resize: 'vertical' }} />
                  <span style={{ fontSize: '12px', color: '#8C8C8A' }}>Vorige week van klant: {kc.prevKlant}</span>
                </div>
              </div>
              <div className="f-foot" style={{ padding: '16px 28px', borderTop: '1px solid #E4E1DE', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: '#FDFBF8', borderRadius: '0 0 12px 12px' }}>
                <span className="kbd-hint" style={{ fontSize: '12px', color: '#8C8C8A' }}>Ctrl/⌘ + Enter om op te slaan</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Button variant="ghost" size="lg" onClick={skipKlant}>Geen feedback deze week</Button>
                  <Button variant="primary" size="lg" onClick={saveKlant}>Opslaan</Button>
                </div>
              </div>
            </div> : null}
        </div>
      </div>
    </div>
  );
}
