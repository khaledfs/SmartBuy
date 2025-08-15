const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Import models
const User = require('../models/User');
const Group = require('../models/Group');
const ProductHistory = require('../models/ProductHistory');
const UserFavorites = require('../models/UserFavorites');
const ProductFrequency = require('../models/ProductFrequency');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';

// Load products from products.json
function loadProducts() {
  const productsPath = path.resolve(__dirname, 'products.json');
  const data = fs.readFileSync(productsPath, 'utf-8');
  return JSON.parse(data);
}

// Generate realistic product history for smart suggestions
async function generateProductHistory(users, products) {
  console.log('📊 Generating ProductHistory data...');
  
  const productHistory = [];
  const now = new Date();
  
  users.forEach(user => {
    // Generate 20-50 product interactions per user
    const interactions = Math.floor(Math.random() * 31) + 20;
    
    for (let i = 0; i < interactions; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const action = Math.random() > 0.7 ? 'purchased' : 'added'; // 30% purchased, 70% added
      const interactionDate = new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000); // Last 90 days
      
      productHistory.push({
        userId: user._id,
        productId: product._id || product.name, // Use _id or name as productId
        listId: null,
        action: action,
        quantity: Math.floor(Math.random() * 3) + 1,
        metadata: {
          price: (Math.random() * 20 + 1).toFixed(2),
          store: 'Walmart',
          timestamp: interactionDate
        },
        createdAt: interactionDate,
        updatedAt: interactionDate
      });
    }
  });
  
  return productHistory;
}

// Generate user favorites data
async function generateUserFavorites(users, products) {
  console.log('❤️ Generating UserFavorites data...');
  
  const userFavorites = [];
  
  users.forEach(user => {
    // Each user favorites 5-15 products
    const favoriteCount = Math.floor(Math.random() * 11) + 5;
    const userFavProducts = [];
    
    for (let i = 0; i < favoriteCount; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const favoriteDate = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000); // Last 60 days
      
      // Avoid duplicates
      if (!userFavProducts.includes(product._id || product.name)) {
        userFavProducts.push(product._id || product.name);
        
        // Get a random group for this user (for seeding purposes)
        // In real usage, this would be the actual group the user is in
        const randomGroupId = new mongoose.Types.ObjectId(); // Create a dummy group ID for seeding
        
        userFavorites.push({
          userId: user._id,
          groupId: randomGroupId, // Add the required groupId field
          productId: product._id || product.name,
          addedAt: favoriteDate,
          createdAt: favoriteDate,
          updatedAt: favoriteDate
        });
      }
    }
  });
  
  return userFavorites;
}

// Generate product frequency data for households
async function generateProductFrequency(groups, products) {
  console.log('📈 Generating ProductFrequency data...');
  
  const productFrequency = [];
  
  groups.forEach(group => {
    // Each group has 10-30 frequently bought products
    const frequentCount = Math.floor(Math.random() * 21) + 10;
    const groupFreqProducts = [];
    
    for (let i = 0; i < frequentCount; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      
      // Avoid duplicates
      if (!groupFreqProducts.includes(product._id || product.name)) {
        groupFreqProducts.push(product._id || product.name);
        
        const totalAdded = Math.floor(Math.random() * 20) + 5; // 5-25 times added
        const totalPurchased = Math.floor(Math.random() * 15) + 3; // 3-18 times purchased
        const householdStreak = Math.floor(Math.random() * 8) + 1; // 1-8 shopping trips in a row
        
        productFrequency.push({
          groupId: group._id,
          productId: product._id || product.name,
          householdStats: {
            totalAdded: totalAdded,
            totalPurchased: totalPurchased,
            lastAdded: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            lastPurchased: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            addedBy: [{
              userId: group.members[0]._id,
              count: totalAdded
            }]
          },
          purchaseIntervals: [7, 14, 21, 28, 35], // Sample intervals
          averageInterval: 21,
          nextPurchasePrediction: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          confidence: 0.7 + Math.random() * 0.25, // 0.7-0.95 confidence
          householdPatterns: {
            preferredDays: [1, 3, 5], // Monday, Wednesday, Friday
            preferredTime: 'afternoon',
            seasonalTrend: 'stable',
            shoppingFrequency: 'weekly'
          },
          householdStreak: householdStreak,
          longestStreak: householdStreak + Math.floor(Math.random() * 5),
          priceHistory: [{
            price: (Math.random() * 20 + 1).toFixed(2),
            store: 'Walmart',
            date: new Date()
          }],
          averagePrice: (Math.random() * 20 + 1).toFixed(2),
          householdScore: Math.floor(Math.random() * 50) + 50, // 50-100 score
          similarHouseholds: Math.floor(Math.random() * 20) + 5, // 5-25 similar households
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  });
  
  return productFrequency;
}

// Main seeding function
async function seedSmartSuggestionsData() {
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas successfully!');
    
    // Load products
    console.log('📦 Loading products from products.json...');
    const products = loadProducts();
    console.log(`✅ Loaded ${products.length} products`);
    
    // Get existing users and groups
    console.log('👥 Getting existing users and groups...');
    const users = await User.find({});
    const groups = await Group.find({});
    
    if (users.length === 0) {
      console.log('❌ No users found. Please run the main seeding script first.');
      return;
    }
    
    if (groups.length === 0) {
      console.log('❌ No groups found. Please run the main seeding script first.');
      return;
    }
    
    console.log(`✅ Found ${users.length} users and ${groups.length} groups`);
    
    // Clear existing smart suggestions data
    console.log('🧹 Clearing existing smart suggestions data...');
    await ProductHistory.deleteMany({});
    await UserFavorites.deleteMany({});
    await ProductFrequency.deleteMany({});
    console.log('✅ Cleared existing data');
    
    // Generate new data
    const productHistory = await generateProductHistory(users, products);
    const userFavorites = await generateUserFavorites(users, products);
    const productFrequency = await generateProductFrequency(groups, products);
    
    // Save to database
    console.log('💾 Saving ProductHistory...');
    await ProductHistory.insertMany(productHistory);
    console.log(`✅ Saved ${productHistory.length} product history records`);
    
    console.log('💾 Saving UserFavorites...');
    await UserFavorites.insertMany(userFavorites);
    console.log(`✅ Saved ${userFavorites.length} user favorites records`);
    
    console.log('💾 Saving ProductFrequency...');
    await ProductFrequency.insertMany(productFrequency);
    console.log(`✅ Saved ${productFrequency.length} product frequency records`);
    
    console.log('🎉 Smart suggestions data seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - ProductHistory: ${productHistory.length} records`);
    console.log(`   - UserFavorites: ${userFavorites.length} records`);
    console.log(`   - ProductFrequency: ${productFrequency.length} records`);
    console.log('\n🚀 Your smart suggestions should now work!');
    
  } catch (error) {
    console.error('❌ Error seeding smart suggestions data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seeding
seedSmartSuggestionsData(); 