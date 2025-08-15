const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testSearchFunctionality() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const Product = require('./models/Product');
    
    // Test 1: Check total products
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}`);

    // Test 2: Test search functionality - simulate the API endpoint
    const searchTests = [
      'קמח', // Hebrew search
      'waffle', // English search
      'שוקולד', // Hebrew chocolate
      'milk', // English milk
      'חלב', // Hebrew milk
      'bread', // English bread
      'לחם', // Hebrew bread
    ];

    console.log('\n🔍 Testing search functionality:');
    console.log('=' .repeat(50));

    for (const searchTerm of searchTests) {
      try {
        // Simulate the exact query from productRoutes.js
        const mongoQuery = { name: { $regex: searchTerm, $options: 'i' } };
        const searchResults = await Product.find(mongoQuery).limit(10).select('name barcode img');
        
        console.log(`\n🔎 Search for "${searchTerm}":`);
        console.log(`   Found: ${searchResults.length} products`);
        
        if (searchResults.length > 0) {
          console.log(`   Sample results:`);
          searchResults.slice(0, 3).forEach((product, i) => {
            console.log(`     ${i + 1}. ${product.name} (Barcode: ${product.barcode || 'N/A'})`);
          });
        } else {
          console.log(`   ❌ No results found for "${searchTerm}"`);
        }
      } catch (error) {
        console.log(`   ❌ Error searching for "${searchTerm}": ${error.message}`);
      }
    }

    // Test 3: Test pagination (like the API does)
    console.log('\n📄 Testing pagination:');
    console.log('=' .repeat(50));
    
    const limit = 20;
    const offset = 0;
    
    // Test random sampling (like ALL card)
    const randomProducts = await Product.aggregate([
      { $sample: { size: limit } },
      { $project: { _id: 1, name: 1, img: 1, barcode: 1 } }
    ]);
    
    console.log(`🎲 Random products (limit=${limit}): ${randomProducts.length}`);
    console.log(`   Sample: ${randomProducts.slice(0, 3).map(p => p.name).join(', ')}`);

    // Test 4: Check if search is working with specific known products
    console.log('\n🎯 Testing specific product searches:');
    console.log('=' .repeat(50));
    
    // Get some known products first
    const knownProducts = await Product.find().limit(5).select('name barcode');
    
    for (const product of knownProducts) {
      const searchTerm = product.name.split(' ')[0]; // Use first word
      const searchResults = await Product.find({ 
        name: { $regex: searchTerm, $options: 'i' } 
      }).limit(5);
      
      console.log(`\n🔎 Search for "${searchTerm}" (from "${product.name}"):`);
      console.log(`   Found: ${searchResults.length} products`);
      if (searchResults.length > 0) {
        console.log(`   Includes original: ${searchResults.some(p => p._id.toString() === product._id.toString()) ? '✅ Yes' : '❌ No'}`);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Search functionality test completed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSearchFunctionality();



