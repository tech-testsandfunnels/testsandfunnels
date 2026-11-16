#!/usr/bin/env node
/* t&f CRM intake: reference implementation of the two endpoints the website forms call.
 *
 *   POST /api/intake   receives tf-intake/1 events: lead, appointment, skip
 *   GET  /api/slots    returns free appointment slots: { days: [{ date: "2026-11-16", times: ["11:00", ...] }] }
 *
 * It keeps everything in memory (and writes intake-log.json next to this file), so it is for testing the forms
 * and for showing your developer exactly what the real CRM must do. No dependencies: node mock-intake.js
 *
 *   PORT=8787 CONFIRM=auto node mock-intake.js      CONFIRM=auto confirms slots at once, CONFIRM=manual (default) leaves them "requested"
 *
 * To try it with the site: set CRM_INTAKE_URL = "http://localhost:8787/api/intake" and CRM_SLOTS_URL = "http://localhost:8787/api/slots"
 * in sitebuild/lib.py, then rebuild.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = +process.env.PORT || 8787;
const CONFIRM = process.env.CONFIRM || "manual";
const HOURS = { days: [1, 2, 3, 4, 5, 6], start: "11:00", end: "18:00", step: 30, lead: 3, ahead: 14 };
const LOG = path.join(__dirname, "intake-log.json");

const leads = new Map();        // lead_id -> lead record
const bySubmission = new Map(); // submission_id -> lead_id (idempotency: the site may retry)
const appts = [];               // appointment records
let seq = 1000;

const pad = n => (n < 10 ? "0" : "") + n;
const hm = t => { const p = t.split(":"); return +p[0] * 60 + +p[1]; };
function istNow() { const n = new Date(); return new Date(n.getTime() + (n.getTimezoneOffset() + 330) * 60000); }
function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

function freeSlots(pillar, ahead) {
  const now = istNow(), minNow = now.getHours() * 60 + now.getMinutes() + HOURS.lead * 60, out = [];
  for (let i = 0; i <= Math.min(ahead || HOURS.ahead, 30) && out.length < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (!HOURS.days.includes(d.getDay())) continue;
    const date = ymd(d), times = [];
    for (let m = hm(HOURS.start); m + HOURS.step <= hm(HOURS.end); m += HOURS.step) {
      if (i === 0 && m < minNow) continue;
      const t = pad(Math.floor(m / 60)) + ":" + pad(m % 60);
      const taken = appts.some(a => a.status !== "cancelled" && a.start.startsWith(date + "T" + t));
      if (!taken) times.push(t);
    }
    if (times.length) out.push({ date, times });
  }
  return out;
}

function send(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
  res.end(JSON.stringify(body));
}

function save() { try { fs.writeFileSync(LOG, JSON.stringify({ leads: [...leads.values()], appointments: appts }, null, 2)); } catch (e) { /* read-only folder */ } }

function intake(d) {
  if (d.schema !== "tf-intake/1") return [422, { ok: false, error: "unknown schema" }];
  if (!["lead", "appointment", "skip"].includes(d.event)) return [422, { ok: false, error: "unknown event" }];
  if (!d.submission_id || !d.name || !(d.phone || d.email)) return [422, { ok: false, error: "name and a phone or email are required" }];

  // Lead: one record per submission_id. The appointment and skip events carry the full details again, so they create the lead if event 1 never arrived.
  let id = d.lead_id && leads.has(d.lead_id) ? d.lead_id : bySubmission.get(d.submission_id);
  let lead = id && leads.get(id);
  if (!lead) {
    id = "L-" + (++seq);
    lead = { lead_id: id, created_at: new Date().toISOString(), source: d.source || "Website form", pillar: d.pillar, form_type: d.form_type, status: "New",
      name: d.name, phone: d.phone, email: d.email, website: d.website, industry: d.industry, monthly_ad_spend: d.monthly_ad_spend, message: d.message,
      attribution: { utm_source: d.utm_source, utm_medium: d.utm_medium, utm_campaign: d.utm_campaign, utm_term: d.utm_term, utm_content: d.utm_content, gclid: d.gclid, fbclid: d.fbclid, landing_page: d.landing_page, referrer: d.referrer, source_page: d.source_page },
      appointment_id: null, events: [] };
    leads.set(id, lead);
    bySubmission.set(d.submission_id, id);
  }
  lead.events.push({ at: new Date().toISOString(), event: d.event });

  if (d.event === "skip") { lead.appointment_skipped = true; lead.next_action = "Call the lead"; save(); return [200, { ok: true, lead_id: id }]; }
  if (d.event === "lead") { save(); return [200, { ok: true, lead_id: id }]; }

  // Appointment: refuse a slot that is already taken, so two visitors never get the same time
  if (!d.appt_start) return [422, { ok: false, error: "appt_start is required" }];
  if (appts.some(a => a.status !== "cancelled" && a.start === d.appt_start && a.lead_id !== id)) return [409, { ok: false, error: "slot_taken" }];
  let appt = appts.find(a => a.lead_id === id && a.status !== "cancelled");
  if (!appt) { appt = { appointment_id: "A-" + (++seq), lead_id: id }; appts.push(appt); }
  Object.assign(appt, { kind: d.appt_kind, start: d.appt_start, end: d.appt_end, duration_min: d.appt_duration_min, mode: d.appt_mode, tz: d.appt_tz || "Asia/Kolkata", pillar: d.pillar,
    status: CONFIRM === "auto" ? "confirmed" : "requested", booked_at: new Date().toISOString(), booked_via: "Website form" });
  lead.appointment_id = appt.appointment_id;
  lead.next_action = appt.status === "confirmed" ? "Attend the call" : "Confirm the appointment";
  save();
  return [200, { ok: true, lead_id: id, appointment: { id: appt.appointment_id, status: appt.status, start: appt.start } }];
}

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && u.pathname === "/api/slots") return send(res, 200, { days: freeSlots(u.searchParams.get("pillar"), +u.searchParams.get("days")) });
  if (req.method === "GET" && u.pathname === "/api/leads") return send(res, 200, { leads: [...leads.values()], appointments: appts });
  if (req.method === "POST" && u.pathname === "/api/reset") { leads.clear(); bySubmission.clear(); appts.length = 0; return send(res, 200, { ok: true }); }
  if (req.method === "POST" && u.pathname === "/api/intake") {
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 50000) req.destroy(); });
    req.on("end", () => {
      let d; try { d = JSON.parse(raw); } catch (e) { return send(res, 400, { ok: false, error: "invalid json" }); }
      if (process.env.FAIL === "1") return send(res, 500, { ok: false, error: "forced failure" });
      const [code, body] = intake(d);
      send(res, code, body);
    });
    return;
  }
  send(res, 404, { ok: false, error: "not found" });
}).listen(PORT, () => console.log("t&f mock CRM intake on http://localhost:" + PORT + "  (CONFIRM=" + CONFIRM + ")"));
