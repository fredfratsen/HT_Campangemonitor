// Easter egg: a bug sent via "Bug of idee melden" (only a bug, not an idea or improvement). The screen powers up anime
// style: a white flash, speed lines spinning in from the edges, an energy aura with sparks rising, ゴゴゴ menace, and
// questiondog (from /public) in a shaking card. Gone after a few seconds (App.bugCharge); it never catches clicks.
import React from 'react';

const SPARK_COLORS = ['#F9CE00', '#FFFFFF', '#FB8915', '#FFE680'];
function sparks(n = 46) {
  return Array.from({ length: n }, (_, i) => {
    const r = Math.random, w = 3 + r() * 5;
    return { key: i, style: { left: `${8 + r() * 84}%`, width: `${w}px`, height: `${w * (3 + r() * 4)}px`, background: SPARK_COLORS[i % SPARK_COLORS.length],
      animationDelay: `${0.35 + r() * 2.2}s`, animationDuration: `${0.7 + r() * 0.9}s` } };
  });
}
const GO = [{ left: '9%', top: '18%', delay: '.5s', size: 54 }, { left: '14%', top: '62%', delay: '.8s', size: 40 }, { left: '80%', top: '14%', delay: '.65s', size: 46 },
  { left: '84%', top: '58%', delay: '.95s', size: 60 }, { left: '22%', top: '82%', delay: '1.1s', size: 34 }, { left: '72%', top: '84%', delay: '1.25s', size: 38 }];

export default function BugCharge() {
  const [bits] = React.useState(sparks);
  return (
    <div className="bug-charge" role="status" aria-live="polite">
      <div className="bug-charge-dim" aria-hidden="true" />
      <div className="bug-charge-lines" aria-hidden="true" />
      <div className="bug-charge-aura" aria-hidden="true" />
      <div className="bug-charge-sparks" aria-hidden="true">{bits.map(b => <span key={b.key} style={b.style} />)}</div>
      {GO.map((g, i) => <span key={i} className="bug-charge-go" aria-hidden="true" style={{ left: g.left, top: g.top, fontSize: `${g.size}px`, animationDelay: g.delay }}>ゴゴ</span>)}
      <div className="bug-charge-flash" aria-hidden="true" />
      <div className="bug-charge-card">
        <div className="bug-charge-title">BUG GEMELD!!</div>
        <img className="bug-charge-fig" src="/questiondog.jpg" width="408" height="254" alt="" />
        <div className="bug-charge-cap">^ Tsjerk right now</div>
      </div>
    </div>
  );
}
