/* Task.js — a piece of work on the team task board (to do, in progress, review, done). */
const mongoose = require('mongoose');
const { TASK_STATUSES, TASK_PRIORITIES } = require('../lib/constants');

module.exports = mongoose.model(
  'Task',
  new mongoose.Schema(
    {
      taskId: { type: String, required: true, unique: true }, // K-12
      title: { type: String, required: true, trim: true },
      area: { type: String, default: 'General', trim: true }, // client or area, e.g. "Marigold Home Decor"
      owner: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', default: null },
      status: { type: String, enum: TASK_STATUSES, default: 'todo' },
      priority: { type: String, enum: TASK_PRIORITIES, default: 'med' },
      due: { type: String, default: '' }, // YYYY-MM-DD (India time)
      doneAt: { type: Date, default: null },
      notes: { type: String, default: '' },
    },
    { timestamps: true }
  )
);
