// server/scripts/diagnoseScraping.js
const mongoose = require('mongoose');
require('dotenv').config();

async function connectToDatabase() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function diagnoseScrapingIssues() {
  try {
    await connectToDatabase();
    
    const Product = require('../models/Product');
    
    console.log('🔍 DIAGNOSING SCRAPING ISSUES\n');
    
    // 1. Check total products
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products: ${totalProducts}`);
    
    // 2. Check barcode quality - simplified
    const barcodeStats = await Product.aggregate([
      {
        $group: {
          _id: {
            barcodeLength: { $strLenCP: { $ifNull: ['$barcode', ''] } },
            isEmpty: { $eq: ['$barcode', ''] }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.barcodeLength': 1 } }
    ]);
    
    console.log('\n📋 BARCODE QUALITY ANALYSIS:');
    barcodeStats.forEach(stat => {
      console.log(`   Length: ${stat._id.barcodeLength}, Empty: ${stat._id.isEmpty} → ${stat.count} products`);
    });
    
    // 3. Check for problematic barcodes
    console.log('\n🚨 PROBLEMATIC BARCODES:');
    
    // Products with empty barcodes
    const emptyBarcodes = await Product.find({ $or: [{ barcode: '' }, { barcode: null }] }).limit(5).lean();
    console.log(`\n   Empty barcodes (${emptyBarcodes.length} found):`);
    emptyBarcodes.forEach((product, i) => {
      console.log(`     ${i + 1}. "${product.name}" (Barcode: "${product.barcode}")`);
    });
    
    // Products with very short barcodes
    const shortBarcodes = await Product.find({
      barcode: { $exists: true, $ne: null, $ne: '' },
      $expr: { $lt: [{ $strLenCP: '$barcode' }, 8] }
    }).limit(5).lean();
    
    console.log(`\n   Short barcodes (< 8 chars) (${shortBarcodes.length} found):`);
    shortBarcodes.forEach((product, i) => {
      console.log(`     ${i + 1}. "${product.name}" (Barcode: "${product.barcode}")`);
    });
    
    // Products with non-numeric barcodes
    const nonNumericBarcodes = await Product.find({
      barcode: { $exists: true, $ne: null, $ne: '' },
      barcode: { $not: /^\d+$/ }
    }).limit(5).lean();
    
    console.log(`\n   Non-numeric barcodes (${nonNumericBarcodes.length} found):`);
    nonNumericBarcodes.forEach((product, i) => {
      console.log(`     ${i + 1}. "${product.name}" (Barcode: "${product.barcode}")`);
    });
    
    // 4. Test scraping compatibility with sample products
    console.log('\n🧪 TESTING SCRAPING COMPATIBILITY:');
    
    // Get sample products for testing
    const testProducts = await Product.find().limit(10).lean();
    
    testProducts.forEach((product, i) => {
      console.log(`\n   Product ${i + 1}: "${product.name}"`);
      console.log(`     Barcode: "${product.barcode}"`);
      
      // Test search strategies
      const strategies = [];
      
      // Original
      if (product.barcode) strategies.push(product.barcode);
      if (product.name) strategies.push(product.name);
      
      // Barcode variations
      if (product.barcode && /^\d+$/.test(product.barcode)) {
        if (product.barcode.length < 13) {
          strategies.push(product.barcode.padStart(13, '0'));
        }
        if (product.barcode.length === 13 && product.barcode.startsWith('0')) {
          strategies.push(product.barcode.replace(/^0+/, ''));
        }
      }
      
      // Name variations
      if (product.name && !/^\d+$/.test(product.name)) {
        const cleanName = product.name.replace(/\s+\d+.*$/, '').trim();
        if (cleanName !== product.name && cleanName.length >= 3) {
          strategies.push(cleanName);
        }
        
        const words = product.name.split(' ');
        if (words.length > 1) {
          const brandName = words[0];
          if (brandName.length >= 2) {
            strategies.push(brandName);
          }
        }
      }
      
      console.log(`     Search strategies: ${strategies.join(', ')}`);
    });
    
    // 5. Summary and recommendations
    console.log('\n📝 SUMMARY & RECOMMENDATIONS:');
    
    const emptyBarcodeCount = await Product.countDocuments({ $or: [{ barcode: '' }, { barcode: null }] });
    const shortBarcodeCount = await Product.countDocuments({
      barcode: { $exists: true, $ne: null, $ne: '' },
      $expr: { $lt: [{ $strLenCP: '$barcode' }, 8] }
    });
    const nonNumericBarcodeCount = await Product.countDocuments({
      barcode: { $exists: true, $ne: null, $ne: '' },
      barcode: { $not: /^\d+$/ }
    });
    
    console.log(`   • ${emptyBarcodeCount} products have empty barcodes`);
    console.log(`   • ${shortBarcodeCount} products have short barcodes (< 8 chars)`);
    console.log(`   • ${nonNumericBarcodeCount} products have non-numeric barcodes`);
    
    if (emptyBarcodeCount > 0) {
      console.log('   ⚠️  Empty barcodes will rely on name-based scraping only');
    }
    
    if (shortBarcodeCount > 0) {
      console.log('   ⚠️  Short barcodes may not be valid for scraping');
    }
    
    if (nonNumericBarcodeCount > 0) {
      console.log('   ⚠️  Non-numeric barcodes may not work with chp.co.il');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Diagnosis completed');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    await mongoose.disconnect();
  }
}

diagnoseScrapingIssues();
