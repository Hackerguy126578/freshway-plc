const mongoose = require('mongoose');

const LOASchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: Date,
  endDate: Date,
  reason: String,
  status: { type: String, enum: ['Pending', 'Approved', 'Denied'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LOA', LOASchema);
