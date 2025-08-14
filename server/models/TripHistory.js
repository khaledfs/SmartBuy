const mongoose = require('mongoose');

const tripHistorySchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  tripNumber: {
    type: Number,
    required: true,
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
  store: {
    branch: String,
    address: String,
    totalPrice: Number,
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    username: String,
  }],
  itemCount: {
    type: Number,
    default: 0,
  },
  totalSpent: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

// Indexes for efficient queries
tripHistorySchema.index({ group: 1, completedAt: -1 });
tripHistorySchema.index({ group: 1, tripNumber: -1 });

// Ensure unique trip numbers per group
tripHistorySchema.index({ group: 1, tripNumber: 1 }, { unique: true });

module.exports = mongoose.model('TripHistory', tripHistorySchema); 