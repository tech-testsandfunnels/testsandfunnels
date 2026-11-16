(function () {
  "use strict";
  var TF = window.TF || {};
  window.dataLayer = window.dataLayer || [];
  function track(event, data) {
    var p = { event: event };
    for (var k in data) { if (Object.prototype.hasOwnProperty.call(data, k)) p[k] = data[k]; }
    window.dataLayer.push(p);
  }
  function store(get, key, val) {
    try { return get ? window.sessionStorage.getItem(key) : window.sessionStorage.setItem(key, val); } catch (e) { return null; }
  }

  /* Header shadow, footer year */
  var header = document.querySelector(".site-header");
  function onScroll() { if (header) header.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  /* Theme: light or dark. The choice is kept in this browser; until one is made the device setting decides (applied in <head> before first paint). */
  var root = document.documentElement, tbtn = document.querySelector("[data-theme-toggle]");
  function themeNow() { return root.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
  function paintTheme() {
    var d = themeNow() === "dark";
    if (tbtn) { tbtn.setAttribute("aria-pressed", d ? "true" : "false"); tbtn.setAttribute("aria-label", d ? "Switch to light theme" : "Switch to dark theme"); }
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", d ? "#12131D" : "#383C4F");
  }
  paintTheme();
  if (tbtn) tbtn.addEventListener("click", function () {
    var next = themeNow() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("tf-theme", next); } catch (e) { /* storage blocked: the choice lasts for this page only */ }
    paintTheme();
    track("theme_toggle", { theme: next });
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onMq = function (e) {
      var saved = null;
      try { saved = localStorage.getItem("tf-theme"); } catch (x) { /* ignore */ }
      if (saved !== "dark" && saved !== "light") { root.setAttribute("data-theme", e.matches ? "dark" : "light"); paintTheme(); }
    };
    if (mq.addEventListener) mq.addEventListener("change", onMq);
  }

  /* Mobile nav, built from the desktop nav (single source of truth) */
  var menuToggle = document.querySelector(".menu-toggle");
  var mobileNav = document.getElementById("mobile-nav");
  var items = document.querySelectorAll(".nav > ul > li");
  if (menuToggle && mobileNav && items.length) {
    var list = document.createElement("ul");
    items.forEach(function (li) {
      var top = li.querySelector("a.link");
      var sub = li.querySelector("ul.submenu");
      var item = document.createElement("li");
      if (sub) {
        var d = document.createElement("details");
        var s = document.createElement("summary");
        s.textContent = top.textContent;
        d.appendChild(s);
        var c = sub.cloneNode(true);
        c.removeAttribute("class");
        d.appendChild(c);
        item.appendChild(d);
      } else {
        item.appendChild(top.cloneNode(true));
      }
      list.appendChild(item);
    });
    mobileNav.appendChild(list);
    var cta = document.createElement("a");
    cta.className = "btn mnav-cta";
    cta.href = TF.auditHref || "#";
    cta.textContent = "Get your Free Business Audit";
    cta.setAttribute("data-track", "Get your Free Business Audit");
    cta.setAttribute("data-pos", "mobile-nav");
    mobileNav.appendChild(cta);
    var closeNav = function () {
      menuToggle.setAttribute("aria-expanded", "false");
      mobileNav.classList.remove("open");
      document.body.style.overflow = "";
    };
    menuToggle.addEventListener("click", function () {
      if (menuToggle.getAttribute("aria-expanded") === "true") { closeNav(); return; }
      menuToggle.setAttribute("aria-expanded", "true");
      mobileNav.classList.add("open");
      document.body.style.overflow = "hidden";
    });
    mobileNav.addEventListener("click", function (e) { if (e.target.closest("a")) closeNav(); });
    window.addEventListener("resize", function () { if (window.innerWidth > 1280) closeNav(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeNav(); });
  }

  /* Click tracking */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-track]");
    if (!el) return;
    track(el.getAttribute("data-event") || "cta_click", {
      cta_label: el.getAttribute("data-track"),
      cta_position: el.getAttribute("data-pos") || "",
      page_type: document.body.getAttribute("data-page-type") || ""
    });
  });

  /* Lead source: keep UTMs and click ids for the whole visit, not just the landing page */
  var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
  var qs = new URLSearchParams(window.location.search);
  keys.forEach(function (k) {
    var v = qs.get(k);
    if (v) store(false, "tf_" + k, v);
  });
  if (!store(true, "tf_landing")) store(false, "tf_landing", window.location.href.split("#")[0]);
  if (!store(true, "tf_ref")) store(false, "tf_ref", document.referrer || "");

  /* Forms: step 1 collects details and sends the lead to the CRM; step 2 books a call and sends the appointment.
     Both steps share one submission_id, so the CRM can match them even if the first request never arrived. */
  var H = TF.hours || { days: [1, 2, 3, 4, 5, 6], start: "11:00", end: "18:00", step: 30, lead: 3, ahead: 14 };
  var WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function istNow() { var n = new Date(); return new Date(n.getTime() + (n.getTimezoneOffset() + 330) * 60000); } // India wall-clock time in a Date's local fields
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function hm(t) { var p = t.split(":"); return +p[0] * 60 + +p[1]; }
  function label12(t) { var m = hm(t), h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + ":" + pad(mm) + " " + (h < 12 ? "am" : "pm"); }
  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* fall through */ }
    return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function fallbackDays() { // the standard hours, used until the CRM says which slots are free
    var out = [], now = istNow(), minNow = now.getHours() * 60 + now.getMinutes() + H.lead * 60;
    for (var i = 0; i <= H.ahead && out.length < 12; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (H.days.indexOf(d.getDay()) < 0) continue;
      var times = [];
      for (var m = hm(H.start); m + H.step <= hm(H.end); m += H.step) {
        if (i === 0 && m < minNow) continue;
        times.push(pad(Math.floor(m / 60)) + ":" + pad(m % 60));
      }
      if (times.length) out.push({ date: ymd(d), times: times });
    }
    return out;
  }
  function dayLabel(iso, i) {
    var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    var today = ymd(istNow()), tm = new Date(istNow().getTime() + 864e5);
    return { top: iso === today ? "Today" : (iso === ymd(tm) ? "Tomorrow" : WD[d.getDay()]), num: d.getDate(), mon: MO[d.getMonth()], long: WD[d.getDay()] + ", " + d.getDate() + " " + MO[d.getMonth()] };
  }
  function icsFile(title, startIso, endIso, details) {
    function z(iso) { return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""); }
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//tests&funnels//Website//EN", "BEGIN:VEVENT", "UID:" + uuid() + "@testsandfunnels.com",
      "DTSTAMP:" + z(new Date().toISOString()), "DTSTART:" + z(startIso), "DTEND:" + z(endIso), "SUMMARY:" + title, "DESCRIPTION:" + details.replace(/\n/g, "\\n"), "END:VEVENT", "END:VCALENDAR"];
    return URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  }
  function post(url, data) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), keepalive: true }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error("status " + r.status); e.status = r.status; e.body = j; throw e; } return j; });
    });
  }

  document.querySelectorAll("form[data-form]").forEach(function (form) {
    var kind = form.getAttribute("data-form");
    var isApply = kind === "training" || kind === "incubation";
    var startEvt = kind === "audit" ? "audit_form_start" : (isApply ? "apply_start" : "contact_form_start");
    var submitEvt = kind === "audit" ? "audit_form_submit" : (isApply ? "apply_submit" : "contact_form_submit");
    var call = form.getAttribute("data-appt") || "call", mins = +form.getAttribute("data-appt-min") || 30;
    var basePillar = form.getAttribute("data-pillar") || "services";
    var sid = uuid(), leadId = "", leadSent = false, leadBusy = null, step = 1, days = null, slot = null;

    keys.forEach(function (k) { if (form.elements[k]) form.elements[k].value = store(true, "tf_" + k) || ""; });
    if (form.elements["landing_page"]) form.elements["landing_page"].value = store(true, "tf_landing") || window.location.href.split("#")[0];
    if (form.elements["referrer"]) form.elements["referrer"].value = store(true, "tf_ref") || "";
    if (form.elements["source_page"]) form.elements["source_page"].value = window.location.pathname;

    // Prefill selects from the query string, e.g. ?industry=E-commerce or ?topic=Training
    ["industry", "topic"].forEach(function (name) {
      var want = qs.get(name);
      var sel = form.elements[name];
      if (want && sel && sel.tagName === "SELECT") {
        Array.prototype.forEach.call(sel.options, function (o) { if (o.text === want || o.value === want) sel.value = o.value || o.text; });
      }
    });

    var started = false;
    form.addEventListener("focusin", function () {
      if (started) return;
      started = true;
      track(startEvt, { form_type: kind, form_id: form.id });
    });

    var msg = form.querySelector(".form-msg");
    function show(text, isErr, href, label) {
      if (!msg) return;
      msg.className = "form-msg show" + (isErr ? " err" : "");
      msg.textContent = text;
      if (href) {
        msg.appendChild(document.createTextNode(" "));
        var a = document.createElement("a");
        a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = label;
        msg.appendChild(a);
      }
    }
    function clearMsg() { if (msg) { msg.className = "form-msg"; msg.textContent = ""; } }

    var panels = form.querySelectorAll(".fpanel"), stepLis = form.querySelectorAll(".fsteps li");
    var dayBox = form.querySelector(".slot-days"), timeBox = form.querySelector(".slot-times"), noneMsg = form.querySelector(".slot-none");
    function setStep(n) {
      step = n;
      Array.prototype.forEach.call(panels, function (p) { p.hidden = +p.getAttribute("data-panel") !== n; });
      Array.prototype.forEach.call(stepLis, function (li, i) {
        li.classList.toggle("on", i + 1 === n); li.classList.toggle("done", i + 1 < n);
        if (i + 1 === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      });
      clearMsg();
      var target = n === 2 ? form.querySelector(".slot-title") : form.querySelector("input,select,textarea");
      if (target) { try { target.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } }
      var r = form.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function pillar() {
      var t = form.elements["topic"] ? form.elements["topic"].value : "";
      if (t === "Training enquiry") return "training";
      if (t === "Incubation") return "incubation";
      return basePillar;
    }
    function slotIso(date, time, plusMin) {
      var m = hm(time) + (plusMin || 0);
      return date + "T" + pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60) + ":00+05:30";
    }
    function chosen() {
      var d = form.querySelector('input[name="appt_date"]:checked'), t = form.querySelector('input[name="appt_time"]:checked');
      return d && t ? { date: d.value, time: t.value } : null;
    }
    function fields() {
      var data = {}, lines = [];
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.name === "company" || el.type === "submit" || el.type === "button" || el.name.indexOf("appt_") === 0) return;
        var v = (el.value || "").trim();
        data[el.name] = v;
        if (el.type === "hidden") return;
        var lab = form.querySelector('label[for="' + el.id + '"]');
        if (lab && v) lines.push(lab.firstChild.textContent.trim() + ": " + v);
      });
      return { data: data, lines: lines };
    }
    function build(evt, withSlot) {
      var f = fields(), d = f.data;
      d.schema = "tf-intake/1"; d.event = evt; d.submission_id = sid; d.form_type = kind; d.form_id = form.id; d.pillar = pillar();
      d.source = "Website form"; d.page_title = document.title; d.submitted_at = new Date().toISOString();
      if (leadId) d.lead_id = leadId;
      if (withSlot) {
        var mode = form.querySelector('input[name="appt_mode"]:checked');
        d.appt_kind = call; d.appt_start = slotIso(withSlot.date, withSlot.time); d.appt_end = slotIso(withSlot.date, withSlot.time, mins);
        d.appt_duration_min = mins; d.appt_mode = mode ? mode.value : "Phone call"; d.appt_tz = "Asia/Kolkata"; d.appt_status = "requested";
      }
      return { data: d, lines: f.lines };
    }

    /* Step 1 -> CRM: the lead is saved before the person picks a time */
    function sendLead() {
      if (!TF.intake || leadSent) return Promise.resolve();
      if (leadBusy) return leadBusy;
      leadBusy = post(TF.intake, build("lead").data).then(function (j) { leadSent = true; if (j && j.lead_id) leadId = String(j.lead_id); })
        .catch(function () { /* the appointment or skip request carries the full details again */ })
        .then(function () { leadBusy = null; });
      return leadBusy;
    }

    /* Step 2: day chips and time slots */
    function renderDays(list) {
      days = list; slot = null;
      dayBox.innerHTML = ""; timeBox.innerHTML = "";
      if (noneMsg) noneMsg.hidden = list.length > 0;
      dayBox.hidden = timeBox.hidden = !list.length;
      var conf = form.querySelector("[data-confirm]"); if (conf) conf.disabled = !list.length;
      list.forEach(function (d, i) {
        var l = dayLabel(d.date, i), lab = document.createElement("label");
        lab.className = "sd";
        lab.innerHTML = '<input type="radio" name="appt_date" value="' + d.date + '"><span><small>' + l.top + "</small><b>" + l.num + "</b><small>" + l.mon + "</small></span>";
        lab.firstChild.addEventListener("change", function () { renderTimes(d); track("appointment_day_selected", { form_type: kind, pillar: pillar() }); });
        dayBox.appendChild(lab);
      });
      if (list.length) { var first = dayBox.querySelector("input"); first.checked = true; renderTimes(list[0]); }
    }
    function renderTimes(d) {
      timeBox.innerHTML = "";
      d.times.forEach(function (t) {
        var lab = document.createElement("label");
        lab.className = "stm";
        lab.innerHTML = '<input type="radio" name="appt_time" value="' + t + '"><span>' + label12(t) + "</span>";
        lab.firstChild.addEventListener("change", function () { clearMsg(); track("appointment_slot_selected", { form_type: kind, pillar: pillar(), appt_time: t }); });
        timeBox.appendChild(lab);
      });
    }
    function loadSlots() {
      if (!dayBox) return;
      renderDays(fallbackDays());
      if (!TF.slots) return;
      var ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
      fetch(TF.slots + "?pillar=" + encodeURIComponent(pillar()) + "&kind=" + encodeURIComponent(kind) + "&days=" + H.ahead, ctl ? { signal: ctl.signal } : {})
        .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
        .then(function (j) {
          clearTimeout(to);
          if (j && j.days && j.days.length >= 0 && Array.isArray(j.days)) renderDays(j.days.filter(function (d) { return d.times && d.times.length; }).slice(0, 12));
        })
        .catch(function () { clearTimeout(to); /* keep the standard hours */ });
    }

    /* Finish: a calm confirmation that says exactly what happened */
    function finish(opts) { // opts: slot, status ("confirmed" | "requested"), via ("crm" | "whatsapp"), url
      var d = fields().data, name = (d.name || "").split(" ")[0] || "there", html = "";
      var panel = document.createElement("div");
      panel.className = "fdone"; panel.setAttribute("role", "status"); panel.tabIndex = -1;
      var title, body, extra = "";
      if (opts.slot) {
        var l = dayLabel(opts.slot.date), when = l.long + " at " + label12(opts.slot.time) + " IST";
        var mode = form.querySelector('input[name="appt_mode"]:checked');
        if (opts.status === "confirmed") { title = "You are booked in, " + name; body = "Your " + call + " is on " + when + ". We will reach you by " + (mode ? mode.value.toLowerCase() : "phone call") + "."; }
        else if (opts.via === "whatsapp") { title = "One last step, " + name; body = "Press send in WhatsApp to request your " + call + " for " + when + ". We confirm there."; }
        else { title = "Request received, " + name; body = "You asked for a " + call + " on " + when + ". We confirm it by WhatsApp or phone, usually within one working day."; }
        var iso = slotIso(opts.slot.date, opts.slot.time), end = slotIso(opts.slot.date, opts.slot.time, mins);
        try {
          extra = '<a class="btn ghost sm" download="tf-appointment.ics" href="' + icsFile("t&f: " + call, iso, end, "Your " + call + " with tests&funnels (" + (mode ? mode.value : "Phone call") + "). Call " + TF.phone + " to change the time.") + '">Add to calendar</a>';
        } catch (e) { extra = ""; }
      } else {
        title = "Thank you, " + name; body = form.getAttribute("data-thanks") || "We have your request and will be in touch.";
      }
      panel.innerHTML = '<p class="fd-title">' + title + '</p><p>' + body + '</p><div class="fd-actions">' + extra +
        '<a class="btn ghost sm" href="https://wa.me/' + TF.wa + '" target="_blank" rel="noopener">Message us on WhatsApp</a></div>';
      Array.prototype.forEach.call(panels, function (p) { p.hidden = true; });
      var steps = form.querySelector(".fsteps"); if (steps) steps.hidden = true;
      clearMsg();
      form.insertBefore(panel, msg);
      try { panel.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      var r = form.getBoundingClientRect(); if (r.top < 0) form.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (opts.url) { var w = window.open(opts.url, "_blank", "noopener"); if (!w) { show("Almost done.", false, opts.url, "Open WhatsApp to send your request"); } }
    }
    function waUrl(built, withSlot) {
      var lines = [form.getAttribute("data-wa-intro") || "Hi t&f, I'd like to get in touch."].concat(built.lines);
      if (withSlot) { var l = dayLabel(withSlot.date); lines.push("Preferred time for the " + call + ": " + l.long + " at " + label12(withSlot.time) + " IST (" + built.data.appt_mode + ")"); }
      return "https://wa.me/" + TF.wa + "?text=" + encodeURIComponent(lines.join("\n"));
    }
    function busy(b) { Array.prototype.forEach.call(form.querySelectorAll("button"), function (x) { x.disabled = b; }); }

    form.addEventListener("click", function (e) {
      if (e.target.closest("[data-back]")) { setStep(1); return; }
      if (e.target.closest("[data-skip]")) skip();
    });

    function skip() {
      var built = build("skip");
      track("appointment_skipped", { form_type: kind, form_id: form.id, pillar: pillar() });
      if (TF.intake) {
        busy(true);
        post(TF.intake, built.data).then(function () { finish({}); })
          .catch(function () { finish({ via: "whatsapp", url: waUrl(built) }); })
          .then(function () { busy(false); });
      } else {
        finish({ via: "whatsapp", url: waUrl(built) });
      }
    }

    function book() {
      var sl = chosen();
      if (!sl) { show("Choose a day and a time, or skip this step and we will call you.", true); return; }
      var built = build("appointment", sl);
      track("appointment_booked", { form_type: kind, form_id: form.id, pillar: pillar(), appt_kind: call });
      if (!TF.intake) { finish({ slot: sl, via: "whatsapp", status: "requested", url: waUrl(built, sl) }); return; }
      busy(true);
      post(TF.intake, built.data).then(function (j) {
        var st = j && j.appointment && j.appointment.status === "confirmed" ? "confirmed" : "requested";
        finish({ slot: sl, via: "crm", status: st });
      }).catch(function (err) {
        if (err && err.status === 409) { // someone else took the slot
          show("That time was just taken. Please choose another.", true); loadSlots();
        } else {
          finish({ slot: sl, via: "whatsapp", status: "requested", url: waUrl(built, sl) });
        }
      }).then(function () { busy(false); });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.elements["company"] && form.elements["company"].value) return; // spam trap
      if (step === 1) {
        track(submitEvt, { form_type: kind, form_id: form.id, industry: (form.elements["industry"] || {}).value || "", monthly_ad_spend: (form.elements["monthly_ad_spend"] || {}).value || "", pillar: pillar() });
        sendLead();
        loadSlots();
        setStep(2);
        track("appointment_step_view", { form_type: kind, form_id: form.id, pillar: pillar() });
        return;
      }
      book();
    });
  });
})();

/* t&f interactions: scroll progress, reveal, counters, video lightbox, VSL player, rails, filters, tilt, marquee.
   Everything degrades to the plain page; motion is skipped under prefers-reduced-motion. */
(function () {
  "use strict";
  var doc = document;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function track(e, d) {
    var p = { event: e };
    for (var k in d) { if (Object.prototype.hasOwnProperty.call(d, k)) p[k] = d[k]; }
    (window.dataLayer = window.dataLayer || []).push(p);
  }

  /* ---------- scroll progress + floating CTA ---------- */
  var prog = $("#progress"), fcta = $("#fcta"), formsInView = 0, ticking = false;
  function onScroll() {
    ticking = false;
    var h = doc.documentElement, max = h.scrollHeight - window.innerHeight;
    if (prog) prog.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ")";
    if (fcta) fcta.classList.toggle("show", window.scrollY > 560 && formsInView === 0);
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
  if ("IntersectionObserver" in window) {
    var fo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { formsInView += e.isIntersecting ? 1 : -1; });
      formsInView = Math.max(0, formsInView);
      onScroll();
    }, { threshold: 0.2 });
    $$("form[data-form]").forEach(function (f) { fo.observe(f); });
  }
  onScroll();

  /* ---------- hero: pointer parallax on the background blobs ---------- */
  var hero = $(".hero");
  if (hero && fine && !reduce) {
    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
      hero.style.setProperty("--my", ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
    }, { passive: true });
  }

  /* ---------- scroll reveal (only below-the-fold elements are hidden, so nothing flashes) ---------- */
  if ("IntersectionObserver" in window && !reduce) {
    var sel = ".card-d,.card-s,.niche,.metric,.steps-l li,.quote,.vt,.rail-item,.infl-card,.tbl-wrap,.sec>.wrap>h2,.sec>.wrap>.intro,.faq details,.bento>div,.reel,.vec-band,.statband,.step,.why li,.price,.chain,.vsl-grid>*,.script";
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
        var t = e.target;
        setTimeout(function () { t.classList.remove("rv", "in"); t.style.removeProperty("--i"); }, 1500);
      });
    }, { threshold: 0, rootMargin: "0px 0px 18% 0px" });   // reveal just before the element scrolls into view, so nothing is ever half-faded on screen
    function inScroller(el) {   // cards inside a horizontal scroller (rails, video rows) are never hidden: a half-visible card at the edge must not be blank
      for (var a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        var o = window.getComputedStyle(a).overflowX;
        if (o === "auto" || o === "scroll") return true;
      }
      return false;
    }
    $$(sel).forEach(function (el) {
      if (el.parentElement && el.parentElement.closest(".rv")) return;
      if (inScroller(el)) return;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.98) return;
      var sibs = Array.prototype.filter.call(el.parentElement ? el.parentElement.children : [], function (c) { return c.tagName === el.tagName; });
      el.style.setProperty("--i", Math.min(Math.max(0, sibs.indexOf(el)), 5));
      el.classList.add("rv");
      io.observe(el);
    });
  }

  /* ---------- counters ---------- */
  function fmt(v, dec) { return v.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function runCount(el) {
    var to = parseFloat(el.getAttribute("data-count")), dec = parseInt(el.getAttribute("data-dec") || "0", 10);
    var pre = el.getAttribute("data-prefix") || "", suf = el.getAttribute("data-suffix") || "", final = el.textContent;
    if (isNaN(to)) return;
    var t0 = null, dur = 1500;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = pre + fmt(to * e, dec) + suf;
      if (p < 1) window.requestAnimationFrame(step); else el.textContent = final;
    }
    el.textContent = pre + fmt(0, dec) + suf;
    window.requestAnimationFrame(step);
  }
  var cEls = $$("[data-count]");
  if (cEls.length && "IntersectionObserver" in window && !reduce) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { runCount(e.target); co.unobserve(e.target); } });
    }, { threshold: 0.6 });
    cEls.forEach(function (el) { co.observe(el); });
  }

  /* ---------- marquee: duplicate the track so the loop is seamless ---------- */
  $$("[data-dup]").forEach(function (ul) {
    if (reduce) return;
    Array.prototype.slice.call(ul.children).forEach(function (li) {
      var c = li.cloneNode(true); c.setAttribute("aria-hidden", "true"); ul.appendChild(c);
    });
  });

  /* ---------- tilt on cards (mouse only) ---------- */
  if (fine && !reduce) {
    $$(".card-d,.infl-card").forEach(function (el) {
      el.setAttribute("data-tilt", "");
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--rx", (-y * 5).toFixed(2) + "deg");
        el.style.setProperty("--ry", (x * 6).toFixed(2) + "deg");
      });
      el.addEventListener("mouseleave", function () { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
    });
  }

  /* ---------- rails and filters ---------- */
  $$("[data-rail]").forEach(function (b) {
    b.addEventListener("click", function () {
      var list = $("[data-rail-list]", b.closest("section"));
      if (list) list.scrollBy({ left: parseInt(b.getAttribute("data-rail"), 10) * list.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
    });
  });
  $$(".chipbar").forEach(function (bar) {
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-filter]");
      if (!b) return;
      $$("button", bar).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var cat = b.getAttribute("data-filter");
      var sec = bar.closest("section"), shown = 0;
      $$("[data-cat]", sec).forEach(function (it) { it.hidden = !!cat && it.getAttribute("data-cat") !== cat; if (!it.hidden) shown++; });
      var out = $("[data-filter-count]", sec);
      if (out) out.textContent = shown + (shown === 1 ? " piece" : " pieces") + (cat ? " in " + cat : "");
      track("media_filter", { filter: cat || "All" });
    });
  });

  /* ---------- video lightbox ---------- */
  var modal = $("#modal"), box = $("#modal-box"), screen = $("#modal-screen"), mx = $("#modal-x"), lastFocus = null;
  function openVid(el) {
    var vsl = el.closest("[data-vsl]");
    if (vsl) { startVsl(vsl); return; }
    if (!modal) return;
    lastFocus = el;
    var slot = el.getAttribute("data-slot") || "", src = el.getAttribute("data-src"), title = el.getAttribute("data-title") || "Video";
    box.classList.toggle("portrait", el.hasAttribute("data-portrait"));
    screen.innerHTML = "";
    if (src) {
      var v = doc.createElement("video");
      v.controls = true; v.autoplay = true; v.playsInline = true; v.src = src;
      var po = el.getAttribute("data-poster"); if (po) v.poster = po;
      screen.appendChild(v);
    } else {
      var w = doc.createElement("div"), eq = doc.createElement("div"), h = doc.createElement("h3"), p = doc.createElement("p"), p2 = doc.createElement("p");
      eq.className = "eq"; eq.innerHTML = "<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>";
      h.textContent = title;
      p.textContent = el.getAttribute("data-brief") || "";
      p2.style.marginTop = ".8rem"; p2.style.fontWeight = "600";
      p2.textContent = "Video slot " + slot + ". Add " + slot + ".mp4 to the media folder and rebuild.";
      w.appendChild(eq); w.appendChild(h); w.appendChild(p); w.appendChild(p2); screen.appendChild(w);
    }
    modal.classList.add("open");
    doc.body.style.overflow = "hidden";
    if (mx) mx.focus();
    track("video_open", { video_slot: slot, real_file: !!src });
  }
  function closeVid() {
    if (!modal || !modal.classList.contains("open")) return;
    modal.classList.remove("open");
    screen.innerHTML = "";
    doc.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }
  doc.addEventListener("click", function (e) {
    var v = e.target.closest(".vid");
    if (v) { e.preventDefault(); openVid(v); return; }
    var o = e.target.closest("[data-open]");
    if (o) {
      var t = $('.vid[data-slot="' + o.getAttribute("data-open") + '"]');
      if (t && t.closest("[data-vsl]")) { t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }); setTimeout(function () { openVid(t); }, reduce ? 0 : 450); }
      else if (t) openVid(t);
      return;
    }
    if (e.target === modal || e.target.closest("#modal-x")) closeVid();
  });
  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeVid();
    if (e.key === "Tab" && modal && modal.classList.contains("open") && mx) { e.preventDefault(); mx.focus(); }
  });

  /* ---------- VSL: real <video> when a file exists, otherwise a timed demo of chapters + CTA unlock ---------- */
  function startVsl(root) {
    if (root.__on) return;
    root.__on = true;
    var vid = $(".vid", root), dur = parseFloat(root.getAttribute("data-dur")) || 240;
    var bar = $(".vsl-prog i", root), cta = $(".vsl-cta", root), chs = $$(".chapters button", root);
    var slot = vid.getAttribute("data-slot"), src = vid.getAttribute("data-src"), seen = {};
    function mark(t) {
      var p = Math.max(0, Math.min(1, t / dur));
      bar.style.width = (p * 100).toFixed(1) + "%";
      if (p >= 0.3) cta.classList.add("on");
      var cur = -1;
      chs.forEach(function (b, i) { if (t >= parseFloat(b.getAttribute("data-t"))) cur = i; });
      chs.forEach(function (b, i) { b.classList.toggle("on", i === cur); });
      if (src) [25, 50, 75, 100].forEach(function (m) { if (p * 100 >= m && !seen[m]) { seen[m] = 1; track("vsl_progress", { video_slot: slot, percent: m }); } });
    }
    if (src) {
      var holder = doc.createElement("div"), v = doc.createElement("video");
      holder.className = "r-16x9";
      holder.style.cssText = "position:relative;border-radius:24px;overflow:hidden;background:#000;box-shadow:0 30px 80px rgba(0,0,0,.45)";
      v.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
      v.src = src; v.controls = true; v.autoplay = true; v.playsInline = true;
      var po = vid.getAttribute("data-poster"); if (po) v.poster = po;
      holder.appendChild(v); vid.parentNode.replaceChild(holder, vid);
      v.addEventListener("loadedmetadata", function () { if (v.duration) dur = v.duration; });
      v.addEventListener("timeupdate", function () { mark(v.currentTime); });
      chs.forEach(function (b) { b.addEventListener("click", function () { v.currentTime = parseFloat(b.getAttribute("data-t")); v.play(); }); });
      track("vsl_play", { video_slot: slot });
      return;
    }
    var t = 0, speed = 14, timer = null;
    var screenEl = doc.createElement("div");
    screenEl.className = "modal-screen"; screenEl.style.cssText = "position:absolute;inset:0;z-index:2;aspect-ratio:auto";
    var eq = doc.createElement("div"), h = doc.createElement("h3"), p = doc.createElement("p");
    eq.className = "eq"; eq.innerHTML = "<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>";
    p.textContent = "Timed demo of the player. The real video replaces this screen.";
    var wrap = doc.createElement("div"); wrap.appendChild(eq); wrap.appendChild(h); wrap.appendChild(p); screenEl.appendChild(wrap);
    vid.appendChild(screenEl);
    $$(".vid-play,.vid-meta", vid).forEach(function (x) { x.style.display = "none"; });
    function label() { var cur = chs.filter(function (b) { return t >= parseFloat(b.getAttribute("data-t")); }).pop(); h.textContent = cur ? cur.textContent.replace(/^\d+:\d+/, "") : ""; }
    function tick() {
      t += 0.25 * speed; mark(t); label();
      if (t >= dur) { clearInterval(timer); p.textContent = "Demo finished."; }
    }
    timer = setInterval(tick, 250); tick();
    chs.forEach(function (b) { b.addEventListener("click", function () { t = parseFloat(b.getAttribute("data-t")); mark(t); label(); }); });
  }
  $$(".vsl-player .chapters button").forEach(function (b) {
    b.addEventListener("click", function () { var root = b.closest("[data-vsl]"); if (!root.__on) { startVsl(root); } });
  });

  /* ---------- anchor links to the hero form focus the first field ---------- */
  doc.addEventListener("click", function (e) {
    var a = e.target.closest('a[href$="#hero-form"],a[href="#apply"]');
    if (!a) return;
    setTimeout(function () { var i = $("#hero-form input, #apply input"); if (i && a.getAttribute("href").indexOf("hero-form") > -1) i.focus({ preventScroll: true }); }, 600);
  });
})();
