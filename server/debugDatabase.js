const mongoose = require('mongoose');
const Product = require('./models/Product');

async function debugDatabase() {
  console.log('=== DEBUGGING DATABASE ===');
  
  try {
    // Connect to test database
    const MONGO_URI = 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/test?retryWrites=true&w=majority';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to test database');
    
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
    }).limit(5).lean();
    
    console.log(`\n📦 Products with non-null barcode: ${productsWithNonNullBarcode.length}`);
    
    productsWithNonNullBarcode.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - Barcode: ${product.barcode}`);
    });
    
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugDatabase();
