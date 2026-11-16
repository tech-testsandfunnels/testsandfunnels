/* db.js
   Connects to MongoDB (MONGODB_URI, local by default) and keeps trying until
   it works: hosts such as Hostinger start several Node workers, and a worker
   whose first attempt times out (cold Atlas cluster, slow network) must not
   stay disconnected for good, or every website lead that lands on it would
   get a 503. After the first successful connection it builds the indexes the
   models declare (including the one-appointment-per-slot index) and upgrades
   any data saved by the first CRM version. The server starts either way;
   /api/health says the state and the website forms fall back to WhatsApp. */
const mongoose = require('mongoose');
const { migrate } = require('./migrate');

const RETRY_MS = 10000;
let setupDone = false;
let attempts = 0;

async function setup() {
  if (setupDone) return;
  setupDone = true;
  try {
    await migrate();
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  } catch (err) {
    setupDone = false; // try again on the next (re)connect
    console.warn('MongoDB setup failed: ' + err.message);
  }
}

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/testsandfunnels';
  let wasConnected = false;
  mongoose.connection.on('connected', () => {
    wasConnected = true;
    console.log('MongoDB connected: ' + mongoose.connection.host + '/' + mongoose.connection.name);
    setup();
  });
  mongoose.connection.on('disconnected', () => {
    if (wasConnected) console.warn('MongoDB disconnected; the driver reconnects on its own');
  });

  for (;;) {
    attempts++;
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
      return; // from here the driver keeps the connection alive and reconnects by itself
    } catch (err) {
      if (attempts <= 3 || attempts % 30 === 0) {
        console.warn('MongoDB connection failed (attempt ' + attempts + '): ' + err.message);
        if (attempts === 1) console.warn('Start a local MongoDB (mongod) or set MONGODB_URI. Retrying every ' + RETRY_MS / 1000 + 's.');
      }
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
}

/* True only while a live connection exists. */
const isConnected = () => mongoose.connection.readyState === 1;

module.exports = { connectDB, isConnected };
