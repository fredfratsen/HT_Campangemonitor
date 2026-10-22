import React from 'react';
import Button from '../components/Button.jsx';
import NewTabLink, { cardClick } from '../components/NewTabLink.jsx';

export default function WeekView({ v }) {
  const { canAssign, canRemind, canSendRemind, emptyHint, emptyTitle, fbBar, goAssign, goCampaigns, groups, liveEmpty, remind, remindLabel, remindNote, sum, wk } = v;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>{wk.today} · check-in ronde</div>
          <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Week {wk.n}</h1>
          <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px' }}>{wk.range} · {sum.active} actieve campagnes{sum.scope}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={goCampaigns}>Alle campagnes</Button>
        </div>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px', minWidth: '0' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Monitorstatus</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: '16px' }}>
            {sum.levels.map((l, i) => <button key={i} onClick={l.onClick} style={{ border: '0', background: 'none', padding: '0', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1', color: l.fg }}>{l.n}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#3C3C3A' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.fg }} />{l.label}</span>
              </button>)}
          </div>
          <div style={{ display: 'flex', height: '8px', borderRadius: '999px', overflow: 'hidden', gap: '2px' }}>
            {sum.levels.map((l, i) => <div key={i} style={{ width: l.pct, background: l.fg }} />)}
          </div>
        </div>
        {fbBar ? <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', minWidth: '0' }}>
            <button onClick={fbBar.toggle} aria-expanded={fbBar.open} style={{ width: '100%', border: '0', background: 'none', padding: '12px 20px 12px 24px', display: 'flex', alignItems: 'center', gap: '8px 16px', flexWrap: 'wrap', cursor: 'pointer', textAlign: 'left', fontSize: '14px', color: '#3C3C3A' }}>
              <span style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Feedback recruiters</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {fbBar.doneText}
                <span style={{ width: '64px', height: '6px', borderRadius: '999px', background: '#F5F2ED', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: fbBar.donePct, background: 'linear-gradient(135deg,#F9CE00 0%,#FB8915 100%)' }} /></span>
              </span>
              <span style={{ color: fbBar.hasOpen ? '#5C5C5A' : '#1A7A4A' }}>{fbBar.openText}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B1B63" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', marginLeft: 'auto', transform: fbBar.open ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {fbBar.open && fbBar.hasOpen ? <div style={{ borderTop: '1px solid #F5F2ED', padding: '14px 20px 16px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {fbBar.recs.map((r, i) => <div key={i} className="m-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,220px) minmax(0,1fr)', gap: '4px 16px', fontSize: '13px' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#1D1D1B' }}>{r.rec}</div>
                      <div style={{ color: '#8C8C8A' }}>{r.counts}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '0' }}>
                      {r.items.map((m, j) => <button key={j} onClick={m.open} style={{ border: '0', background: 'none', padding: '0', cursor: 'pointer', textAlign: 'left', fontSize: '13px', color: '#1D1D1B' }}>
                          {m.label}{m.tag ? <span style={{ color: '#B45309' }}> · {m.tag}</span> : null}
                        </button>)}
                    </div>
                  </div>)}
                {canRemind ? <button onClick={remind} disabled={!canSendRemind} style={{ alignSelf: 'flex-start', border: '1px solid #E4E1DE', background: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: '500', cursor: canSendRemind ? 'pointer' : 'default', color: canSendRemind ? '#1D1D1B' : '#8C8C8A' }}>{remindLabel}</button> : null}
                {canRemind && remindNote ? <div style={{ fontSize: '12px', color: '#8C8C8A', lineHeight: '1.45' }}>{remindNote}</div> : null}
              </div> : null}
          </div> : null}
      </div>
      {liveEmpty ? <div style={{ background: '#FFFFFF', border: '1px dashed #C0BDB9', borderRadius: '12px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '17px' }}>{emptyTitle}</div>
            <div style={{ fontSize: '14px', color: '#5C5C5A' }}>{emptyHint}</div>
          </div>
          {canAssign ? <Button variant="primary" onClick={goAssign}>Naar Toewijzing</Button> : null}
        </div> : null}
      {groups.map((g, i) => <section key={i} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: g.fg, alignSelf: 'center' }} />
            <h2 style={{ margin: '0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '22px', letterSpacing: '-.01em' }}>{g.label}</h2>
            <span style={{ fontSize: '15px', color: '#8C8C8A' }}>{g.n}</span>
            <span style={{ fontSize: '13px', color: '#5C5C5A' }}>{g.sub}</span>
            {g.views ? <div role="group" aria-label={`${g.label} tonen als`} style={{ marginLeft: 'auto', alignSelf: 'center', display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px' }}>
                {g.views.map((t, i) => <button key={i} onClick={t.onClick} aria-pressed={t.on} style={{ border: '0', borderRadius: '999px', padding: '5px 12px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', background: t.bg, color: t.fg, boxShadow: t.sh }}>{t.label}</button>)}
              </div> : null}
          </div>
          {g.cards ? <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: '14px' }}>
              {g.items.map((c, j) => <div key={j} className="hov-lift" {...cardClick(c.href, c.open)} style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(29,29,27,.05)', transition: 'box-shadow 150ms' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: '0' }}>
                      <div style={{ fontSize: '13px', color: '#5C5C5A' }}>{c.client}</div>
                      <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '17px', lineHeight: '1.3' }}>{c.vac}</div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '22px', lineHeight: '1.2', color: c.qFg }}>{c.qText}</div>
                      <div style={{ fontSize: '12px', color: c.qdColor }}>{c.qdText}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '13px', color: '#3C3C3A' }}>
                    <span><strong>{c.cur.leads}</strong> kandidaten</span>
                    <span style={{ color: c.ldColor }}>{c.ldText}</span>
                    <span style={{ color: '#8C8C8A' }}>{c.rec}</span>
                  </div>
                  {c.monText ? <div style={{ fontSize: '12px', fontWeight: '600', color: c.sFg }}>{c.monText}</div> : null}
                  {c.hasQuote ? <div style={{ fontSize: '14px', lineHeight: '1.5', textWrap: 'pretty' }}>“{c.quote}”</div> : null}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                    <div style={{ flex: '1', minWidth: '0', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {c.reasons.map((r, i3) => <span key={i3} style={{ fontSize: '12px', fontWeight: '500', padding: '3px 8px', borderRadius: '6px', background: r.bg, color: r.fg }}>{r.t}</span>)}
                    </div>
                    <NewTabLink href={c.href} label={`${c.client} – ${c.vac} openen in een nieuw tabblad`} />
                  </div>
                </div>)}
            </div> : null}
          {g.list ? <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
              {g.items.map((c, j) => <div key={j} className="hov-row week-row" {...cardClick(c.href, c.open)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) 132px 72px minmax(0,1.7fr) auto', gap: '16px', alignItems: 'center', padding: '10px 12px 10px 20px', borderTop: j ? '1px solid #F5F2ED' : '0', cursor: 'pointer', fontSize: '14px' }}>
                  <div style={{ minWidth: '0' }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>{c.client}</span>
                      <span style={{ color: '#5C5C5A' }}> – {c.vac}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#8C8C8A' }}>{c.rec}{c.monText ? <span style={{ fontWeight: '600', color: c.sFg }}> · {c.monText}</span> : null}</div>
                  </div>
                  <div style={{ color: '#3C3C3A', whiteSpace: 'nowrap' }}>{c.cur.leads} kandidaten {c.ldShort ? <span style={{ fontSize: '12px', color: c.ldColor }}>{c.ldShort}</span> : null}</div>
                  <div style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: '600', color: c.qFg }}>{c.qText}</span>
                    {c.qdShort ? <span style={{ fontSize: '12px', color: c.qdColor }}> {c.qdShort}</span> : null}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {c.reasons.map((r, i3) => <span key={i3} style={{ fontSize: '11px', fontWeight: '500', padding: '2px 7px', borderRadius: '6px', background: r.bg, color: r.fg }}>{r.t}</span>)}
                  </div>
                  <NewTabLink href={c.href} label={`${c.client} – ${c.vac} openen in een nieuw tabblad`} />
                </div>)}
            </div> : null}
          {g.rows ?<div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
              {g.items.map((c, j) => <div key={j} className="hov-row week-row" {...cardClick(c.href, c.open)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) auto auto minmax(0,2fr) auto', gap: '16px', alignItems: 'center', padding: '8px 12px 8px 20px', borderTop: '1px solid #F5F2ED', cursor: 'pointer', fontSize: '14px' }}>
                  <div style={{ minWidth: '0' }}>
                    <span style={{ fontWeight: '600' }}>{c.client}</span>
                    <span style={{ color: '#5C5C5A' }}> – {c.vac}</span>
                  </div>
                  <div style={{ color: '#3C3C3A' }}>{c.cur.leads} kandidaten</div>
                  <div style={{ fontWeight: '600', color: c.qFg }}>{c.qText}</div>
                  <div style={{ color: '#5C5C5A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.quote}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {g.canCheck ? <button onClick={e => { e.stopPropagation(); c.check(); }} aria-label={`${c.client} – ${c.vac} op Check zetten`} style={{ border: '1.5px solid #1A7A4A', background: '#FFFFFF', color: '#1A7A4A', borderRadius: '6px', padding: '4px 12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Check</button> : null}
                    <NewTabLink href={c.href} label={`${c.client} – ${c.vac} openen in een nieuw tabblad`} />
                  </div>
                </div>)}
            </div> : null}
        </section>)}
    </div>
  );
}
