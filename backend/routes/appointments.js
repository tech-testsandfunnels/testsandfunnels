/* appointments.js — /api/appointments (admin). IDs in URLs are A-1005 style.
     GET    /                 recent and upcoming appointments (+ every open request)
     POST   /                 book one from the dashboard (confirmed straight away)
     PUT    /:id              change status, time, mode, owner, notes, Meet link
     POST   /confirm-all      confirm every website request
     DELETE /:id              delete
   A slot already held by another active appointment returns 409. */
const router = require('express').Router();
const Appointment = require('../models/Appointment');
const Lead = require('../models/Lead');
const { nextId } = require('../models/Counter');
const { PILLAR_KEYS, APPT_STATUSES, APPT_MODES } = require('../lib/constants');
const { istToDate } = require('../lib/time');
const { str } = require('../lib/intakeMap');
const { wrap, ref } = require('../lib/http');

const LEAD_FIELDS = 'leadId name phone email company pillar stage owner';
const slotTaken = (res) => res.status(409).json({ error: 'That time is already booked. Pick another slot.' });

/* What the lead's "next action" becomes when its appointment changes. */
const NEXT = { requested: 'Confirm the appointment', confirmed: 'Attend the call', done: 'Follow up after the call', noshow: 'Rebook the call', cancelled: 'Call the lead' };

async function touchLead(appt) {
  if (!appt.lead) return;
  const id = appt.lead._id || appt.lead;
  await Lead.updateOne({ _id: id }, { $set: { lastTouchAt: new Date(), nextAction: NEXT[appt.status] || '' } });
}

/* Apply editable fields from the request body to an appointment document. */
function apply(appt, b) {
  if (b.date && b.time) appt.start = istToDate(b.date, b.time);
  else if (b.start) appt.start = new Date(b.start);
  if (isNaN(appt.start)) throw Object.assign(new Error('bad time'), { status: 422 });
  if (b.durationMin !== undefined) appt.durationMin = Math.min(480, Math.max(5, parseInt(b.durationMin, 10) || 30));
  appt.end = new Date(appt.start.getTime() + (appt.durationMin || 30) * 60000);
  if (b.mode && APPT_MODES.includes(b.mode)) appt.mode = b.mode;
  if (b.pillar && PILLAR_KEYS.includes(b.pillar)) appt.pillar = b.pillar;
  if (b.status && APPT_STATUSES.includes(b.status)) {
    if (b.status === 'confirmed' && appt.status !== 'confirmed') appt.confirmedAt = new Date();
    appt.status = b.status;
  }
  for (const k of ['kind', 'who', 'company', 'meetLink']) if (b[k] !== undefined) appt[k] = str(b[k], 500);
  if (b.notes !== undefined) appt.notes = str(b.notes, 5000);
  if (b.owner !== undefined) appt.owner = ref(b.owner);
}

router.get('/', wrap(async (req, res) => {
  const since = new Date(Date.now() - (parseInt(req.query.pastDays, 10) || 45) * 86400000);
  const appointments = await Appointment.find({ $or: [{ start: { $gte: since } }, { status: 'requested' }] })
    .populate('lead', LEAD_FIELDS)
    .sort({ start: 1 })
    .limit(3000)
    .lean();
  res.json({ appointments });
}));

router.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.kind) return res.status(422).json({ error: 'Type of appointment is required' });
  if (!(b.date && b.time) && !b.start) return res.status(422).json({ error: 'Date and time are required' });
  let lead = null;
  if (b.leadId) {
    lead = await Lead.findOne({ leadId: b.leadId });
    if (!lead) return res.status(422).json({ error: 'Lead not found' });
  }
  const appt = new Appointment({
    apptId: await nextId('A'),
    lead: lead ? lead._id : null,
    who: lead ? lead.name : str(b.who, 200),
    company: lead ? lead.company : str(b.company, 200),
    pillar: lead ? lead.pillar : 'services',
    owner: lead ? lead.owner : null,
    kind: 'Intro call',
    status: 'confirmed',
    confirmedAt: new Date(),
    bookedVia: 'Dashboard',
  });
  try { apply(appt, { status: 'confirmed', ...b }); } catch (e) { return res.status(422).json({ error: 'Invalid date or time' }); }
  if (!appt.who) return res.status(422).json({ error: 'Who the appointment is with is required' });
  try { await appt.save(); } catch (err) { if (err.code === 11000) return slotTaken(res); throw err; }
  await touchLead(appt);
  await appt.populate('lead', LEAD_FIELDS);
  res.status(201).json({ appointment: appt });
}));

router.post('/confirm-all', wrap(async (req, res) => {
  const list = await Appointment.find({ status: 'requested' });
  for (const a of list) {
    a.status = 'confirmed';
    a.confirmedAt = new Date();
    await a.save();
    await touchLead(a);
  }
  res.json({ ok: true, confirmed: list.length });
}));

router.put('/:id', wrap(async (req, res) => {
  const appt = await Appointment.findOne({ apptId: req.params.id });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  try { apply(appt, req.body || {}); } catch (e) { return res.status(422).json({ error: 'Invalid date or time' }); }
  try { await appt.save(); } catch (err) { if (err.code === 11000) return slotTaken(res); throw err; }
  await touchLead(appt);
  await appt.populate('lead', LEAD_FIELDS);
  res.json({ appointment: appt });
}));

router.delete('/:id', wrap(async (req, res) => {
  await Appointment.deleteOne({ apptId: req.params.id });
  res.json({ ok: true });
}));

module.exports = router;
