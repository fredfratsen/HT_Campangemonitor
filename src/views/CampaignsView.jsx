import React from 'react';

// Also "Mijn campagnes" (isMine): a recruiter's own campaigns, without the Status, Recruiter and Gem. kwaliteit columns.
export default function CampaignsView({ v }) {
  const { campTitle, f, isMine, list, listCount, listEmpty, setSearch, setSort, sortOptions, sortValue, statusTabs, sum, wk } = v;
  const cols = isMine ? 'minmax(220px,2fr) 150px 130px 100px minmax(180px,1.6fr)' : '136px minmax(220px,2fr) 84px 150px 130px 96px 100px minmax(180px,1.6fr)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Week {wk.n} · {wk.range}</div>
          <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>{campTitle}</h1>
        </div>
        <div style={{ fontSize: '13px', color: '#5C5C5A' }}>{listCount} van {sum.active} campagnes</div>
      </header>
      <div className="m-filters" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={f.q ?? ''} onChange={setSearch} placeholder="Zoek klant of vacature" style={{ flex: '1 1 220px', minWidth: '180px', height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 14px', fontSize: '14px', background: '#FFFFFF' }} />
        <div className="m-pills" style={{ display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px', flexWrap: 'wrap' }}>
          {statusTabs.map((t, i) => <button key={i} onClick={t.onClick} style={{ border: '0', borderRadius: '999px', padding: '7px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', background: t.bg, color: t.fg, boxShadow: t.sh, display: 'flex', gap: '6px', alignItems: 'center' }}>{t.dot ? <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: t.dot }} /> : null}{t.label} <span style={{ color: '#8C8C8A' }}>{t.n}</span></button>)}
        </div>
        <select value={sortValue ?? ''} onChange={setSort} style={{ height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 10px', fontSize: '14px', background: '#FFFFFF' }}>
          {sortOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </div>
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflowX: 'auto' }}>
        <div className="m-table" style={{ minWidth: isMine ? '880px' : '1076px' }}>
          <div className="m-thead" style={{ display: 'grid', gridTemplateColumns: cols, gap: '14px', padding: '12px 20px', fontSize: '11px', fontWeight: '500', letterSpacing: '.06em', textTransform: 'uppercase', color: '#8C8C8A', borderBottom: '1px solid #E4E1DE' }}>
            {isMine ? null : <div>Status</div>}
            <div>Klant · vacature</div>
            {isMine ? null : <div>Recruiter</div>}
            <div>Instroom deze week</div>
            <div>Kwaliteit</div>
            {isMine ? null : <div>Gem. kwaliteit</div>}
            <div>Feedback</div>
            <div>Signalen</div>
          </div>
          {list.map((c, i) => <div key={i} className={isMine ? 'hov-row mine-row' : 'hov-row camp-row'} onClick={c.open} style={{ display: 'grid', gridTemplateColumns: cols, gap: '14px', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid #F5F2ED', cursor: 'pointer', fontSize: '14px' }}>
              {isMine ? null : <div>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', fontSize: '12px', lineHeight: '1.35', fontWeight: '600', padding: '4px 9px', borderRadius: '6px', background: c.sBg, color: c.sFg }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.sFg, flex: 'none', transform: 'translateY(-1px)' }} />{c.statusLabel}</span>
                </div>}
              <div style={{ minWidth: '0' }}>
                <div style={{ fontWeight: '600' }}>{c.client}</div>
                <div style={{ color: '#5C5C5A', fontSize: '13px' }}>{c.vac}</div>
              </div>
              {isMine ? null : <div data-label="Recruiter" style={{ color: '#3C3C3A' }}>{c.rec}</div>}
              <div data-label="Instroom" style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '24px' }}>
                  {c.bars.map((b, j) => <div key={j} style={{ width: '6px', height: b.h, background: b.bg, borderRadius: '2px' }} />)}
                </div>
                <div style={{ lineHeight: '1.1' }}>
                  <div style={{ fontWeight: '600', fontSize: '16px' }}>{c.cur.leads}</div>
                  <div style={{ fontSize: '11px', color: c.ldColor }}>{c.ldShort}</div>
                </div>
              </div>
              <div data-label="Kwaliteit" style={{ lineHeight: '1.2' }}>
                <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '16px', color: c.qFg }}>{c.qText}</span>
                {' '}
                <span style={{ fontSize: '12px', color: c.qdColor }}>{c.qdShort}</span>
                <div style={{ fontSize: '11px', color: '#8C8C8A' }}>vorige week {c.prevQText}</div>
              </div>
              {isMine ? null : <div data-label="Gem. kwaliteit" style={{ lineHeight: '1.2' }}>
                  <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '16px', color: c.avgFg }}>{c.avgQ}</span>
                  <div style={{ fontSize: '11px', color: '#8C8C8A' }}>{c.avgSub}</div>
                </div>}
              <div data-label="Feedback" style={{ fontSize: '13px', color: c.atColor, fontWeight: c.atWeight }}>{c.lastAt}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {c.reasons.map((r, j) => <span key={j} style={{ fontSize: '11px', fontWeight: '500', padding: '2px 7px', borderRadius: '6px', background: r.bg, color: r.fg }}>{r.t}</span>)}
              </div>
            </div>)}
          {listEmpty ? <div style={{ padding: '40px', textAlign: 'center', color: '#8C8C8A', fontSize: '14px' }}>Geen campagnes met deze filters.</div> : null}
        </div>
      </div>
    </div>
  );
}
