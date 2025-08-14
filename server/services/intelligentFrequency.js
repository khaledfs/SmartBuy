const ProductFrequency = require('../models/ProductFrequency');
const ProductHistory = require('../models/ProductHistory');
const Group = require('../models/Group');

class IntelligentFrequencyService {
  
  // Update frequency data when a product is added or purchased by household
  static async updateHouseholdFrequency(groupId, productId, action, userId, metadata = {}) {
    try {
      console.log(`Updating household frequency for group ${groupId}, product ${productId}, action ${action}`);
      
      let frequency = await ProductFrequency.findOne({ groupId, productId });
      
      if (!frequency) {
        frequency = new ProductFrequency({
          groupId,
          productId
        });
      }

      const now = new Date();
      
      if (action === 'added') {
        frequency.householdStats.totalAdded += 1;
        frequency.householdStats.lastAdded = now;
        
        // Track who added it
        const existingUser = frequency.householdStats.addedBy.find(u => u.userId.toString() === userId.toString());
        if (existingUser) {
          existingUser.count += 1;
        } else {
          frequency.householdStats.addedBy.push({ userId, count: 1 });
        }
        
        // Update household streak
        const daysSinceLastAdded = frequency.householdStats.lastAdded ? 
          Math.floor((now - frequency.householdStats.lastAdded) / (1000 * 60 * 60 * 24)) : 0;
        
        if (daysSinceLastAdded <= 7) { // Within a week
          frequency.householdStreak += 1;
        } else {
          frequency.householdStreak = 1;
        }
        
        frequency.longestStreak = Math.max(frequency.householdStreak, frequency.longestStreak);
        
      } else if (action === 'purchased') {
        frequency.householdStats.totalPurchased += 1;
        frequency.householdStats.lastPurchased = now;
        
        // Calculate purchase interval
        if (frequency.householdStats.lastPurchased && frequency.householdStats.lastPurchased !== now) {
          const interval = Math.floor((now - frequency.householdStats.lastPurchased) / (1000 * 60 * 60 * 24));
          frequency.purchaseIntervals.push(interval);
          
          // Keep only last 10 intervals for recent patterns
          if (frequency.purchaseIntervals.length > 10) {
            frequency.purchaseIntervals = frequency.purchaseIntervals.slice(-10);
          }
          
          // Calculate average interval
          const sum = frequency.purchaseIntervals.reduce((a, b) => a + b, 0);
          frequency.averageInterval = sum / frequency.purchaseIntervals.length;
        }
        
        // Update price history if provided
        if (metadata.price && metadata.store) {
          frequency.priceHistory.push({
            price: metadata.price,
            store: metadata.store,
            date: now
          });
          
          // Keep only last 20 price entries
          if (frequency.priceHistory.length > 20) {
            frequency.priceHistory = frequency.priceHistory.slice(-20);
          }
          
          // Calculate average price
          const totalPrice = frequency.priceHistory.reduce((sum, entry) => sum + entry.price, 0);
          frequency.averagePrice = totalPrice / frequency.priceHistory.length;
        }
      }

      // Update household shopping patterns
      await this.updateHouseholdPatterns(frequency, now, metadata);
      
      // Calculate next purchase prediction
      await this.calculateNextPurchasePrediction(frequency);
      
      // Calculate household score
      await this.calculateHouseholdScore(frequency);
      
      // Update similar households data
      await this.updateSimilarHouseholdsData(frequency);
      
      await frequency.save();
      
      console.log(`Updated household frequency for ${productId}: added=${frequency.householdStats.totalAdded}, purchased=${frequency.householdStats.totalPurchased}, score=${frequency.householdScore}`);
      
      return frequency;
    } catch (error) {
      console.error('Error updating household frequency:', error);
      throw error;
    }
  }

  // Update household shopping patterns
  static async updateHouseholdPatterns(frequency, timestamp, metadata) {
    const dayOfWeek = timestamp.getDay();
    const hour = timestamp.getHours();
    
    // Update preferred days
    if (!frequency.householdPatterns.preferredDays.includes(dayOfWeek)) {
      frequency.householdPatterns.preferredDays.push(dayOfWeek);
    }
    
    // Keep only most frequent days (top 3)
    const dayCounts = {};
    frequency.householdPatterns.preferredDays.forEach(day => {
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    
    const sortedDays = Object.entries(dayCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([day]) => parseInt(day));
    
    frequency.householdPatterns.preferredDays = sortedDays;
    
    // Update preferred time
    let timeOfDay;
    if (hour >= 6 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';
    
    frequency.householdPatterns.preferredTime = timeOfDay;
    
    // Update shopping frequency
    if (frequency.averageInterval <= 1) {
      frequency.householdPatterns.shoppingFrequency = 'daily';
    } else if (frequency.averageInterval <= 7) {
      frequency.householdPatterns.shoppingFrequency = 'weekly';
    } else if (frequency.averageInterval <= 14) {
      frequency.householdPatterns.shoppingFrequency = 'bi-weekly';
    } else {
      frequency.householdPatterns.shoppingFrequency = 'monthly';
    }
    
    // Update seasonal trend
    const month = timestamp.getMonth();
    const isHolidaySeason = month >= 10 || month <= 1; // Nov-Feb
    const isSummer = month >= 5 && month <= 8; // Jun-Sep
    
    if (isHolidaySeason && frequency.householdStats.totalAdded > 5) {
      frequency.householdPatterns.seasonalTrend = 'increasing';
    } else if (isSummer && frequency.householdStats.totalAdded > 5) {
      frequency.householdPatterns.seasonalTrend = 'stable';
    }
  }

  // Calculate when the household will likely purchase this product again
  static async calculateNextPurchasePrediction(frequency) {
    if (frequency.householdStats.totalPurchased < 2 || frequency.averageInterval === 0) {
      frequency.nextPurchasePrediction = null;
      frequency.confidence = 0;
      return;
    }

    const now = new Date();
    const lastPurchase = frequency.householdStats.lastPurchased || frequency.householdStats.lastAdded;
    
    // Base prediction on average interval
    const predictedDate = new Date(lastPurchase);
    predictedDate.setDate(predictedDate.getDate() + frequency.averageInterval);
    
    frequency.nextPurchasePrediction = predictedDate;
    
    // Calculate confidence based on consistency
    const intervals = frequency.purchaseIntervals;
    if (intervals.length < 2) {
      frequency.confidence = 0.3;
    } else {
      // Calculate standard deviation to measure consistency
      const mean = frequency.averageInterval;
      const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      
      // Lower standard deviation = higher confidence
      const consistency = Math.max(0, 1 - (stdDev / mean));
      frequency.confidence = Math.min(0.95, 0.3 + (consistency * 0.65));
    }
    
    // Adjust confidence based on household streak
    if (frequency.householdStreak > 3) {
      frequency.confidence = Math.min(0.95, frequency.confidence + 0.1);
    }
  }

  // Calculate household score based on multiple factors
  static async calculateHouseholdScore(frequency) {
    let score = 0;
    
    // Base score from household frequency (35% weight)
    const frequencyScore = Math.min(100, frequency.householdStats.totalAdded * 8);
    score += frequencyScore * 0.35;
    
    // Recency score (20% weight)
    const daysSinceLastAdded = Math.floor((new Date() - frequency.householdStats.lastAdded) / (1000 * 60 * 60 * 24));
    const recencyScore = Math.max(0, 100 - (daysSinceLastAdded * 2));
    score += recencyScore * 0.2;
    
    // Household streak score (15% weight)
    const streakScore = Math.min(100, frequency.householdStreak * 15);
    score += streakScore * 0.15;
    
    // Prediction urgency score (15% weight)
    let urgencyScore = 0;
    if (frequency.nextPurchasePrediction) {
      const daysUntilPrediction = Math.floor((frequency.nextPurchasePrediction - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilPrediction <= 0) {
        urgencyScore = 100; // Overdue
      } else if (daysUntilPrediction <= 3) {
        urgencyScore = 90; // Due soon
      } else if (daysUntilPrediction <= 7) {
        urgencyScore = 70; // Due this week
      } else {
        urgencyScore = Math.max(0, 50 - (daysUntilPrediction - 7) * 2);
      }
    }
    score += urgencyScore * 0.15;
    
    // Similar households score (10% weight)
    const similarScore = Math.min(100, frequency.similarHouseholds * 10);
    score += similarScore * 0.1;
    
    // Consistency score (5% weight)
    const consistencyScore = frequency.confidence * 100;
    score += consistencyScore * 0.05;
    
    frequency.householdScore = Math.round(score);
  }

  // Update similar households data
  static async updateSimilarHouseholdsData(frequency) {
    try {
      // Count how many other households buy this product regularly
      const similarHouseholds = await ProductFrequency.countDocuments({
        productId: frequency.productId,
        groupId: { $ne: frequency.groupId },
        'householdStats.totalAdded': { $gte: 3 } // At least 3 times
      });
      
      frequency.similarHouseholds = similarHouseholds;
    } catch (error) {
      console.error('Error updating similar households data:', error);
    }
  }

  // Get intelligent frequent products for a household
  static async getHouseholdFrequentProducts(groupId, limit = 10) {
    try {
      console.log(`Getting household frequent products for group ${groupId}`);
      
      // Safety check for undefined groupId
      if (!groupId) {
        console.log('No groupId provided, returning empty array');
        return [];
      }
      
      // Get products with highest household scores
      const frequentProducts = await ProductFrequency.find({ groupId })
        .sort({ householdScore: -1, 'householdStats.totalAdded': -1 })
        .limit(limit);

      console.log(`Found ${frequentProducts.length} household frequent products`);

      if (frequentProducts.length === 0) {
        return [];
      }

      // Get product details from products.json
      const fs = require('fs');
      const path = require('path');
      const productsPath = path.resolve(__dirname, '../scripts/products.json');
      const data = fs.readFileSync(productsPath, 'utf-8');
      const allProducts = JSON.parse(data);

      // Match with product details
      const result = [];
      for (const freq of frequentProducts) {
        const product = allProducts.find(p => {
          return p._id === freq.productId || p.name === freq.productId;
        });

        if (product) {
          const daysUntilNext = freq.nextPurchasePrediction ? 
            Math.floor((freq.nextPurchasePrediction - new Date()) / (1000 * 60 * 60 * 24)) : null;

          result.push({
            productId: freq.productId,
            name: product.name,
            img: product.img || '',
            frequency: freq.householdStats.totalAdded,
            householdScore: freq.householdScore,
            nextPurchaseIn: daysUntilNext,
            confidence: freq.confidence,
            householdStreak: freq.householdStreak,
            isOverdue: daysUntilNext !== null && daysUntilNext <= 0,
            isDueSoon: daysUntilNext !== null && daysUntilNext <= 3,
            averagePrice: freq.averagePrice,
            similarHouseholds: freq.similarHouseholds,
            shoppingFrequency: freq.householdPatterns.shoppingFrequency,
            addedBy: freq.householdStats.addedBy
          });
        }
      }

      console.log(`Returning ${result.length} household frequent products`);
      return result;
    } catch (error) {
      console.error('Error getting household frequent products:', error);
      return [];
    }
  }

  // Get products that are due for purchase soon for household
  static async getHouseholdDueSoonProducts(groupId, limit = 5) {
    try {
      const dueSoon = await ProductFrequency.find({
        groupId,
        nextPurchasePrediction: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // Next 7 days
      })
      .sort({ nextPurchasePrediction: 1 })
      .limit(limit);

      return dueSoon;
    } catch (error) {
      console.error('Error getting household due soon products:', error);
      return [];
    }
  }

  // Analyze household shopping patterns
  static async analyzeHouseholdPatterns(groupId) {
    try {
      const patterns = await ProductFrequency.aggregate([
        { $match: { groupId: new require('mongoose').Types.ObjectId(groupId) } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            avgHouseholdScore: { $avg: '$householdScore' },
            mostFrequentDay: { $push: '$householdPatterns.preferredDays' },
            avgInterval: { $avg: '$averageInterval' },
            avgPrice: { $avg: '$averagePrice' }
          }
        }
      ]);

      return patterns[0] || {};
    } catch (error) {
      console.error('Error analyzing household patterns:', error);
      return {};
    }
  }
}

module.exports = IntelligentFrequencyService; 