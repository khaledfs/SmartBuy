const mongoose = require('mongoose');

const weightsSchema = new mongoose.Schema({
  featureName: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'bias',
      'isFavorite',
      'purchasedBefore',
      'timesPurchased',
      'recentlyPurchased',
      'storeCount',
      'timesWasRejectedByUser',
      'timesWasRejectedByCart'
    ]
  },
  weight: {
    type: Number,
    required: true,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Weights', weightsSchema); 