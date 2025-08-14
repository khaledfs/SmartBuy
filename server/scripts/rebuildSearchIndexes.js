const mongoose = require('mongoose');
const Product = require('../models/Product');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jimale-up');
    console.log('✅ MongoDB connected for index rebuild');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const rebuildIndexes = async () => {
  try {
    console.log('🔧 Starting index rebuild...');
    
    // Drop existing text indexes
    console.log('🗑️ Dropping existing text indexes...');
    await Product.collection.dropIndexes();
    console.log('✅ Existing indexes dropped');
    
    // Rebuild all indexes
    console.log('🔧 Rebuilding indexes...');
    await Product.syncIndexes();
    console.log('✅ Indexes rebuilt successfully');
    
    // Verify indexes
    console.log('🔍 Verifying indexes...');
    const indexes = await Product.collection.getIndexes();
    console.log('📋 Current indexes:', Object.keys(indexes));
    
    // Test search functionality
    console.log('🧪 Testing search functionality...');
    const testResults = await Product.find(
      { $text: { $search: "milk" } },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" } })
    .limit(5)
    .lean();
    
    console.log(`✅ Search test successful - found ${testResults.length} results for "milk"`);
    if (testResults.length > 0) {
      console.log('📋 Sample results:', testResults.slice(0, 3).map(p => ({ name: p.name, score: p.score })));
    }
    
    console.log('🎉 Index rebuild completed successfully!');
    
  } catch (error) {
    console.error('❌ Error rebuilding indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  connectDB().then(rebuildIndexes);
}

module.exports = { rebuildIndexes }; 