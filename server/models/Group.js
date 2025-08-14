// models/Group.js
const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'admin', 'member'], required: true },
}, { _id: false });

const groupSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  members:  [groupMemberSchema], // Array of { user, role }
  waitingList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  list: { type: mongoose.Schema.Types.ObjectId, ref: 'List', default: null },
}, { timestamps: true });

// Performance optimization: Add indexes for frequently queried fields
groupSchema.index({ 'members.user': 1 }); // For finding user's groups
groupSchema.index({ name: 1 }); // For group name searches
groupSchema.index({ createdAt: -1 }); // For recent groups

module.exports = mongoose.model('Group', groupSchema);
