const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  icon:      { type: String }, // optional if you want to store icon url
  quantity:  { type: Number, default: 1 },
  addedBy:   { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Item', itemSchema);
