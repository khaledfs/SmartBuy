const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testProductsAPI() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const Product = require('./models/Product');
    
    // Test 1: Check total products in database
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}`);

    // Test 2: Get sample products
    const sampleProducts = await Product.find().limit(5).select('name img barcode');
    console.log('📦 Sample products:');
    sampleProducts.forEach((p, i) => {
      console.log(`${i + 1}. Name: ${p.name}`);
      console.log(`   Image: ${p.img ? 'Has image' : 'No image'}`);
      console.log(`   Barcode: ${p.barcode || 'No barcode'}`);
      console.log('');
    });

    // Test 3: Test aggregation (like the API does)
    const aggregatedProducts = await Product.aggregate([
      { $sample: { size: 10 } },
      { $project: { _id: 1, name: 1, img: 1 } }
    ]);
    console.log(`🎲 Aggregated products (sample of 10): ${aggregatedProducts.length}`);
    
    // Test 4: Check image distribution
    const productsWithImages = await Product.countDocuments({ 
      img: { $exists: true, $ne: null, $ne: '' } 
    });
    console.log(`🖼️  Products with images: ${productsWithImages}/${totalProducts}`);

    await mongoose.disconnect();
    console.log('✅ Test completed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testProductsAPI(); 