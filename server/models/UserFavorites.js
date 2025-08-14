const mongoose = require('mongoose');

const userFavoritesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  productId: {
    type: String, // Changed from ObjectId to String since we're using products.json
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure a user can only favorite a product once per group
userFavoritesSchema.index({ groupId: 1, userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('UserFavorites', userFavoritesSchema); 