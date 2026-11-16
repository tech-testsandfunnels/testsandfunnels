/* Reports.jsx — the weekly numbers from live data, plus earlier weeks' lead
   counts. "Generate report" builds the text to paste into WhatsApp or email. */
import { useStore } from '../store';
import { useDialog } from '../dialogs';
import { Head, Icon } from '../ui';
import { metrics, weekly, isOpen } from '../lib/derive';
import { fD, dateAt, inrS } from '../lib/format';

export default function Reports() {
  const { S } = useStore();
  const { open } = useDialog();
  const meta = S.meta, m = metrics(S), wk = weekly(S.leads, meta.pillarKeys);
  const sec = (t, rows) => (
    <div className="mini"><h5>{t}</h5><dl className="kv" style={{ gridTemplateColumns: '150px 1fr' }}>{rows.map((r) => [<dt key={r[0] + 't'}>{r[0]}</dt>, <dd key={r[0]} className="num">{r[1]}</dd>])}</dl></div>
  );
  return (
    <>
      <Head title="Reports" sub="One report for the last 7 days, built from the live numbers. Copy it into WhatsApp or email, or download it as text.">
        <button className="btn primary" onClick={() => open('report')}><Icon n="file" /> Generate report</button>
      </Head>
      <div className="grid">
        <section className="card s8">
          <div className="chead"><div><h3>This week, {fD(dateAt(-6))} to {fD(dateAt(0))}</h3><p className="csub">Last 7 days, compared with the 7 days before where it makes sense.</p></div></div>
          <div className="mgrid two">
            {sec('Leads', [['New leads', m.new7 + ' (was ' + m.prev7 + ')'], ['Won or enrolled', m.won7], ['Open pipeline', inrS(m.pipe)], ['Idle 3+ days', m.idle.length]])}
            {sec('Appointments', [['Held', m.apHeld7], ['No-shows to rebook', m.noshows.length], ['Next 7 days', m.apWeek.length], ['Website requests', m.req.length]])}
            {sec('Team', [['Tasks done', m.done7], ['Open', m.kOpen.length], ['Overdue', m.overdue.length], ['Attendance', S.team.length ? m.attPct + '%' : '–']])}
            {sec('Training and Incube8', [['Training leads open', S.leads.filter((l) => l.pillar === 'training' && isOpen(l)).length], ['Enrolled', S.leads.filter((l) => l.pillar === 'training' && l.stage === 4).length], ['Applicants active', S.leads.filter((l) => l.pillar === 'incubation' && isOpen(l)).length], ['Awaiting decision', m.decide.length]])}
          </div>
        </section>
        <section className="card s4">
          <div className="chead"><div><h3>Earlier weeks</h3><p className="csub">New leads per week</p></div></div>
          <div className="tw"><table className="t rt"><thead><tr><th>Week</th>{meta.pillarKeys.map((p) => <th className="r" key={p} title={meta.pillars[p].name}>{meta.pillars[p].name.split(' ')[0]}</th>)}<th className="r">Total</th></tr></thead>
            <tbody>{[1, 2, 3, 4, 5, 6, 7].map((k) => { const w = wk[7 - k]; return (
              <tr key={k}><td className="first name" style={{ whiteSpace: 'nowrap' }}>{w.label} to {w.end}</td>{meta.pillarKeys.map((p) => <td className="r num" key={p} data-l={meta.pillars[p].name}>{w.c[p]}</td>)}<td data-l="Total" className="r num"><b>{w.total}</b></td></tr>
            ); })}</tbody></table></div>
        </section>
      </div>
    </>
  );
}
