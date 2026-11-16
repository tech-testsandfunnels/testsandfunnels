/* TeamMember.js — people who own leads, appointments and tasks. */
const mongoose = require('mongoose');

module.exports = mongoose.model(
  'TeamMember',
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      role: { type: String, default: '', trim: true },
      email: { type: String, default: '', trim: true, lowercase: true },
      phone: { type: String, default: '', trim: true },
      active: { type: Boolean, default: true },
    },
    { timestamps: true }
  )
);
