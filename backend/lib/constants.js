/* constants.js
   Pillars, their pipeline stages and the other fixed lists the CRM uses.
   The dashboard reads these from GET /api/meta, so this file is the single
   source of truth (no copy in the frontend). Stage index 0-3 = open,
   4 = won (or enrolled / onboarded), 5 = lost (or declined). */

const PILLARS = {
  services: { name: 'Services', stages: ['New', 'Contacted', 'Audit call', 'Proposal', 'Won', 'Lost'] },
  production: { name: 'Production house', stages: ['New', 'Contacted', 'Brief and quote', 'Proposal', 'Won', 'Lost'] },
  training: { name: 'Training', stages: ['New', 'Counselled', 'Applied', 'Interview', 'Enrolled', 'Lost'] },
  incubation: { name: 'Incube8', stages: ['Applied', 'Screening', 'Interview', 'Decision', 'Onboarded', 'Declined'] },
};
const PILLAR_KEYS = Object.keys(PILLARS);
const WON = 4;
const LOST = 5;

const SOURCES = ['Website form', 'Instagram', 'LinkedIn', 'WhatsApp', 'Referral', 'Cold outreach', 'Google search', 'AI search', 'Dashboard'];

const APPT_STATUSES = ['requested', 'confirmed', 'done', 'noshow', 'cancelled'];
const APPT_MODES = ['Phone call', 'Google Meet', 'In office'];
const APPT_KINDS = [
  'Free Business Audit call',
  'AI agents planning call',
  'production brief call',
  'personal brand planning call',
  'influencer campaign call',
  'counselling call',
  'screening call',
  'call back',
  'partnership call',
  'Intro call',
  'Proposal walkthrough',
  'Online interview',
  'In-office interview',
  'Incube8 interview',
  'Decision call',
  'Client review',
  'Shoot recce',
];

const TASK_STATUSES = ['todo', 'doing', 'review', 'done'];
const TASK_PRIORITIES = ['high', 'med', 'low'];
const CLIENT_HEALTH = ['good', 'warn', 'crit'];
const ATTENDANCE = ['P', 'W', 'L', 'A', 'O']; // present, WFH, leave, absent, weekly off

/* Fields from tf-intake/1 that map to their own lead columns (spec section 5). */
const ATTRIBUTION_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'landing_page', 'referrer', 'source_page',
];
/* Form fields kept "as typed" under the lead's interest and notes (spec 5, Lead). */
const INTEREST_KEYS = ['interest', 'topic', 'message', 'format', 'status', 'city', 'mode', 'goal', 'stage'];

module.exports = {
  PILLARS, PILLAR_KEYS, WON, LOST, SOURCES,
  APPT_STATUSES, APPT_MODES, APPT_KINDS,
  TASK_STATUSES, TASK_PRIORITIES, CLIENT_HEALTH, ATTENDANCE,
  ATTRIBUTION_KEYS, INTEREST_KEYS,
};
