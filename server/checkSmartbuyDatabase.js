const mongoose = require('mongoose');
const Product = require('./models/Product');

async function checkSmartbuyDatabase() {
  console.log('=== CHECKING SMARTBUY DATABASE ===');
  
  try {
    // Connect to smartbuy database specifically
    const SMARTBUY_URI = 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';
    await mongoose.connect(SMARTBUY_URI);
    console.log('✅ Connected to smartbuy database');
    
    // Check database name
    const dbName = mongoose.connection.db.databaseName;
    console.log(`🗄️  Database name: ${dbName}`);
    
    // Check total products
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in smartbuy: ${totalProducts}`);
    
    // Check products with barcodes
    const productsWithBarcodes = await Product.countDocuments({ barcode: { $exists: true, $ne: null, $ne: '' } });
    console.log(`📦 Products with barcodes: ${productsWithBarcodes}`);
    
    // Check products with images
    const productsWithImages = await Product.countDocuments({ 
      img: { $exists: true, $ne: null, $ne: '', $ne: 'https://via.placeholder.com/100' } 
    });
    console.log(`🖼️  Products with valid images: ${productsWithImages}`);
    
    // Get sample products
    const sampleProducts = await Product.find().limit(5).select('name barcode img source').lean();
    
    console.log('\n📋 Sample products from smartbuy:');
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Barcode: ${product.barcode || 'No barcode'}`);
      console.log(`   Source: ${product.source || 'No source'}`);
      console.log(`   Has image: ${product.img ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    // Check products by source
    const sourceCounts = await Product.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📦 Products by source in smartbuy:');
    sourceCounts.forEach(source => {
      console.log(`   - ${source._id || 'No source'}: ${source.count} products`);
    });
    
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\n📚 Collections in smartbuy: ${collections.map(c => c.name).join(', ')}`);
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from smartbuy database');
    
  } catch (error) {
    console.error('❌ Smartbuy database check failed:', error.message);
  }
}

checkSmartbuyDatabase();
