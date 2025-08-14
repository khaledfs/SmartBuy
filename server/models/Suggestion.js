// server/models/Suggestion.js
const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['frequent', 'recent', 'popular', 'seasonal', 'favorite'],
    required: true
  },
  score: {
    type: Number,
    default: 0
  },
  lastSuggested: {
    type: Date,
    default: Date.now
  },
  frequency: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate suggestions
suggestionSchema.index({ userId: 1, productId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Suggestion', suggestionSchema);
