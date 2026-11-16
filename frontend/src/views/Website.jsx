/* Website.jsx — how the website forms reach the CRM: the two endpoint URLs to
   set on the site, a live preview of the free slots visitors see, the latest
   website leads with where they came from, and the field mapping. */
import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useDialog } from '../dialogs';
import { Head, Icon, PillTag, St } from '../ui';
import { istTime, fDW, istDate, copyText } from '../lib/format';

const MAP = [
  ['name, phone, email', 'Lead: name, phone (normalised to +91…), email'],
  ['organisation, website, industry, monthly_ad_spend', 'Lead: company, website, industry, ad spend'],
  ['topic, stage, format, status, city, mode, goal, message', 'Lead: interest and notes, kept as typed'],
  ['pillar (set from the page the form is on)', 'Lead: pipeline (Services, Production house, Training or Incube8), first stage'],
  ['utm_*, gclid, fbclid, landing_page, referrer, source_page', 'Lead: where it came from, shown as "Came from"'],
  ['appt_start, appt_end, appt_kind, appt_mode, appt_duration_min', 'Appointment: time (IST), length, call type and mode. Status "requested" until you confirm'],
  ['submission_id, lead_id', 'Keeps the lead and its appointment together and makes a retry safe (no duplicate)'],
  ['any other field', 'Lead: kept under extra, so nothing is dropped'],
];

export default function Website() {
  const { S, toast } = useStore();
  const { open } = useDialog();
  const meta = S.meta;
  const [slots, setSlots] = useState(null);
  useEffect(() => {
    fetch('/api/slots?pillar=services&days=14').then((r) => r.json()).then((d) => setSlots(d.days || [])).catch(() => setSlots([]));
  }, [S.appts.length]);
  const web = S.leads.filter((l) => l.source === 'Website form').slice(0, 12);
  const apptFor = (l) => S.appts.find((a) => a.lead && a.lead.leadId === l.leadId && a.status !== 'cancelled');
  const copy = async (t) => toast((await copyText(t)) ? 'Copied' : 'Could not copy');

  return (
    <>
      <Head title="Website forms" sub="Every lead form on the site is two steps: details first (creates the lead here at once), then pick a call time (creates an appointment for that lead). A visitor who skips step 2 still arrives, with the next action 'Call the lead'." />
      <div className="grid">
        <section className="card s7">
          <div className="chead"><div><h3>Connect the site</h3><p className="csub">Set these two URLs on the website, then rebuild it. Until then the forms finish in WhatsApp, so no lead is lost.</p></div></div>
          <dl className="kv" style={{ gridTemplateColumns: '130px 1fr' }}>
            <dt>Intake URL</dt><dd><div className="copyrow"><code>{meta.urls.intake}</code><button className="btn sm" onClick={() => copy(meta.urls.intake)}><Icon n="copy" /> Copy</button></div></dd>
            <dt>Slots URL</dt><dd><div className="copyrow"><code>{meta.urls.slots}</code><button className="btn sm" onClick={() => copy(meta.urls.slots)}><Icon n="copy" /> Copy</button></div></dd>
            <dt>Bookings</dt><dd>{meta.autoConfirm ? 'Confirmed at once (INTAKE_AUTO_CONFIRM=true)' : 'Arrive as "requested" and wait for you in Appointments'}</dd>
          </dl>
          <p className="note">Only the site's own origin may call these (CORS_ORIGINS on the server). Intake is limited per visitor to stop floods, and the hidden bot field is checked.</p>
        </section>
        <section className="card s5">
          <div className="chead"><div><h3>What visitors can book</h3><p className="csub">Free slots right now, from the booking hours in <a className="link" href="#settings">Settings</a>.</p></div></div>
          {slots == null ? <p className="empty">Loading…</p> : slots.length ? (
            <div className="list">
              {slots.slice(0, 5).map((d) => <div className="li" key={d.date}><div className="mid"><b>{fDW(d.date)}</b><small>{d.times.length} free: {d.times.slice(0, 6).join(', ')}{d.times.length > 6 ? '…' : ''}</small></div></div>)}
            </div>
          ) : <p className="empty">No free slots in the next 14 days. Check the booking hours.</p>}
        </section>

        <section className="card s12">
          <div className="chead"><div><h3>Latest from the website</h3><p className="csub">Open a lead to see the page and campaign it came from.</p></div><a className="link" href="#leads">All leads <Icon n="right" /></a></div>
          {web.length ? (
            <div className="tw"><table className="t rt"><thead><tr><th>Lead</th><th>Pillar</th><th>Came from</th><th>Call</th></tr></thead>
              <tbody>{web.map((l) => {
                const a = apptFor(l), at = l.attribution || {};
                const utm = [at.utm_source, at.utm_medium, at.utm_campaign].filter(Boolean).join(' / ') || 'direct';
                return (
                  <tr key={l.leadId}>
                    <td className="first"><button className="rowbtn" onClick={() => open('lead', { id: l.leadId })}>{l.name}</button><span className="sub">{at.source_page || l.formId || l.formType}</span></td>
                    <td data-l="Pillar"><PillTag p={l.pillar} meta={meta} /></td>
                    <td data-l="Came from">{utm}</td>
                    <td data-l="Call">{a ? <>{a.status === 'requested' ? <St k="acc">Requested</St> : <St k="good">{a.status === 'done' ? 'Held' : 'Booked'}</St>} {fDW(istDate(a.start))} {istTime(a.start)}</> : l.appointmentSkipped ? <St k="neutral">Skipped, call them</St> : <St k="neutral">No time picked yet</St>}</td>
                  </tr>
                );
              })}</tbody></table></div>
          ) : <p className="empty">No website leads yet.</p>}
        </section>

        <section className="card s12">
          <div className="chead"><div><h3>How a form is mapped</h3><p className="csub">The site posts one flat message to <b>POST /api/intake</b> (events: lead, appointment, skip) and reads free times from <b>GET /api/slots</b>. Full spec: docs/intake-spec.md in the repo.</p></div></div>
          <div className="tw"><table className="t rt"><thead><tr><th>Website form field</th><th>CRM field</th></tr></thead>
            <tbody>{MAP.map((r) => <tr key={r[0]}><td className="first name" data-l="Form field">{r[0]}</td><td data-l="CRM">{r[1]}</td></tr>)}</tbody></table></div>
        </section>
      </div>
    </>
  );
}
