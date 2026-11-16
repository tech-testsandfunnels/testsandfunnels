/* Settings.jsx — booking hours for website appointments, the default owner
   for each pillar's new website leads, and the team members list. */
import { useState } from 'react';
import { useStore } from '../store';
import { useDialog } from '../dialogs';
import { Head, Icon, Field, Avatar, Chip } from '../ui';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Settings() {
  const { S, saveSettings } = useStore();
  const { open } = useDialog();
  const meta = S.meta;
  const [b, setB] = useState(S.settings.booking);
  const [own, setOwn] = useState(S.settings.defaultOwners || {});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setB({ ...b, [k]: e.target.value });
  const toggleDay = (d) => setB({ ...b, days: b.days.includes(d) ? b.days.filter((x) => x !== d) : [...b.days, d].sort() });

  async function saveBooking(e) {
    e.preventDefault();
    setBusy(true);
    await saveSettings({ booking: { ...b, step: +b.step, leadHours: +b.leadHours, ahead: +b.ahead } });
    setBusy(false);
  }

  return (
    <>
      <Head title="Settings" sub="Booking hours for website appointments, who gets new website leads, and your team." />
      <div className="grid">
        <section className="card s6">
          <div className="chead"><div><h3>Booking hours</h3><p className="csub">What visitors can pick in step 2 of a form. India time.</p></div></div>
          <form className="fgrid" onSubmit={saveBooking}>
            <div className="field full">Days
              <div className="daypick" role="group" aria-label="Booking days">{[1, 2, 3, 4, 5, 6, 0].map((d) => <Chip key={d} on={b.days.includes(d)} onClick={() => toggleDay(d)}>{WD[d]}</Chip>)}</div>
            </div>
            <Field label="From"><input type="time" value={b.start} onChange={set('start')} required /></Field>
            <Field label="Until"><input type="time" value={b.end} onChange={set('end')} required /></Field>
            <Field label="Slot length"><select value={b.step} onChange={set('step')}>{[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></Field>
            <Field label="Earliest booking"><select value={b.leadHours} onChange={set('leadHours')}>{[0, 1, 2, 3, 4, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h ? h + ' hours from now' : 'Any time today'}</option>)}</select></Field>
            <Field label="Days ahead"><input type="number" min="1" max="30" value={b.ahead} onChange={set('ahead')} /></Field>
            <div className="foot full"><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save booking hours'}</button></div>
          </form>
        </section>

        <section className="card s6">
          <div className="chead"><div><h3>New website leads go to</h3><p className="csub">Owner set automatically when a form lead arrives.</p></div></div>
          <form className="fgrid" onSubmit={async (e) => { e.preventDefault(); await saveSettings({ defaultOwners: own }); }}>
            {meta.pillarKeys.map((p) => (
              <Field key={p} label={meta.pillars[p].name}>
                <select value={own[p] || ''} onChange={(e) => setOwn({ ...own, [p]: e.target.value })}>
                  <option value="">Nobody (unassigned)</option>{S.team.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
              </Field>
            ))}
            <div className="foot full"><button className="btn primary" type="submit">Save owners</button></div>
          </form>
        </section>

        <section className="card s12">
          <div className="chead"><div><h3>Team</h3><p className="csub">People who own leads, appointments and tasks.</p></div><button className="btn primary sm" onClick={() => open('member')}><Icon n="plus" /> Add member</button></div>
          {S.team.length ? (
            <div className="list">
              {S.team.map((t) => (
                <div className="li" key={t._id}>
                  <Avatar name={t.name} />
                  <div className="mid"><b>{t.name}</b><small>{[t.role, t.email, t.phone].filter(Boolean).join(' · ')}</small></div>
                  <button className="btn sm" onClick={() => open('member', { member: t })}>Edit</button>
                </div>
              ))}
            </div>
          ) : <p className="empty">No team members yet.</p>}
        </section>
      </div>
    </>
  );
}
