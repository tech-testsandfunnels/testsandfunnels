/* Appointment.js
   A call or meeting, usually tied to a Lead. Website visitors book one in
   step 2 of a form (status "requested") and a person confirms it.
   Slot safety: every active appointment stores `slotKey` (its start time);
   a unique index on it means two visitors can never hold the same slot, even
   if they press "Confirm" at the same moment. Cancelling removes the key so
   the slot frees up. */
const mongoose = require('mongoose');
const { PILLAR_KEYS, APPT_STATUSES, APPT_MODES } = require('../lib/constants');

const AppointmentSchema = new mongoose.Schema(
  {
    apptId: { type: String, required: true, unique: true }, // A-1005
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null, index: true },
    who: { type: String, default: '', trim: true }, // name shown when there is no lead (e.g. a client review)
    company: { type: String, default: '', trim: true },
    kind: { type: String, required: true, trim: true },
    pillar: { type: String, enum: PILLAR_KEYS, default: 'services' },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    durationMin: { type: Number, default: 30 },
    mode: { type: String, enum: APPT_MODES, default: 'Phone call' },
    tz: { type: String, default: 'Asia/Kolkata' },
    status: { type: String, enum: APPT_STATUSES, default: 'requested', index: true },
    bookedVia: { type: String, default: 'Dashboard' },
    meetLink: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', default: null },
    notes: { type: String, default: '' },
    confirmedAt: { type: Date, default: null },
    slotKey: { type: String }, // set while active, removed when cancelled
  },
  { timestamps: true }
);

AppointmentSchema.index(
  { slotKey: 1 },
  { unique: true, partialFilterExpression: { slotKey: { $type: 'string' } } }
);

/* Keep slotKey in step with status before every save. */
AppointmentSchema.pre('save', function (next) {
  if (this.status === 'cancelled') this.slotKey = undefined;
  else this.slotKey = new Date(this.start).toISOString();
  next();
});

module.exports = mongoose.model('Appointment', AppointmentSchema);
