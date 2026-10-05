import React from 'react';
import Button from '../components/Button.jsx';

const eyebrow = { fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' };
const COLS = '20px minmax(200px,1.6fr) 140px 170px 170px 92px';
const check = { width: '16px', height: '16px', margin: '0', accentColor: '#1B1B63', cursor: 'pointer' };
const sel = { height: '36px', borderRadius: '8px', padding: '0 8px', fontSize: '13px', background: '#FFFFFF', color: '#1D1D1B', minWidth: '0' };
const textBtn = { border: '0', background: 'none', padding: '0', fontSize: '13px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' };
const funcsLine = { display: 'flex', gap: '4px', alignItems: 'baseline', fontSize: '12px', color: '#5C5C5A', whiteSpace: 'nowrap', minWidth: '0' };

export default function AssignView({ v }) {
  const { asg, asgQ, setAsgQ, canTrelloTest, goTrelloTest } = v;
  const b = asg.bulk;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={eyebrow}>Beheer</div>
          <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Toewijzing</h1>
          <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px', maxWidth: '640px', textWrap: 'pretty' }}>Elk Trello-bord is een klant en elk label een functie, met een eigen campagne voor de feedback van recruiter en klant. Wijs per klant een recruiter en een Recruitment Marketeer toe: zij volgen alle functies. Nieuwe borden en functies verschijnen hier vanzelf. Vink meerdere klanten aan om ze in één keer toe te wijzen.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5C5C5A' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: asg.syncDot }} />{asg.syncText}</div>
      </header>
      {asg.hasNotice ? <div style={{ background: '#FFF8E0', borderRadius: '12px', padding: '14px 18px', fontSize: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{asg.notice}</span>
          {asg.noticeLink && canTrelloTest ? <button onClick={goTrelloTest} className="link-btn" style={{ fontSize: '14px', fontWeight: '600' }}>Naar testpagina →</button> : null}
        </div> : null}
      {asg.ready ? <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '12px' }}>
          {[['Recruiters · aantal klanten', asg.recChips], ['Recruitment Marketeers · aantal klanten', asg.mktChips]].map(([title, chips]) => <div key={title} style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={eyebrow}>{title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {chips.map((p, i) => <span key={i} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', background: '#F5F2ED', borderRadius: '999px', padding: '6px 12px', fontSize: '13px' }}>
                    <span style={{ fontWeight: '600' }}>{p.name}</span>
                    <span style={{ color: '#5C5C5A' }}>{p.n}</span>
                  </span>)}
              </div>
            </div>)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="m-filters" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={asgQ ?? ''} onChange={setAsgQ} placeholder="Zoek klant" style={{ flex: '1 1 220px', minWidth: '180px', height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 14px', fontSize: '14px', background: '#FFFFFF' }} />
            <div className="m-pills" style={{ display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px', flex: 'none' }}>
              {asg.tabs.map((t, i) => <button key={i} onClick={t.onClick} style={{ border: '0', borderRadius: '999px', padding: '7px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', background: t.bg, color: t.fg, boxShadow: t.sh }}>{t.label} <span style={{ color: '#8C8C8A' }}>{t.n}</span></button>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px 16px', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px', color: '#5C5C5A' }}>
            <span>{asg.summary}</span>
            {asg.quietText ? <button onClick={asg.toggleQuiet} style={{ ...textBtn, marginLeft: 'auto', color: '#1B1B63', whiteSpace: 'normal', textAlign: 'left' }}>{asg.quietText}</button> : null}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflowX: 'auto' }}>
          <div className="m-table" style={{ minWidth: '880px' }}>
            <div className="m-thead" style={{ display: 'grid', gridTemplateColumns: COLS, gap: '16px', padding: '12px 20px', fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#8C8C8A', borderBottom: '1px solid #E4E1DE', alignItems: 'center' }}>
              <div>{asg.canPick ? <input type="checkbox" checked={asg.allOn} ref={el => { if (el) el.indeterminate = asg.someOn; }} onChange={asg.toggleAll} aria-label="Alle klanten in de lijst selecteren" style={check} /> : null}</div>
              <div>Klant · functies</div>
              <div>Activiteit</div>
              <div>Recruiter</div>
              <div>Recruitment Marketeer</div>
              <div />
            </div>
            {asg.rows.map((r, i) => <div key={r.key} style={{ borderBottom: '1px solid #F5F2ED', background: r.bg }}>
                <div className="asg-row" style={{ display: 'grid', gridTemplateColumns: COLS, gap: '16px', padding: '10px 20px', alignItems: 'center', fontSize: '14px' }}>
                  <div style={{ display: 'flex' }}>{r.canPick ? <input type="checkbox" id={`asg-pick-${i}`} checked={r.picked} onChange={r.togglePick} style={check} /> : null}</div>
                  <div style={{ minWidth: '0', opacity: r.op }}>
                    <label htmlFor={r.canPick ? `asg-pick-${i}` : undefined} style={{ display: 'block', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: r.canPick ? 'pointer' : 'default' }}>{r.name}</label>
                    {r.canExpand ? <button onClick={r.toggleExp} aria-expanded={r.expanded} title="Functies van deze klant" style={{ ...funcsLine, border: '0', background: 'none', padding: '0', cursor: 'pointer', textAlign: 'left', maxWidth: '100%' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.newText ? <span style={{ color: '#B45309', fontWeight: '600' }}>{r.newText}{r.funcs ? ' · ' : ''}</span> : null}{r.funcs}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1B1B63" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', alignSelf: 'center', transform: r.expanded ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg>
                      </button> : <div style={funcsLine}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.funcs}</span></div>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#5C5C5A' }}>{r.last}</div>
                  <select value={r.rec ?? ''} onChange={r.onRec} disabled={r.ign} aria-label={`Recruiter voor ${r.name}`} style={{ ...sel, border: `1px solid ${r.recBorder}` }}>
                    {r.recOpts.map((o, j) => <option key={j} value={o.v}>{o.l}</option>)}
                  </select>
                  <select value={r.mkt ?? ''} onChange={r.onMkt} disabled={r.ign} aria-label={`Recruitment Marketeer voor ${r.name}`} style={{ ...sel, border: `1px solid ${r.mktBorder}` }}>
                    {r.mktOpts.map((o, j) => <option key={j} value={o.v}>{o.l}</option>)}
                  </select>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{r.addText ? <button onClick={r.add} title="Nieuwe functies toevoegen, met dezelfde recruiter" style={{ ...textBtn, color: '#1B1B63', fontWeight: '600' }}>{r.addText}</button>
                    : r.canIgnore ? <button onClick={r.ignore} title="Dit bord is geen klant" style={{ ...textBtn, color: '#5C5C5A' }}>Geen klant</button>
                    : r.ign ? <button onClick={r.restore} style={{ ...textBtn, color: '#1B1B63' }}>Herstel</button> : null}</div>
                </div>
                {r.expanded ? <div className="asg-fns" style={{ padding: '0 20px 12px 56px', display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                    {r.note ? <div style={{ color: '#5C5C5A', padding: '0 0 6px' }}>{r.note}</div> : null}
                    {r.fnRows.map((f, j) => <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: '6px 12px', flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid #EEEAE5' }}>
                        <span style={{ fontWeight: '600', color: f.fg }}>{f.name}</span>
                        <span style={{ color: '#8C8C8A' }}>{f.meta}</span>
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: '16px' }}>{f.acts.map((a, k) => <button key={k} onClick={a.onClick} style={{ ...textBtn, color: a.strong ? '#1B1B63' : '#5C5C5A', fontWeight: a.strong ? '600' : '500' }}>{a.label}</button>)}</span>
                      </div>)}
                    {r.split ? <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px 12px', flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid #EEEAE5' }}>
                        <span style={{ color: '#5C5C5A' }}>{r.split.text}</span>
                        <button onClick={r.split.onClick} style={{ ...textBtn, marginLeft: 'auto', color: '#1B1B63', fontWeight: '600' }}>Per functie splitsen</button>
                      </div> : null}
                  </div> : null}
              </div>)}
            {asg.empty ? <div style={{ padding: '32px', textAlign: 'center', fontSize: '14px', color: '#8C8C8A' }}>{asg.emptyText}</div> : null}
          </div>
        </div>
        {b.show ? <div className="asg-bulk" role="region" aria-label="Geselecteerde klanten toewijzen" style={{ position: 'sticky', bottom: '16px', zIndex: 5, marginTop: '-8px', background: '#1B1B63', color: '#FFFFFF', borderRadius: '12px', padding: '12px 16px', display: 'flex', gap: '10px 12px', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 8px 32px rgba(29,29,27,.18)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>{b.text}</span>
              {b.moreText ? <button onClick={b.selectAll} style={{ ...textBtn, fontSize: '12px', color: '#F9CE00', textAlign: 'left' }}>{b.moreText}</button> : null}
            </div>
            <select value={b.rec} onChange={b.setRec} aria-label="Recruiter voor de geselecteerde klanten" style={{ ...sel, border: '0', flex: '1 1 170px', maxWidth: '220px' }}>
              {b.recOpts.map((o, j) => <option key={j} value={o.v}>{o.l}</option>)}
            </select>
            <select value={b.mkt} onChange={b.setMkt} aria-label="Recruitment Marketeer voor de geselecteerde klanten" style={{ ...sel, border: '0', flex: '1 1 170px', maxWidth: '220px' }}>
              {b.mktOpts.map((o, j) => <option key={j} value={o.v}>{o.l}</option>)}
            </select>
            <Button variant="primary" size="sm" onClick={b.apply}>Toewijzen</Button>
            <div style={{ display: 'flex', gap: '16px', marginLeft: 'auto' }}>
              {b.canIgnore ? <button onClick={b.ignore} style={{ ...textBtn, color: 'rgba(255,255,255,.8)' }}>Geen klant</button> : null}
              <button onClick={b.clear} style={{ ...textBtn, color: 'rgba(255,255,255,.8)' }}>Selectie wissen</button>
            </div>
          </div> : null}
      </> : null}
    </div>
  );
}
