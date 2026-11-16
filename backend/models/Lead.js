/* Lead.js
   A potential client, trainee or Incube8 applicant. Leads come from the
   website forms (POST /api/intake, tf-intake/1) or are added in the dashboard.
   `pillar` picks the pipeline and `stage` is an index into that pipeline's
   stages (lib/constants.js): 0-3 open, 4 won, 5 lost. */
const mongoose = require('mongoose');
const { PILLAR_KEYS } = require('../lib/constants');

const str = { type: String, default: '', trim: true };

const LeadSchema = new mongoose.Schema(
  {
    leadId: { type: String, required: true, unique: true }, // L-1004
    submissionId: { type: String, unique: true, sparse: true }, // idempotency key from the website
    pillar: { type: String, enum: PILLAR_KEYS, default: 'services', index: true },
    stage: { type: Number, min: 0, max: 5, default: 0 },
    source: { ...str, default: 'Website form' },
    formType: str,
    formId: str,
    pageTitle: str,

    name: { type: String, required: true, trim: true },
    phone: str,
    phoneNormalised: { ...str, index: true },
    email: { ...str, lowercase: true },
    company: str, // company, organisation, or a trainee's background
    website: str,
    industry: str,
    adSpend: str,
    value: { type: Number, default: 0 }, // deal value in INR
    interest: { type: mongoose.Schema.Types.Mixed, default: {} }, // topic, message, format, status, city, mode, goal, stage as typed
    extra: { type: mongoose.Schema.Types.Mixed, default: {} }, // any other form field
    attribution: { type: mongoose.Schema.Types.Mixed, default: {} }, // utm_*, gclid, fbclid, landing_page, referrer, source_page

    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', default: null },
    notes: { type: String, default: '' },
    appointmentSkipped: { type: Boolean, default: false },
    nextAction: str,
    lastTouchAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
    events: { type: [{ at: Date, event: String, _id: false }], default: [] }, // intake events received
  },
  { timestamps: true }
);

LeadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lead', LeadSchema);
