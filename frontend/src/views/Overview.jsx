/* Overview.jsx — the home view: KPIs, leads by pillar, today's appointments,
   new leads per week (stacked chart or table), needs attention, sources,
   Incube8 funnel, team today, tasks, weekly report and client health. */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useDialog } from '../dialogs';
import { Head, Kpi, Delta, HBars, Icon, PillTag, Avatar, St } from '../ui';
import { metrics, attention, weekly, isOpen, memberStats, whoOf } from '../lib/derive';
import { istTime, longToday, fDN, fD, dateAt, inrS, sum, dayDiff } from '../lib/format';

function niceMax(v) {
  if (v <= 4) return 4;
  const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
  return Math.max(4, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e);
}

function Trend({ data, meta }) {
  const ref = useRef(null);
  const [W, setW] = useState(600);
  const [hi, setHi] = useState(-1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth || 600)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 270, ml = 30, mr = 4, mt = 18, mb = 26, PK = meta.pillarKeys;
  const mx = niceMax(Math.max(...data.map((d) => d.total))), ph = H - mt - mb, n = data.length, cw = (W - ml - mr) / n, bw = Math.min(44, cw * 0.62);
  const d = hi >= 0 ? data[hi] : null;
  const tipX = hi >= 0 ? ml + hi * cw + cw / 2 : 0;
  return (
    <div className="cw" ref={ref} onMouseLeave={() => setHi(-1)}>
      <svg viewBox={'0 0 ' + W + ' ' + H} width={W} height={H} role="img" aria-label="Stacked column chart of new leads per week for the last 8 weeks, by pillar">
        {[0, 0.5, 1].map((f) => {
          const y = mt + ph - f * ph;
          return <g key={f}><line className="gl" x1={ml} x2={W - mr} y1={y} y2={y} /><text x={ml - 6} y={y + 4} textAnchor="end">{Math.round(mx * f)}</text></g>;
        })}
        {data.map((w, i) => {
          const x = ml + i * cw + (cw - bw) / 2;
          let y = mt + ph;
          const segs = PK.map((p) => {
            const v = w.c[p];
            if (!v) return null;
            const h = (v / mx) * ph;
            y -= h;
            return <rect key={p} className="seg" x={x} y={y} width={bw} height={Math.max(2, h)} rx="2" style={{ fill: 'var(--c-' + p + ')' }} />;
          });
          return (
            <g key={i}>
              {segs}
              <text className="tot" x={x + bw / 2} y={y - 5} textAnchor="middle">{w.total}</text>
              {(cw >= 58 || (n - 1 - i) % 2 === 0) && <text x={x + bw / 2} y={H - 8} textAnchor="middle">{w.label}</text>}
              <rect className={'hit' + (hi === i ? ' on' : '')} x={ml + i * cw} y={mt} width={cw} height={ph} onMouseEnter={() => setHi(i)} onClick={() => setHi(i)} />
            </g>
          );
        })}
      </svg>
      {d && (
        <div className="tip" style={{ left: Math.min(Math.max(hi < n / 2 ? tipX + cw / 2 + 90 : tipX - cw / 2 - 90, 90), W - 90), top: mt - 6, transform: 'translate(-50%,0)' }}>
          <b>{d.label} to {d.end}</b>
          {PK.map((p) => <div className="r" key={p}><span><i className="sq" style={{ '--pc': 'var(--c-' + p + ')' }} />{meta.pillars[p].name}</span><span className="num">{d.c[p]}</span></div>)}
          <div className="r"><b>Total</b><b className="num">{d.total}</b></div>
        </div>
      )}
    </div>
  );
}

export default function Overview({ go }) {
  const { S } = useStore();
  const { open } = useDialog();
  const [table, setTable] = useState(false);
  const meta = S.meta, P = meta.pillars, PK = meta.pillarKeys;
  const m = metrics(S), wk = weekly(S.leads, PK), att = attention(m, S);
  const hour = Number(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  const srcRows = Object.keys(m.bySrc).map((k) => [k, m.bySrc[k]]).sort((a, b) => b[1] - a[1]);
  const inc = S.leads.filter((l) => l.pillar === 'incubation');
  const incC = P.incubation.stages.map((s, i) => [s, inc.filter((l) => l.stage === i).length]);
  const ks = [['todo', 'To do'], ['doing', 'In progress'], ['review', 'Review']].map((a) => [a[1], S.tasks.filter((t) => t.status === a[0]).length]);
  ks.push(['Done (7d)', m.done7]);
  const soon = S.tasks.filter((t) => t.status !== 'done').sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1).slice(0, 5);
  const owner = (id) => (S.team.find((t) => t._id === id) || {}).name || 'Unassigned';
  const SLAB = { P: ['good', 'Present'], W: ['acc', 'WFH'], L: ['warn', 'Leave'], A: ['crit', 'Absent'], O: ['neutral', 'Off'], '': ['neutral', 'Not marked'] };

  return (
    <>
      <Head title={'Good ' + (hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening')} sub={'Everything across Services, Production house, Training and Incube8, in one view. ' + longToday() + '.'}>
        <button className="btn" onClick={() => open('appt')}><Icon n="cal" /> Book appointment</button>
        <button className="btn" onClick={() => open('task')}><Icon n="plus" /> New task</button>
      </Head>
      <div className="grid">
        <Kpi href="leads" lab="New leads (7 days)" val={m.new7} sub={'vs ' + m.prev7 + ' the week before'} extra={<><Delta a={m.new7} b={m.prev7} /> </>} />
        <Kpi href="leads" lab="Open pipeline" val={inrS(m.pipe)} sub={m.openSales.length + ' open leads, excl. Incube8'} />
        <Kpi href="appointments" lab="Appointments today" val={m.apToday.length} sub={m.apWeek.length + ' in the next 7 days'} />
        <Kpi href="appointments" lab="Website requests" val={m.req.length} sub="calls waiting to be confirmed" />
        <Kpi href="team" lab="Tasks overdue" val={m.overdue.length} sub={m.kOpen.length + ' open · ' + m.dueToday.length + ' due today'} />
        <Kpi href="team" lab="In today" val={m.inCount + ' / ' + S.team.length} sub={S.team.length ? (m.unmarked ? m.unmarked + ' not marked yet' : 'All marked') : 'Add your team in Settings'} />

        <section className="card s8">
          <div className="chead"><div><h3>Leads by pillar</h3><p className="csub">Lighter bands are earlier stages, darker are closer to won, grey is lost.</p></div><a className="link" href="#leads">All leads <Icon n="right" /></a></div>
          {PK.map((p) => {
            const ls = S.leads.filter((l) => l.pillar === p), st = P[p].stages, cnt = st.map((s, i) => ls.filter((l) => l.stage === i).length), ops = [0.38, 0.52, 0.66, 0.82, 1];
            return (
              <div className={'prow p-' + p} key={p}>
                <div className="nm"><i className="dot" />{P[p].name}</div>
                <div className="mid">
                  <div className="bar stack" role="img" aria-label={P[p].name + ' leads by stage: ' + st.map((s, i) => s + ' ' + cnt[i]).join(', ')}>
                    {cnt.map((c, i) => (c ? <i key={i} style={{ flex: c, ...(i === 5 ? { background: 'var(--axis)' } : { opacity: ops[i] }) }} title={st[i] + ': ' + c} /> : null))}
                  </div>
                  <div className="cnts">{st.map((s, i) => <span key={s}>{s} <b className="num">{cnt[i]}</b></span>)}</div>
                </div>
                <div className="tt num" title="Total leads">{ls.length}<small style={{ display: 'block', fontSize: '.72rem', fontWeight: 500, color: 'var(--muted)' }}>{ls.filter(isOpen).length} open</small></div>
              </div>
            );
          })}
        </section>

        <section className="card s4">
          <div className="chead"><div><h3>Today's appointments</h3><p className="csub">{fDN(0)}</p></div><a className="link" href="#appointments">Agenda <Icon n="right" /></a></div>
          <div className="list">
            {m.apToday.length ? m.apToday.slice().sort((a, b) => new Date(a.start) - new Date(b.start)).map((a) => (
              <div className="li" key={a.apptId}>
                <span className="tm">{istTime(a.start)}</span>
                <div className="mid"><b>{whoOf(a)}</b><small>{a.kind} · {a.mode}{a.status === 'requested' ? ' · to confirm' : ''}</small></div>
                <PillTag p={a.pillar} meta={meta} go />
              </div>
            )) : <p className="empty">No appointments today.</p>}
          </div>
        </section>

        <section className="card s8">
          <div className="chead">
            <div><h3>New leads per week</h3><p className="csub">Last 8 weeks, all four pillars. Hover or tap a column for the split.</p></div>
            <button className="btn sm" aria-pressed={table} onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show table'}</button>
          </div>
          {table ? (
            <div className="tw"><table className="t"><thead><tr><th>Week</th>{PK.map((p) => <th className="r" key={p}>{P[p].name}</th>)}<th className="r">Total</th></tr></thead>
              <tbody>{wk.slice().reverse().map((w) => <tr key={w.label}><td>{w.label} to {w.end}</td>{PK.map((p) => <td className="r num" key={p}>{w.c[p]}</td>)}<td className="r num"><b>{w.total}</b></td></tr>)}</tbody></table></div>
          ) : (
            <>
              <div className="legend">{PK.map((p) => <span className={'p-' + p} key={p}><i className="sq" />{P[p].name}</span>)}</div>
              <Trend data={wk} meta={meta} />
            </>
          )}
        </section>

        <section className="card s4">
          <div className="chead"><div><h3>Needs attention</h3><p className="csub">Click an item to open it</p></div></div>
          <div className="list">
            {att.length ? att.map((a) => (
              <button className="att" key={a.t} onClick={() => go(a.go, a.f)}>
                <span className={'ico ' + a.sev}><Icon n={a.ic} /></span>
                <span className="mid"><b>{a.t}</b><small>{a.s}</small></span>
                <span className="n num">{a.n}</span>
              </button>
            )) : <p className="empty">Nothing needs attention.</p>}
          </div>
        </section>

        <section className="card s4">
          <div className="chead"><div><h3>Where leads come from</h3><p className="csub">All leads, by source</p></div></div>
          {srcRows.length ? <HBars rows={srcRows} /> : <p className="empty">No leads yet.</p>}
        </section>

        <section className="card s4">
          <div className="chead"><div><h3>Incube8 funnel</h3><p className="csub">Applicants by stage</p></div><a className="link" href="#pipeline/incubation">Open <Icon n="right" /></a></div>
          <HBars rows={incC.slice(0, 5)} />
          <p className="note">Declined: {incC[5][1]}</p>
        </section>

        <section className="card s4">
          <div className="chead"><div><h3>Weekly report</h3><p className="csub">Last 7 days, {fD(dateAt(-6))} to {fD(dateAt(0))}</p></div></div>
          <dl className="kv" style={{ gridTemplateColumns: '140px 1fr' }}>
            <dt>New leads</dt><dd className="num">{m.new7}</dd>
            <dt>Won / enrolled</dt><dd className="num">{m.won7}</dd>
            <dt>Appointments held</dt><dd className="num">{m.apHeld7}</dd>
            <dt>Tasks done</dt><dd className="num">{m.done7}</dd>
            <dt>Attendance</dt><dd className="num">{S.team.length ? m.attPct + '%' : '–'}</dd>
            <dt>Client fees</dt><dd className="num">{inrS(m.mrr)} / month</dd>
          </dl>
          <div className="tools" style={{ margin: '14px 0 0' }}>
            <button className="btn primary sm" onClick={() => open('report')}><Icon n="file" /> Generate report</button>
            <a className="link" href="#reports">Reports <Icon n="right" /></a>
          </div>
        </section>

        <section className="card s5">
          <div className="chead"><div><h3>Team today</h3><p className="csub">Attendance for {fDN(0)}</p></div><a className="link" href="#team">Mark <Icon n="right" /></a></div>
          {S.team.length ? (
            <div className="tm-strip">
              {S.team.map((t) => { const v = m.attToday(t); return <div className="tm-c" key={t._id}><Avatar name={t.name} /><b>{t.name.split(' ')[0]}</b><St k={SLAB[v][0]}>{SLAB[v][1]}</St></div>; })}
            </div>
          ) : <p className="empty">No team members yet. <a className="link" href="#settings">Add them in Settings</a>.</p>}
        </section>

        <section className="card s7">
          <div className="chead"><div><h3>Tasks</h3><p className="csub">Open work by status, and what is due next</p></div><a className="link" href="#team">Board <Icon n="right" /></a></div>
          <div className="bar" role="img" aria-label={'Tasks: ' + ks.map((x) => x[0] + ' ' + x[1]).join(', ')}>
            {ks.map((x, i) => <i key={x[0]} style={{ flex: Math.max(x[1], 0.0001), opacity: [0.4, 0.62, 0.82, 1][i] }} />)}
          </div>
          <div className="sumrow" style={{ margin: '8px 0 6px' }}>{ks.map((x) => <span key={x[0]}>{x[0]} <b>{x[1]}</b></span>)}</div>
          <div className="list">
            {soon.length ? soon.map((t) => (
              <button className="li" key={t._id} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0 }} onClick={() => open('task', { task: t })}>
                <div className="mid"><b>{t.title}</b><small>{t.area} · {owner(t.owner)}</small></div>
                {t.due && <DueLab due={t.due} />}
              </button>
            )) : <p className="empty">No open tasks.</p>}
          </div>
        </section>

        <section className="card s12">
          <div className="chead"><div><h3>Client health</h3><p className="csub">Healthy, watch or at risk, with the reason</p></div><a className="link" href="#clients">Clients <Icon n="right" /></a></div>
          {S.clients.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 10 }}>
              {S.clients.map((c) => (
                <div className="mini" key={c._id}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><b>{c.name}</b><HealthSt h={c.health} /></div>
                  <div style={{ color: 'var(--muted)', fontSize: '.82rem', marginTop: 3 }}>{c.service}</div>
                  {c.healthWhy && <div style={{ fontSize: '.84rem', marginTop: 6 }}>{c.healthWhy}</div>}
                </div>
              ))}
            </div>
          ) : <p className="empty">No clients yet. Add one in Clients, or from a won lead.</p>}
        </section>

        {S.team.length > 0 && (
          <section className="card s12">
            <div className="chead"><div><h3>Output by team member</h3><p className="csub">Last 7 days. Shown as separate measures on purpose: no single score.</p></div><a className="link" href="#team">Details <Icon n="right" /></a></div>
            <div className="tw"><table className="t rt"><thead><tr><th>Member</th><th className="r">Done</th><th className="r">On time</th><th className="r">Open</th><th className="r">Overdue</th><th className="r">Attendance</th></tr></thead>
              <tbody>{S.team.map((t) => { const s = memberStats(t, S.tasks, S.att); return (
                <tr key={t._id}><td className="first name">{t.name}<span className="sub">{t.role}</span></td><td data-l="Done (7d)" className="r num">{s.done}</td><td data-l="On time" className="r num">{s.onTime == null ? '–' : s.onTime + '%'}</td><td data-l="Open" className="r num">{s.open}</td><td data-l="Overdue" className="r num">{s.od ? <St k="crit">{s.od}</St> : 0}</td><td data-l="Attendance" className="r num">{s.att == null ? '–' : s.att + '%'}</td></tr>
              ); })}</tbody></table></div>
          </section>
        )}
      </div>
    </>
  );
}

export const HealthSt = ({ h }) => <St k={h === 'good' ? 'good' : h === 'warn' ? 'warn' : 'crit'}>{h === 'good' ? 'Healthy' : h === 'warn' ? 'Watch' : 'At risk'}</St>;
export function DueLab({ due, done }) {
  if (done) return null;
  const d = dayDiff(due);
  if (d < 0) return <St k="crit">Overdue {-d}d</St>;
  if (d === 0) return <St k="warn">Due today</St>;
  return <St k="neutral">{d === 1 ? 'Tomorrow' : fDN(d)}</St>;
}
export { sum };
