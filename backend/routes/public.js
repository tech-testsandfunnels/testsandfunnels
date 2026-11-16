/* public.js — the two endpoints the website forms call (no login).
     POST /api/intake   tf-intake/1 events: lead, appointment, skip
     GET  /api/slots    free appointment slots in India time
   CORS allows only CORS_ORIGINS (the marketing site). Intake is rate-limited
   per IP and the hidden `company` field is checked as a bot trap. */
const router = require('express').Router();
const express = require('express');
const Appointment = require('../models/Appointment');
const { getSetting } = require('../models/Setting');
const { handleIntake } = require('../lib/intake');
const { isBot } = require('../lib/intakeMap');
const { freeSlots, DEFAULT_HOURS } = require('../lib/slots');
const { wrap, rateLimit, publicCors } = require('../lib/http');
const { isConnected } = require('../config/db');

router.use(['/intake', '/slots'], publicCors);

/* Website forms fall back to WhatsApp on any 5xx, so say so clearly when the DB is down. */
const needDb = (req, res, next) =>
  isConnected() ? next() : res.status(503).json({ ok: false, error: 'database unavailable' });

router.post(
  '/intake',
  rateLimit({ max: +process.env.INTAKE_RATE_PER_MIN || 10 }),
  express.json({ limit: '50kb' }),
  needDb,
  wrap(async (req, res) => {
    const d = req.body || {};
    if (isBot(d)) return res.json({ ok: true }); // pretend success, store nothing
    const [code, body] = await handleIntake(d);
    res.status(code).json(body);
  })
);

router.get(
  '/slots',
  needDb,
  wrap(async (req, res) => {
    const hours = await getSetting('booking', DEFAULT_HOURS);
    const days = Math.min(Math.max(1, parseInt(req.query.days, 10) || hours.ahead || 14), 30);
    const from = new Date(Date.now() - 4 * 3600000);
    const to = new Date(Date.now() + (days + 2) * 86400000);
    const busy = await Appointment.find(
      { status: { $ne: 'cancelled' }, start: { $lt: to }, end: { $gt: from } },
      { start: 1, end: 1, _id: 0 }
    ).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ days: freeSlots(hours, busy, { days }) });
  })
);

module.exports = router;
