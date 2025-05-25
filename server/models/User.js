const mongoose = require('mongoose');

// models/User.js
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    phone:    { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    profilePicUrl: { type: String, default: '' } // ✅ New field
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
