import React from 'react';
import Button from '../components/Button.jsx';

export default function TrelloView({ v }) {
  const { goTrelloTest, syncDot, tr } = v;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Koppelingen</div>
          <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '40px', lineHeight: '1.1', letterSpacing: '-.02em' }}>Klanten uit Trello</h1>
          <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px', maxWidth: '640px', textWrap: 'pretty' }}>Elk bord is een klant, elk label een functie. Nieuwe borden en labels verschijnen hier automatisch. Koppel een label aan een recruiter en de campagne staat live.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5C5C5A' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: syncDot }} />{tr.syncText}</div>
      </header>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px', flex: 'none' }}>
          {tr.tabs.map((t, i) => <button key={i} onClick={t.onClick} style={{ border: '0', borderRadius: '999px', padding: '7px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', background: t.bg, color: t.fg, boxShadow: t.sh }}>{t.label} <span style={{ color: '#8C8C8A' }}>{t.n}</span></button>)}
        </div>
        <span style={{ fontSize: '13px', color: '#5C5C5A' }}>{tr.summary}</span>
        <button onClick={tr.toggleInactive} style={{ marginLeft: 'auto', border: '0', background: 'none', padding: '0', fontSize: '13px', fontWeight: '500', color: '#1B1B63', cursor: 'pointer' }}>{tr.inactiveText}</button>
      </div>
      {tr.hasNotice ? <div style={{ background: '#FFF8E0', borderRadius: '12px', padding: '14px 18px', fontSize: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{tr.notice}</span>
          {tr.noticeLink ? <button onClick={goTrelloTest} className="link-btn" style={{ fontSize: '14px', fontWeight: '600' }}>Naar testpagina →</button> : null}
        </div> : null}
      {tr.empty ? <div style={{ background: '#E6F4ED', borderRadius: '12px', padding: '18px 22px', fontSize: '14px', color: '#1A7A4A', fontWeight: '500' }}>Alle labels zijn gekoppeld of genegeerd.</div> : null}
      {tr.boards.map((b, i) => <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderBottom: '1px solid #E4E1DE', background: '#FDFBF8' }}>
            <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '16px' }}>{b.name}</span>
            {b.isNew ? <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: '#FFF8E0', color: '#B45309' }}>Nieuw bord · {b.found}</span> : null}
            {b.isInactive ? <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: '#F5F2ED', color: '#5C5C5A' }}>{b.inactiveText}</span> : null}
            <span style={{ fontSize: '12px', color: '#8C8C8A', marginLeft: 'auto' }}>{b.meta}</span>
            {b.canIgnore ? <button onClick={b.ignoreBoard} style={{ border: '0', background: 'none', padding: '0', fontSize: '12px', fontWeight: '500', color: '#5C5C5A', cursor: 'pointer' }}>Geen klant</button> : null}
            {b.isIgnoredBoard ? <>
                <span style={{ fontSize: '12px', color: '#8C8C8A' }}>Genegeerd</span>
                <button onClick={b.restoreBoard} style={{ border: '0', background: 'none', padding: '0', fontSize: '12px', fontWeight: '500', color: '#1B1B63', cursor: 'pointer' }}>Herstel</button>
              </> : null}
          </div>
          {b.labels.map((l, j) => <div key={j} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 84px auto', gap: '16px', padding: '12px 20px', borderTop: '1px solid #F5F2ED', alignItems: 'center', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '0' }}>
                <span style={{ width: '28px', height: '8px', borderRadius: '999px', flex: 'none', background: l.color }} />
                <span style={{ fontWeight: '600', color: l.fg }}>{l.name}</span>
              </div>
              <div style={{ color: '#5C5C5A', fontSize: '13px' }}>{l.cards} kaarten</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', whiteSpace: 'nowrap', justifyContent: 'flex-end' }}>
                {l.isLinked ? <>
                    <span style={{ fontSize: '13px', color: '#1A7A4A', fontWeight: '500' }}>Gekoppeld · {l.rec}</span>
                    <button onClick={l.open} style={{ border: '0', background: 'none', padding: '0', fontSize: '13px', fontWeight: '500', color: '#1B1B63', cursor: 'pointer' }}>Bekijk →</button>
                    {l.canUnlink ? <button onClick={l.unlink} style={{ border: '0', background: 'none', padding: '0', fontSize: '13px', color: '#8C8C8A', cursor: 'pointer' }}>Ontkoppelen</button> : null}
                  </> : null}
                {l.isEnded ? <span style={{ fontSize: '13px', color: '#8C8C8A' }}>Campagne afgerond</span> : null}
                {l.isInactive ? <span style={{ fontSize: '13px', color: '#8C8C8A' }}>Niet actief, wordt niet gevolgd</span> : null}
                {l.isIgnored ? <>
                    <span style={{ fontSize: '13px', color: '#8C8C8A' }}>Genegeerd, geen functie</span>
                    <button onClick={l.unignore} style={{ border: '0', background: 'none', padding: '0', fontSize: '13px', fontWeight: '500', color: '#1B1B63', cursor: 'pointer' }}>Herstel</button>
                  </> : null}
                {l.isOpen ? <>
                    <input value={l.vac ?? ''} onChange={l.setVac} placeholder="Functie" style={{ width: '140px', height: '34px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }} />
                    <select value={l.sel ?? ''} onChange={l.setRec} style={{ height: '34px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 8px', fontSize: '13px', background: '#FFFFFF' }}>
                      <option value="">Kies recruiter</option>
                      <option value="Robin">Robin</option>
                      <option value="Tsjerk">Tsjerk</option>
                      <option value="Kim">Kim</option>
                      <option value="Juul">Juul</option>
                    </select>
                    <Button variant="accent" size="sm" onClick={l.link}>Koppelen</Button>
                    {l.showIgnore ? <button onClick={l.ignore} style={{ border: '0', background: 'none', padding: '0 4px', fontSize: '13px', color: '#5C5C5A', cursor: 'pointer' }}>Geen functie</button> : null}
                  </> : null}
              </div>
            </div>)}
        </div>)}
    </div>
  );
}
