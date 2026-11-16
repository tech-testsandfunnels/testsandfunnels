/* auth.js — /api/auth: single-admin login (credentials in env) and token check. */
const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { rateLimit } = require('../lib/http');
const { jwtSecret, adminCreds, configured } = require('../config/secrets');

/* Constant-time string compare, so response time does not leak the password. */
const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

router.post('/login', rateLimit({ max: 10, message: 'Too many login attempts. Wait a minute.' }), (req, res) => {
  if (!configured()) {
    return res.status(503).json({ error: 'Login is not configured: set ADMIN_PASSWORD and JWT_SECRET on the server.' });
  }
  const { username, password } = req.body || {};
  const c = adminCreds();
  if (same(username || '', c.username) && same(password || '', c.password)) {
    const user = { username: c.username, role: 'admin' };
    const token = jwt.sign(user, jwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    return res.json({ token, user });
  }
  res.status(401).json({ error: 'Invalid username or password' });
});

router.get('/verify', auth, (req, res) => res.json({ user: req.user }));

module.exports = router;
