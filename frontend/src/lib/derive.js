/* derive.js
   Numbers the dashboard shows, computed from the live lists in the store:
   KPIs, "needs attention", weekly lead counts, team output, report text.
   Stage index 0-3 is open, 4 won, 5 lost (see backend/lib/constants.js). */
import { dayOf, dayDiff, dateAt, fD, inrS, sum, pct, istDate } from './format';

export const OPEN = 4;
export const isOpen = (l) => l.stage < OPEN;
export const idleDays = (l) => -dayOf(l.lastTouchAt || l.updatedAt || l.createdAt);
export const isIdle = (l) => isOpen(l) && dayOf(l.createdAt) < 0 && idleDays(l) >= 3;
export const active = (a) => a.status !== 'cancelled';
export const apDay = (a) => dayOf(a.start);
export const leadOf = (a) => a.lead || null;
export const whoOf = (a) => (a.lead && a.lead.name) || a.who || '(no name)';

export function weekly(leads, keys) {
  const out = [];
  for (let k = 7; k >= 0; k--) {
    const hi = -7 * k, lo = -7 * k - 6, c = {};
    keys.forEach((p) => { c[p] = 0; });
    leads.forEach((l) => { const d = dayOf(l.createdAt); if (d >= lo && d <= hi && c[l.pillar] != null) c[l.pillar]++; });
    out.push({ label: fD(dateAt(lo)), end: fD(dateAt(hi)), c, total: sum(keys.map((p) => c[p])) });
  }
  return out;
}

export function memberStats(m, tasks, att) {
  const mine = tasks.filter((t) => t.owner === m._id);
  const done7 = mine.filter((t) => t.status === 'done' && t.doneAt && dayOf(t.doneAt) >= -6);
  const onTime = done7.filter((t) => !t.due || istDate(t.doneAt) <= t.due).length;
  const open = mine.filter((t) => t.status !== 'done');
  const od = open.filter((t) => t.due && dayDiff(t.due) < 0).length;
  let p = 0, n = 0;
  att.filter((a) => a.member === m._id && dayDiff(a.date) >= -6).forEach((a) => { if (a.status === 'O') return; n++; if (a.status === 'P' || a.status === 'W') p++; });
  return { done: done7.length, onTime: done7.length ? pct(onTime, done7.length) : null, open: open.length, od, att: n ? pct(p, n) : null };
}

export function metrics(S) {
  const L = S.leads, A = S.appts.filter(active), K = S.tasks, T = S.team, today = istDate();
  const created = (l) => dayOf(l.createdAt);
  const new7 = L.filter((l) => created(l) >= -6).length;
  const prev7 = L.filter((l) => created(l) <= -7 && created(l) >= -13).length;
  const openSales = L.filter((l) => isOpen(l) && l.pillar !== 'incubation');
  const apToday = A.filter((a) => apDay(a) === 0 && a.status !== 'noshow');
  const apWeek = A.filter((a) => apDay(a) >= 0 && apDay(a) <= 6 && (a.status === 'confirmed' || a.status === 'requested'));
  const kOpen = K.filter((t) => t.status !== 'done');
  const overdue = kOpen.filter((t) => t.due && t.due < today);
  const dueToday = kOpen.filter((t) => t.due === today);
  const attToday = (m) => (S.att.find((a) => a.member === m._id && a.date === today) || {}).status || '';
  const inCount = T.filter((m) => ['P', 'W'].includes(attToday(m))).length;
  const unmarked = T.filter((m) => !attToday(m)).length;
  const won7 = L.filter((l) => l.stage === 4 && dayOf(l.lastTouchAt) >= -6).length;
  const bySrc = {};
  L.forEach((l) => { const s = l.source || 'Other'; bySrc[s] = (bySrc[s] || 0) + 1; });
  const apHeld7 = A.filter((a) => a.status === 'done' && apDay(a) >= -6 && apDay(a) <= 0).length;
  /* no-shows whose lead has nothing booked after them */
  const noshows = A.filter((a) => a.status === 'noshow' && !A.some((b) => b !== a && b.lead && a.lead && b.lead._id === a.lead._id && ['requested', 'confirmed'].includes(b.status) && new Date(b.start) > new Date(a.start)));
  const req = A.filter((a) => a.status === 'requested');
  let ap = 0, at = 0;
  S.att.filter((a) => dayDiff(a.date) >= -6).forEach((a) => { if (a.status === 'O') return; at++; if (a.status === 'P' || a.status === 'W') ap++; });
  const clients = S.clients;
  return {
    L, A, K, new7, prev7, openSales, pipe: sum(openSales.map((l) => l.value || 0)), apToday, apWeek, kOpen, overdue, dueToday,
    attToday, inCount, unmarked, won7, bySrc, apHeld7, noshows, req, attPct: pct(ap, at),
    idle: L.filter(isIdle), skipped: L.filter((l) => l.appointmentSkipped && isOpen(l) && l.nextAction === 'Call the lead'),
    decide: L.filter((l) => l.pillar === 'incubation' && l.stage === 3),
    risk: clients.filter((c) => c.health !== 'good'), mrr: sum(clients.map((c) => c.monthlyFee || 0)),
    done7: K.filter((t) => t.status === 'done' && t.doneAt && dayOf(t.doneAt) >= -6).length,
  };
}

export function attention(m, S) {
  const a = [];
  const names = (arr, f) => arr.slice(0, 2).map(f).join(', ');
  if (m.req.length) a.push({ sev: 'warn', ic: 'cal', n: m.req.length, t: 'Website appointments to confirm', s: names(m.req, (x) => (x.lead && x.lead.name) || x.who) + ' booked a call in the form', go: 'appointments' });
  if (m.overdue.length) a.push({ sev: 'crit', ic: 'alert', n: m.overdue.length, t: 'Tasks overdue', s: names(m.overdue, (t) => t.title), go: 'team' });
  if (m.risk.some((c) => c.health === 'crit')) a.push({ sev: 'crit', ic: 'alert', n: m.risk.length, t: 'Clients need attention', s: names(m.risk, (c) => c.name), go: 'clients' });
  if (m.skipped.length) a.push({ sev: 'warn', ic: 'phone', n: m.skipped.length, t: 'Website leads to call', s: 'Skipped picking a time: ' + names(m.skipped, (l) => l.name), go: 'leads', f: 'call' });
  if (m.idle.length) a.push({ sev: 'warn', ic: 'clock', n: m.idle.length, t: 'Open leads untouched for 3+ days', s: 'Follow up before they go cold', go: 'leads', f: 'idle' });
  if (m.noshows.length) a.push({ sev: 'warn', ic: 'cal', n: m.noshows.length, t: 'No-show to rebook', s: names(m.noshows, (x) => (x.lead && x.lead.name) || x.who), go: 'appointments' });
  if (m.decide.length) a.push({ sev: 'neutral', ic: 'rocket', n: m.decide.length, t: 'Incube8 applicants awaiting a decision', s: names(m.decide, (l) => l.name), go: 'pipeline/incubation' });
  if (m.unmarked && S.team.length) a.push({ sev: 'neutral', ic: 'users', n: m.unmarked, t: 'Attendance not marked today', s: S.team.filter((t) => !m.attToday(t)).map((t) => t.name.split(' ')[0]).join(', '), go: 'team' });
  return a;
}

export function reportText(S, meta) {
  const m = metrics(S), P = meta.pillars, PK = meta.pillarKeys, wk = weekly(S.leads, PK), cur = wk[7], out = [], p = (s) => out.push(s);
  const top = Object.keys(m.bySrc).sort((a, b) => m.bySrc[b] - m.bySrc[a])[0];
  const inc = S.leads.filter((l) => l.pillar === 'incubation');
  const owner = (id) => (S.team.find((t) => t._id === id) || {}).name || 'Unassigned';
  p('t&f weekly report');
  p('Period: ' + fD(dateAt(-6)) + ' to ' + fD(dateAt(0)) + ' ' + new Date().getFullYear() + ', last 7 days');
  p('');
  p('LEADS');
  p('- New leads: ' + m.new7 + ' (previous 7 days: ' + m.prev7 + ')');
  p('  ' + PK.map((k) => P[k].name + ' ' + cur.c[k]).join(', '));
  p('- Won, enrolled or onboarded: ' + m.won7);
  p('- Open pipeline: ' + inrS(m.pipe) + ' across ' + m.openSales.length + ' open leads (excluding Incube8)');
  if (top) p('- Biggest source overall: ' + top + ' (' + m.bySrc[top] + ' leads)');
  p('- Open leads untouched for 3+ days: ' + m.idle.length);
  p('- Website leads waiting for a call back: ' + m.skipped.length);
  p('');
  p('APPOINTMENTS');
  p('- Held in the last 7 days: ' + m.apHeld7 + '; no-shows to rebook: ' + m.noshows.length);
  p('- Booked for the next 7 days: ' + m.apWeek.length + ' (' + m.apToday.length + ' today)');
  p('- Website requests waiting to be confirmed: ' + m.req.length);
  p('');
  p('TEAM');
  p('- Tasks done: ' + m.done7 + '; open: ' + m.kOpen.length + '; overdue: ' + m.overdue.length);
  if (S.team.length) p('- Attendance: ' + m.attPct + '%');
  m.overdue.forEach((t) => p('  Overdue: ' + t.title + ' (' + t.area + ', ' + owner(t.owner) + ')'));
  p('');
  p('INCUBE8');
  p('- ' + P.incubation.stages.slice(0, 5).map((s, i) => s + ' ' + inc.filter((l) => l.stage === i).length).join(', ') + '; declined ' + inc.filter((l) => l.stage === 5).length);
  p('- Awaiting a decision: ' + (m.decide.length ? m.decide.map((l) => l.name).join(', ') : 'none'));
  p('');
  p('CLIENTS');
  const c = S.clients;
  p('- ' + c.filter((x) => x.health === 'good').length + ' healthy, ' + c.filter((x) => x.health === 'warn').length + ' watch, ' + c.filter((x) => x.health === 'crit').length + ' at risk; monthly fees ' + inrS(m.mrr));
  c.filter((x) => x.health !== 'good').forEach((x) => p('  ' + x.name + ': ' + (x.healthWhy || 'no reason given')));
  return out.join('\n');
}
