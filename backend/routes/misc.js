/* misc.js — the smaller dashboard resources (all admin):
     /api/meta         pillars, stages and fixed lists (single source for the UI)
     /api/team         team members (owners of leads, appointments, tasks)
     /api/tasks        task board
     /api/clients      active clients and their health
     /api/attendance   daily attendance marks
     /api/settings     booking hours and default owner per pillar */
const router = require('express').Router();
const TeamMember = require('../models/TeamMember');
const Task = require('../models/Task');
const Client = require('../models/Client');
const Attendance = require('../models/Attendance');
const { nextId } = require('../models/Counter');
const { getSetting, setSetting } = require('../models/Setting');
const C = require('../lib/constants');
const { DEFAULT_HOURS } = require('../lib/slots');
const { istDate, istMinutes, fromMin } = require('../lib/time');
const { wrap, pick, ref } = require('../lib/http');

/* ---------- meta ---------- */
router.get('/meta', (req, res) => {
  const base = (process.env.PUBLIC_URL || req.protocol + '://' + req.get('host')).replace(/\/$/, '');
  res.json({
    pillars: C.PILLARS, pillarKeys: C.PILLAR_KEYS, sources: C.SOURCES,
    apptStatuses: C.APPT_STATUSES, apptModes: C.APPT_MODES, apptKinds: C.APPT_KINDS,
    taskStatuses: C.TASK_STATUSES, today: istDate(),
    urls: { intake: base + '/api/intake', slots: base + '/api/slots' },
    autoConfirm: String(process.env.INTAKE_AUTO_CONFIRM || '').toLowerCase() === 'true',
  });
});

/* ---------- generic CRUD helper ---------- */
function crud(path, Model, fields, opts = {}) {
  const fix = (b) => {
    const f = pick(b, fields);
    for (const k of opts.refs || []) if (f[k] !== undefined) f[k] = ref(f[k]);
    return opts.fix ? opts.fix(f) : f;
  };
  router.get(path, wrap(async (req, res) => {
    res.json({ items: await Model.find(opts.list || {}).sort(opts.sort || { createdAt: 1 }).lean() });
  }));
  router.post(path, wrap(async (req, res) => {
    const f = fix(req.body || {});
    if (opts.create) await opts.create(f);
    res.status(201).json({ item: await Model.create(f) });
  }));
  router.put(path + '/:id', wrap(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const f = fix(req.body || {});
    if (opts.update) opts.update(doc, f);
    Object.assign(doc, f);
    await doc.save();
    res.json({ item: doc });
  }));
  router.delete(path + '/:id', wrap(async (req, res) => {
    if (opts.softDelete) await Model.updateOne({ _id: req.params.id }, { $set: { active: false } });
    else await Model.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  }));
}

crud('/team', TeamMember, ['name', 'role', 'email', 'phone', 'active'], { list: { active: true }, softDelete: true });

crud('/tasks', Task, ['title', 'area', 'owner', 'status', 'priority', 'due', 'notes'], {
  refs: ['owner'],
  sort: { due: 1, createdAt: 1 },
  create: async (f) => { f.taskId = await nextId('K', 0); if (f.status === 'done') f.doneAt = new Date(); },
  update: (doc, f) => {
    if (f.status === 'done' && doc.status !== 'done') f.doneAt = new Date();
    if (f.status && f.status !== 'done') f.doneAt = null;
  },
});

crud('/clients', Client, ['name', 'service', 'pillar', 'monthlyFee', 'health', 'healthWhy', 'manager', 'lastReport', 'nextReview', 'active', 'lead'], {
  refs: ['manager', 'lead'],
  list: { active: true },
  softDelete: true,
  fix: (f) => { if (f.monthlyFee !== undefined) f.monthlyFee = Math.max(0, Number(f.monthlyFee) || 0); return f; },
});

/* ---------- attendance ---------- */
router.get('/attendance', wrap(async (req, res) => {
  const to = req.query.to || istDate();
  const from = req.query.from || istDate(new Date(Date.now() - 6 * 86400000));
  res.json({ items: await Attendance.find({ date: { $gte: from, $lte: to } }).lean() });
}));

/* PUT { member, date?, status } — status "" clears the mark. */
router.put('/attendance', wrap(async (req, res) => {
  const { member, status } = req.body || {};
  const date = (req.body && req.body.date) || istDate();
  if (!ref(member)) return res.status(422).json({ error: 'member is required' });
  if (!status) {
    await Attendance.deleteOne({ member, date });
    return res.json({ ok: true });
  }
  if (!C.ATTENDANCE.includes(status)) return res.status(422).json({ error: 'Unknown status' });
  const set = { status };
  if ((status === 'P' || status === 'W') && date === istDate()) set.checkIn = fromMin(istMinutes());
  if (status !== 'P' && status !== 'W') set.checkIn = '';
  const item = await Attendance.findOneAndUpdate({ member, date }, { $set: set }, { upsert: true, new: true });
  res.json({ item });
}));

/* ---------- settings ---------- */
router.get('/settings', wrap(async (req, res) => {
  res.json({
    booking: { ...DEFAULT_HOURS, ...(await getSetting('booking', {})) },
    defaultOwners: await getSetting('defaultOwners', {}),
  });
}));

router.put('/settings', wrap(async (req, res) => {
  const b = req.body || {};
  if (b.booking) {
    const h = b.booking, hm = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!hm.test(h.start) || !hm.test(h.end) || h.start >= h.end) return res.status(422).json({ error: 'Start and end must be HH:MM, start before end' });
    await setSetting('booking', {
      days: (Array.isArray(h.days) ? h.days : []).map(Number).filter((d) => d >= 0 && d <= 6),
      start: h.start,
      end: h.end,
      step: [15, 20, 30, 45, 60].includes(+h.step) ? +h.step : 30,
      leadHours: Math.min(72, Math.max(0, +h.leadHours || 0)),
      ahead: Math.min(30, Math.max(1, +h.ahead || 14)),
      maxDays: 12,
    });
  }
  if (b.defaultOwners) {
    const o = {};
    for (const k of C.PILLAR_KEYS) o[k] = ref(b.defaultOwners[k]);
    await setSetting('defaultOwners', o);
  }
  res.json({ ok: true });
}));

module.exports = router;
