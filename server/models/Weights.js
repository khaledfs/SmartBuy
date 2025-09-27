const mongoose = require('mongoose');

const weightsSchema = new mongoose.Schema({
  featureName: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'bias',
      'isFavorite',
      'addedBefore',
      'recentlyadded',
      'timesAdded',
      'AddedFrequency',
      'timesRejected'
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
