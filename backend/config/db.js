/* db.js
   Connects to MongoDB (MONGODB_URI, local by default), builds the indexes the
   models declare (including the one-appointment-per-slot index), and upgrades
   any data saved by the first CRM version. The server still starts if the DB
   is down; /api/health says so and the website forms fall back to WhatsApp. */
const mongoose = require('mongoose');
const { migrate } = require('./migrate');

let connected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/testsandfunnels';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 6000 });
    connected = true;
    console.log('MongoDB connected: ' + mongoose.connection.host + '/' + mongoose.connection.name);
    await migrate();
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  } catch (err) {
    console.warn('MongoDB setup failed: ' + err.message);
    if (!connected) console.warn('Start a local MongoDB (mongod) or set MONGODB_URI in backend/.env');
  }
}

/* True only when a live connection exists. */
const isConnected = () => connected && mongoose.connection.readyState === 1;

module.exports = { connectDB, isConnected };
