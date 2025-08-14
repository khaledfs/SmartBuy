const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String }, // optional: store icon URL from suggestions
  quantity: { type: Number, default: 1 },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ✅ Enhanced: link to User
  modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ✅ NEW: track who modified
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // ✅ NEW: link to Product
  barcode: { type: String, default: '' }, // <-- Add this line
  isPurchased: { type: Boolean, default: false }, // ✅ NEW: mark as purchased
  purchasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ✅ NEW: who purchased
  purchasedAt: { type: Date }, // ✅ NEW: when purchased
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }, // ✅ NEW: track modifications
  actionHistory: [{ // ✅ NEW: undo support
    action: { type: String, enum: ['added', 'modified', 'purchased', 'unpurchased', 'deleted'], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    previousState: { type: mongoose.Schema.Types.Mixed } // Store previous state for undo
  }]
});

// Update the updatedAt field before saving
itemSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Item', itemSchema);
