/* Client.js — an active client account, with health set by the account manager. */
const mongoose = require('mongoose');
const { PILLAR_KEYS, CLIENT_HEALTH } = require('../lib/constants');

module.exports = mongoose.model(
  'Client',
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      service: { type: String, default: '', trim: true },
      pillar: { type: String, enum: PILLAR_KEYS, default: 'services' },
      monthlyFee: { type: Number, default: 0 },
      health: { type: String, enum: CLIENT_HEALTH, default: 'good' },
      healthWhy: { type: String, default: '', trim: true },
      manager: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', default: null },
      lastReport: { type: String, default: '' }, // YYYY-MM-DD
      nextReview: { type: String, default: '' }, // YYYY-MM-DD
      lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null }, // the lead it was won from
      active: { type: Boolean, default: true },
    },
    { timestamps: true }
  )
);
