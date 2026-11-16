/* migrate.js
   One-time upgrade of data saved by the first CRM version (leads with a
   `status` text and appointments with a `datetime`). Runs on every start but
   only touches documents that are missing the new fields, so it is safe to
   leave in. */
const mongoose = require('mongoose');
const { nextId } = require('../models/Counter');

const LEAD_STAGE = { New: 0, Contacted: 1, 'In Discussion': 2, Converted: 4, Closed: 5 };
const APPT_STATUS = { Interested: 'requested', 'Call later': 'requested', Scheduled: 'confirmed', Converted: 'done', Closed: 'done', 'Not interested': 'cancelled' };

async function migrate() {
  const db = mongoose.connection.db;
  const leads = db.collection('leads');
  const appts = db.collection('appointments');
  let n = 0;

  for await (const l of leads.find({ leadId: { $exists: false } })) {
    await leads.updateOne({ _id: l._id }, {
      $set: {
        leadId: await nextId('L'),
        pillar: 'services',
        stage: LEAD_STAGE[l.status] ?? 0,
        phoneNormalised: '',
        lastTouchAt: l.updatedAt || new Date(),
        interest: l.message ? { message: l.message } : {},
        attribution: l.sourcePage ? { source_page: l.sourcePage } : {},
        extra: l.raw && typeof l.raw === 'object' ? l.raw : {},
      },
      $unset: { status: '', raw: '', message: '', sourcePage: '' },
    });
    n++;
  }

  for await (const a of appts.find({ apptId: { $exists: false } })) {
    const lead = a.lead ? await leads.findOne({ _id: a.lead }) : null;
    const start = a.datetime ? new Date(a.datetime) : a.createdAt || new Date();
    const status = a.datetime ? APPT_STATUS[a.status] || 'requested' : 'cancelled';
    const set = {
      apptId: await nextId('A'),
      who: lead ? lead.name : '(deleted lead)',
      company: (lead && lead.company) || '',
      kind: 'Intro call',
      pillar: (lead && lead.pillar) || 'services',
      start,
      end: new Date(start.getTime() + 30 * 60000),
      durationMin: 30,
      mode: 'Phone call',
      status,
      bookedVia: 'Dashboard',
    };
    const update = { $set: set, $unset: { datetime: '' } };
    if (status !== 'cancelled') set.slotKey = start.toISOString();
    try {
      await appts.updateOne({ _id: a._id }, update);
    } catch (err) {
      // Two old appointments at the same time: keep the second one, cancelled.
      if (err.code !== 11000) throw err;
      delete set.slotKey;
      set.status = 'cancelled';
      await appts.updateOne({ _id: a._id }, update);
    }
    n++;
  }
  if (n) console.log('Migrated ' + n + ' records from the first CRM version');
}

module.exports = { migrate };
