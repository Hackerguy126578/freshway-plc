const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema({
  title: String,
  date: Date,
  startTime: String,
  endTime: String,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Shift', ShiftSchema);
