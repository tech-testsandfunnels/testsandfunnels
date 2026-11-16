/* Team.jsx — attendance today, the last 7 days, the task board and output
   per member. Team members themselves are managed in Settings. */
import { useState } from 'react';
import { useStore } from '../store';
import { useDialog } from '../dialogs';
import { Head, Icon, Avatar, St } from '../ui';
import { metrics, memberStats } from '../lib/derive';
import { dateAt, fDN, istDate } from '../lib/format';
import { DueLab } from './Overview';

const STAT = ['todo', 'doing', 'review', 'done'];
const STLAB = { todo: 'To do', doing: 'In progress', review: 'Review', done: 'Done (last 7 days)' };
const SLAB = { P: 'Present', W: 'WFH', L: 'Leave', A: 'Absent', O: 'Off', '': 'Not marked' };

export default function Team() {
  const { S, mark, save } = useStore();
  const { open } = useDialog();
  const [who, setWho] = useState('all');
  const m = metrics(S);
  const days = [-6, -5, -4, -3, -2, -1, 0];
  const attOn = (id, d) => (S.att.find((a) => a.member === id && a.date === dateAt(d)) || {});
  const owner = (id) => S.team.find((t) => t._id === id);
  const move = (t, dir) => { const s = STAT[STAT.indexOf(t.status) + dir]; save('tasks', '/tasks', t._id, { status: s }, '"' + t.title + '" is now ' + STLAB[s].replace(' (last 7 days)', '').toLowerCase()); };

  return (
    <>
      <Head title="Team" sub="Mark attendance, move tasks along and see output.">
        <a className="btn" href="#settings"><Icon n="users" /> Manage team</a>
        <button className="btn primary" onClick={() => open('task')}><Icon n="plus" /> New task</button>
      </Head>
      <div className="grid">
        <section className="card s6">
          <div className="chead">
            <div><h3>Attendance today</h3><p className="csub">{fDN(0)} · {m.inCount} in, {m.unmarked} not marked</p></div>
            <button className="btn sm" disabled={!m.unmarked} onClick={() => S.team.filter((t) => !m.attToday(t)).forEach((t) => mark(t._id, 'P'))}><Icon n="check" /> Mark unmarked present</button>
          </div>
          {S.team.length ? S.team.map((t) => {
            const a = attOn(t._id, 0), v = a.status || '';
            return (
              <div className="arow" key={t._id}>
                <div className="who"><Avatar name={t.name} /><span><b>{t.name}</b><small>{(v === 'P' || v === 'W') && a.checkIn ? 'In at ' + a.checkIn + ' · ' : ''}{t.role}</small></span></div>
                <div className="seg-btn" role="group" aria-label={'Attendance for ' + t.name}>
                  {['P', 'W', 'L', 'A'].map((k) => <button key={k} aria-pressed={v === k} onClick={() => mark(t._id, v === k ? '' : k)}>{SLAB[k]}</button>)}
                </div>
              </div>
            );
          }) : <p className="empty">No team members yet. <a className="link" href="#settings">Add them in Settings</a>.</p>}
        </section>

        <section className="card s6">
          <div className="chead"><div><h3>Last 7 days</h3><p className="csub">Attendance this past week. Tap a cell to cycle the mark.</p></div></div>
          {S.team.length > 0 && (
            <>
              <div className="heat">
                <span />
                {days.map((d) => { const s = dateAt(d); return <div className="hd" key={d}>{new Date(s + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2)}<br />{+s.slice(8)}</div>; })}
                {S.team.map((t) => [
                  <div className="who" key={t._id}><Avatar name={t.name} /><span>{t.name.split(' ')[0]}</span></div>,
                  ...days.map((d) => {
                    const v = attOn(t._id, d).status || '';
                    const nx = { '': 'P', P: 'W', W: 'L', L: 'A', A: 'O', O: '' }[v];
                    return <button key={t._id + d} className={'hc ' + v} style={{ border: 0 }} title={t.name + ', ' + fDN(d) + ': ' + SLAB[v]} onClick={() => mark(t._id, nx, dateAt(d))}>{v === 'O' ? '–' : v || '·'}</button>;
                  }),
                ])}
              </div>
              <div className="legend2">
                <span><b className="hc P">P</b>Present</span><span><b className="hc W">W</b>Work from home</span><span><b className="hc L">L</b>Leave</span><span><b className="hc A">A</b>Absent</span><span><b className="hc O">–</b>Weekly off</span><span><b className="hc">·</b>Not marked</span>
              </div>
              <p className="note">Attendance this week: <b>{m.attPct}%</b>.</p>
            </>
          )}
        </section>

        <section className="card s12">
          <div className="chead">
            <div><h3>Task board</h3><p className="csub">Move a task along with the buttons. Red outline means overdue. Click a task to edit it.</p></div>
            <select className="sel" aria-label="Show tasks for" value={who} onChange={(e) => setWho(e.target.value)} style={{ width: 'auto' }}>
              <option value="all">Everyone</option>{S.team.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
          <div className="board tk" aria-label="Task board">
            {STAT.map((s, i) => {
              let ks = S.tasks.filter((t) => t.status === s && (who === 'all' || t.owner === who));
              if (s === 'done') ks = ks.filter((t) => t.doneAt && istDate(t.doneAt) >= dateAt(-6));
              ks.sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1));
              return (
                <div className="col" key={s}>
                  <h4>{STLAB[s]}<span className="n num">{ks.length}</span></h4>
                  {ks.length ? ks.map((t) => {
                    const late = t.status !== 'done' && t.due && t.due < istDate();
                    const o = owner(t.owner);
                    const onTime = t.status === 'done' && (!t.due || istDate(t.doneAt) <= t.due);
                    return (
                      <div className={'kc' + (late ? ' late' : '')} key={t._id}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span className={'pri ' + t.priority} title={{ high: 'High', med: 'Medium', low: 'Low' }[t.priority] + ' priority'} />
                          <div><button className="rowbtn" onClick={() => open('task', { task: t })}><b>{t.title}</b></button><small style={{ display: 'block' }}>{t.area}</small></div>
                        </div>
                        <div className="row">
                          {o && <Avatar name={o.name} />}
                          {t.due && t.status !== 'done' && <DueLab due={t.due} />}
                          {t.status === 'done' && <St k={onTime ? 'good' : 'warn'}>{onTime ? 'On time' : 'Late'}</St>}
                        </div>
                        <div className="mv">
                          {i > 0 && <button className="btn sm" onClick={() => move(t, -1)} aria-label={'Move back to ' + STLAB[STAT[i - 1]]}><Icon n="left" /></button>}
                          {i < 3 && <button className="btn sm" onClick={() => move(t, 1)}>{i === 2 ? <><Icon n="check" /> Mark done</> : <>Move on <Icon n="right" /></>}</button>}
                        </div>
                      </div>
                    );
                  }) : <p className="empty" style={{ padding: '6px 4px' }}>Nothing here</p>}
                </div>
              );
            })}
          </div>
        </section>

        {S.team.length > 0 && (
          <section className="card s12">
            <div className="chead"><div><h3>Productivity</h3><p className="csub">Output, timeliness and presence over the last 7 days, side by side on purpose: a single score hides more than it shows.</p></div></div>
            <div className="tw"><table className="t rt"><thead><tr><th>Member</th><th className="r">Tasks done</th><th className="r">On time</th><th className="r">Open</th><th className="r">Overdue</th><th className="r">Attendance</th></tr></thead>
              <tbody>{S.team.map((t) => { const s = memberStats(t, S.tasks, S.att); return (
                <tr key={t._id}><td className="first name">{t.name}<span className="sub">{t.role}</span></td><td data-l="Tasks done" className="r num">{s.done}</td><td data-l="On time" className="r num">{s.onTime == null ? '–' : s.onTime + '%'}</td><td data-l="Open" className="r num">{s.open}</td><td data-l="Overdue" className="r num">{s.od ? <St k="crit">{s.od}</St> : 0}</td><td data-l="Attendance" className="r num">{s.att == null ? '–' : s.att + '%'}</td></tr>
              ); })}</tbody></table></div>
          </section>
        )}
      </div>
    </>
  );
}
