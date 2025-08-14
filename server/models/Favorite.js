const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  quantity: {
    type: Number,
    default: 1,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Ensure unique favorites per user per product
favoriteSchema.index({ productId: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema); 