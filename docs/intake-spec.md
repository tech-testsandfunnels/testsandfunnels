> **In this repo:** the CRM side of this spec is built in `backend/` (`lib/intake.js`, `routes/public.js`). The marketing site here is Astro (`website/`), not the `sitebuild/lib.py` build this spec mentions: its forms send a one-step `lead` event from `website/src/chrome/app.js`, and the intake URL is set with the `PUBLIC_CRM_INTAKE_URL` repo variable (see README). `mock-intake.js` is in `tools/`.

# t&f website to CRM: intake spec (tf-intake/1)

For whoever builds `crm.testsandfunnels.com`. This is everything the website forms send, what the CRM must answer, and how each field maps. A working reference server is in `mock-intake.js` (no dependencies: `node mock-intake.js`).

**Status.** The website side is built and tested against that mock. The CRM side does not exist yet: `tf-crm-admin-dashboard.html` is a demo with made-up data, not a running system. Until the two URLs below are set in `sitebuild/lib.py`, every form finishes in WhatsApp (details and preferred time prefilled), so no lead is lost.

## 1. What the visitor does

Every lead form on the site is the same two-step form:

1. **Your details.** Pressing "Next: choose a time" sends a `lead` event to the CRM at once, so the lead exists even if the visitor leaves.
2. **Pick a time.** The visitor picks a day and a time (India time, 11:00 to 18:00 by default, 30 or 15 minutes long) and phone call or Google Meet, then "Confirm appointment", which sends an `appointment` event. Or they press the skip link, which sends a `skip` event.

```
Step 1 submit ──► POST /api/intake  {event:"lead"}          ──► { lead_id }
Step 2 opens  ──► GET  /api/slots?pillar=..&kind=..&days=14 ──► { days:[{date,times[]}] }
Confirm       ──► POST /api/intake  {event:"appointment", lead_id, appt_*} ──► { appointment:{id,status} }  or 409 slot_taken
Skip          ──► POST /api/intake  {event:"skip", lead_id}  ──► { lead_id }
```

All three events of one visit share one `submission_id` (a UUID made in the browser). The `appointment` and `skip` events carry the full form fields again, so if the `lead` request never arrived, the CRM creates the lead from them.

If `CRM_INTAKE_URL` is empty, or the request fails or times out, the form opens a prefilled WhatsApp message and tells the visitor to press send. It never shows a dead end.

## 2. Endpoints

| | |
|---|---|
| `POST /api/intake` | Body: JSON, `Content-Type: application/json`. Public (no login). Send CORS headers: `Access-Control-Allow-Origin: https://testsandfunnels.com` (the mock uses `*`), `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Allow-Methods: GET,POST,OPTIONS`, and answer `OPTIONS` with 204. |
| `GET /api/slots` | Query: `pillar` (services, production, training, incubation), `kind` (form type), `days` (how many days ahead, 14). Answer: `{"days":[{"date":"2026-11-16","times":["11:00","11:30"]}]}`. Dates are `YYYY-MM-DD` and times `HH:MM`, both in India time. Leave out days with no free time. The site shows at most 12 days. |

Set them in `sitebuild/lib.py`, then rebuild:

```python
CRM_INTAKE_URL = "https://crm.testsandfunnels.com/api/intake"
CRM_SLOTS_URL  = "https://crm.testsandfunnels.com/api/slots"
```

If `/api/slots` is down or takes more than 4 seconds, the form falls back to the standard hours (`SLOT_*` in `lib.py`), and a taken slot is caught by the 409 below.

## 3. The message

One flat JSON object, strings only (numbers are sent as numbers where noted). `schema` is always `"tf-intake/1"`.

### 3.1 On every event

| Field | Example | Meaning |
|---|---|---|
| `schema` | `tf-intake/1` | Version. Reject unknown versions with 422 |
| `event` | `lead` / `appointment` / `skip` | What just happened |
| `submission_id` | `0b9c...` (UUID) | One per visit to a form. **Idempotency key**: the same id must never create a second lead |
| `lead_id` | `L-1004` | Only after the CRM has returned it. Missing on the first event, and when the first request failed |
| `form_type` | `audit`, `training`, `incubation`, `contact`, `partner` | Which kind of form |
| `form_id` | `hf-form`, `audit-form`, `contact-form`, `training-form`, `partner-form` | `hf-form` is the hero form at the top of a page |
| `pillar` | `services`, `production`, `training`, `incubation` | Which pillar's pipeline the lead belongs to (section 5) |
| `source` | `Website form` | Fixed. Use it as the lead source |
| `page_title`, `submitted_at` | | Page title and ISO time (UTC) |
| `name`, `phone` | | Always present. `phone` is free text such as `+91 98765 43210`; normalise it in the CRM |
| `email` | | Present on every form except the hero forms |

### 3.2 Fields that depend on the form

| Form | Extra fields |
|---|---|
| Hero form, services pages (`audit`) | `industry` |
| Free Business Audit (home section, `/free-business-audit/`) | `email`, `website`, `industry`, `monthly_ad_spend` |
| Hero form, `/training/` (`training`) | `format` |
| Training apply (`#apply`) | `email`, `status`, `city`, `mode`, `goal` |
| Hero form, `/incubation/` (`incubation`) | `stage` |
| Contact (`contact`) | `email`, `topic`, `message` |
| Partner (`partner`) | `organisation`, `email`, `message` |

Keep anything you do not have a column for in a JSON `extra` column so nothing is dropped.

### 3.3 Where it came from (on every event)

`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid`, `landing_page` (the first page of the visit), `referrer`, `source_page` (the page the form is on). Empty string when unknown. Store them on the lead as attribution; the dashboard shows them as "Came from".

### 3.4 Appointment events only

| Field | Example | Meaning |
|---|---|---|
| `appt_kind` | `Free Business Audit call` | What is being booked (section 5) |
| `appt_start` | `2026-11-16T12:30:00+05:30` | Start, ISO 8601 with the India offset |
| `appt_end` | `2026-11-16T13:00:00+05:30` | End (start plus `appt_duration_min`) |
| `appt_duration_min` | `30` (number) | 30, or 15 for the contact call back |
| `appt_mode` | `Phone call` or `Google Meet` | How the team reaches them. For Meet, create the link when confirming |
| `appt_tz` | `Asia/Kolkata` | Always India time |
| `appt_status` | `requested` | What the website asks for. Only the CRM sets `confirmed` |

## 4. What the CRM answers

| Case | Status | Body |
|---|---|---|
| Lead created, or the same `submission_id` again | 200 | `{"ok":true,"lead_id":"L-1004"}` |
| Appointment saved | 200 | `{"ok":true,"lead_id":"L-1004","appointment":{"id":"A-1005","status":"requested","start":"2026-11-16T12:30:00+05:30"}}`. Use `"status":"confirmed"` if the CRM books it straight away; the page then says "You are booked in" instead of "Request received" |
| Slot already taken by someone else | **409** | `{"ok":false,"error":"slot_taken"}`. The page keeps the visitor on step 2 and asks for another time |
| Bad message | 422 | `{"ok":false,"error":"..."}` |
| Anything else | 5xx | The site falls back to WhatsApp |

Rules:

1. **Idempotent.** The site retries nothing automatically, but browsers and networks repeat requests. A second `lead` with the same `submission_id` returns the same `lead_id`.
2. **Never lose a lead.** If an `appointment` or `skip` arrives without a known `lead_id`, create the lead from its fields.
3. **Slot safety.** Check the slot inside the same transaction that saves the appointment (a unique index on `start` per calendar). Two visitors can pick the same slot at the same moment.
4. **Skip.** Save `appointment_skipped = true` and set the lead's next action to "Call the lead".
5. **Confirm.** A `requested` appointment stays in the "Website appointments to confirm" list until a person confirms it (the demo has the button). On confirm, send the visitor a WhatsApp and an email with the time and, for Meet, the link.
6. **Do not email or message the visitor on the `lead` event alone.** Wait for the appointment or skip, or for a short delay (for example 10 minutes), so they are not contacted twice.

## 5. Mapping to CRM objects

### Pillar

| Page the form is on | `pillar` |
|---|---|
| `/production-house/`, `/personal-branding/`, `/influencer-marketing/` and their sub pages | `production` |
| `/training/` | `training` |
| `/incubation/` | `incubation` |
| every other page (home, services, AI, industries, locations, work, about, free audit, partner) | `services` |
| Contact form, when "What is this about?" is "Training enquiry" | `training` (overrides the page) |
| Contact form, when it is "Incubation" | `incubation` (overrides the page) |

### Appointment kind

| Form | `appt_kind` | Minutes |
|---|---|---|
| Audit forms (default) | Free Business Audit call | 30 |
| Audit forms on `/ai-automation/` | AI agents planning call | 30 |
| Audit forms on `/production-house/` | production brief call | 30 |
| Audit forms on `/personal-branding/` | personal brand planning call | 30 |
| Audit forms on `/influencer-marketing/` | influencer campaign call | 30 |
| Training | counselling call | 30 |
| Incubation | screening call | 30 |
| Contact | call back | 15 |
| Partner | partnership call | 30 |

### Lead

| Website | CRM |
|---|---|
| `name`, `phone`, `email` | Lead name, phone, email |
| `organisation`, `website` | Company, website |
| `industry`, `monthly_ad_spend` | Industry, ad spend band |
| `topic`, `message`, `format`, `status`, `city`, `mode`, `goal`, `stage` | Interest and notes, kept as typed |
| `pillar` | Pipeline (Services, Production house, Training, Incube8) and first stage "New" |
| `source` | Lead source `Website form` |
| `utm_*`, `gclid`, `fbclid`, `landing_page`, `referrer`, `source_page` | Attribution |
| `submission_id` | Idempotency key |

### Appointment

| Website | CRM |
|---|---|
| `lead_id` | The lead it belongs to |
| `appt_kind`, `appt_start`, `appt_end`, `appt_duration_min`, `appt_mode` | Kind, start, end, length, mode |
| `appt_status: requested` | Status `requested`; the CRM moves it to `confirmed` when a person confirms it (the demo dashboard calls that state "scheduled") |
| `pillar` | Pillar of the appointment |

Suggested owner: services and production to Sales; training and incubation to the Training team. Set this in the CRM, not on the site.

## 6. Suggested tables (Postgres)

```sql
create table leads (
  id            text primary key,                -- L-1004
  submission_id text unique not null,
  created_at    timestamptz not null default now(),
  pillar        text not null check (pillar in ('services','production','training','incubation')),
  source        text not null default 'Website form',
  form_type     text, form_id text,
  name text not null, phone text, email text, company text, website text,
  industry text, ad_spend text, extra jsonb not null default '{}',
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  gclid text, fbclid text, landing_page text, referrer text, source_page text,
  stage text not null default 'New', owner_id text,
  appointment_skipped boolean not null default false,
  next_action text
);
create table appointments (
  id          text primary key,                  -- A-1005
  lead_id     text not null references leads(id),
  kind        text not null, pillar text not null,
  starts_at   timestamptz not null, ends_at timestamptz not null,
  duration_min int not null, mode text not null,
  status      text not null default 'requested' check (status in ('requested','confirmed','done','noshow','cancelled')),
  booked_via  text not null default 'Website form',
  meet_link   text,
  created_at  timestamptz not null default now()
);
-- two visitors can never hold the same slot
create unique index appointments_one_per_slot on appointments (starts_at) where status <> 'cancelled';
```

## 7. Test it

```bash
node mock-intake.js                       # PORT=8787, CONFIRM=manual (requested). CONFIRM=auto confirms at once. FAIL=1 forces errors.
curl -s localhost:8787/api/slots?pillar=services | head -c 200
curl -s -X POST localhost:8787/api/intake -H 'Content-Type: application/json' -d '{
 "schema":"tf-intake/1","event":"lead","submission_id":"demo-1","form_type":"audit","form_id":"audit-form","pillar":"services",
 "source":"Website form","name":"Test Person","phone":"+91 98765 43210","email":"test@example.com","industry":"E-commerce"}'
curl -s localhost:8787/api/leads          # what it has stored
```

Then set `CRM_INTAKE_URL = "http://localhost:8787/api/intake"` and `CRM_SLOTS_URL = "http://localhost:8787/api/slots"` in `sitebuild/lib.py`, run `python3 build.py ../out`, and open `out/preview/contact/index.html`.

## 8. Before going live

1. Allow only the site's origin in CORS, and rate-limit `POST /api/intake` by IP (for example 10 a minute).
2. Treat every field as untrusted text: validate length, escape on display, never build SQL or HTML from it. The forms also include a hidden `company` field as a bot trap; the site drops submissions that fill it, so a server-side check is a second layer.
3. Keep the privacy policy in step: the lead is stored at step 1, before the visitor has chosen a time.
4. Run the site's `python3 check.py` after rebuilding (it checks that every form still has both steps and the CRM fields).
