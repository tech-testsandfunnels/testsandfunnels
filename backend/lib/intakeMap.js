/* intakeMap.js
   Pure functions that check a tf-intake/1 message from the website forms and
   turn it into lead and appointment fields (spec: docs/intake-spec.md, §3 and §5).
   Every value is treated as untrusted text: trimmed, length-capped, and only
   known keys get their own column. Anything else lands in `extra`, so nothing
   the form sent is dropped. */
const { PILLAR_KEYS, ATTRIBUTION_KEYS, INTEREST_KEYS, APPT_MODES } = require('./constants');

const MAX = 2000; // max length of any single text field
const EVENTS = ['lead', 'appointment', 'skip'];

/* Keys handled explicitly, so they are not copied into `extra`. */
const KNOWN = new Set([
  'schema', 'event', 'submission_id', 'lead_id', 'form_type', 'form_id', 'pillar', 'source',
  'page_title', 'submitted_at', 'name', 'phone', 'email', 'organisation', 'venture', 'website', 'industry',
  'monthly_ad_spend', 'company', // company = bot trap
  ...ATTRIBUTION_KEYS, ...INTEREST_KEYS,
  'appt_kind', 'appt_start', 'appt_end', 'appt_duration_min', 'appt_mode', 'appt_tz', 'appt_status',
]);

const str = (v, max = MAX) => (v == null ? '' : String(v).trim().slice(0, max));

/* "+91 98765 43210" / "098765 43210" / "9876543210" -> "+919876543210".
   Anything that does not look like a number is kept as typed in `phone`. */
function normalisePhone(raw) {
  const s = str(raw, 40);
  if (!s) return '';
  let d = s.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (d.startsWith('+')) return '+' + d.slice(1).replace(/\D/g, '');
  d = d.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) return '+91' + d;
  if (d.length === 12 && d.startsWith('91')) return '+' + d;
  return d;
}

/** Returns an error string, or '' when the message is acceptable. */
function validate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'invalid body';
  if (d.schema !== 'tf-intake/1') return 'unknown schema';
  if (!EVENTS.includes(d.event)) return 'unknown event';
  if (!str(d.submission_id)) return 'submission_id is required';
  if (!str(d.name) || !(str(d.phone) || str(d.email))) return 'name and a phone or email are required';
  if (d.pillar && !PILLAR_KEYS.includes(d.pillar)) return 'unknown pillar';
  if (d.event === 'appointment') {
    if (!d.appt_start || isNaN(new Date(d.appt_start))) return 'appt_start is required';
    if (d.appt_end && isNaN(new Date(d.appt_end))) return 'appt_end is not a valid time';
  }
  return '';
}

/* Lead fields from a message. Used to create a lead, or to fill in blanks on
   an existing one when a later event carries the details again. */
function leadFields(d) {
  const attribution = {};
  for (const k of ATTRIBUTION_KEYS) attribution[k] = str(d[k], 1000);
  const interest = {};
  for (const k of INTEREST_KEYS) if (str(d[k])) interest[k] = str(d[k]);
  const extra = {};
  let n = 0;
  for (const k of Object.keys(d)) {
    if (KNOWN.has(k) || n >= 50) continue;
    const v = d[k];
    if (v == null || typeof v === 'object') continue;
    extra[str(k, 60)] = str(v);
    n++;
  }
  return {
    submissionId: str(d.submission_id, 100),
    pillar: PILLAR_KEYS.includes(d.pillar) ? d.pillar : 'services',
    source: str(d.source, 60) || 'Website form',
    formType: str(d.form_type, 40),
    formId: str(d.form_id, 60),
    pageTitle: str(d.page_title, 300),
    name: str(d.name, 200),
    phone: str(d.phone, 40),
    phoneNormalised: normalisePhone(d.phone),
    email: str(d.email, 200).toLowerCase(),
    company: str(d.organisation, 200) || str(d.venture, 200), // partner form sends organisation, Incube8 apply sends venture
    website: str(d.website, 300),
    industry: str(d.industry, 100),
    adSpend: str(d.monthly_ad_spend, 100),
    interest,
    extra,
    attribution,
    submittedAt: d.submitted_at && !isNaN(new Date(d.submitted_at)) ? new Date(d.submitted_at) : null,
  };
}

/* Appointment fields from an `appointment` message. */
function apptFields(d) {
  const start = new Date(d.appt_start);
  const dur = Math.min(240, Math.max(5, parseInt(d.appt_duration_min, 10) || 30));
  const end = d.appt_end && !isNaN(new Date(d.appt_end)) ? new Date(d.appt_end) : new Date(start.getTime() + dur * 60000);
  return {
    kind: str(d.appt_kind, 100) || 'Free Business Audit call',
    pillar: PILLAR_KEYS.includes(d.pillar) ? d.pillar : 'services',
    start,
    end,
    durationMin: Math.round((end - start) / 60000) || dur,
    mode: APPT_MODES.includes(d.appt_mode) ? d.appt_mode : 'Phone call',
    tz: 'Asia/Kolkata',
    bookedVia: 'Website form',
  };
}

/* The hidden `company` field is a bot trap: people never see it. */
const isBot = (d) => !!str(d && d.company);

module.exports = { validate, leadFields, apptFields, normalisePhone, isBot, str };
