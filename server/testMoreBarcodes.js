const mongoose = require('mongoose');
const Product = require('./models/Product');
const MultiScraper = require('./services/multiScraper');

async function testMoreBarcodes() {
  console.log('=== TESTING MORE BARCODES FROM DATABASE ===');
  
  try {
    // Connect to test database (which has more products)
    const MONGO_URI = 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/test?retryWrites=true&w=majority';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to test database');
    
    const multiScraper = new MultiScraper();
    const testCity = 'רמת גן';
    
    // Get different types of barcodes from database
    const shortBarcodes = await Product.find({ 
      barcode: { $exists: true, $ne: null, $ne: '' },
      $expr: { $lt: [{ $strLenCP: '$barcode' }, 8] }
    }).limit(3).select('name barcode').lean();
    
    const longBarcodes = await Product.find({ 
      barcode: { $exists: true, $ne: null, $ne: '' },
      $expr: { $gte: [{ $strLenCP: '$barcode' }, 8] }
    }).limit(3).select('name barcode').lean();
    
    const israeliBarcodes = await Product.find({ 
      barcode: { $regex: '^729', $exists: true, $ne: null, $ne: '' }
    }).limit(3).select('name barcode').lean();
    
    console.log('\n🔍 Testing short barcodes (< 8 digits):');
    for (const product of shortBarcodes) {
      console.log(`\n📦 Testing: ${product.name} (${product.barcode})`);
      try {
        const results = await multiScraper.searchProduct(testCity, product.barcode);
        console.log(`   Results: ${results.length} stores found`);
        if (results.length > 0) {
          console.log(`   First store: ${results[0].branch} - ${results[0].price}₪`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🔍 Testing long barcodes (≥ 8 digits):');
    for (const product of longBarcodes) {
      console.log(`\n📦 Testing: ${product.name} (${product.barcode})`);
      try {
        const results = await multiScraper.searchProduct(testCity, product.barcode);
        console.log(`   Results: ${results.length} stores found`);
        if (results.length > 0) {
          console.log(`   First store: ${results[0].branch} - ${results[0].price}₪`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🔍 Testing Israeli barcodes (starting with 729):');
    for (const product of israeliBarcodes) {
      console.log(`\n📦 Testing: ${product.name} (${product.barcode})`);
      try {
        const results = await multiScraper.searchProduct(testCity, product.barcode);
        console.log(`   Results: ${results.length} stores found`);
        if (results.length > 0) {
          console.log(`   First store: ${results[0].branch} - ${results[0].price}₪`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMoreBarcodes();
