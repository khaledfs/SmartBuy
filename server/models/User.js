const mongoose = require('mongoose');

// models/User.js
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    phone:    { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true }
  },
  { timestamps: true }
);

// Optional—makes sure an index is in place even if `unique:true` is missed
// userSchema.index({ phone: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
