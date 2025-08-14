const mongoose = require('mongoose');

const rejectedProductSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Ensure unique rejections per user per product per group
rejectedProductSchema.index(
  { groupId: 1, productId: 1, rejectedBy: 1 },
  { unique: true }
);

module.exports = mongoose.model('RejectedProduct', rejectedProductSchema); 