// server/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name:     { type: String, required: true, unique: true },
  category: { type: String },
  iconUrl:  { type: String },
  upc:      { type: String, unique: true },
  price:    { type: Number, required: true },   // ← new
  createdAt:{ type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);