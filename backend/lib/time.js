/* time.js
   India time helpers. India has no daylight saving, so IST is always UTC+05:30
   and plain arithmetic is safe. Dates are "YYYY-MM-DD", times "HH:MM". */

const IST_OFFSET_MIN = 330;
const pad = (n) => String(n).padStart(2, '0');

/* A Date whose UTC fields read as the current IST wall clock. */
function istWall(d = new Date()) {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60000);
}

/* "2026-11-16" for the IST calendar day of `d`. */
function istDate(d = new Date()) {
  const w = istWall(d);
  return w.getUTCFullYear() + '-' + pad(w.getUTCMonth() + 1) + '-' + pad(w.getUTCDate());
}

/* Minutes since IST midnight for `d`. */
function istMinutes(d = new Date()) {
  const w = istWall(d);
  return w.getUTCHours() * 60 + w.getUTCMinutes();
}

const toMin = (hm) => {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + (m || 0);
};
const fromMin = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);

/* Date for an IST date + time. */
const istToDate = (date, hm) => new Date(date + 'T' + hm + ':00+05:30');

/* ISO string with the India offset, e.g. 2026-11-16T12:30:00+05:30 */
function toIstIso(d) {
  const w = istWall(d);
  return (
    w.getUTCFullYear() + '-' + pad(w.getUTCMonth() + 1) + '-' + pad(w.getUTCDate()) +
    'T' + pad(w.getUTCHours()) + ':' + pad(w.getUTCMinutes()) + ':' + pad(w.getUTCSeconds()) + '+05:30'
  );
}

/* Day of week (0 = Sunday) of an IST date string. */
const istWeekday = (date) => new Date(date + 'T12:00:00+05:30').getUTCDay();

/* IST date string `n` days after `date`. */
function addDays(date, n) {
  const d = new Date(date + 'T12:00:00+05:30');
  d.setUTCDate(d.getUTCDate() + n);
  return istDate(d);
}

module.exports = { istDate, istMinutes, toMin, fromMin, istToDate, toIstIso, istWeekday, addDays };
