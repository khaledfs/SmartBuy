// server/models/List.js
const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  owner:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
  createdAt: { type: Date, default: Date.now },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
},{ timestamps: true });

module.exports = mongoose.model('List', listSchema);
