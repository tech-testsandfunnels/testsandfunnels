/* auth.js
   Rejects any request without a valid admin JWT in "Authorization: Bearer".
   Used on every dashboard route. The public website endpoints
   (/api/intake, /api/slots) do not use it. Tokens are never accepted in the
   query string, so they cannot leak into logs or browser history. */
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/secrets');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, jwtSecret());
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
