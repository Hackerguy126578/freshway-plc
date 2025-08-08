const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  robloxId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  roleId: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
