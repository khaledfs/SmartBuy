const mongoose = require('mongoose');
const Product = require('./models/Product');
const MultiScraper = require('./services/multiScraper');
require('dotenv').config();

async function checkDatabase() {
  console.log('=== DATABASE ANALYSIS ===');
  
  try {
    // Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check total products
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}`);
    
    // Check products with barcodes
    const productsWithBarcodes = await Product.countDocuments({ barcode: { $exists: true, $ne: null, $ne: '' } });
    console.log(`📦 Products with barcodes: ${productsWithBarcodes}`);
    
    // Check products with images
    const productsWithImages = await Product.countDocuments({ 
      img: { $exists: true, $ne: null, $ne: '', $ne: 'https://via.placeholder.com/100' } 
    });
    console.log(`🖼️  Products with valid images: ${productsWithImages}`);
    
    // Get sample products with barcodes
    const sampleProducts = await Product.find({ 
      barcode: { $exists: true, $ne: null, $ne: '' } 
    }).limit(10).select('name barcode img').lean();
    
    console.log('\n📋 Sample products with barcodes:');
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Barcode: ${product.barcode}`);
      console.log(`   Has image: ${product.img ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    // Check database name
    const dbName = mongoose.connection.db.databaseName;
    console.log(`🗄️  Database name: ${dbName}`);
    
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📚 Collections: ${collections.map(c => c.name).join(', ')}`);
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
    return sampleProducts;
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    return [];
  }
}

async function testMultipleBarcodes(products) {
  console.log('\n=== TESTING MULTIPLE BARCODES ===');
  
  const multiScraper = new MultiScraper();
  const testCity = 'רמת גן';
  
  // Test the original barcode that was failing
  console.log('\n🔍 Testing original failing barcode: 7290110566579');
  let results = await multiScraper.searchProduct(testCity, '7290110566579');
  console.log(`✅ Results found: ${results.length}`);
  
  // Test with sample barcodes from database
  if (products.length > 0) {
    console.log('\n🔍 Testing barcodes from database:');
    
    for (let i = 0; i < Math.min(5, products.length); i++) {
      const product = products[i];
      if (product.barcode && product.barcode.length >= 8) {
        console.log(`\n📦 Testing: ${product.name} (${product.barcode})`);
        
        try {
          const barcodeResults = await multiScraper.searchProduct(testCity, product.barcode);
          console.log(`   Results: ${barcodeResults.length} stores found`);
          
          if (barcodeResults.length > 0) {
            console.log(`   First store: ${barcodeResults[0].branch} - ${barcodeResults[0].price}₪`);
          }
        } catch (error) {
          console.log(`   ❌ Error: ${error.message}`);
        }
        
        // Add a small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // Test with some common Israeli barcodes
  const commonBarcodes = [
    '7290011017866', // Common Israeli product
    '7290000000000', // Test barcode
    '7290110566579'  // The original failing one
  ];
  
  console.log('\n🔍 Testing common Israeli barcodes:');
  for (const barcode of commonBarcodes) {
    console.log(`\n📦 Testing barcode: ${barcode}`);
    
    try {
      const barcodeResults = await multiScraper.searchProduct(testCity, barcode);
      console.log(`   Results: ${barcodeResults.length} stores found`);
      
      if (barcodeResults.length > 0) {
        console.log(`   First store: ${barcodeResults[0].branch} - ${barcodeResults[0].price}₪`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Add a small delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function checkDatabaseConfusion() {
  console.log('\n=== DATABASE CONFUSION ANALYSIS ===');
  
  try {
    // Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check if we're connected to 'smartbuy' or 'test' database
    const dbName = mongoose.connection.db.databaseName;
    console.log(`🗄️  Current database: ${dbName}`);
    
    // Check if there are multiple databases
    const adminDb = mongoose.connection.db.admin();
    const dbList = await adminDb.listDatabases();
    
    console.log('\n📚 Available databases:');
    dbList.databases.forEach(db => {
      if (db.name.includes('smartbuy') || db.name.includes('test')) {
        console.log(`   - ${db.name} (${db.sizeOnDisk} bytes)`);
      }
    });
    
    // Check current database collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\n📖 Collections in ${dbName}:`);
    collections.forEach(collection => {
      console.log(`   - ${collection.name}`);
    });
    
    // Check products count in current database
    const totalProducts = await Product.countDocuments();
    console.log(`\n📊 Products in ${dbName}: ${totalProducts}`);
    
    // Check products with different sources
    const sourceCounts = await Product.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📦 Products by source:');
    sourceCounts.forEach(source => {
      console.log(`   - ${source._id || 'No source'}: ${source.count} products`);
    });
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Database confusion analysis failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 STARTING COMPREHENSIVE TEST');
  console.log('=' .repeat(50));
  
  // Check database state
  const sampleProducts = await checkDatabase();
  
  // Check database confusion
  await checkDatabaseConfusion();
  
  // Test multiple barcodes
  await testMultipleBarcodes(sampleProducts);
  
  console.log('\n🎉 COMPREHENSIVE TEST COMPLETED');
}

runAllTests().catch(console.error);
