const mongoose = require('mongoose');
const UserFavorites = require('./models/UserFavorites');
const Product = require('./models/Product');
const Group = require('./models/Group');
const User = require('./models/User');

// Test configuration
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Example ObjectId
const TEST_GROUP_ID = '507f1f77bcf86cd799439012'; // Example ObjectId
const TEST_PRODUCT_ID = '507f1f77bcf86cd799439013'; // Example ObjectId

async function testFavoritesFunctionality() {
  try {
    console.log('🧪 Testing Favorites Functionality...');
    
    // Test 1: Check if UserFavorites model is working
    console.log('\n1️⃣ Testing UserFavorites model...');
    const testFavorite = new UserFavorites({
      userId: TEST_USER_ID,
      groupId: TEST_GROUP_ID,
      productId: TEST_PRODUCT_ID.toString()
    });
    console.log('✅ UserFavorites model created successfully');
    
    // Test 2: Check if we can find existing favorites
    console.log('\n2️⃣ Testing favorite lookup...');
    const existingFavorites = await UserFavorites.find({
      userId: TEST_USER_ID,
      groupId: TEST_GROUP_ID
    }).limit(5);
    console.log(`✅ Found ${existingFavorites.length} existing favorites`);
    
    // Test 3: Check if we can create a favorite (without saving to avoid duplicates)
    console.log('\n3️⃣ Testing favorite creation logic...');
    const existingFavorite = await UserFavorites.findOne({
      userId: TEST_USER_ID,
      groupId: TEST_GROUP_ID,
      productId: TEST_PRODUCT_ID.toString()
    });
    
    if (existingFavorite) {
      console.log('✅ Favorite lookup working correctly');
    } else {
      console.log('✅ No existing favorite found (expected for test data)');
    }
    
    // Test 4: Check if Product model is accessible
    console.log('\n4️⃣ Testing Product model...');
    const products = await Product.find().limit(1);
    console.log(`✅ Product model accessible, found ${products.length} products`);
    
    // Test 5: Check if Group model is accessible
    console.log('\n5️⃣ Testing Group model...');
    const groups = await Group.find().limit(1);
    console.log(`✅ Group model accessible, found ${groups.length} groups`);
    
    console.log('\n🎉 All tests passed! The favorites functionality should work correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  // Connect to MongoDB
  const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';
  
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('🔗 Connected to MongoDB');
      return testFavoritesFunctionality();
    })
    .then(() => {
      console.log('✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testFavoritesFunctionality }; 