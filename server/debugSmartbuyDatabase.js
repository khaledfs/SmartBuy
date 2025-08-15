const mongoose = require('mongoose');
const Product = require('./models/Product');

async function debugSmartbuyDatabase() {
  console.log('=== DEBUGGING SMARTBUY DATABASE ===');
  
  try {
    // Connect to smartbuy database
    const MONGO_URI = 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to smartbuy database');
    
    // Get total count
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products: ${totalProducts}`);
    
    // Get first 5 products with all fields
    const products = await Product.find().limit(5).lean();
    
    console.log('\n📋 First 5 products:');
    products.forEach((product, index) => {
      console.log(`${index + 1}. Name: ${product.name}`);
      console.log(`   Barcode: ${product.barcode || 'No barcode'}`);
      console.log(`   Has image: ${product.img ? 'Yes' : 'No'}`);
      console.log(`   All fields:`, Object.keys(product));
      console.log('');
    });
    
    // Check barcode field specifically
    const productsWithBarcode = await Product.find({ barcode: { $exists: true } }).limit(5).lean();
    console.log(`\n📦 Products with barcode field: ${productsWithBarcode.length}`);
    
    productsWithBarcode.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - Barcode: ${product.barcode}`);
    });
    
    // Check for non-null barcodes
    const productsWithNonNullBarcode = await Product.find({ 
      barcode: { $ne: null, $ne: '' } 
    }).limit(10).lean();
    
    console.log(`\n📦 Products with non-null barcode: ${productsWithNonNullBarcode.length}`);
    
    productsWithNonNullBarcode.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - Barcode: ${product.barcode} (${product.barcode.length} digits)`);
    });
    
    // Check Israeli barcodes
    const israeliBarcodes = productsWithNonNullBarcode.filter(p => p.barcode.startsWith('729'));
    console.log(`\n🇮🇱 Israeli barcodes (729): ${israeliBarcodes.length} products`);
    
    if (israeliBarcodes.length > 0) {
      console.log('Sample Israeli barcodes:');
      israeliBarcodes.slice(0, 5).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.barcode} - ${product.name}`);
      });
    }
    
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
    
    return israeliBarcodes;
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    return [];
  }
}

debugSmartbuyDatabase();
