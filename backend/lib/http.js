/* http.js
   Small Express helpers shared by the routes: async error wrapper, a tiny
   in-memory rate limiter, CORS for the public website endpoints, and
   field pickers for safe updates. No extra dependencies. */
const mongoose = require('mongoose');

/* Wrap an async handler so a thrown error becomes a JSON 500 (or 4xx for bad input). */
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
      return res.status(422).json({ ok: false, error: err.message });
    }
    if (err && err.code === 11000) return res.status(409).json({ ok: false, error: 'duplicate', detail: err.keyValue });
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  });

/* Fixed-window limiter keyed by IP. Fine for one Node process. */
function rateLimit({ windowMs = 60000, max = 10, message = 'Too many requests' } = {}) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const n = (hits.get(key) || 0) + 1;
    hits.set(key, n);
    if (n > max) return res.status(429).json({ ok: false, error: message });
    next();
  };
}

/* Origins allowed to call the public endpoints (the marketing site).
   CORS_ORIGINS is a comma list; "*" allows any (dev only). */
function allowedOrigins() {
  const raw = process.env.CORS_ORIGINS || 'https://testsandfunnels.com,https://www.testsandfunnels.com';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/* CORS for /api/intake, /api/slots and the legacy POST /api/leads. */
function publicCors(req, res, next) {
  const list = allowedOrigins();
  const origin = req.headers.origin;
  if (list.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && (list.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) && process.env.NODE_ENV !== 'production')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

/* Copy only the allowed keys from body. */
function pick(body, keys) {
  const out = {};
  for (const k of keys) if (body && body[k] !== undefined) out[k] = body[k];
  return out;
}

/* Treat "", "none" and null as "no owner". */
const ref = (v) => (v && v !== 'none' && mongoose.isValidObjectId(v) ? v : null);

module.exports = { wrap, rateLimit, publicCors, pick, ref };
