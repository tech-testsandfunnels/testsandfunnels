/* format.js — dates (India time), money and small text helpers. */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');
const wall = (d) => new Date(new Date(d).getTime() + 330 * 60000); // IST wall clock in UTC fields

/* "2026-11-16" (IST) for a Date / ISO string. */
export const istDate = (d = new Date()) => { const w = wall(d); return w.getUTCFullYear() + '-' + pad(w.getUTCMonth() + 1) + '-' + pad(w.getUTCDate()); };
/* "14:30" (IST). */
export const istTime = (d) => { const w = wall(d); return pad(w.getUTCHours()) + ':' + pad(w.getUTCMinutes()); };
/* Whole days from today (IST) to the IST date `s` ("YYYY-MM-DD"). */
export const dayDiff = (s) => Math.round((Date.parse(s + 'T00:00:00Z') - Date.parse(istDate() + 'T00:00:00Z')) / DAY);
/* Day offset of a Date from today, in IST days. */
export const dayOf = (d) => dayDiff(istDate(d));
/* IST date string `n` days from today. */
export const dateAt = (n) => { const d = new Date(Date.parse(istDate() + 'T00:00:00Z') + n * DAY); return d.toISOString().slice(0, 10); };
const parts = (s) => { const d = new Date(s + 'T00:00:00Z'); return { d: d.getUTCDate(), m: MON[d.getUTCMonth()], w: WD[d.getUTCDay()], y: d.getUTCFullYear() }; };
export const fD = (s) => { const p = parts(s); return p.d + ' ' + p.m; };
export const fDW = (s) => { const p = parts(s); return p.w + ', ' + p.d + ' ' + p.m; };
export const fDN = (n) => fDW(dateAt(n));
export const relD = (n) => (n === 0 ? 'Today' : n === -1 ? 'Yesterday' : n === 1 ? 'Tomorrow' : n < 0 ? -n + ' days ago' : 'In ' + n + ' days');
export const longToday = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

export const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
export const inrS = (n) => (n >= 1e7 ? '₹' + (n / 1e7).toFixed(2) + ' Cr' : n >= 1e5 ? '₹' + (n / 1e5).toFixed(1).replace(/\.0$/, '') + ' L' : n >= 1e3 ? '₹' + Math.round(n / 1e3) + 'k' : '₹' + (n || 0));
export const sum = (a) => a.reduce((x, y) => x + y, 0);
export const pct = (a, b) => (b ? Math.round((a * 100) / b) : 0);
export const initials = (n) => String(n || '?').replace(/^Dr\.?\s+/, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');

/* Digits for a wa.me link: "+91 98765 43210" -> "919876543210". */
export const waDigits = (p) => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;
  if (d.length === 11 && d[0] === '0') d = '91' + d.slice(1);
  return d;
};

export function download(name, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    try { const x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); const ok = document.execCommand('copy'); x.remove(); return ok; } catch { return false; }
  }
}
