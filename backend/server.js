/* server.js
   Express entry point for the CRM. One process serves:
     /api/intake, /api/slots   public endpoints the website forms call (tf-intake/1)
     /api/auth/*               admin login
     /api/*                    dashboard API (admin JWT)
     /                         the built React dashboard (backend/public)
   In development the dashboard can also run on Vite (:5173), which proxies /api here. */
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { connectDB, isConnected } = require('./config/db');
const auth = require('./middleware/auth');
const { configured, isProd } = require('./config/secrets');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1); // behind Render/most hosts: use the real client IP for rate limits
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

connectDB();
if (isProd() && !configured()) console.warn('ADMIN_PASSWORD and JWT_SECRET must be set: dashboard login is disabled until they are.');

/* Public website endpoints (own CORS + body limit), mounted before the global JSON parser. */
app.use('/api', require('./routes/public'));

app.use(express.json({ limit: '200kb' }));
app.get('/api/health', (req, res) => res.json({ ok: true, db: isConnected() ? 'connected' : 'disconnected' }));
app.use('/api/auth', require('./routes/auth'));

/* Everything below needs the admin token. */
app.use('/api/leads', auth, require('./routes/leads'));
app.use('/api/appointments', auth, require('./routes/appointments'));
app.use('/api', auth, require('./routes/misc'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

/* The built dashboard. `npm run build` (in backend/) writes it to backend/public. */
const pub = path.join(__dirname, 'public');
const indexHtml = path.join(pub, 'index.html');
app.use(express.static(pub, { index: false, maxAge: '1h' }));
app.get('*', (req, res) => {
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  res
    .status(503)
    .type('text')
    .send('CRM dashboard is not built. Run "npm run build" in backend/ (or set the host build command to "npm install && npm run build").');
});

/* Bad JSON, too-large bodies and anything unexpected: always answer in JSON. */
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ ok: false, error: err.type === 'entity.parse.failed' ? 'invalid json' : status === 413 ? 'request too large' : status >= 500 ? 'Server error' : err.message });
});

app.listen(PORT, () => console.log('CRM listening on http://localhost:' + PORT));
