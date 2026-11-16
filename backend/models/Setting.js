/* Setting.js — small key/value store for settings edited in the dashboard
   (booking hours, default owner per pillar). */
const mongoose = require('mongoose');

const Setting = mongoose.model(
  'Setting',
  new mongoose.Schema({ _id: String, value: mongoose.Schema.Types.Mixed }, { timestamps: true })
);

async function getSetting(key, fallback) {
  const s = await Setting.findById(key).lean();
  return s && s.value != null ? s.value : fallback;
}
async function setSetting(key, value) {
  await Setting.findByIdAndUpdate(key, { value }, { upsert: true });
  return value;
}

module.exports = { Setting, getSetting, setSetting };
