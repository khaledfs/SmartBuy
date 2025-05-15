const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  icon:      { type: String }, // optional: store icon URL from suggestions
  quantity:  { type: Number, default: 1 },
  addedBy:   { type: String }, // optional: could be userId
  product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // ✅ NEW: link to Product
  createdAt: { type: Date, default: Date.now } // optional: helps with sorting
});

module.exports = mongoose.model('Item', itemSchema);
