/* intake.js
   What happens when a website form sends a tf-intake/1 event
   (spec: docs/intake-spec.md §4 rules):
     1. Idempotent: one lead per submission_id. A repeat returns the same lead_id.
     2. Never lose a lead: an appointment or skip with no known lead creates it.
     3. Slot safety: a slot held by another lead returns 409 slot_taken
        (enforced by the unique slotKey index on Appointment).
     4. Skip: appointment_skipped = true, next action "Call the lead".
     5. A booked slot stays "requested" until a person confirms it in the
        dashboard (or INTAKE_AUTO_CONFIRM=true confirms at once).
     6. Nobody is messaged from here.
   Returns [httpStatus, body]. */
const Lead = require('../models/Lead');
const Appointment = require('../models/Appointment');
const { nextId } = require('../models/Counter');
const { getSetting } = require('../models/Setting');
const { validate, leadFields, apptFields } = require('./intakeMap');
const { toIstIso } = require('./time');

const isDup = (err) => err && err.code === 11000;

/* Fill blank fields on an existing lead from a later event, never overwrite. */
function fillBlanks(lead, f) {
  for (const k of ['phone', 'phoneNormalised', 'email', 'company', 'website', 'industry', 'adSpend', 'formType', 'formId', 'pageTitle']) {
    if (!lead[k] && f[k]) lead[k] = f[k];
  }
  lead.interest = { ...(f.interest || {}), ...(lead.interest || {}) };
  lead.extra = { ...(f.extra || {}), ...(lead.extra || {}) };
  const a = { ...(lead.attribution || {}) };
  for (const k of Object.keys(f.attribution || {})) if (!a[k] && f.attribution[k]) a[k] = f.attribution[k];
  lead.attribution = a;
  lead.markModified('interest');
  lead.markModified('extra');
  lead.markModified('attribution');
}

async function findOrCreateLead(d) {
  const f = leadFields(d);
  let lead = null;
  if (d.lead_id) lead = await Lead.findOne({ leadId: String(d.lead_id) });
  if (!lead) lead = await Lead.findOne({ submissionId: f.submissionId });
  if (lead) {
    fillBlanks(lead, f);
    return lead;
  }
  const owners = await getSetting('defaultOwners', {});
  try {
    lead = await Lead.create({
      ...f,
      leadId: await nextId('L'),
      stage: 0,
      owner: owners[f.pillar] || null,
      nextAction: 'Call the lead',
      lastTouchAt: new Date(),
    });
  } catch (err) {
    // Two copies of the same submission arrived together: the other one won.
    if (!isDup(err)) throw err;
    lead = await Lead.findOne({ submissionId: f.submissionId });
    if (!lead) throw err;
  }
  return lead;
}

async function handleIntake(d) {
  const bad = validate(d);
  if (bad) return [422, { ok: false, error: bad }];

  const lead = await findOrCreateLead(d);
  lead.events.push({ at: new Date(), event: d.event });

  if (d.event === 'lead') {
    await lead.save();
    return [200, { ok: true, lead_id: lead.leadId }];
  }

  if (d.event === 'skip') {
    lead.appointmentSkipped = true;
    lead.nextAction = 'Call the lead';
    await lead.save();
    return [200, { ok: true, lead_id: lead.leadId }];
  }

  // appointment
  const a = apptFields(d);
  const autoConfirm = String(process.env.INTAKE_AUTO_CONFIRM || '').toLowerCase() === 'true';

  // Re-booking from the same visit moves the lead's existing open website appointment.
  let appt = await Appointment.findOne({ lead: lead._id, status: { $in: ['requested', 'confirmed'] }, bookedVia: 'Website form' });
  if (!appt) appt = new Appointment({ apptId: await nextId('A'), lead: lead._id });
  Object.assign(appt, a, {
    who: lead.name,
    company: lead.company,
    owner: appt.owner || lead.owner,
    status: autoConfirm ? 'confirmed' : 'requested',
    confirmedAt: autoConfirm ? new Date() : null,
  });

  try {
    await appt.save();
  } catch (err) {
    if (isDup(err)) {
      await lead.save(); // keep the lead and the event even though the slot was taken
      return [409, { ok: false, error: 'slot_taken', lead_id: lead.leadId }];
    }
    throw err;
  }

  lead.appointmentSkipped = false;
  lead.nextAction = appt.status === 'confirmed' ? 'Attend the call' : 'Confirm the appointment';
  lead.lastTouchAt = new Date();
  await lead.save();

  return [200, {
    ok: true,
    lead_id: lead.leadId,
    appointment: { id: appt.apptId, status: appt.status, start: toIstIso(appt.start) },
  }];
}

module.exports = { handleIntake };
