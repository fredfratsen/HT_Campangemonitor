// Which right each change to the shared data needs. The app hides what you can't do; this is the check that
// actually counts. Called per changed key (see store.patch) with the value before and after. Returns '' to
// allow, a reason to reject, or { value } to store a corrected value: author fields (recBy, klantBy, by,
// from) are always set to the person who is logged in, so nobody can save under someone else's name.
import { rightsOf } from '../src/lib/permissions.js';
import { DEF_RULES, RENAME } from '../src/lib/constants.js';

export const NO_RIGHT = 'Je hebt geen rechten voor deze wijziging.';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isEmpty = v => v == null || (Array.isArray(v) ? !v.length : typeof v === 'object' && !Object.keys(v).length);
const keysOf = (...objs) => [...new Set(objs.flatMap(o => o && typeof o === 'object' ? Object.keys(o) : []))];
// Fields of a feedback week that belong to the recruiter's check-in, and to the client feedback.
const REC_FIELDS = new Set(['leads', 'q', 'rec', 'recBy', 'note', 'needsAction', 'at']);
const KLANT_FIELDS = new Set(['klant', 'klantBy']);
const emptyWeek = w => w && w.q == null && !w.rec && !w.klant && !w.note && !w.needsAction && !w.at;

export function makeAuthorizer(actor, docs) {
  const R = rightsOf(actor), has = r => R.has(r), any = (...rs) => rs.some(has);
  const mine = new Set([actor.name, actor.recName].filter(Boolean));
  const need = ok => ok ? '' : NO_RIGHT;
  const canRec = campaignRec => has('feedback.all') || (has('feedback.own') && !!actor.recName && campaignRec === actor.recName);

  /** Checks the changes between two feedback weeks. Returns '' or a reason. */
  function weekChange(bw, aw, campaignRec, { allowLeadsDrop = false } = {}) {
    for (const f of keysOf(bw, aw)) {
      if (same(bw && bw[f], aw && aw[f])) continue;
      if (REC_FIELDS.has(f)) {
        // In Trello mode a manual candidate count disappears by itself once Trello counts the same number.
        if (f === 'leads' && allowLeadsDrop && aw && aw[f] === undefined) continue;
        if (!canRec(campaignRec)) return NO_RIGHT;
      } else if (KLANT_FIELDS.has(f)) { if (!has('feedback.client')) return NO_RIGHT; }
      else if (f === 'tr') continue; // demo pipeline numbers, derived data
      else if (!has('dev')) return NO_RIGHT;
    }
    return '';
  }
  /** Author fields that changed are set to the actor. Returns the (possibly copied) week. */
  function stampWeek(bw, aw) {
    if (!aw) return aw;
    let out = aw;
    for (const f of ['recBy', 'klantBy']) {
      if (aw[f] !== undefined && (!bw || bw[f] !== aw[f]) && aw[f] !== actor.name) { if (out === aw) out = { ...aw }; out[f] = actor.name; }
    }
    return out;
  }

  const rules = {
    campaigns(key, before, after) {
      if (before === undefined) return need(any('trello.link', 'dev'));
      if (after === undefined) return need(has('dev'));
      for (const k of keysOf(before, after)) {
        if (k === 'weeks' || k === 'actions' || same(before[k], after[k])) continue;
        if (k === 'rec' && RENAME[before.rec] === after.rec) continue; // old demo names, renamed by the app on load
        if (['rec', 'ended', 'inactive'].includes(k)) { if (!has('assign')) return NO_RIGHT; }
        else if (!any('trello.link', 'dev')) return NO_RIGHT;
      }
      if (!same(before.actions, after.actions) && !has('campaign.changes')) return NO_RIGHT;
      const bws = before.weeks || [], aws = after.weeks || [];
      let stamped = null;
      for (let i = 0; i < Math.max(bws.length, aws.length); i++) {
        const bw = bws[i], aw = aws[i];
        if (same(bw, aw)) continue;
        if (!aw) { if (!has('dev')) return NO_RIGHT; continue; }
        if (!bw) { if (!emptyWeek(aw) && !has('dev')) return NO_RIGHT; continue; } // a new week rolls in: anyone
        const err = weekChange(bw, aw, before.rec);
        if (err) return err;
        const sw = stampWeek(bw, aw);
        if (sw !== aw) { stamped = stamped || aws.slice(); stamped[i] = sw; }
      }
      return stamped ? { value: { ...after, weeks: stamped } } : '';
    },
    rules(key, before, after) {
      if (has('rules.edit')) return '';
      // The app fills in defaults for rules that are new since the data was saved.
      if (before === undefined && key in DEF_RULES && same(after, DEF_RULES[key])) return '';
      return NO_RIGHT;
    },
    trIgnored: () => need(has('trello.link')),
    mktDemo: () => need(has('assign')),
    'live.links': () => need(any('trello.link', 'assign')),
    'live.ignored': () => need(has('trello.link')),
    'live.inactive': () => need(has('assign')),
    'live.mkt': () => need(has('assign')),
    'live.fb'(key, before, after) {
      if (before === undefined && isEmpty(after)) return ''; // a newly linked campaign gets an empty entry
      if (after === undefined) return need(any('trello.link', 'dev'));
      const link = (docs['live.links'] || {})[key], campaignRec = link && link.rec;
      let stamped = null;
      for (const w of keysOf(before, after)) {
        const bw = (before || {})[w], aw = (after || {})[w];
        if (same(bw, aw)) continue;
        const err = weekChange(bw || {}, aw || {}, campaignRec, { allowLeadsDrop: true });
        if (err) return err;
        const sw = stampWeek(bw, aw);
        if (sw !== aw) { stamped = stamped || { ...after }; stamped[w] = sw; }
      }
      return stamped ? { value: stamped } : '';
    },
    'live.actions'(key, before, after) {
      if (before === undefined && isEmpty(after)) return '';
      return need(has('campaign.changes'));
    },
    assignLog(key, before, after) {
      if (!any('assign', 'trello.link')) return NO_RIGHT;
      if (before === undefined) return after && after.by !== actor.name ? { value: { ...after, by: actor.name } } : '';
      if (after === undefined) return ''; // the log keeps the newest 500
      return need(has('dev'));
    },
    inbox(key, before, after) {
      if (before === undefined) {
        const ok = after && (after.kind === 'reminder' ? has('reminders.send') : after.kind === 'assign' ? any('assign', 'trello.link') : has('dev'));
        if (!ok) return NO_RIGHT;
        return after.from !== actor.name ? { value: { ...after, from: actor.name } } : '';
      }
      if (after === undefined) return need(has('dev'));
      // Marking your own notification as read.
      const changed = keysOf(before, after).filter(k => !same(before[k], after[k]));
      if (changed.length === 1 && changed[0] === 'read' && mine.has(before.to)) return '';
      return need(has('dev'));
    },
    ideas(key, before, after) {
      if (before === undefined) {
        const value = { ...after, by: actor.name, voters: (after.voters || []).filter(n => n === actor.name) };
        if (!has('ideas.manage')) value.status = 'nieuw';
        return same(value, after) ? '' : { value };
      }
      if (after === undefined) return need(has('ideas.manage'));
      for (const k of keysOf(before, after)) {
        if (same(before[k], after[k])) continue;
        if (k === 'voters') {
          const b = new Set(before.voters || []), a = new Set(after.voters || []);
          const diff = [...a].filter(n => !b.has(n)).concat([...b].filter(n => !a.has(n)));
          if (diff.every(n => n === actor.name)) continue; // your own +1
        }
        if (!has('ideas.manage')) return NO_RIGHT;
      }
      return '';
    },
    // Each person's "last seen" times: only your own.
    seen: key => need(key === actor.id),
    meta: (key, before, after) => need((key === 'seeded' && after === true) || has('dev')),
  };

  return (doc, key, before, after) => {
    if (same(before, after)) return '';
    const fn = rules[doc];
    return fn ? fn(key, before, after) : need(has('dev'));
  };
}
