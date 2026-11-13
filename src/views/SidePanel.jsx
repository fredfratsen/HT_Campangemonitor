import React from 'react';
import Button from '../components/Button.jsx';

export default function SidePanel({ v }) {
  const { authorName, closePanel, idea, inbox, isIdea, isInbox, isNews, news, panelTitle, setIdeaText, submitIdea, user } = v;
  return (
    <>
      <div onClick={closePanel} className="panel-backdrop" style={{ position: 'fixed', inset: '0', background: 'rgba(29,29,27,.12)', zIndex: '20' }} />
      <div className="side-panel" style={{ position: 'fixed', top: '16px', right: '16px', bottom: '16px', width: 'min(440px,calc(100vw - 32px))', background: '#FFFFFF', borderRadius: '12px', boxShadow: '0 8px 32px rgba(29,29,27,.18)', zIndex: '21', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E4E1DE', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'Poppins,sans-serif', fontWeight: '600', fontSize: '18px' }}>{panelTitle}</span>
          <button onClick={closePanel} aria-label="Sluiten" style={{ border: '0', background: '#F5F2ED', borderRadius: '8px', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: '1', overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isInbox ? <>
              <div style={{ fontSize: '13px', color: '#5C5C5A', lineHeight: '1.5' }}>Herinneringen, vragen en meldingen voor {user.name}.</div>
              {inbox.items.map((n, i) => <div key={i} onClick={n.canBord ? n.openBord : n.canClient ? n.openClient : n.canIdea ? n.openIdea : undefined} className={n.canBord || n.canClient || n.canIdea ? 'inbox-link' : undefined} style={{ border: '1px solid #E4E1DE', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: n.bg }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', color: '#8C8C8A' }}>
                    <span>{n.from}</span>
                    <span>{n.at}</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', lineHeight: '1.4' }}>{n.title}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {n.lines.map((ln, j) => <span key={j} style={{ fontSize: '13px', lineHeight: '1.45', whiteSpace: 'pre-wrap', color: ln.fg }}>{ln.t}</span>)}
                  </div>
                  {n.hasAction ? <button onClick={n.act} style={{ alignSelf: 'flex-start', border: '0', background: '#1B1B63', color: '#FFFFFF', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>{n.actLabel}</button> : null}
                  {n.replying ? <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <textarea value={n.replyText ?? ''} onChange={n.setReplyText} rows="3" placeholder="Je antwoord" autoFocus style={{ border: '1px solid #E4E1DE', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', lineHeight: '1.45', resize: 'vertical', background: '#FFFFFF' }} />
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Button variant="primary" size="sm" onClick={n.sendReply}>Antwoord versturen</Button>
                        <button onClick={n.cancelReply} className="link-btn">Annuleren</button>
                      </div>
                    </div> : null}
                  {n.canReply || n.answered || n.canOpen || n.canClient || n.canBord || n.canIdea ? <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {n.canReply ? <button onClick={n.startReply} style={{ border: '0', background: '#1B1B63', color: '#FFFFFF', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Beantwoorden</button> : null}
                      {n.answered ? <span style={{ fontSize: '12px', fontWeight: '600', color: '#1A7A4A' }}>✓ Beantwoord</span> : null}
                      {n.canOpen ? <button onClick={n.openCampaign} className="link-btn">Campagne openen</button> : null}
                      {n.canClient ? <button onClick={n.openClient} className="link-btn">Klant openen</button> : null}
                      {n.canBord ? <button onClick={n.openBord} className="link-btn">Kandidaat openen</button> : null}
                      {n.canIdea ? <button onClick={e => { e.stopPropagation(); n.openIdea(); }} className="link-btn">Bekijken en reageren</button> : null}
                    </div> : null}
                </div>)}
              {inbox.empty ? <div style={{ padding: '24px 0', textAlign: 'center', fontSize: '14px', color: '#8C8C8A' }}>Geen meldingen.</div> : null}
              <div style={{ fontSize: '12px', color: '#8C8C8A', lineHeight: '1.5', borderTop: '1px solid #F5F2ED', paddingTop: '12px' }}>Herinneringen verschijnen hier. Een e-mail (of Slack/Teams) en de automatische herinnering op vrijdag 09:00 volgen zodra die koppeling is ingesteld.</div>
            </> : null}
          {isNews ? <>
              {news.items.map((it, i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '14px', borderBottom: '1px solid #F5F2ED' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: it.tagBg, color: it.tagFg }}>{it.tag}</span>
                    <span style={{ fontSize: '12px', color: '#8C8C8A' }}>{it.date}</span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '600' }}>{it.title}</div>
                  <div style={{ fontSize: '13px', lineHeight: '1.55', color: '#3C3C3A' }}>{it.text}</div>
                </div>)}
            </> : null}
          {isIdea ? <>
              <div style={{ fontSize: '13px', color: '#5C5C5A', lineHeight: '1.5' }}>Je melding gaat naar de ontwikkelaar.{idea.mailsBack ? ' Je krijgt een mail zodra hij is opgepakt of afgehandeld, of als er op gereageerd wordt.' : ''} Staat hij hieronder al? Geef dan een +1. Opgeloste meldingen verdwijnen uit deze lijst.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#FDFBF8', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: '2px', background: '#F5F2ED', borderRadius: '999px', padding: '3px', alignSelf: 'flex-start' }}>
                  {idea.types.map((t, i) => <button key={i} onClick={t.onClick} style={{ border: '0', borderRadius: '999px', padding: '6px 12px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', background: t.bg, color: t.fg, boxShadow: t.sh }}>{t.label}</button>)}
                </div>
                <textarea value={idea.text ?? ''} onChange={setIdeaText} rows="4" placeholder={idea.placeholder} style={{ border: '1px solid #E4E1DE', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', lineHeight: '1.5', resize: 'vertical', background: '#FFFFFF' }} />
                {idea.isBug ? <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: '500', color: '#3C3C3A' }}>
                    Gebeurt dit bij een specifiek restaurant? Zo ja, welke?
                    <select value={idea.client} onChange={idea.setClient} style={{ height: '38px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 8px', fontSize: '14px', fontWeight: '400', background: '#FFFFFF', color: idea.client ? '#1D1D1B' : '#8C8C8A' }}>
                      <option value="" disabled>Kies…</option>
                      <option value="-">Nee, niet bij één restaurant</option>
                      {idea.restaurants.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label> : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#8C8C8A' }}>Scherm: {idea.page} · door {authorName}</span>
                  <Button variant="primary" size="sm" onClick={submitIdea}>Versturen</Button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {idea.filters.map((f, i) => <button key={i} onClick={f.onClick} style={{ border: `1px solid ${f.border}`, background: f.bg, borderRadius: '999px', padding: '5px 12px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>{f.label} <span style={{ color: '#8C8C8A' }}>{f.n}</span></button>)}
              </div>
              {idea.items.map(it => <div key={it.id} id={'idea-' + it.id} style={{ border: `1px solid ${it.focus ? '#F9A800' : '#E4E1DE'}`, background: it.focus ? '#FFFDF5' : '#FFFFFF', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px', background: it.tBg, color: it.tFg }}>{it.type}</span>
                    <span style={{ fontSize: '12px', color: '#8C8C8A' }}>{it.by} · {it.at} · {it.page}</span>
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: '1.5', textWrap: 'pretty', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{it.text}</div>
                  {it.client ? <div style={{ fontSize: '12px', color: '#5C5C5A' }}>Bij restaurant: <b style={{ fontWeight: '600', color: '#1D1D1B' }}>{it.client}</b></div> : null}
                  {it.replies.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '2px solid #E4E1DE', paddingLeft: '10px' }}>
                      {it.replies.map((r, j) => <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '12px', color: '#8C8C8A' }}><b style={{ fontWeight: '600', color: '#3C3C3A' }}>{r.by}</b> · {r.at}</span>
                          <span style={{ fontSize: '13px', lineHeight: '1.45', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.text}</span>
                        </div>)}
                    </div> : null}
                  {it.replying ? <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <textarea value={it.replyText} onChange={it.setReplyText} rows="3" maxLength={it.replyMax} placeholder="Je reactie" aria-label="Je reactie" autoFocus style={{ border: '1px solid #E4E1DE', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', lineHeight: '1.45', resize: 'vertical', background: '#FFFFFF' }} />
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Button variant="primary" size="sm" onClick={it.sendReply}>Reactie versturen</Button>
                        <button onClick={it.cancelReply} className="link-btn">Annuleren</button>
                      </div>
                    </div> : null}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {it.canSet ? <select value={it.status ?? ''} onChange={it.setStatus} style={{ height: '30px', border: '1px solid #E4E1DE', borderRadius: '6px', padding: '0 6px', fontSize: '12px', background: '#FFFFFF' }}>
                        <option value="nieuw">Nieuw</option>
                        <option value="opgepakt">Opgepakt</option>
                        <option value="opgelost">Opgelost</option>
                        <option value="niet">Doen we niet</option>
                      </select> : null}
                    {it.showStatus ? <span style={{ fontSize: '12px', fontWeight: '600', color: it.sFg }}>{it.statusLabel}</span> : null}
                    {it.canReply ? <button onClick={it.startReply} className="link-btn" style={{ fontSize: '12px' }}>Reageren</button> : null}
                    <button onClick={it.vote} style={{ marginLeft: 'auto', border: `1px solid ${it.vBorder}`, background: it.vBg, color: it.vFg, borderRadius: '999px', padding: '4px 10px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>+1 · {it.votes}</button>
                  </div>
                </div>)}
              {idea.empty ? <div style={{ padding: '16px 0', textAlign: 'center', fontSize: '14px', color: '#8C8C8A' }}>Nog niets gemeld.</div> : null}
            </> : null}
        </div>
      </div>
    </>
  );
}
