const mongoose = require('mongoose');

const purchaseHistorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  quantity: {
    type: Number,
    default: 1,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null, // null for personal purchases
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TripHistory',
    default: null, // null for old records or personal purchases
  },
  boughtAt: {
    type: Date,
    default: Date.now,
  },
  price: {
    type: Number,
    default: 0,
  },
  supermarket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supermarket',
    default: null,
  },
  img: {
    type: String,
    default: '',
  },
  metadata: {
    store: {
      branch: String,
      address: String,
      totalPrice: Number,
    },
  },
}, { timestamps: true });

// Indexes for efficient ML queries
purchaseHistorySchema.index({ user: 1, boughtAt: -1 });
purchaseHistorySchema.index({ group: 1, boughtAt: -1 });
purchaseHistorySchema.index({ product: 1, boughtAt: -1 });
purchaseHistorySchema.index({ user: 1, product: 1, boughtAt: -1 });

module.exports = mongoose.model('PurchaseHistory', purchaseHistorySchema);
