/* Attendance.js — one mark per team member per IST day: P present, W WFH, L leave, A absent, O weekly off. */
const mongoose = require('mongoose');
const { ATTENDANCE } = require('../lib/constants');

const AttendanceSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    status: { type: String, enum: ATTENDANCE, required: true },
    checkIn: { type: String, default: '' }, // HH:MM
  },
  { timestamps: true }
);
AttendanceSchema.index({ member: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
