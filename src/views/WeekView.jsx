import React from 'react';
import Button from '../components/Button.jsx';
import NewTabLink, { cardClick } from '../components/NewTabLink.jsx';

export default function WeekView({ v }) {
  const { canAssign, canRemind, canSendRemind, emptyHint, goAssign, goCampaigns, groups, liveEmpty, remind, remindLabel, remindNote, sum, wk } = v;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>{wk.today} · check-in ronde</div>
          <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Week {wk.n}</h1>
          <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px' }}>{wk.range} · {sum.active} actieve campagnes</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={goCampaigns}>Alle campagnes</Button>
        </div>
      </header>
      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '16px' }}>
        <div className="span-2" style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px', gridColumn: 'span 2', minWidth: '0' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Monitorstatus</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px' }}>
            {sum.levels.map((l, i) => <button key={i} onClick={l.onClick} style={{ border: '0', background: 'none', padding: '0', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1', color: l.fg }}>{l.n}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#3C3C3A' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.fg }} />{l.label}</span>
              </button>)}
          </div>
          <div style={{ display: 'flex', height: '8px', borderRadius: '999px', overflow: 'hidden', gap: '2px' }}>
            {sum.levels.map((l, i) => <div key={i} style={{ width: l.pct, background: l.fg }} />)}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Feedback recruiter</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1' }}>{sum.done}</span>
            <span style={{ fontSize: '18px', color: '#8C8C8A' }}>/ {sum.active}</span>
          </div>
          <div style={{ height: '8px', borderRadius: '999px', background: '#F5F2ED', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: sum.donePct, background: 'linear-gradient(135deg,#F9CE00 0%,#FB8915 100%)' }} />
          </div>
          {sum.hasMissing ? <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              {sum.missingList.map((m, i) => <button key={i} onClick={m.fill} style={{ border: '0', background: 'none', padding: '0', display: 'flex', justifyContent: 'space-between', gap: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px' }}>
                  <span style={{ color: '#1D1D1B' }}>{m.client} – {m.vac}</span>
                  <span style={{ color: '#8C8C8A', flex: 'none' }}>{m.rec}</span>
                </button>)}
              {sum.hasMoreMissing ? <button onClick={sum.toggleMissing} className="link-btn" aria-expanded={sum.missAll}>{sum.moreMissingLabel}</button> : null}
              {canRemind ? <button onClick={remind} disabled={!canSendRemind} style={{ marginTop: '6px', alignSelf: 'flex-start', border: '1px solid #E4E1DE', background: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: '500', cursor: canSendRemind ? 'pointer' : 'default', color: canSendRemind ? '#1D1D1B' : '#8C8C8A' }}>{remindLabel}</button> : null}
              {canRemind && remindNote ? <div style={{ fontSize: '12px', color: '#8C8C8A', lineHeight: '1.45' }}>{remindNote}</div> : null}
            </div> : null}
        </div>
      </div>
      {liveEmpty ? <div style={{ background: '#FFFFFF', border: '1px dashed #C0BDB9', borderRadius: '12px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '17px' }}>Nog geen campagnes gekoppeld</div>
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
          {g.rows ? <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
              {g.items.map((c, j) => <div key={j} className="hov-row week-row" {...cardClick(c.href, c.open)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) auto auto minmax(0,2fr) auto', gap: '16px', alignItems: 'center', padding: '8px 12px 8px 20px', borderTop: '1px solid #F5F2ED', cursor: 'pointer', fontSize: '14px' }}>
                  <div style={{ minWidth: '0' }}>
                    <span style={{ fontWeight: '600' }}>{c.client}</span>
                    <span style={{ color: '#5C5C5A' }}> – {c.vac}</span>
                  </div>
                  <div style={{ color: '#3C3C3A' }}>{c.cur.leads} kandidaten</div>
                  <div style={{ fontWeight: '600', color: c.qFg }}>{c.qText}</div>
                  <div style={{ color: '#5C5C5A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.quote}</div>
                  <NewTabLink href={c.href} label={`${c.client} – ${c.vac} openen in een nieuw tabblad`} />
                </div>)}
            </div> : null}
        </section>)}
    </div>
  );
}
