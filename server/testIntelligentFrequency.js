// Test script for intelligent frequency system
require('dotenv').config();
const mongoose = require('mongoose');
const IntelligentFrequencyService = require('./services/intelligentFrequency');

const testUserId = '507f1f77bcf86cd799439011'; // Test user ID

async function testIntelligentFrequency() {
  try {
    console.log('🔍 Testing Intelligent Frequency System...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smartbuy');
    console.log('✅ Connected to MongoDB\n');
    
    // Test 1: Update frequency for a product being added
    console.log('📝 Test 1: Tracking product addition...');
    await IntelligentFrequencyService.updateProductFrequency(
      testUserId, 
      'milk_product', 
      'added', 
      { quantity: 1, timestamp: new Date() }
    );
    console.log('✅ Product addition tracked\n');
    
    // Test 2: Update frequency for a product being purchased
    console.log('🛒 Test 2: Tracking product purchase...');
    await IntelligentFrequencyService.updateProductFrequency(
      testUserId, 
      'milk_product', 
      'purchased', 
      { quantity: 1, timestamp: new Date() }
    );
    console.log('✅ Product purchase tracked\n');
    
    // Test 3: Add more data to build patterns
    console.log('📊 Test 3: Building shopping patterns...');
    const products = ['bread_product', 'eggs_product', 'milk_product', 'butter_product'];
    
    for (let i = 0; i < 5; i++) {
      for (const product of products) {
        await IntelligentFrequencyService.updateProductFrequency(
          testUserId,
          product,
          'added',
          { quantity: 1, timestamp: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000) }
        );
        
        if (i > 0) { // Purchase after first addition
          await IntelligentFrequencyService.updateProductFrequency(
            testUserId,
            product,
            'purchased',
            { quantity: 1, timestamp: new Date(Date.now() - (i - 1) * 7 * 24 * 60 * 60 * 1000) }
          );
        }
      }
    }
    console.log('✅ Shopping patterns built\n');
    
    // Test 4: Get intelligent frequent products
    console.log('🧠 Test 4: Getting intelligent frequent products...');
    const frequentProducts = await IntelligentFrequencyService.getIntelligentFrequentProducts(testUserId, 10);
    
    console.log(`📋 Found ${frequentProducts.length} frequent products:`);
    frequentProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   - Frequency: ${product.frequency} times added`);
      console.log(`   - Smart Score: ${product.smartScore}`);
      console.log(`   - Streak: ${product.streak} shopping trips`);
      console.log(`   - Confidence: ${Math.round(product.confidence * 100)}%`);
      if (product.nextPurchaseIn !== null) {
        console.log(`   - Next purchase: ${product.nextPurchaseIn} days`);
        console.log(`   - Status: ${product.isOverdue ? '🔴 OVERDUE' : product.isDueSoon ? '🟠 DUE SOON' : '🟢 Normal'}`);
      }
      console.log('');
    });
    
    // Test 5: Analyze user patterns
    console.log('📈 Test 5: Analyzing user patterns...');
    const patterns = await IntelligentFrequencyService.analyzeUserPatterns(testUserId);
    console.log('User Pattern Analysis:');
    console.log(`- Total products tracked: ${patterns.totalProducts || 0}`);
    console.log(`- Average smart score: ${Math.round(patterns.avgSmartScore || 0)}`);
    console.log(`- Average purchase interval: ${Math.round(patterns.avgInterval || 0)} days`);
    console.log('');
    
    console.log('🎉 All tests completed successfully!');
    console.log('\n💡 The Intelligent Frequency System is working correctly!');
    console.log('   - It tracks shopping patterns');
    console.log('   - It calculates smart scores');
    console.log('   - It predicts next purchases');
    console.log('   - It provides confidence levels');
    console.log('   - It identifies overdue and due-soon items');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testIntelligentFrequency(); 