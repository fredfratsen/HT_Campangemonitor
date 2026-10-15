// Tijdwinst: per feedback week, the team's active time in the app per task next to the agreed time from before the
// app (lib/timesaved.js). The server only keeps team totals (server/timing.js).
import React, { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import { api, fmtDate } from '../../lib/api.js';
import { TASKS, timeReport, dur } from '../../lib/timesaved.js';
import { wl, range } from '../../lib/weeks.js';
import { Section, Notice, Err, useAction, input, label, muted, row } from './ui.jsx';

const HEAD = ['Aantal', 'Vroeger', 'In de app', 'Tijdwinst'];
const cell ={ padding: '8px 0', fontSize: '14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const head = { ...cell, fontSize: '12px', color: '#5C5C5A', fontWeight: 500 };
const savedFg = s => s == null ? '#8C8C8A' : s < 0 ? '#D32F2F' : '#1A7A4A';

/** Task rows, other screens, and a total over the tasks with agreed minutes. */
function WeekTable({ r }) {
  const counted = TASKS.filter(t => r.tasks[t.key].oldSec != null), list = counted.length ? counted : TASKS;
  const sum = k => list.reduce((s, t) => s + r.tasks[t.key][k], 0);
  // undefined: no value in this row (the cell stays empty, and on phones it is left out)
  const line = (key, name, sub, units, oldSec, appSec, savedSec, strong) => (
    <div key={key} className="ts-row" style={{ borderTop: '1px solid #F5F2ED', fontWeight: strong ? 600 : 400 }}>
      <div className="ts-name" style={{ ...cell, textAlign: 'left' }}>{name}{sub ? <div style={{ fontSize: '12px', color: '#8C8C8A', fontWeight: 400 }}>{sub}</div> : null}</div>
      <div data-l={HEAD[0]} style={cell}>{units === undefined ? null : units}</div>
      <div data-l={HEAD[1]} style={cell}>{oldSec === undefined ? null : dur(oldSec)}</div>
      <div data-l={HEAD[2]} style={cell}>{dur(appSec)}</div>
      <div data-l={HEAD[3]} style={{ ...cell, color: savedFg(savedSec), fontWeight: 600 }}>{savedSec === undefined ? null : dur(savedSec)}</div>
    </div>
  );
  return (
    <div>
      <div className="ts-row ts-head">
        <div style={{ ...head, textAlign: 'left' }}>Taak</div>{HEAD.map(h => <div key={h} style={head}>{h}</div>)}
      </div>
      {TASKS.map(t => { const x = r.tasks[t.key]; return line(t.key, t.label, t.units, x.units, x.oldSec, x.appSec, x.savedSec); })}
      {line('other', 'Overige schermen', 'telt niet mee in de tijdwinst', undefined, undefined, r.otherSec, undefined)}
      {line('total', 'Totaal', counted.length && counted.length < TASKS.length ? 'taken met een afgesproken tijd' : '', undefined, counted.length ? sum('oldSec') : null, sum('appSec'), r.savedSec, true)}
    </div>
  );
}

function Minutes({ data, onSaved, flash }) {
  const toVals = m => Object.fromEntries(TASKS.map(t => [t.key, m[t.key] == null ? '' : String(m[t.key])]));
  const [vals, setVals] = useState(toVals(data.minutes));
  const a = useAction(flash);
  const dirty = TASKS.some(t => vals[t.key] !== toVals(data.minutes)[t.key]);
  const save = async e => {
    e.preventDefault();
    const r = await a.run(() => api('PUT', '/api/timing/minutes', { minutes: vals }), 'Afgesproken tijd opgeslagen');
    if (r) { onSaved(r); setVals(toVals(r.minutes)); }
  };
  return (
    <Section title="Tijd van vroeger per taak" sub={`De afgesproken tijd in minuten die een taak vóór de app kostte.${data.minutesAt ? ` Laatst gewijzigd op ${fmtDate(data.minutesAt)}.` : ''}`}>
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px 16px' }}>
          {TASKS.map(t => <label key={t.key} style={label}>{t.label}
              <span style={{ ...row, gap: '8px', flexWrap: 'nowrap' }}>
                <input type="number" min="0" max="600" step="0.5" inputMode="decimal" value={vals[t.key]} onChange={e => setVals({ ...vals, [t.key]: e.target.value })} style={{ ...input, width: '96px' }} />
                <span style={{ ...muted, fontWeight: 400 }}>min per {t.unit}</span>
              </span>
            </label>)}
        </div>
        <div><Button type="submit" variant="accent" size="sm" disabled={a.busy || !dirty}>Opslaan</Button></div>
        <Err>{a.error}</Err>
      </form>
    </Section>
  );
}

export default function TimeSavedTab({ s }) {
  const [data, setData] = useState(null);
  const a = useAction(s.flash);
  useEffect(() => { if (!s.isLocal) a.run(async () => setData(await api('GET', '/api/timing'))); }, []);
  if (s.isLocal) return <Notice>In de lokale demo zonder server wordt geen tijd gemeten.</Notice>;
  const rep = data && timeReport(s.campaigns, data), first = rep && rep.weeks[rep.weeks.length - 1];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px' }}>
      <div style={muted}>Per week de tijd die het team actief in de app werkt, opgeteld voor iedereen samen, naast de afgesproken tijd van vroeger. De app bewaart niet wie die tijd besteedde.</div>
      {s.onDemo ? <Notice tone="warn">De aantallen hieronder komen uit de demo-data. Gemeten tijd telt alleen met de databron Trello live.</Notice> : null}
      {data ? <Minutes data={data} onSaved={setData} flash={s.flash} /> : null}
      {rep && !rep.weeks.length ? <Notice>Er is nog geen tijd gemeten.</Notice> : null}
      {rep && rep.weeks.length ? <Section title={`Sinds week ${wl(first.w)}`} sub={`Tijdwinst over ${rep.weeks.length === 1 ? '1 week' : `${rep.weeks.length} weken`}.`}
          right={<div style={{ fontFamily: 'Poppins,sans-serif', fontSize: '28px', fontWeight: 600, color: savedFg(rep.total.savedSec) }}>{dur(rep.total.savedSec)}</div>}>
          <WeekTable r={rep.total} />
        </Section> : null}
      {rep ? rep.weeks.map(r => <Section key={r.w} title={`Week ${wl(r.w)}`} sub={`${range(r.w)} · actief in de app: ${dur(r.activeSec)}`}
          right={<div style={{ fontFamily: 'Poppins,sans-serif', fontSize: '20px', fontWeight: 600, color: savedFg(r.savedSec) }}>{dur(r.savedSec)}</div>}>
          <WeekTable r={r} />
        </Section>) : null}
      <Err>{a.error}</Err>
    </div>
  );
}
