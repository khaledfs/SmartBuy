const mongoose = require('mongoose');
const Product = require('./models/Product');
const ProductHistory = require('./models/ProductHistory');
const Group = require('./models/Group');

// Test function to check what's happening
async function testSuggestions() {
  try {
    console.log('🔍 Testing Smart Suggestions...');
    
    // Check if MongoDB is connected
    console.log('📊 MongoDB connection state:', mongoose.connection.readyState);
    
    // Check if we have products in database
    const productCount = await Product.countDocuments();
    console.log('📦 Products in database:', productCount);
    
    // Check if we have product history
    const historyCount = await ProductHistory.countDocuments();
    console.log('📝 Product history records:', historyCount);
    
    // Check if we have groups
    const groupCount = await Group.countDocuments();
    console.log('👥 Groups in database:', groupCount);
    
    // Test products.json file
    const fs = require('fs');
    const path = require('path');
    const productsPath = path.resolve(__dirname, './scripts/products.json');
    
    if (fs.existsSync(productsPath)) {
      const data = fs.readFileSync(productsPath, 'utf-8');
      const products = JSON.parse(data);
      console.log('📄 Products in products.json:', products.length);
    } else {
      console.log('❌ products.json not found!');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run the test
testSuggestions(); 