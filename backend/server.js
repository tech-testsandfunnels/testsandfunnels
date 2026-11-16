/* server.js
   Express entry point for the CRM. API at /api/*, the built React dashboard
   (backend/public) at "/". In development the dashboard can also run on its own
   Vite server (:5173) that proxies /api here. */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { connectDB, isConnected } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '2mb' }));

/* API routes */
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/leads', require('./routes/leadRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.get('/api/health', (req, res) => res.json({ ok: true, db: isConnected() ? 'connected' : 'disconnected' }));

/* Serve the built dashboard at "/". `npm run build` (in backend/) compiles the
   React app into backend/public. Unknown non-API paths fall back to index.html
   so the SPA can handle them. */
const pub = path.join(__dirname, 'public');
const indexHtml = path.join(pub, 'index.html');
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(express.static(pub));
app.get('*', (req, res) => {
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  res
    .status(503)
    .type('text')
    .send('CRM dashboard is not built. Run "npm run build" in backend/ (or set the host build command to "npm install && npm run build").');
});

app.listen(PORT, () => {
  console.log('CRM API listening on http://localhost:' + PORT);
});
