import React from 'react';
import Button from '../components/Button.jsx';

export default function DetailView({ v }) {
  const { act, addAction, ask, askQuestion, backLabel, canActions, canAsk, d, goBack, setActText, setActType, setActWeek, setAskText, setAskTo, showTrello, zone } = v;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <button onClick={goBack} style={{ alignSelf: 'flex-start', border: '0', background: 'none', padding: '0', fontSize: '13px', fontWeight: '500', color: '#5C5C5A', cursor: 'pointer' }}>← {backLabel}</button>
        <div className="m-cta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '0' }}>
            <div style={{ fontSize: '15px', color: '#5C5C5A' }}>{d.client}</div>
            <h1 style={{ margin: '2px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '36px', lineHeight: '1.15', letterSpacing: '-.02em' }}>{d.vac}</h1>
            <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', padding: '5px 10px', borderRadius: '6px', background: d.sBg, color: d.sFg }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.sFg }} />{d.statusLabel}</span>
              {d.reasons.map((r, i) => <span key={i} style={{ fontSize: '12px', fontWeight: '500', padding: '4px 8px', borderRadius: '6px', background: '#F5F2ED', color: '#3C3C3A' }}>{r.t}</span>)}
              <span style={{ fontSize: '13px', color: '#8C8C8A', marginLeft: '6px' }}>Recruiter {d.rec} · Marketeer {d.mkt} · gestart week {d.startLabel}</span>
            </div>
          </div>
          {d.hasFill ? <Button variant="primary" onClick={d.fill}>{d.fillLabel}</Button> : null}
        </div>
      </div>
      <div className="m-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
        {d.kpis.map((k, i) => <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>{k.label}</div>
            <div style={{ marginTop: '6px', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '26px', lineHeight: '1.1' }}>{k.value}<span style={{ fontSize: '15px', color: '#8C8C8A', fontWeight: '500' }}> {k.unit}</span></div>
          </div>)}
      </div>
      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: '16px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '16px' }}>Instroom per week</span>
            <span style={{ fontSize: '12px', color: '#8C8C8A' }}>kandidaten · bron Trello</span>
          </div>
          <div style={{ display: 'flex', height: '170px', borderBottom: '1px solid #E4E1DE' }}>
            {d.chart.map((b, i) => <div key={i} style={{ flex: '1', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', padding: '0 4px' }}>
                {b.act ? <div style={{ position: 'absolute', top: '0', bottom: '0', left: '0', borderLeft: '1.5px dashed #FB8915' }} /> : null}
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#3C3C3A' }}>{b.leads}</span>
                <div style={{ width: '100%', maxWidth: '34px', height: b.lh, background: b.lbg, borderRadius: '5px 5px 0 0' }} />
              </div>)}
          </div>
          <div style={{ display: 'flex', marginTop: '-6px' }}>
            {d.chart.map((b, i) => <div key={i} style={{ flex: '1', textAlign: 'center', fontSize: '11px', color: '#8C8C8A' }}>{b.label}</div>)}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '16px' }}>Kwaliteit per week</span>
            <span style={{ fontSize: '12px', color: '#8C8C8A' }}>score 1–10 · recruiter</span>
          </div>
          <div style={{ position: 'relative', height: '170px', borderBottom: '1px solid #E4E1DE' }}>
            <div style={{ position: 'absolute', left: '0', right: '0', bottom: '0', height: zone.red, background: '#FDECEA', opacity: '.6' }} />
            <div style={{ position: 'absolute', left: '0', right: '0', top: '0', height: zone.green, background: '#E6F4ED', opacity: '.7' }} />
            <div style={{ position: 'absolute', inset: '0', display: 'flex' }}>
              {d.chart.map((b, i) => <div key={i} style={{ flex: '1', position: 'relative' }}>
                  {b.act ? <div style={{ position: 'absolute', top: '0', bottom: '0', left: '0', borderLeft: '1.5px dashed #FB8915' }} /> : null}
                </div>)}
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'visible' }}>
              <polyline points={d.qPoints} fill="none" stroke="#1B1B63" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
            {d.qDots.map((p, i) => <div key={i} style={{ position: 'absolute', left: p.x, bottom: p.y, transform: 'translate(-50%,50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FFFFFF', border: `2.5px solid ${p.fg}` }} />
                <span style={{ position: 'absolute', bottom: '14px', fontSize: '12px', fontWeight: '600', color: p.fg }}>{p.q}</span>
              </div>)}
          </div>
          <div style={{ display: 'flex', marginTop: '-6px' }}>
            {d.chart.map((b, i) => <div key={i} style={{ flex: '1', textAlign: 'center', fontSize: '11px', color: '#8C8C8A' }}>{b.label}</div>)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#5C5C5A', marginTop: '-16px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '0', height: '12px', borderLeft: '1.5px dashed #FB8915' }} />Campagnewijziging</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', background: '#E6F4ED' }} />
          <span>{zone.greenText}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', background: '#FDECEA' }} />
          <span>{zone.redText}</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 560px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h2 style={{ margin: '0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '20px' }}>Verloop per week</h2>
          {d.story.map((s, i) => <div key={i} className="story-row" style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr)', gap: '14px' }}>
              <div className="story-wk" style={{ paddingTop: '16px' }}>
                <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '15px' }}>Week {s.wl}</div>
                <div style={{ fontSize: '12px', color: '#8C8C8A' }}>{s.range}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '600', fontSize: '15px' }}>{s.leads} kandidaten</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', padding: '3px 9px', borderRadius: '6px', background: s.qBg, color: s.qFg }}>{s.qText}</span>
                    {s.showTr ? <span style={{ fontSize: '12px', color: '#8C8C8A' }}>Trello: {s.trText}</span> : null}
                    {s.needsAction ? <span style={{ fontSize: '12px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: '#FDECEA', color: '#D32F2F' }}>Bijsturing gevraagd</span> : null}
                  </div>
                  {s.missing ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '14px', color: '#B45309' }}>
                      <span>Recruiter heeft voor deze week nog geen feedback ingevuld.</span>
                      {s.canFill ? <button onClick={s.fill} style={{ border: '1px solid #E4E1DE', background: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', color: '#1D1D1B' }}>Nu invullen</button> : null}
                    </div> : null}
                  {s.hasFb ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#5C5C5A' }}><span style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#1B1B63' }} />Recruitment</span>
                        <span style={{ fontSize: '14px', lineHeight: '1.5', textWrap: 'pretty' }}>{s.rec}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#5C5C5A' }}><span style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#FB8915' }} />Klant</span>
                        <span style={{ fontSize: '14px', lineHeight: '1.5', textWrap: 'pretty', color: s.klantColor }}>{s.klant}</span>
                        {s.canAddKlant ? <button onClick={s.addKlant} style={{ alignSelf: 'flex-start', border: '0', background: 'none', padding: '0', fontSize: '13px', fontWeight: '500', color: '#1B1B63', cursor: 'pointer' }}>+ Klantfeedback toevoegen</button> : null}
                      </div>
                    </div> : null}
                  {s.hasReasons ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', borderTop: '1px solid #F5F2ED', paddingTop: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#5C5C5A', marginRight: '4px' }}>Afgewezen ({s.rejN}) · reden uit Trello</span>
                      {s.reasons.map((rs, j) => <span key={j} style={{ fontSize: '12px', padding: '3px 9px', borderRadius: '999px', background: '#FDECEA', color: '#3C3C3A', display: 'inline-flex', gap: '5px' }}>{rs.t} <strong>{rs.n}</strong></span>)}
                    </div> : null}
                  {s.hasNote ? <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#3C3C3A', borderTop: '1px solid #F5F2ED', paddingTop: '10px' }}><strong>Actie / notitie:</strong> {s.note}</div> : null}
                </div>
                {s.acts.map((a, j) => <div key={j} style={{ display: 'flex', gap: '10px', alignItems: 'baseline', background: '#FFF8E0', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', lineHeight: '1.45' }}>
                    <span style={{ flex: 'none', width: '8px', height: '8px', borderRadius: '2px', background: 'linear-gradient(135deg,#F9CE00 0%,#FB8915 100%)', transform: 'rotate(45deg) translateY(-1px)' }} />
                    <span><strong>Campagnewijziging · {a.type}</strong> — {a.text}</span>
                  </div>)}
              </div>
            </div>)}
        </div>
        <div className="detail-side" style={{ flex: '1 1 300px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {canAsk ? <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '16px' }}>Vraag stellen</span>
                <span style={{ fontSize: '12px', color: '#8C8C8A', lineHeight: '1.45' }}>Over deze campagne. Het antwoord komt binnen onder Meldingen.</span>
              </div>
              {ask.hasOpts ? <>
                  <select value={ask.to} onChange={setAskTo} aria-label="Aan" style={{ height: '38px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 8px', fontSize: '13px', background: '#FFFFFF' }}>
                    {ask.opts.map((o, i) => <option key={i} value={o.v}>Aan: {o.l}</option>)}
                  </select>
                  <textarea value={ask.text ?? ''} onChange={setAskText} rows="3" placeholder="Wat wil je weten?" style={{ border: '1px solid #E4E1DE', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', lineHeight: '1.45', resize: 'vertical' }} />
                  <Button variant="primary" size="sm" onClick={askQuestion}>Versturen</Button>
                </> : <div style={{ fontSize: '13px', color: '#8C8C8A' }}>Deze campagne heeft nog geen recruiter of marketeer om je vraag aan te stellen.</div>}
            </div> : null}
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '16px' }}>Acties & campagnewijzigingen</div>
            {canActions ? <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={act.type ?? ''} onChange={setActType} style={{ flex: '1', height: '38px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 8px', fontSize: '13px', background: '#FFFFFF' }}>
                    <option value="Advertentie">Advertentie</option>
                    <option value="Doelgroep">Doelgroep</option>
                    <option value="Budget">Budget</option>
                    <option value="Vacaturetekst">Vacaturetekst</option>
                    <option value="Screening">Screening</option>
                    <option value="Klantafspraak">Klantafspraak</option>
                    <option value="Besluit">Besluit</option>
                  </select>
                  <select value={act.w} onChange={setActWeek} aria-label="Week" className="act-week" style={{ width: '92px', height: '38px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 8px', fontSize: '13px', background: '#FFFFFF' }}>
                    {d.weekOpts.map((o, i) => <option key={i} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <textarea value={act.text ?? ''} onChange={setActText} rows="2" placeholder="Wat is er aangepast?" style={{ border: '1px solid #E4E1DE', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', lineHeight: '1.45', resize: 'vertical' }} />
                <Button variant="accent" size="sm" onClick={addAction}>Vastleggen</Button>
              </div> : null}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {d.actions.map((a, i) => <div key={i} style={{ padding: '10px 0', borderTop: '1px solid #F5F2ED', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12px', color: '#8C8C8A' }}>Week {a.wl} · {a.type}</span>
                  <span style={{ fontSize: '13px', lineHeight: '1.45' }}>{a.text}</span>
                  <span style={{ fontSize: '12px', color: a.effFg }}>{a.eff}</span>
                </div>)}
              {d.noActions ? <div style={{ fontSize: '13px', color: '#8C8C8A', borderTop: '1px solid #F5F2ED', paddingTop: '10px' }}>Nog geen wijzigingen vastgelegd.</div> : null}
            </div>
          </div>
          {showTrello ? <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '16px' }}>Pipeline uit Trello</span>
                <span style={{ fontSize: '12px', color: '#8C8C8A' }}>totaal · automatisch</span>
              </div>
              {d.funnel.map((fu, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '92px minmax(0,1fr) 32px', gap: '10px', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: '#3C3C3A' }}>{fu.label}</span>
                  <div style={{ height: '8px', background: '#F5F2ED', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: fu.pct, background: '#1B1B63', borderRadius: '999px' }} />
                  </div>
                  <span style={{ fontWeight: '600', textAlign: 'right' }}>{fu.n}</span>
                </div>)}
              <div style={{ fontSize: '12px', color: '#8C8C8A', lineHeight: '1.45' }}>Geteld op basis van kaartbewegingen tussen lijsten. Alleen ter context — kandidaten worden in Trello opgevolgd.</div>
            </div> : null}
          {d.hasRej ? <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '16px' }}>Reden afgewezen</span>
                <span style={{ fontSize: '12px', color: '#8C8C8A' }}>{d.rejTotal} kandidaten · uit Trello</span>
              </div>
              {d.rej.map((x, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '132px minmax(0,1fr) 44px', gap: '10px', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: '#3C3C3A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.t}</span>
                  <div style={{ height: '8px', background: '#F5F2ED', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: x.pct, background: '#D32F2F', opacity: '.75', borderRadius: '999px' }} />
                  </div>
                  <span style={{ fontWeight: '600', textAlign: 'right' }}>{x.share}</span>
                </div>)}
            </div> : null}
        </div>
      </div>
    </div>
  );
}
