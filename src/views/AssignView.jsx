import React from 'react';

export default function AssignView({ v }) {
  const { asg, asgQ, setAsgQ } = v;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header>
        <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Teamlead</div>
        <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Toewijzing</h1>
        <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px', maxWidth: '640px', textWrap: 'pretty' }}>Wijs per klant een recruiter en een Recruitment Marketeer toe, of zet de opvolging op ‘Niet actief’. De recruiter geldt voor alle functies van de klant. Een klant die nog niet gekoppeld is, wordt meteen gekoppeld als ‘Alle functies’; per label splitsen kan daarna in Klanten uit Trello.</div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '12px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Recruiters · aantal klanten</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {asg.recChips.map((p, i) => <span key={i} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', background: '#F5F2ED', borderRadius: '999px', padding: '6px 12px', fontSize: '13px' }}>
                <span style={{ fontWeight: '600' }}>{p.name}</span>
                <span style={{ color: '#5C5C5A' }}>{p.n}</span>
              </span>)}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Recruitment Marketeers · aantal klanten</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {asg.mktChips.map((p, i) => <span key={i} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', background: '#F5F2ED', borderRadius: '999px', padding: '6px 12px', fontSize: '13px' }}>
                <span style={{ fontWeight: '600' }}>{p.name}</span>
                <span style={{ color: '#5C5C5A' }}>{p.n}</span>
              </span>)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={asgQ ?? ''} onChange={setAsgQ} placeholder="Zoek klant" style={{ flex: '1 1 220px', minWidth: '180px', height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 14px', fontSize: '14px', background: '#FFFFFF' }} />
        <div style={{ display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px', flex: 'none' }}>
          {asg.tabs.map((t, i) => <button key={i} onClick={t.onClick} style={{ border: '0', borderRadius: '999px', padding: '7px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', background: t.bg, color: t.fg, boxShadow: t.sh }}>{t.label} <span style={{ color: '#8C8C8A' }}>{t.n}</span></button>)}
        </div>
      </div>
      {asg.hasNotice ? <div style={{ background: '#FFF8E0', borderRadius: '12px', padding: '14px 18px', fontSize: '14px' }}>{asg.notice}</div> : null}
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflowX: 'auto' }}>
        <div style={{ minWidth: '760px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.6fr) 150px 170px 170px', gap: '16px', padding: '12px 20px', fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#8C8C8A', borderBottom: '1px solid #E4E1DE' }}>
            <div>Klant · functies</div>
            <div>Activiteit</div>
            <div>Recruiter</div>
            <div>Recruitment Marketeer</div>
          </div>
          {asg.rows.map((r, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.6fr) 150px 170px 170px', gap: '16px', padding: '10px 20px', borderBottom: '1px solid #F5F2ED', alignItems: 'center', fontSize: '14px' }}>
              <div style={{ minWidth: '0', opacity: r.op }}>
                <div style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                <div style={{ fontSize: '12px', color: '#5C5C5A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.funcs}</div>
              </div>
              <div style={{ fontSize: '13px', color: '#5C5C5A' }}>{r.last}</div>
              <select value={r.rec ?? ''} onChange={r.onRec} style={{ height: '36px', border: `1px solid ${r.recBorder}`, borderRadius: '8px', padding: '0 8px', fontSize: '13px', background: '#FFFFFF' }}>
                {r.recOpts.map((o, j) => <option key={j} value={o.v}>{o.l}</option>)}
              </select>
              <select value={r.mkt ?? ''} onChange={r.onMkt} style={{ height: '36px', border: `1px solid ${r.mktBorder}`, borderRadius: '8px', padding: '0 8px', fontSize: '13px', background: '#FFFFFF' }}>
                {r.mktOpts.map((o, j) => <option key={j} value={o.v}>{o.l}</option>)}
              </select>
            </div>)}
          {asg.empty ? <div style={{ padding: '32px', textAlign: 'center', fontSize: '14px', color: '#8C8C8A' }}>Alle klanten hebben een recruiter en marketeer.</div> : null}
        </div>
      </div>
    </div>
  );
}
