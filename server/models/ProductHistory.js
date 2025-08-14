const mongoose = require('mongoose');

const productHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: String, // Keep as String to match existing data
    required: true
  },
  listId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'List'
  },
  action: {
    type: String,
    enum: ['added', 'removed', 'purchased', 'favorited', 'rejected'],
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// ULTRA FAST: Optimized indexes for favorite queries
productHistorySchema.index({ userId: 1, action: 1, createdAt: -1 }); // For favorite lookups
productHistorySchema.index({ userId: 1, productId: 1, createdAt: -1 }); // For product history
productHistorySchema.index({ action: 1, createdAt: -1 }); // For action-based queries

module.exports = mongoose.model('ProductHistory', productHistorySchema); 