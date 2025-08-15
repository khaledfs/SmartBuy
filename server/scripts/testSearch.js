const mongoose = require('mongoose');
const Product = require('../models/Product');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jimale-up');
    console.log('✅ MongoDB connected for search testing');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const testSearch = async () => {
  try {
    console.log('🧪 Testing search functionality...');
    
    // Test queries
    const testQueries = [
      'milk',
      'bread',
      'apple',
      'chicken',
      'rice',
      'water',
      'cheese',
      'yogurt'
    ];
    
    for (const query of testQueries) {
      console.log(`\n🔍 Testing search for: "${query}"`);
      
      // Test text search
      try {
        const textResults = await Product.find(
          { $text: { $search: query } },
          { score: { $meta: "textScore" } }
        )
        .sort({ score: { $meta: "textScore" } })
        .limit(10)
        .lean();
        
        console.log(`  📊 Text search: ${textResults.length} results`);
        if (textResults.length > 0) {
          console.log(`  📋 Top 3 results:`, textResults.slice(0, 3).map(p => ({ 
            name: p.name, 
            category: p.category,
            score: p.score 
          })));
        }
      } catch (error) {
        console.log(`  ❌ Text search failed: ${error.message}`);
      }
      
      // Test regex search
      try {
        const regexResults = await Product.find({
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { category: { $regex: query, $options: 'i' } },
            { brand: { $regex: query, $options: 'i' } }
          ]
        })
        .limit(10)
        .lean();
        
        console.log(`  📊 Regex search: ${regexResults.length} results`);
        if (regexResults.length > 0) {
          console.log(`  📋 Top 3 results:`, regexResults.slice(0, 3).map(p => ({ 
            name: p.name, 
            category: p.category
          })));
        }
      } catch (error) {
        console.log(`  ❌ Regex search failed: ${error.message}`);
      }
    }
    
    // Test total product count
    const totalProducts = await Product.countDocuments();
    console.log(`\n📊 Total products in database: ${totalProducts}`);
    
    console.log('\n🎉 Search testing completed!');
    
  } catch (error) {
    console.error('❌ Error during search testing:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  connectDB().then(testSearch);
}

module.exports = { testSearch }; 