// The API of the client portal (a separate Next.js app, server to server): which candidates the recruiter handed to a
// client, and what the client does with them. forClient is the security boundary: an allow-list of what a client sees.
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { CandidateError } from './candidates.js';
import { visibleToClient, waitingSince, stageName } from '../src/lib/ats.js';
import { can } from '../src/lib/permissions.js';
import { stamp } from '../src/lib/weeks.js';

const PER_MIN = 120, MAX_LINKS = 50, OWN = 'Horeca Toppers';
// Timeline lines a client may see besides its own: the hand-over and the recruiter's moves, never notes or calls.
const SHARED = ['Doorgezet naar klant', 'Naar Gesprek', 'Naar Voorstel', 'Naar Aangenomen', 'Afgewezen'];

/** What a client may see of a candidate: exactly these keys, nothing internal. */
export function forClient(c) {
  return {
    id: c.id, linkId: c.link, naam: c.name, telefoon: c.phone || null, email: c.email || null,
    screening: c.screening || null, fase: c.stage, faseNaam: stageName(c.stage), gesprek: c.gesprek || null,
    reden: c.stage === 'afgewezen' ? c.reason || null : null,
    doorgezetOp: c.doorgezetOp || null, wachtSinds: waitingSince(c), klantGg: c.klantGg || 0,
    vragen: (c.vragen || []).map(q => ({ id: q.id, at: q.at, door: q.door, tekst: q.tekst, antwoord: q.antwoord || null })),
    tijdlijn: (c.log || []).filter(e => e.klant || SHARED.some(s => String(e.what).startsWith(s)))
      .map(e => ({ at: e.at, door: e.klant ? e.by : OWN, wat: e.what })),
  };
}

/** One inbox item per recipient of a client's question; deliberately without name, phone or question text. */
export function questionNotice(store, accounts, link, cand, now = Date.now()) {
  const rm = (store.docs['live.mkt'] || {})[link.boardId];
  const to = new Set(rm ? [rm] : accounts.all().filter(a => a.status === 'active' && can(a, 'assign')).map(a => a.name));
  if (link.rec) to.add(link.rec);
  const set = {};
  [...to].forEach((name, i) => {
    const id = now + i / 10;
    set[String(id)] = { id, to: name, from: 'Klantportaal', at: stamp(), read: false, kind: 'klantvraag', client: link.boardName,
      title: `Vraag van ${link.boardName} over een kandidaat · ${link.vac}`, items: [], link: `#bord=${link.id}&k=${cand.id}` };
  });
  return [{ doc: 'inbox', set }];
}

const str = v => (typeof v === 'string' ? v : undefined);

export function portaalRouter({ candidates, secrets, store, accounts, audit, atsChanged }) {
  const r = express.Router(), links = () => store.docs['live.links'] || {};
  let hits = { since: 0, n: 0 }, deniedAt = 0;

  r.use((req, res, next) => {
    const now = Date.now();
    if (now - hits.since >= 60000) hits = { since: now, n: 0 };
    if (++hits.n > PER_MIN) return res.status(429).json({ fout: 'Te veel verzoeken; probeer het over een minuut opnieuw.' });
    const s = secrets.get('portaal');
    if (!s) return res.status(503).json({ fout: 'Koppeling met het klantportaal staat uit' });
    const a = Buffer.from(String(req.get('x-toppers-sleutel') || '')), b = Buffer.from(s.sleutel);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      if (now - deniedAt >= 60000) { deniedAt = now; audit.log('portaal.denied', { details: { ip: req.ip } }); }
      return res.status(401).json({ fout: 'Geen toegang' });
    }
    next();
  });

  r.get('/functies', (req, res) => {
    const L = links();
    const functies = Object.keys(candidates.switched()).filter(id => L[id]).map(id => ({ linkId: id, klant: L[id].boardName, functie: L[id].vac }))
      .sort((x, y) => x.klant.localeCompare(y.klant, 'nl') || x.functie.localeCompare(y.functie, 'nl'));
    res.json({ functies });
  });

  r.get('/kandidaten', (req, res) => {
    const ids = String(req.query.links || '').split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length > MAX_LINKS) return res.status(400).json({ fout: 'Maximaal 50 functies per verzoek.' });
    const kandidaten = ids.flatMap(id => candidates.ofLink(id)).filter(visibleToClient)
      .sort((a, b) => b.doorgezetOp - a.doorgezetOp).map(forClient);
    res.json({ kandidaten });
  });

  r.post('/kandidaten/:id/actie', express.json({ limit: '20kb' }), (req, res) => {
    const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const d = b.door && typeof b.door === 'object' ? b.door : {};
    let c;
    try {
      c = candidates.klantAct(String(b.linkId || ''), req.params.id, { kind: String(b.kind || ''), at: str(b.at), reason: str(b.reason), text: str(b.text) },
        { naam: str(d.naam), organisatie: str(d.organisatie) });
    } catch (e) { if (e instanceof CandidateError) return res.status(400).json({ fout: e.message }); throw e; }
    if (!c) return res.status(404).json({ fout: 'Kandidaat niet gevonden' });
    atsChanged();
    if (b.kind === 'vraag') store.patch(questionNotice(store, accounts, links()[c.link] || { id: c.link, boardName: '', vac: '' }, c));
    res.json({ kandidaat: forClient(c) });
  });

  return r;
}
