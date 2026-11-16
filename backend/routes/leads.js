/* leads.js — /api/leads (admin). IDs in URLs are the readable lead IDs (L-1004).
     GET    /            all leads, newest first (the dashboard filters in the browser)
     POST   /            add a lead by hand
     GET    /:id         one lead with its appointments
     PUT    /:id         edit fields, move stage, assign owner, notes
     DELETE /:id         delete the lead and its appointments */
const router = require('express').Router();
const Lead = require('../models/Lead');
const Appointment = require('../models/Appointment');
const { nextId } = require('../models/Counter');
const { PILLAR_KEYS, PILLARS } = require('../lib/constants');
const { normalisePhone, str } = require('../lib/intakeMap');
const { wrap, pick, ref } = require('../lib/http');

const EDITABLE = ['name', 'phone', 'email', 'company', 'website', 'industry', 'adSpend', 'value', 'notes', 'nextAction', 'source', 'pillar', 'stage', 'owner'];

const findLead = (id) => Lead.findOne({ leadId: id });

function clean(f) {
  if (f.phone !== undefined) f.phoneNormalised = normalisePhone(f.phone);
  if (f.value !== undefined) f.value = Math.max(0, Number(f.value) || 0);
  if (f.stage !== undefined) f.stage = Math.min(5, Math.max(0, parseInt(f.stage, 10) || 0));
  if (f.pillar !== undefined && !PILLAR_KEYS.includes(f.pillar)) delete f.pillar;
  if (f.owner !== undefined) f.owner = ref(f.owner);
  for (const k of ['name', 'phone', 'email', 'company', 'website', 'industry', 'adSpend', 'nextAction', 'source']) {
    if (f[k] !== undefined) f[k] = str(f[k], 300);
  }
  if (f.notes !== undefined) f.notes = str(f.notes, 10000);
  return f;
}

router.get('/', wrap(async (req, res) => {
  const leads = await Lead.find({}, { events: 0 }).sort({ createdAt: -1 }).limit(5000).lean();
  res.json({ leads });
}));

router.post('/', wrap(async (req, res) => {
  const f = clean(pick(req.body, EDITABLE));
  if (!f.name) return res.status(422).json({ error: 'Name is required' });
  const lead = await Lead.create({
    ...f,
    leadId: await nextId('L'),
    source: f.source || 'Dashboard',
    pillar: f.pillar || 'services',
    stage: f.stage || 0,
    lastTouchAt: new Date(),
  });
  res.status(201).json({ lead });
}));

router.get('/:id', wrap(async (req, res) => {
  const lead = await findLead(req.params.id).lean();
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const appointments = await Appointment.find({ lead: lead._id }).sort({ start: -1 }).lean();
  res.json({ lead, appointments });
}));

router.put('/:id', wrap(async (req, res) => {
  const lead = await findLead(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const f = clean(pick(req.body, EDITABLE));
  Object.assign(lead, f, { lastTouchAt: new Date() });
  if (f.stage !== undefined && f.stage >= 4) lead.nextAction = '';
  await lead.save();
  res.json({ lead, stageName: PILLARS[lead.pillar].stages[lead.stage] });
}));

router.delete('/:id', wrap(async (req, res) => {
  const lead = await findLead(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  await Appointment.deleteMany({ lead: lead._id });
  await lead.deleteOne();
  res.json({ ok: true });
}));

module.exports = router;
