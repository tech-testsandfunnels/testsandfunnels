/* slots.js
   Works out the free appointment slots shown in step 2 of the website forms
   (GET /api/slots). Pure function: give it the booking hours and the busy
   intervals, get back { days: [{ date, times[] }] } in India time.
   A slot is free when it starts at least `leadHours` from now and no active
   appointment overlaps [start, start + step). */
const { istDate, istMinutes, toMin, fromMin, istToDate, istWeekday, addDays } = require('./time');

const DEFAULT_HOURS = {
  days: [1, 2, 3, 4, 5, 6], // Monday to Saturday
  start: '11:00',
  end: '18:00',
  step: 30, // minutes
  leadHours: 3, // earliest bookable slot is this far from now
  ahead: 14, // days ahead to offer
  maxDays: 12, // the site shows at most 12 days
};

/**
 * @param {object} hours   booking hours (see DEFAULT_HOURS)
 * @param {Array<{start:Date,end:Date}>} busy  active appointments
 * @param {object} [opt]   { days: how many days ahead, now: Date }
 */
function freeSlots(hours, busy, opt = {}) {
  const h = { ...DEFAULT_HOURS, ...(hours || {}) };
  const now = opt.now || new Date();
  const ahead = Math.min(Math.max(1, +opt.days || h.ahead), 30);
  const today = istDate(now);
  const earliest = istMinutes(now) + h.leadHours * 60;
  const step = Math.max(5, +h.step || 30);
  const out = [];

  for (let i = 0; i <= ahead && out.length < h.maxDays; i++) {
    const date = addDays(today, i);
    if (!h.days.includes(istWeekday(date))) continue;
    const times = [];
    for (let m = toMin(h.start); m + step <= toMin(h.end); m += step) {
      if (i === 0 && m < earliest) continue;
      const s = istToDate(date, fromMin(m)).getTime();
      const e = s + step * 60000;
      const taken = busy.some((b) => b.start.getTime() < e && (b.end ? b.end.getTime() : b.start.getTime() + step * 60000) > s);
      if (!taken) times.push(fromMin(m));
    }
    if (times.length) out.push({ date, times });
  }
  return out;
}

module.exports = { freeSlots, DEFAULT_HOURS };
