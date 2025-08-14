const mongoose = require('mongoose');

const productFrequencySchema = new mongoose.Schema({
  // Track at household/group level, not just individual
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  productId: {
    type: String, // String to match products.json
    required: true
  },
  // Household shopping patterns
  householdStats: {
    totalAdded: {
      type: Number,
      default: 0
    },
    totalPurchased: {
      type: Number,
      default: 0
    },
    lastAdded: {
      type: Date,
      default: Date.now
    },
    lastPurchased: {
      type: Date
    },
    // Track who adds what most often
    addedBy: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      count: {
        type: Number,
        default: 0
      }
    }]
  },
  // Purchase intervals for household
  purchaseIntervals: [{
    type: Number, // Days between household purchases
    default: []
  }],
  averageInterval: {
    type: Number, // Average days between household purchases
    default: 0
  },
  // Household prediction data
  nextPurchasePrediction: {
    type: Date
  },
  confidence: {
    type: Number, // 0-1 confidence in prediction
    default: 0
  },
  // Household shopping patterns
  householdPatterns: {
    preferredDays: [{
      type: Number, // 0-6 (Sunday-Saturday)
      default: []
    }],
    preferredTime: {
      type: String, // 'morning', 'afternoon', 'evening', 'night'
      default: 'afternoon'
    },
    seasonalTrend: {
      type: String, // 'increasing', 'decreasing', 'stable'
      default: 'stable'
    },
    // Track household shopping frequency
    shoppingFrequency: {
      type: String, // 'daily', 'weekly', 'bi-weekly', 'monthly'
      default: 'weekly'
    }
  },
  // Household streak tracking
  householdStreak: {
    type: Number, // Consecutive shopping trips with this product
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  // Price tracking for household
  priceHistory: [{
    price: Number,
    store: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  averagePrice: {
    type: Number,
    default: 0
  },
  // Smart scoring for household
  householdScore: {
    type: Number, // Calculated score based on household patterns
    default: 0
  },
  // Similar households comparison
  similarHouseholds: {
    type: Number, // How many similar households buy this regularly
    default: 0
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
productFrequencySchema.index({ groupId: 1, productId: 1 }, { unique: true });
productFrequencySchema.index({ groupId: 1, householdScore: -1 });
productFrequencySchema.index({ groupId: 1, nextPurchasePrediction: 1 });

module.exports = mongoose.model('ProductFrequency', productFrequencySchema); 