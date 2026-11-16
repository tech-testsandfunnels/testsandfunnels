/* dialogs/index.jsx
   Every modal in the dashboard, opened through useDialog().open(name, props):
   lead details, new lead, book/edit appointment, confirm a website booking,
   task, client, team member and the weekly report. */
import { Fragment, createContext, useContext, useMemo, useState } from 'react';
import { useStore } from '../store';
import { Modal, Field, Foot, Icon, PillTag, St, APPT_BADGE } from '../ui';
import { istDate, istTime, dateAt, dayOf, relD, fDW, inr, waDigits, copyText, download } from '../lib/format';
import { reportText } from '../lib/derive';

const Ctx = createContext(null);
export const useDialog = () => useContext(Ctx);

export function DialogProvider({ children }) {
  const [d, setD] = useState(null);
  const api = useMemo(() => ({ open: (name, props = {}) => setD({ name, props, k: Date.now() }), close: () => setD(null) }), []);
  const C = d && DIALOGS[d.name];
  return (
    <Ctx.Provider value={api}>
      {children}
      {C && <C key={d.k} {...d.props} close={api.close} open={api.open} />}
    </Ctx.Provider>
  );
}

/* ---------- helpers ---------- */
const formData = (e) => Object.fromEntries(new FormData(e.currentTarget).entries());
const OwnerOptions = ({ team, none = 'Unassigned' }) => (
  <>
    <option value="">{none}</option>
    {team.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
  </>
);
const ownerName = (S, id) => (S.team.find((t) => t._id === id) || {}).name || 'Unassigned';
const defaultKind = (p) => ({ services: 'Free Business Audit call', production: 'production brief call', training: 'counselling call', incubation: 'screening call' }[p] || 'Intro call');

/* Pretty labels for form fields kept on the lead. */
const LABEL = {
  topic: 'Topic', message: 'Message', format: 'Format', status: 'Status', city: 'City', mode: 'Mode', goal: 'Goal', stage: 'Stage',
  utm_source: 'Source', utm_medium: 'Medium', utm_campaign: 'Campaign', utm_term: 'Term', utm_content: 'Content', gclid: 'Google click id',
  fbclid: 'Meta click id', landing_page: 'Landing page', referrer: 'Referrer', source_page: 'Form page',
};

/* ---------- lead ---------- */
function LeadDlg({ id, close, open }) {
  const { S, saveLead, deleteLead } = useStore();
  const meta = S.meta;
  const l = S.leads.find((x) => x.leadId === id);
  const [f, setF] = useState(() => (l ? { stage: l.stage, owner: l.owner || '', value: l.value || 0, notes: l.notes || '', nextAction: l.nextAction || '', pillar: l.pillar } : {}));
  const [busy, setBusy] = useState(false);
  if (!l) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const appts = S.appts.filter((a) => a.lead && a.lead.leadId === id).sort((a, b) => new Date(b.start) - new Date(a.start));
  const at = l.attribution || {};
  const utm = [at.utm_source, at.utm_medium, at.utm_campaign].filter(Boolean).join(' / ');
  const interest = { ...(l.interest || {}) };
  const extra = l.extra || {};
  const wa = waDigits(l.phone);
  const stages = meta.pillars[f.pillar].stages;

  async function save() {
    setBusy(true);
    const r = await saveLead(id, { ...f, stage: +f.stage, value: +f.value || 0 }, 'Lead saved');
    setBusy(false);
    if (r) close();
  }

  return (
    <Modal title={l.name} onClose={close} wide>
      <dl className="kv">
        <dt>Lead ID</dt><dd>{l.leadId}</dd>
        <dt>Pillar</dt>
        <dd>
          <select className="sel" value={f.pillar} onChange={(e) => setF({ ...f, pillar: e.target.value, stage: 0 })} aria-label="Pillar">
            {meta.pillarKeys.map((p) => <option key={p} value={p}>{meta.pillars[p].name}</option>)}
          </select>
        </dd>
        <dt>Stage</dt>
        <dd>
          <select className="sel" value={f.stage} onChange={set('stage')} aria-label="Stage">
            {stages.map((s, i) => <option key={s} value={i}>{s}</option>)}
          </select>
        </dd>
        {l.company && <><dt>{l.pillar === 'training' ? 'Background' : 'Company'}</dt><dd>{l.company}</dd></>}
        <dt>Phone</dt>
        <dd>{l.phone ? <><a href={'tel:' + (l.phoneNormalised || l.phone)}>{l.phone}</a>{wa && <> · <a href={'https://wa.me/' + wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></>}</> : '–'}</dd>
        <dt>Email</dt><dd>{l.email ? <a href={'mailto:' + l.email}>{l.email}</a> : '–'}</dd>
        {l.website && <><dt>Website</dt><dd>{l.website}</dd></>}
        {l.industry && <><dt>Industry</dt><dd>{l.industry}</dd></>}
        {l.adSpend && <><dt>Ad spend</dt><dd>{l.adSpend}</dd></>}
        <dt>Source</dt><dd>{l.source}{l.formType ? ' · ' + l.formType + ' form' : ''}{l.formId ? ' (' + l.formId + ')' : ''}</dd>
        {(at.source_page || utm || at.landing_page || at.referrer) && (
          <>
            <dt>Came from</dt>
            <dd>
              {at.source_page || l.pageTitle || 'Website'}
              <span className="note" style={{ display: 'block', margin: '2px 0 0' }}>
                {[utm || 'direct', at.landing_page && 'landed on ' + at.landing_page, at.referrer && 'referrer ' + at.referrer].filter(Boolean).join(' · ')}
              </span>
            </dd>
          </>
        )}
        {Object.keys(interest).map((k) => <Fragment key={'i' + k}><dt>{LABEL[k] || k}</dt><dd>{interest[k]}</dd></Fragment>)}
        {Object.keys(extra).map((k) => <Fragment key={'x' + k}><dt>{k}</dt><dd>{String(extra[k])}</dd></Fragment>)}
        <dt>Created</dt><dd>{relD(dayOf(l.createdAt))} · {fDW(istDate(l.createdAt))}</dd>
        <dt>Last touch</dt><dd>{relD(dayOf(l.lastTouchAt || l.updatedAt))}</dd>
        {l.appointmentSkipped && <><dt>Website</dt><dd><St k="warn">Skipped picking a time</St></dd></>}
      </dl>

      <div className="fgrid">
        <Field label="Owner"><select value={f.owner} onChange={set('owner')}><OwnerOptions team={S.team} /></select></Field>
        <Field label="Deal value (₹)"><input type="number" min="0" step="1000" value={f.value} onChange={set('value')} inputMode="numeric" /></Field>
        <Field label="Next action" full><input value={f.nextAction} onChange={set('nextAction')} placeholder="For example: Call the lead" /></Field>
        <Field label="Notes" full><textarea value={f.notes} onChange={set('notes')} placeholder="What was said, what happens next" /></Field>
      </div>

      {appts.length > 0 && (
        <div className="list">
          {appts.map((a) => (
            <div className="li" key={a.apptId}>
              <span className="tm">{istTime(a.start)}</span>
              <div className="mid"><b>{a.kind}</b><small>{fDW(istDate(a.start))} · {a.mode} · {a.bookedVia}</small></div>
              <St k={APPT_BADGE[a.status][0]}>{APPT_BADGE[a.status][1]}</St>
            </div>
          ))}
        </div>
      )}

      <div className="foot">
        <button className="btn danger" type="button" onClick={async () => { if (confirm('Delete ' + l.name + ' and their appointments?')) { if (await deleteLead(id)) close(); } }}>Delete</button>
        <span style={{ flex: 1 }} />
        {l.stage === 4 && (l.pillar === 'services' || l.pillar === 'production') && !S.clients.some((c) => c.lead === l._id) && (
          <button className="btn" type="button" onClick={() => open('client', { fromLead: l })}><Icon n="brief" /> Add as client</button>
        )}
        <button className="btn" type="button" onClick={() => open('appt', { leadId: l.leadId })}><Icon n="cal" /> Book appointment</button>
        <button className="btn primary" type="button" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

function NewLeadDlg({ close, open }) {
  const { S, saveLead } = useStore();
  const meta = S.meta;
  const [busy, setBusy] = useState(false);
  const owners = (S.settings && S.settings.defaultOwners) || {};
  const [pillar, setPillar] = useState('services');
  async function submit(e) {
    e.preventDefault();
    const d = formData(e);
    setBusy(true);
    const l = await saveLead(null, { ...d, value: +d.value || 0 }, 'Lead added to ' + meta.pillars[d.pillar].name);
    setBusy(false);
    if (l) open('lead', { id: l.leadId });
  }
  return (
    <Modal title="New lead" onClose={close}>
      <form className="fgrid" onSubmit={submit}>
        <Field label="Name"><input name="name" required autoComplete="off" /></Field>
        <Field label="Company or background"><input name="company" autoComplete="off" /></Field>
        <Field label="Phone"><input name="phone" type="tel" autoComplete="off" /></Field>
        <Field label="Email"><input name="email" type="email" autoComplete="off" /></Field>
        <Field label="Pillar">
          <select name="pillar" value={pillar} onChange={(e) => setPillar(e.target.value)}>{meta.pillarKeys.map((p) => <option key={p} value={p}>{meta.pillars[p].name}</option>)}</select>
        </Field>
        <Field label="Source"><select name="source" defaultValue="Dashboard">{meta.sources.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Deal value (₹)"><input name="value" type="number" min="0" step="1000" defaultValue="0" inputMode="numeric" /></Field>
        <Field label="Owner"><select name="owner" key={pillar} defaultValue={owners[pillar] || ''}><OwnerOptions team={S.team} /></select></Field>
        <Field label="Note" full><textarea name="notes" /></Field>
        <Foot onCancel={close} label="Add lead" busy={busy} />
      </form>
    </Modal>
  );
}

/* ---------- appointments ---------- */
function ApptDlg({ close, leadId, appt, rebookOf }) {
  const { S, saveAppt } = useStore();
  const meta = S.meta;
  const lead = leadId ? S.leads.find((l) => l.leadId === leadId) : appt && appt.lead ? S.leads.find((l) => l.leadId === appt.lead.leadId) : null;
  const base = appt || rebookOf;
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const d = formData(e);
    setBusy(true);
    const body = { ...d, durationMin: +d.durationMin, leadId: lead ? lead.leadId : undefined };
    const r = await saveAppt(appt ? appt.apptId : null, body, (x) => 'Appointment ' + (appt ? 'updated' : 'booked') + ' for ' + fDW(istDate(x.appointment.start)) + ' at ' + istTime(x.appointment.start));
    if (r && rebookOf) await saveAppt(rebookOf.apptId, { status: 'cancelled', notes: (rebookOf.notes ? rebookOf.notes + '\n' : '') + 'No-show, rebooked as ' + r.apptId });
    setBusy(false);
    if (r) close();
  }
  const kinds = meta.apptKinds.includes(base && base.kind) || !base ? meta.apptKinds : [base.kind, ...meta.apptKinds];
  return (
    <Modal title={appt ? 'Edit appointment' : rebookOf ? 'Rebook appointment' : 'Book appointment'} onClose={close}>
      <form className="fgrid" onSubmit={submit}>
        {lead ? (
          <div className="full note" style={{ margin: 0 }}>With <b>{lead.name}</b>{lead.company ? ' · ' + lead.company : ''} · {lead.phone || lead.email}</div>
        ) : (
          <>
            <Field label="With" full><input name="who" required defaultValue={(base && base.who) || ''} autoComplete="off" /></Field>
            <Field label="Company"><input name="company" defaultValue={(base && base.company) || ''} autoComplete="off" /></Field>
          </>
        )}
        <Field label="Pillar"><select name="pillar" defaultValue={(base && base.pillar) || (lead && lead.pillar) || 'services'}>{meta.pillarKeys.map((p) => <option key={p} value={p}>{meta.pillars[p].name}</option>)}</select></Field>
        <Field label="Type"><select name="kind" defaultValue={(base && base.kind) || defaultKind(lead && lead.pillar)}>{kinds.map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Date"><input name="date" type="date" required defaultValue={appt ? istDate(appt.start) : dateAt(1)} /></Field>
        <Field label="Time (India)"><input name="time" type="time" required step="300" defaultValue={appt ? istTime(appt.start) : '11:00'} /></Field>
        <Field label="Length"><select name="durationMin" defaultValue={(base && base.durationMin) || 30}>{[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></Field>
        <Field label="How"><select name="mode" defaultValue={(base && base.mode) || 'Google Meet'}>{meta.apptModes.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Owner"><select name="owner" defaultValue={(base && base.owner) || (lead && lead.owner) || ''}><OwnerOptions team={S.team} /></select></Field>
        <Field label="Meet link"><input name="meetLink" type="url" defaultValue={(appt && appt.meetLink) || ''} placeholder="https://meet.google.com/…" /></Field>
        <Field label="Notes" full><textarea name="notes" defaultValue={(appt && appt.notes) || ''} /></Field>
        <Foot onCancel={close} label={appt ? 'Save' : 'Book'} busy={busy} />
      </form>
    </Modal>
  );
}

/* Confirm a website booking, then offer one-click WhatsApp and email to the visitor. */
function ConfirmDlg({ close, id }) {
  const { S, saveAppt } = useStore();
  const a = S.appts.find((x) => x.apptId === id);
  const [link, setLink] = useState((a && a.meetLink) || '');
  const [done, setDone] = useState(a && a.status === 'confirmed');
  const [busy, setBusy] = useState(false);
  if (!a) return null;
  const l = a.lead || {};
  const when = fDW(istDate(a.start)) + ' at ' + istTime(a.start) + ' (India time)';
  const msg =
    'Hi ' + (l.name || a.who || '').split(' ')[0] + ', this is t&f. Your ' + a.kind + ' is confirmed for ' + when + '. ' +
    (a.mode === 'Google Meet' ? (link ? 'Join here: ' + link : 'We will share the Google Meet link before the call.') : a.mode === 'Phone call' ? 'We will call you on this number.' : 'See you at our office.') +
    ' Reply here if you need to change the time.';
  const wa = waDigits(l.phone);
  async function confirmIt() {
    setBusy(true);
    const r = await saveAppt(a.apptId, { status: 'confirmed', meetLink: link }, 'Confirmed for ' + when);
    setBusy(false);
    if (r) setDone(true);
  }
  return (
    <Modal title={done ? 'Confirmed: let ' + (l.name || a.who) + ' know' : 'Confirm appointment'} onClose={close}>
      <dl className="kv">
        <dt>With</dt><dd>{l.name || a.who}{l.company ? ' · ' + l.company : ''}</dd>
        <dt>When</dt><dd>{when} · {a.durationMin} min</dd>
        <dt>Type</dt><dd>{a.kind} · {a.mode}</dd>
        <dt>Contact</dt><dd>{l.phone || '–'} · {l.email || 'no email'}</dd>
      </dl>
      {a.mode === 'Google Meet' && (
        <Field label="Google Meet link">
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" />
        </Field>
      )}
      {done ? (
        <>
          <p className="note" style={{ margin: 0 }}>Send the confirmation. Each button opens the message ready to send.</p>
          <pre className="rep">{msg}</pre>
          <div className="foot">
            {wa && <a className="btn primary" href={'https://wa.me/' + wa + '?text=' + encodeURIComponent(msg)} target="_blank" rel="noopener noreferrer"><Icon n="phone" /> WhatsApp</a>}
            {l.email && <a className="btn" href={'mailto:' + l.email + '?subject=' + encodeURIComponent('Your ' + a.kind + ' with t&f: ' + when) + '&body=' + encodeURIComponent(msg)}>Email</a>}
            <button className="btn" type="button" onClick={async () => { await copyText(msg); }}><Icon n="copy" /> Copy</button>
            <button className="btn" type="button" onClick={close}>Close</button>
          </div>
        </>
      ) : (
        <div className="foot">
          <button className="btn" type="button" onClick={close}>Cancel</button>
          <button className="btn primary" type="button" onClick={confirmIt} disabled={busy}><Icon n="check" /> {busy ? 'Confirming…' : 'Confirm'}</button>
        </div>
      )}
    </Modal>
  );
}

/* ---------- task, client, member ---------- */
function TaskDlg({ close, task }) {
  const { S, save, remove } = useStore();
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const r = await save('tasks', '/tasks', task && task._id, formData(e), task ? 'Task saved' : 'Task added');
    setBusy(false);
    if (r) close();
  }
  return (
    <Modal title={task ? 'Edit task' : 'New task'} onClose={close}>
      <form className="fgrid" onSubmit={submit}>
        <Field label="Task" full><input name="title" required defaultValue={(task && task.title) || ''} autoComplete="off" /></Field>
        <Field label="Client or area"><input name="area" defaultValue={(task && task.area) || ''} placeholder="Client name, Sales, Training…" autoComplete="off" /></Field>
        <Field label="Owner"><select name="owner" defaultValue={(task && task.owner) || ''}><OwnerOptions team={S.team} /></select></Field>
        <Field label="Due"><input name="due" type="date" defaultValue={(task && task.due) || dateAt(2)} /></Field>
        <Field label="Priority"><select name="priority" defaultValue={(task && task.priority) || 'med'}><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></select></Field>
        <Field label="Status"><select name="status" defaultValue={(task && task.status) || 'todo'}><option value="todo">To do</option><option value="doing">In progress</option><option value="review">Review</option><option value="done">Done</option></select></Field>
        <Field label="Notes" full><textarea name="notes" defaultValue={(task && task.notes) || ''} /></Field>
        <div className="foot full">
          {task && <button className="btn danger" type="button" onClick={async () => { if (confirm('Delete this task?')) { await remove('tasks', '/tasks', task._id, 'Task deleted'); close(); } }}>Delete</button>}
          <span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={close}>Cancel</button>
          <button className="btn primary" type="submit" disabled={busy}>{task ? 'Save' : 'Add task'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ClientDlg({ close, client, fromLead }) {
  const { S, save, remove } = useStore();
  const meta = S.meta;
  const c = client || (fromLead ? { name: fromLead.company || fromLead.name, pillar: fromLead.pillar, monthlyFee: fromLead.value, manager: fromLead.owner, lead: fromLead._id } : {});
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const d = formData(e);
    const r = await save('clients', '/clients', client && client._id, { ...d, monthlyFee: +d.monthlyFee || 0, lead: c.lead || undefined }, client ? 'Client saved' : 'Client added');
    setBusy(false);
    if (r) close();
  }
  return (
    <Modal title={client ? client.name : 'New client'} onClose={close}>
      <form className="fgrid" onSubmit={submit}>
        <Field label="Client" full><input name="name" required defaultValue={c.name || ''} autoComplete="off" /></Field>
        <Field label="Service"><input name="service" defaultValue={c.service || ''} placeholder="Performance marketing and SEO" /></Field>
        <Field label="Pillar"><select name="pillar" defaultValue={c.pillar || 'services'}>{meta.pillarKeys.map((p) => <option key={p} value={p}>{meta.pillars[p].name}</option>)}</select></Field>
        <Field label="Monthly fee (₹)"><input name="monthlyFee" type="number" min="0" step="1000" defaultValue={c.monthlyFee || 0} /></Field>
        <Field label="Account manager"><select name="manager" defaultValue={c.manager || ''}><OwnerOptions team={S.team} /></select></Field>
        <Field label="Health"><select name="health" defaultValue={c.health || 'good'}><option value="good">Healthy</option><option value="warn">Watch</option><option value="crit">At risk</option></select></Field>
        <Field label="Why"><input name="healthWhy" defaultValue={c.healthWhy || ''} placeholder="Reason for the health status" /></Field>
        <Field label="Last report"><input name="lastReport" type="date" defaultValue={c.lastReport || ''} /></Field>
        <Field label="Next review"><input name="nextReview" type="date" defaultValue={c.nextReview || ''} /></Field>
        <div className="foot full">
          {client && <button className="btn danger" type="button" onClick={async () => { if (confirm('Remove ' + client.name + ' from active clients?')) { await remove('clients', '/clients', client._id, 'Client removed'); close(); } }}>Remove</button>}
          <span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={close}>Cancel</button>
          <button className="btn primary" type="submit" disabled={busy}>{client ? 'Save' : 'Add client'}</button>
        </div>
      </form>
    </Modal>
  );
}

function MemberDlg({ close, member }) {
  const { save, remove } = useStore();
  const [busy, setBusy] = useState(false);
  const m = member || {};
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const r = await save('team', '/team', member && member._id, formData(e), member ? 'Saved' : 'Team member added');
    setBusy(false);
    if (r) close();
  }
  return (
    <Modal title={member ? member.name : 'Add team member'} onClose={close}>
      <form className="fgrid" onSubmit={submit}>
        <Field label="Name"><input name="name" required defaultValue={m.name || ''} autoComplete="off" /></Field>
        <Field label="Role"><input name="role" defaultValue={m.role || ''} placeholder="Business development" /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={m.email || ''} /></Field>
        <Field label="Phone"><input name="phone" type="tel" defaultValue={m.phone || ''} /></Field>
        <div className="foot full">
          {member && <button className="btn danger" type="button" onClick={async () => { if (confirm('Remove ' + member.name + ' from the team? Their leads keep their history.')) { await remove('team', '/team', member._id, 'Removed'); close(); } }}>Remove</button>}
          <span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={close}>Cancel</button>
          <button className="btn primary" type="submit" disabled={busy}>{member ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- report ---------- */
function ReportDlg({ close }) {
  const { S, toast } = useStore();
  const txt = reportText(S, S.meta);
  return (
    <Modal title={'Weekly report: ' + fDW(dateAt(-6)) + ' to ' + fDW(dateAt(0))} onClose={close} wide>
      <pre className="rep">{txt}</pre>
      <div className="foot">
        <button className="btn" type="button" onClick={async () => toast((await copyText(txt)) ? 'Report copied' : 'Could not copy, select the text instead')}><Icon n="copy" /> Copy</button>
        <button className="btn primary" type="button" onClick={() => { download('tf-weekly-report-' + istDate() + '.txt', txt); toast('Report downloaded'); }}><Icon n="down" /> Download .txt</button>
      </div>
    </Modal>
  );
}

const DIALOGS = { lead: LeadDlg, 'new-lead': NewLeadDlg, appt: ApptDlg, confirm: ConfirmDlg, task: TaskDlg, client: ClientDlg, member: MemberDlg, report: ReportDlg };

export { ownerName, OwnerOptions, PillTag, inr };
