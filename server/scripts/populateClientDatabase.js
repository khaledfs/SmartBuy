const mongoose = require('mongoose');
const Product = require('../models/Product');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// MongoDB connection with longer timeout
const MONGODB_URI = process.env.MONGO_URI || 'mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/smartbuy?retryWrites=true&w=majority&appName=Cluster0';

async function connectToDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000 // 45 seconds
    });
    console.log('✅ Connected to MongoDB successfully!');
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Load products from products_safe_updated.json
function loadProducts() {
  try {
    const productsPath = path.resolve(__dirname, 'products_safe_updated.json');
    
    if (!fs.existsSync(productsPath)) {
      console.error('❌ products_safe_updated.json not found!');
      console.log('Expected file: ' + productsPath);
      return null;
    }
    
    const data = fs.readFileSync(productsPath, 'utf-8');
    const products = JSON.parse(data);
    console.log(`✅ Loaded ${products.length} products from products_safe_updated.json`);
    return products;
  } catch (error) {
    console.error('❌ Error loading products:', error);
    return null;
  }
}

// Populate database
async function populateDatabase() {
  try {
    console.log('🚀 STARTING DATABASE POPULATION');
    console.log('=' .repeat(50));
    
    // Connect to database
    await connectToDatabase();
    
    // Load products
    const products = loadProducts();
    if (!products) {
      return;
    }
    
    // Check current state
    console.log('\n📊 Checking current database state...');
    const currentCount = await Product.countDocuments();
    console.log(`📦 Current products in database: ${currentCount}`);
    
    if (currentCount > 0) {
      console.log('⚠️  Database already has products. Clearing existing data...');
      await Product.deleteMany({});
      console.log('✅ Cleared existing products');
    }
    
    // Prepare products for insertion
    console.log('\n📥 Preparing products for insertion...');
    const productsToInsert = products.map(product => ({
      name: product.name,
      barcode: product.barcode,
      img: product.img,
      count: product.count || 0,
      brand: product.brand || '',
      manufacturer: product.manufacturer || '',
      updateDate: product.updateDate || new Date(),
      source: product.source || 'client_population'
    }));
    
    // Insert products in batches
    console.log('\n📥 Inserting products...');
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < productsToInsert.length; i += batchSize) {
      const batch = productsToInsert.slice(i, i + batchSize);
      await Product.insertMany(batch);
      insertedCount += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(productsToInsert.length/batchSize)} (${insertedCount}/${productsToInsert.length} products)`);
    }
    
    // Verify insertion
    console.log('\n🔍 Verifying insertion...');
    const finalCount = await Product.countDocuments();
    console.log(`📊 Total products in database: ${finalCount}`);
    
    // Show sample products
    const sampleProducts = await Product.find().limit(5).lean();
    console.log('\n📋 Sample products:');
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (Barcode: ${product.barcode})`);
    });
    
    console.log('\n🎉 DATABASE POPULATION COMPLETED SUCCESSFULLY!');
    console.log(`✅ ${finalCount} products are now available in the database`);
    
  } catch (error) {
    console.error('❌ Error populating database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the population
populateDatabase();
