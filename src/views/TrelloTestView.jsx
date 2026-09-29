// Trello-koppeling testen (teamlead). Replaces the design's separate "Trello-koppeling test" page: the API key
// and token now live on the server, so this page checks the connection and whether a board follows the
// conventions the monitor relies on (list names, labels, custom fields).
import React, { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import { stageOf } from '../lib/constants.js';
import { agoTxt } from '../lib/helpers.js';

const BOARD_Q = '&fields=name&lists=open&list_fields=name&labels=all&label_fields=name,color&cards=all&card_fields=idList,idLabels,closed&card_customFieldItems=true&customFields=true';
const STAGES = {
  nieuw: ['Nieuw', 'nog bellen; telt mee in “Vandaag te bellen”', '#1B1B63'],
  contact: ['Contactpoging', 'opnieuw bellen; telt mee in “Vandaag te bellen”', '#B45309'],
  gescreend: ['Gescreend', 'pipeline', '#1A7A4A'],
  gesprek: ['Gesprek', 'pipeline', '#1A7A4A'],
  voorgesteld: ['Voorgesteld', 'pipeline', '#1A7A4A'],
  geplaatst: ['Geplaatst', 'pipeline (lijstnaam met “aangenomen”)', '#1A7A4A'],
  afgewezen: ['Afgewezen', 'reden via het veld “Reden afgewezen”', '#D32F2F'],
  info: ['Informatie', 'telt niet mee', '#8C8C8A'],
  overig: ['Niet herkend', 'telt mee als kandidaat, zonder fase', '#8C8C8A'],
};

const card = { background: '#FFFFFF', border: '1px solid #E4E1DE', borderRadius: '12px', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' };
const h2 = { margin: 0, fontFamily: 'Poppins,sans-serif', fontWeight: 600, fontSize: '17px' };
const eyebrow = { fontSize: '11px', fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8C8C8A' };
const dot = c => ({ width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: c });
const row = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', flexWrap: 'wrap' };
const code = { fontFamily: "'SF Mono','Fira Code',Consolas,monospace", fontSize: '12.5px', background: '#F5F2ED', padding: '2px 6px', borderRadius: '4px', wordBreak: 'break-all' };

function Check({ ok, warn, children, sub }) {
  const c = ok ? '#1A7A4A' : warn ? '#B45309' : '#D32F2F';
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', fontSize: '14px' }}>
      <span style={{ color: c, fontWeight: 700, width: '14px', flex: 'none' }}>{ok ? '✓' : warn ? '!' : '✕'}</span>
      <span><span style={{ fontWeight: 600 }}>{children}</span>{sub ? <span style={{ color: '#5C5C5A' }}> · {sub}</span> : null}</span>
    </div>
  );
}

export default function TrelloTestView({ v, tget }) {
  const { trelloConfigured, goTrelloLive } = v;
  const [conn, setConn] = useState({ state: trelloConfigured ? 'idle' : 'off' });
  const [boardId, setBoardId] = useState('');
  const [board, setBoard] = useState(null);

  const test = async () => {
    setConn({ state: 'busy' });
    try {
      const me = await tget('/members/me', '&fields=fullName,username');
      const boards = await tget('/members/me/boards', '&filter=open&fields=name,dateLastActivity');
      boards.sort((a, b) => new Date(b.dateLastActivity) - new Date(a.dateLastActivity));
      setConn({ state: 'ok', me, boards });
    } catch (e) { setConn({ state: 'error', msg: e.message }); }
  };
  useEffect(() => { if (trelloConfigured) test(); }, [trelloConfigured]);

  const check = async id => {
    setBoardId(id); setBoard(null);
    if (!id) return;
    setBoard({ busy: true });
    try { setBoard({ data: await tget(`/boards/${id}`, BOARD_Q) }); } catch (e) { setBoard({ error: e.message }); }
  };

  let an = null;
  if (board && board.data) {
    const bd = board.data, stg = {};
    bd.lists.forEach(l => { stg[l.id] = stageOf(l.name); });
    const open = bd.cards.filter(c => !c.closed), counted = bd.cards.filter(c => stg[c.idList] !== 'info');
    const lists = bd.lists.map(l => ({ name: l.name, stage: stg[l.id], n: open.filter(c => c.idList === l.id).length }));
    const has = s => lists.some(l => l.stage === s);
    const cfs = bd.customFields || [];
    const rf = cfs.find(f => /reden\s*afgewezen/i.test(f.name)), sd = cfs.find(f => /sollicitatiedatum/i.test(f.name));
    const labels = bd.labels.map(l => ({ name: l.name || '(zonder naam)', color: l.color, n: counted.filter(c => c.idLabels.includes(l.id)).length })).filter(l => l.n);
    an = { lists, has, rf, sd, labels, total: counted.length };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '860px' }}>
      <header>
        <div style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', color: '#5C5C5A' }}>Koppelingen</div>
        <h1 style={{ margin: '6px 0 0', fontFamily: 'Poppins,sans-serif', fontWeight: 600, fontSize: '40px', lineHeight: 1.1, letterSpacing: '-.02em' }}>Trello-koppeling testen</h1>
        <div style={{ marginTop: '8px', color: '#5C5C5A', fontSize: '15px', maxWidth: '640px', textWrap: 'pretty' }}>Controleer of de server met Trello kan praten en of een bord de lijsten, labels en velden gebruikt waar de monitor op rekent.</div>
      </header>

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={h2}>Verbinding</h2>
          {conn.state !== 'off' ? <Button variant="ghost" size="sm" onClick={test} disabled={conn.state === 'busy'}>{conn.state === 'busy' ? 'Bezig…' : 'Opnieuw testen'}</Button> : null}
        </div>
        {conn.state === 'off' ? <>
          <div style={row}><span style={dot('#D32F2F')} /><span style={{ fontWeight: 600 }}>Trello is nog niet ingesteld op de server</span></div>
          <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', lineHeight: 1.55, color: '#3C3C3A' }}>
            <li>Open <a href="https://trello.com/power-ups/admin" target="_blank" rel="noreferrer">trello.com/power-ups/admin</a>, maak een Power-Up aan in de workspace met de klantborden (bijvoorbeeld “Campagnemonitor”) en kopieer onder <em>API-sleutel</em> de key.</li>
            <li>Maak een token met alleen leesrechten. Log in met een Trello-account dat alle klantborden kan zien en open: <span style={code}>https://trello.com/1/authorize?expiration=never&amp;name=Campagnemonitor&amp;scope=read&amp;response_type=token&amp;key=JOUW_KEY</span></li>
            <li>Zet in Render bij <em>Environment</em> de variabelen <span style={code}>TRELLO_KEY</span> en <span style={code}>TRELLO_TOKEN</span>. Na de herstart kun je hier testen.</li>
          </ol>
          <div style={{ fontSize: '13px', color: '#8C8C8A' }}>De key en het token blijven op de server; ze komen nooit in de browser van het team.</div>
        </> : null}
        {conn.state === 'busy' || conn.state === 'idle' ? <div style={row}><span style={dot('#F9A800')} />Verbinden met Trello…</div> : null}
        {conn.state === 'error' ? <div style={row}><span style={dot('#D32F2F')} /><span style={{ fontWeight: 600 }}>{conn.msg}</span></div> : null}
        {conn.state === 'ok' ? <div style={row}><span style={dot('#1A7A4A')} /><span><span style={{ fontWeight: 600 }}>Verbonden als {conn.me.fullName}</span> <span style={{ color: '#5C5C5A' }}>@{conn.me.username} · {conn.boards.length} open borden</span></span></div> : null}
      </section>

      {conn.state === 'ok' ? <section style={card}>
          <h2 style={h2}>Bord controleren</h2>
          <select value={boardId} onChange={e => check(e.target.value)} aria-label="Bord" style={{ height: '40px', border: '1px solid #E4E1DE', borderRadius: '8px', padding: '0 10px', fontSize: '14px', background: '#FFFFFF', maxWidth: '100%' }}>
            <option value="">Kies een klantbord</option>
            {conn.boards.map(b => <option key={b.id} value={b.id}>{b.name} · {agoTxt(b.dateLastActivity)}</option>)}
          </select>
          {board && board.busy ? <div style={{ fontSize: '14px', color: '#5C5C5A' }}>Bord laden…</div> : null}
          {board && board.error ? <div style={row}><span style={dot('#D32F2F')} />{board.error}</div> : null}
          {an ? <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Check ok={an.has('nieuw')}>Lijst “Nieuw”</Check>
              <Check ok={an.has('contact')} warn>Lijst “Contactpoging”</Check>
              <Check ok={!!an.sd} warn sub={an.sd ? 'week van sollicitatie' : 'ontbreekt: de aanmaakdatum van de kaart wordt gebruikt'}>Veld “Sollicitatiedatum”</Check>
              <Check ok={!!an.rf} warn sub={an.rf ? `${(an.rf.options || []).length} redenen` : 'ontbreekt: geen afwijsredenen in de monitor'}>Veld “Reden afgewezen”</Check>
              <Check ok={an.labels.length > 0} warn sub={an.labels.length ? `${an.labels.length} labels, te koppelen als functie` : 'geen labels: het hele bord wordt één campagne'}>Labels</Check>
            </div>
            <div>
              <div style={{ ...eyebrow, marginBottom: '6px' }}>Lijsten · {an.total} kandidaten</div>
              {an.lists.map((l, i) => { const S = STAGES[l.stage]; return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto 40px', gap: '12px', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #F5F2ED', fontSize: '14px' }}>
                  <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5C5C5A' }}><span style={dot(S[2])} /><span style={{ color: S[2], fontWeight: 600 }}>{S[0]}</span> <span>· {S[1]}</span></span>
                  <span style={{ textAlign: 'right', fontWeight: 600 }}>{l.n}</span>
                </div>); })}
            </div>
            {an.labels.length ? <div>
                <div style={{ ...eyebrow, marginBottom: '8px' }}>Labels</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{an.labels.map((l, i) => <span key={i} style={{ fontSize: '13px', background: '#F5F2ED', borderRadius: '999px', padding: '4px 10px' }}>{l.name} <span style={{ color: '#8C8C8A' }}>{l.n}</span></span>)}</div>
              </div> : null}
          </> : null}
        </section> : null}

      {conn.state === 'ok' ? <section style={{ ...card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: '#FFF8E0', border: 0 }}>
          <div>
            <div style={h2}>Klaar om live te gaan</div>
            <div style={{ fontSize: '14px', color: '#3C3C3A', marginTop: '2px' }}>Zet de databron op Trello live en koppel borden aan recruiters.</div>
          </div>
          <Button variant="accent" onClick={goTrelloLive}>Naar Klanten uit Trello</Button>
        </section> : null}
    </div>
  );
}
