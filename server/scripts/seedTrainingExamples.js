const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Import models
const User = require('../models/User');
const Product = require('../models/Product');
const PurchaseHistory = require('../models/PurchaseHistory');
const TrainingExample = require('../models/TrainingExample');

// MongoDB connection string (same as your other scripts)
const MONGODB_URI = 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';

// Helper to generate features for a product/user
function extractFeatures({ isFavorite, purchasedBefore, timesPurchased, recentlyPurchased, storeCount, timesWasRejectedByUser, timesWasRejectedByCart }) {
  return {
    bias: 1,
    isFavorite: isFavorite ? 1 : 0,
    purchasedBefore: purchasedBefore ? 1 : 0,
    timesPurchased: timesPurchased || 0,
    recentlyPurchased: recentlyPurchased ? 1 : 0,
    storeCount: storeCount || 1,
    timesWasRejectedByUser: timesWasRejectedByUser || 0,
    timesWasRejectedByCart: timesWasRejectedByCart || 0
  };
}

async function seedTrainingExamples() {
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas successfully!');

    // Clear existing training examples
    await TrainingExample.deleteMany({});
    console.log('🧹 Cleared existing TrainingExample data.');

    // Get all users and products
    const users = await User.find({});
    const products = await Product.find({});
    const purchaseHistory = await PurchaseHistory.find({});

    // Build a map of user-product purchase counts
    const userProductMap = {};
    purchaseHistory.forEach(ph => {
      const key = `${ph.user}_${ph.product}`;
      if (!userProductMap[key]) userProductMap[key] = 0;
      userProductMap[key] += ph.quantity || 1;
    });

    // For each user, generate training examples for a sample of products
    const trainingExamples = [];
    for (const user of users) {
      // Get products this user has purchased
      const purchasedProductIds = purchaseHistory.filter(ph => String(ph.user) === String(user._id)).map(ph => String(ph.product));
      const purchasedSet = new Set(purchasedProductIds);

      // For each product, create a training example
      for (const product of products) {
        // Features
        const isFavorite = Math.random() < 0.2; // Simulate 20% favorite
        const purchasedBefore = purchasedSet.has(String(product._id));
        const timesPurchased = userProductMap[`${user._id}_${product._id}`] || 0;
        const recentlyPurchased = purchasedBefore && Math.random() < 0.5; // 50% of purchased are recent
        const storeCount = Math.floor(Math.random() * 5) + 1; // 1-5 stores
        const timesWasRejectedByUser = Math.floor(Math.random() * 3); // 0-2
        const timesWasRejectedByCart = Math.floor(Math.random() * 2); // 0-1

        const features = extractFeatures({
          isFavorite,
          purchasedBefore,
          timesPurchased,
          recentlyPurchased,
          storeCount,
          timesWasRejectedByUser,
          timesWasRejectedByCart
        });

        // Label: 1 if purchased before, else 0 (simulate relevance)
        const label = purchasedBefore ? 1 : 0;

        // Only sample a subset for efficiency
        if (label === 1 || Math.random() < 0.05) { // All positives, 5% negatives
          trainingExamples.push({
            userId: user._id,
            productId: product._id,
            features,
            label,
            context: {
              timestamp: new Date()
            }
          });
        }
      }
    }

    // Insert training examples in batches
    const batchSize = 1000;
    for (let i = 0; i < trainingExamples.length; i += batchSize) {
      const batch = trainingExamples.slice(i, i + batchSize);
      await TrainingExample.insertMany(batch);
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(trainingExamples.length / batchSize)}`);
    }
    console.log(`🎉 Seeded ${trainingExamples.length} training examples!`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error seeding training examples:', error);
    process.exit(1);
  }
}

// Run the seeding
if (require.main === module) {
  seedTrainingExamples();
} 