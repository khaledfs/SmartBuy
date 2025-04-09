const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  price:      { type: Number, default: 1 },   // מחיר יחידה
  quantity:   { type: Number, default: 1 },   // כמות
  addedBy:    { type: String },
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Item', itemSchema);
