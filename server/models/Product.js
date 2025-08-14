// server/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  barcode: { type: String, unique: true, sparse: true },
  img: { type: String },
  category: { type: String },
  price: { type: Number },
  description: { type: String },
  brand: { type: String },
  weight: { type: String },
  ingredients: { type: String },
  nutritionalInfo: { type: String },
  allergens: { type: String },
  storageInstructions: { type: String },
  expiryDate: { type: Date },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Performance optimization: Add indexes for frequently queried fields
productSchema.index({ name: 1 }); // For name searches
productSchema.index({ category: 1 }); // For category filtering
// Note: barcode index is automatically created by unique: true in schema
productSchema.index({ isAvailable: 1 }); // For availability filtering
productSchema.index({ createdAt: -1 }); // For recent products

// Compound index for common query patterns
productSchema.index({ category: 1, isAvailable: 1 });

// Enhanced text index for better search performance (replaces the simple text index)
productSchema.index({ 
  name: 'text', 
  category: 'text', 
  brand: 'text',
  description: 'text'
}, {
  weights: {
    name: 10,        // Highest weight for product name
    category: 5,     // Medium weight for category
    brand: 3,        // Lower weight for brand
    description: 1   // Lowest weight for description
  }
});

module.exports = mongoose.model('Product', productSchema);