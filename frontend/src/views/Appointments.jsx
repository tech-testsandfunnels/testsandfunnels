/* Appointments.jsx — agenda for all four pillars. Website bookings arrive as
   "requested" and wait at the top until someone confirms them (which opens
   the WhatsApp / email confirmation). Mark calls done or no-show, rebook
   no-shows, edit or cancel. */
import { useState } from 'react';
import { useStore } from '../store';
import { useDialog } from '../dialogs';
import { Head, Icon, PillTag, St, Chip, APPT_BADGE } from '../ui';
import { metrics, apDay, whoOf } from '../lib/derive';
import { istTime, fDN, plural } from '../lib/format';

export default function Appointments() {
  const { S, saveAppt, confirmAll } = useStore();
  const { open } = useDialog();
  const meta = S.meta;
  const [p, setP] = useState('all');
  const [past, setPast] = useState(false);
  const m = metrics(S);
  const owner = (id) => (S.team.find((t) => t._id === id) || {}).name || '';
  const A = S.appts.filter((a) => a.status !== 'cancelled' && (p === 'all' || a.pillar === p));
  const from = past ? -30 : -2;
  const days = Array.from(new Set(A.map(apDay).filter((d) => d >= from))).concat(0);
  const uniq = Array.from(new Set(days)).sort((a, b) => a - b);

  const item = (a) => {
    const mi = a.mode === 'In office' ? 'pin' : a.mode === 'Phone call' ? 'phone' : 'video';
    const b = APPT_BADGE[a.status];
    const sub = [a.kind, a.company || (a.lead && a.lead.company), a.mode, owner(a.owner), a.bookedVia === 'Website form' ? 'from a website form' : ''].filter(Boolean);
    return (
      <div className={'ap' + (a.status === 'done' ? ' done' : '')} key={a.apptId}>
        <div className="tm">{istTime(a.start)}</div>
        <div>
          {a.lead ? <button className="rowbtn" onClick={() => open('lead', { id: a.lead.leadId })}><b>{whoOf(a)}</b></button> : <b>{whoOf(a)}</b>} <PillTag p={a.pillar} meta={meta} />
          <small style={{ display: 'block', color: 'var(--muted)', fontSize: '.82rem' }}>
            {sub.map((s, i) => <span key={i}>{i ? ' · ' : ''}{s === a.mode ? <><Icon n={mi} /> {s}</> : s}</span>)}
            {a.meetLink && <> · <a href={a.meetLink} target="_blank" rel="noopener noreferrer">Meet link</a></>}
          </small>
          {a.notes && <small style={{ display: 'block', color: 'var(--muted)', fontSize: '.8rem' }}>{a.notes}</small>}
        </div>
        <div className="acts">
          {a.status !== 'confirmed' && <St k={b[0]}>{b[1]}</St>}
          {a.status === 'requested' && <button className="btn sm primary" onClick={() => open('confirm', { id: a.apptId })}><Icon n="check" /> Confirm</button>}
          {a.status === 'confirmed' && <>
            <button className="btn sm" onClick={() => saveAppt(a.apptId, { status: 'done' }, 'Marked done')}><Icon n="check" /> Done</button>
            <button className="btn sm danger" onClick={() => saveAppt(a.apptId, { status: 'noshow' }, 'Marked no-show. It is on the attention list to rebook.')}>No-show</button>
            <button className="btn sm" onClick={() => open('confirm', { id: a.apptId })} title="Send the confirmation again">Send</button>
          </>}
          {a.status === 'noshow' && <button className="btn sm" onClick={() => open('appt', { rebookOf: a, leadId: a.lead && a.lead.leadId })}>Rebook</button>}
          <button className="btn sm" onClick={() => open('appt', { appt: a })} aria-label="Edit">Edit</button>
          {(a.status === 'requested' || a.status === 'confirmed') && (
            <button className="btn sm" onClick={() => { if (confirm('Cancel this appointment? The slot becomes free again.')) saveAppt(a.apptId, { status: 'cancelled' }, 'Cancelled'); }}>Cancel</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Head title="Appointments" sub="Audit calls, counselling calls, interviews, shoot briefs and client reviews for all four pillars. Times are India time.">
        <button className="btn primary" onClick={() => open('appt')}><Icon n="plus" /> Book appointment</button>
      </Head>

      {m.req.length > 0 && (
        <section className="card" style={{ marginBottom: 16, borderColor: 'var(--warn)' }} aria-label="Website requests">
          <div className="chead">
            <div><h3>{plural(m.req.length, 'call')} booked on the website, waiting for you</h3><p className="csub">Visitors pick a time in step 2 of a form. They are marked "Requested on website" in the agenda below. Confirm to lock the slot, then send them the confirmation by WhatsApp or email.</p></div>
            <button className="btn primary" onClick={() => { if (confirm('Confirm all ' + m.req.length + ' website requests? You can send the messages afterwards from each appointment.')) confirmAll(); }}><Icon n="check" /> Confirm all</button>
          </div>
        </section>
      )}

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="card kpi s3"><span className="lab">Today</span><span className="val num">{m.apToday.length}</span><span className="sub">appointments</span></div>
        <div className="card kpi s3"><span className="lab">Next 7 days</span><span className="val num">{m.apWeek.length}</span><span className="sub">including today</span></div>
        <div className="card kpi s3"><span className="lab">Held (last 7 days)</span><span className="val num">{m.apHeld7}</span><span className="sub">marked done</span></div>
        <div className="card kpi s3"><span className="lab">No-shows</span><span className="val num">{m.noshows.length}</span><span className="sub">to rebook</span></div>
      </div>

      <section className="card">
        <div className="chips" role="group" aria-label="Filter by pillar">
          <Chip on={p === 'all'} onClick={() => setP('all')}>All</Chip>
          {meta.pillarKeys.map((k) => <Chip key={k} p={k} on={p === k} onClick={() => setP(k)}>{meta.pillars[k].name}</Chip>)}
          <span style={{ flex: 1 }} />
          <button className="btn sm" aria-pressed={past} onClick={() => setPast(!past)}>{past ? 'Hide older' : 'Show last 30 days'}</button>
        </div>
        {uniq.map((d) => {
          const day = A.filter((a) => apDay(a) === d).sort((a, b) => new Date(a.start) - new Date(b.start));
          return (
            <div key={d}>
              <div className={'dayh' + (d === 0 ? ' today' : '')}><span>{d === 0 ? 'Today' : fDN(d)}</span><small>{d === 0 ? fDN(0) + ' · ' : ''}{plural(day.length, 'appointment')}</small></div>
              {day.length ? day.map(item) : <p className="empty">Nothing scheduled.</p>}
            </div>
          );
        })}
      </section>
    </>
  );
}
