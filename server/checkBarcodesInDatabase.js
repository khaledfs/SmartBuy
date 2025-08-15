const mongoose = require('mongoose');
const Product = require('./models/Product');

async function checkBarcodesInDatabase() {
  console.log('=== CHECKING BARCODES IN DATABASE ===');
  
  try {
    // Connect to test database
    const MONGO_URI = 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/test?retryWrites=true&w=majority';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to test database');
    
    // Get sample products with barcodes
    const products = await Product.find({ 
      barcode: { $exists: true, $ne: null, $ne: '' } 
    }).limit(20).select('name barcode').lean();
    
    console.log(`\n📋 Found ${products.length} products with barcodes:`);
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Barcode: ${product.barcode} (${product.barcode.length} digits)`);
      console.log(`   Type: ${product.barcode.startsWith('729') ? 'Israeli' : 'Other'}`);
      console.log('');
    });
    
    // Check barcode length distribution
    const barcodeLengths = products.map(p => p.barcode.length);
    const uniqueLengths = [...new Set(barcodeLengths)].sort((a, b) => a - b);
    
    console.log('📊 Barcode length distribution:');
    uniqueLengths.forEach(length => {
      const count = barcodeLengths.filter(l => l === length).length;
      console.log(`   ${length} digits: ${count} products`);
    });
    
    // Check Israeli barcodes (starting with 729)
    const israeliBarcodes = products.filter(p => p.barcode.startsWith('729'));
    console.log(`\n🇮🇱 Israeli barcodes (729): ${israeliBarcodes.length} products`);
    
    if (israeliBarcodes.length > 0) {
      console.log('Sample Israeli barcodes:');
      israeliBarcodes.slice(0, 5).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.barcode} - ${product.name}`);
      });
    }
    
    // Check other barcode patterns
    const otherBarcodes = products.filter(p => !p.barcode.startsWith('729'));
    console.log(`\n📦 Other barcodes: ${otherBarcodes.length} products`);
    
    if (otherBarcodes.length > 0) {
      console.log('Sample other barcodes:');
      otherBarcodes.slice(0, 5).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.barcode} - ${product.name}`);
      });
    }
    
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkBarcodesInDatabase();
