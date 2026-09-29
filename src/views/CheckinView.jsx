import React from 'react';
import Button from '../components/Button.jsx';

export default function CheckinView({ v }) {
  const { decLeads, fc, form, goMine, hasForm, incLeads, needsBg, needsKnob, queue, queueComplete, queueDone, queueOpen, queuePct, queueTotal, saveForm, saveLabel, scoreBtns, setLeads, setNote, setRecText, toggleNeeds, wk } = v;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header>
        <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Wekelijkse feedback recruiter · week {wk.n}</div>
        <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Mijn feedback</h1>
        <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px' }}>Jouw beeld van de instroom per campagne. Klantfeedback wordt apart vastgelegd door de Recruitment Marketeer.</div>
      </header>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', maxWidth: '320px', background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #E4E1DE', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '15px' }}>Mijn campagnes</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#5C5C5A' }}>
              <span>{queueDone} van {queueTotal} ingevuld</span>
              <span>{queueOpen} open</span>
            </div>
            <div style={{ height: '6px', borderRadius: '999px', background: '#F5F2ED', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: queuePct, background: 'linear-gradient(135deg,#F9CE00 0%,#FB8915 100%)' }} />
            </div>
          </div>
          {queue.map((qi, i) => <button key={i} onClick={qi.onClick} style={{ width: '100%', border: '0', borderBottom: '1px solid #F5F2ED', background: qi.bg, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: '22px', height: '22px', flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', background: qi.markBg, color: qi.markFg, border: qi.markBorder }}>{qi.mark}</span>
              <span style={{ minWidth: '0', flex: '1' }}>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: '600' }}>{qi.client}</span>
                <span style={{ display: 'block', fontSize: '12px', color: '#5C5C5A' }}>{qi.vac}</span>
              </span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: qi.qFg }}>{qi.qText}</span>
            </button>)}
        </div>
        <div style={{ flex: '3 1 480px', minWidth: '0' }}>
          {hasForm ? <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', boxShadow: '0 2px 8px rgba(29,29,27,.09)' }}>
              <div style={{ padding: '24px 28px', borderBottom: '1px solid #E4E1DE' }}>
                <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '22px', lineHeight: '1.3' }}>Week {wk.n} – {fc.client} – {fc.vac}</div>
                <div style={{ marginTop: '6px', fontSize: '13px', color: '#5C5C5A', textWrap: 'pretty' }}>Vorige week: {fc.prevLine}</div>
              </div>
              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600' }}>Nieuwe kandidaten deze week</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E4E1DE', borderRadius: '8px', overflow: 'hidden' }}>
                      <button onClick={decLeads} style={{ width: '44px', height: '44px', border: '0', background: '#F5F2ED', fontSize: '18px', cursor: 'pointer' }}>−</button>
                      <input value={form.leads ?? ''} onChange={setLeads} inputMode="numeric" style={{ width: '64px', height: '44px', border: '0', textAlign: 'center', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '18px' }} />
                      <button onClick={incLeads} style={{ width: '44px', height: '44px', border: '0', background: '#F5F2ED', fontSize: '18px', cursor: 'pointer' }}>+</button>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500', padding: '5px 10px', borderRadius: '6px', background: fc.trBg, color: fc.trFg }}>{fc.trText}</span>
                  </div>
                  {fc.hasRej ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#5C5C5A', marginRight: '4px' }}>Afgewezen deze week · uit Trello</span>
                      {fc.rej.map((rs, i) => <span key={i} style={{ fontSize: '12px', padding: '3px 9px', borderRadius: '999px', background: '#FDECEA', color: '#3C3C3A', display: 'inline-flex', gap: '5px' }}>{rs.t} <strong>{rs.n}</strong></span>)}
                    </div> : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600' }}>Kwaliteit instroom</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10,minmax(36px,1fr))', gap: '6px', maxWidth: '560px' }}>
                    {scoreBtns.map((s, i) => <button key={i} onClick={s.onClick} style={{ height: '44px', borderRadius: '8px', border: `1px solid ${s.border}`, background: s.bg, color: s.fg, fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '16px', cursor: 'pointer', transition: 'all 120ms' }}>{s.n}</button>)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '560px', fontSize: '12px', color: '#8C8C8A' }}>
                    <span>Slecht</span>
                    <span>Uitstekend</span>
                  </div>
                  {form.err ? <div style={{ fontSize: '13px', color: '#D32F2F' }}>Kies een kwaliteitsscore om op te slaan.</div> : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#1B1B63' }} />Feedback recruitment</label>
                  <textarea value={form.rec ?? ''} onChange={setRecText} rows="4" placeholder="Wat zie en hoor jij bij de instroom en de kandidaten?" style={{ border: '1px solid #E4E1DE', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', lineHeight: '1.5', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600' }}>Eventuele actie / notitie</label>
                  <textarea value={form.note ?? ''} onChange={setNote} rows="2" placeholder="Optioneel" style={{ border: '1px solid #E4E1DE', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', lineHeight: '1.5', resize: 'vertical' }} />
                  <button onClick={toggleNeeds} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '10px', border: '0', background: 'none', padding: '4px 0', cursor: 'pointer', fontSize: '14px' }}><span style={{ width: '36px', height: '20px', borderRadius: '999px', background: needsBg, position: 'relative', flex: 'none', transition: 'background 150ms' }}>
                      <span style={{ position: 'absolute', top: '2px', left: needsKnob, width: '16px', height: '16px', borderRadius: '50%', background: '#FFFFFF', transition: 'left 150ms' }} />
                    </span> Bijsturing nodig <span style={{ color: '#8C8C8A', fontSize: '13px' }}>– zet campagne op Actie nodig</span></button>
                </div>
              </div>
              <div style={{ padding: '16px 28px', borderTop: '1px solid #E4E1DE', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: '#FDFBF8', borderRadius: '0 0 12px 12px' }}>
                <span style={{ fontSize: '12px', color: '#8C8C8A' }}>Toets 1–0 voor de score · Ctrl/⌘ + Enter om op te slaan</span>
                <Button variant="primary" size="lg" onClick={saveForm}>{saveLabel}</Button>
              </div>
            </div> : null}
          {queueComplete ? <div style={{ background: '#E6F4ED', borderRadius: '12px', padding: '20px 24px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '17px', color: '#1A7A4A' }}>Alles ingevuld voor week {wk.n}</div>
                <div style={{ fontSize: '13px', color: '#3C3C3A' }}>Je kunt eerdere check-ins nog aanpassen in de lijst.</div>
              </div>
              <Button variant="accent" onClick={goMine}>Naar mijn campagnes</Button>
            </div> : null}
        </div>
      </div>
    </div>
  );
}
