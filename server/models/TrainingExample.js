const mongoose = require('mongoose');

const trainingExampleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: String,
    required: true
  },
  features: {
    bias: { type: Number, default: 1 },
    isFavorite: { type: Number, default: 0 },
    addedBefore: { type: Number, default: 0 },
    recentlyadded: { type: Number, default: 0 },
    timesAdded: { type: Number, default: 0 },
    AddedFrequency: { type: Number, default: 0 },
    timesRejected: { type: Number, default: 0 },
  },
  label: {
    type: Number,
    required: true,
    enum: [0, 1]
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
