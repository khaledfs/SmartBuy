const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Check current products in database
async function checkDatabase() {
  try {
    await connectToDatabase();
    
    const Product = require('../models/Product');
    
    // Get total count
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}`);
    
    // Get sample products
    const sampleProducts = await Product.find().limit(10).lean();
    console.log('\n📋 Sample products in database:');
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (Barcode: ${product.barcode})`);
    });
    
    // Check products with images
    const productsWithImages = await Product.countDocuments({
      img: { $exists: true, $ne: null, $ne: '' }
    });
    console.log(`\n🖼️  Products with images: ${productsWithImages}`);
    
    // Check products without images
    const productsWithoutImages = await Product.countDocuments({
      $or: [
        { img: { $exists: false } },
        { img: null },
        { img: '' }
      ]
    });
    console.log(`❌ Products without images: ${productsWithoutImages}`);
    
    // Check barcode patterns
    const barcodeStats = await Product.aggregate([
      {
        $group: {
          _id: { $substr: ['$barcode', 0, 1] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📊 Barcode patterns:');
    barcodeStats.forEach(stat => {
      console.log(`   Starting with '${stat._id}': ${stat.count} products`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Database check completed');
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
    await mongoose.disconnect();
  }
}

// Run the check
checkDatabase(); 