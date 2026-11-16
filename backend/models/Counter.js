/* Counter.js
   Sequence numbers for the readable IDs (L-1001 for leads, A-1001 for
   appointments, K-1 for tasks). One document per sequence, incremented
   atomically so two requests never get the same number. */
const mongoose = require('mongoose');

const Counter = mongoose.model(
  'Counter',
  new mongoose.Schema({ _id: String, seq: { type: Number, default: 1000 } }, { versionKey: false })
);

async function nextId(prefix, start = 1000) {
  const c = await Counter.findOneAndUpdate(
    { _id: prefix },
    [{ $set: { seq: { $add: [{ $ifNull: ['$seq', start] }, 1] } } }],
    { new: true, upsert: true }
  );
  return prefix + '-' + c.seq;
}

module.exports = { Counter, nextId };
