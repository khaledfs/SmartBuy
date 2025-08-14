const mongoose = require('mongoose');

const trainingExampleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  features: {
    bias: { type: Number, default: 1 },
    isFavorite: { type: Number, default: 0 },
    purchasedBefore: { type: Number, default: 0 },
    timesPurchased: { type: Number, default: 0 },
    recentlyPurchased: { type: Number, default: 0 },
    storeCount: { type: Number, default: 0 },
    timesWasRejectedByUser: { type: Number, default: 0 },
    timesWasRejectedByCart: { type: Number, default: 0 }
  },
  label: {
    type: Number,
    required: true,
    enum: [0, 1] // 0 = not purchased, 1 = purchased
  },
  context: {
    listId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'List'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
trainingExampleSchema.index({ userId: 1, productId: 1, 'context.timestamp': -1 });

module.exports = mongoose.model('TrainingExample', trainingExampleSchema); 