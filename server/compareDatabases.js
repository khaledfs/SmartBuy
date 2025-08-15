const mongoose = require('mongoose');
const Product = require('./models/Product');

async function compareDatabases() {
  console.log('=== COMPARING DATABASES ===');
  
  const connectionStrings = {
    'no-database': 'mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    'smartbuy': 'mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/smartbuy?retryWrites=true&w=majority&appName=Cluster0',
    'test': 'mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0'
  };
  
  for (const [dbName, uri] of Object.entries(connectionStrings)) {
    console.log(`\n🔍 CHECKING ${dbName.toUpperCase()} DATABASE`);
    console.log('=' .repeat(50));
    
    try {
      await mongoose.connect(uri);
      console.log(`✅ Connected to ${dbName} database`);
      
      // Check database name
      const actualDbName = mongoose.connection.db.databaseName;
      console.log(`🗄️  Actual database name: ${actualDbName}`);
      
      // Check total products
      const totalProducts = await Product.countDocuments();
      console.log(`📊 Total products: ${totalProducts}`);
      
      if (totalProducts > 0) {
        // Check products with barcodes
        const productsWithBarcodes = await Product.countDocuments({ 
          barcode: { $exists: true, $ne: null, $ne: '' } 
        });
        console.log(`📦 Products with barcodes: ${productsWithBarcodes}`);
        
        // Check products with images
        const productsWithImages = await Product.countDocuments({ 
          img: { $exists: true, $ne: null, $ne: '', $ne: 'https://via.placeholder.com/100' } 
        });
        console.log(`🖼️  Products with valid images: ${productsWithImages}`);
        
        // Get sample products
        const sampleProducts = await Product.find().limit(3).select('name barcode img source').lean();
        
        console.log('\n📋 Sample products:');
        sampleProducts.forEach((product, index) => {
          console.log(`${index + 1}. ${product.name}`);
          console.log(`   Barcode: ${product.barcode || 'No barcode'}`);
          console.log(`   Source: ${product.source || 'No source'}`);
          console.log(`   Has image: ${product.img ? 'Yes' : 'No'}`);
          console.log('');
        });
        
        // Check collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`📚 Collections: ${collections.map(c => c.name).join(', ')}`);
        
        // Check if this database has prediction/ML data
        const hasMLCollections = collections.some(c => 
          c.name.includes('prediction') || 
          c.name.includes('ml') || 
          c.name.includes('model') ||
          c.name.includes('weights') ||
          c.name.includes('training')
        );
        console.log(`🤖 Has ML/Prediction collections: ${hasMLCollections ? 'Yes' : 'No'}`);
        
      } else {
        console.log('❌ Database is empty');
      }
      
      await mongoose.disconnect();
      console.log(`🔌 Disconnected from ${dbName} database`);
      
    } catch (error) {
      console.error(`❌ Error checking ${dbName} database:`, error.message);
    }
  }
  
  console.log('\n🎯 RECOMMENDATION:');
  console.log('Based on the results above, you should use the database that has:');
  console.log('✅ Most products with barcodes');
  console.log('✅ Most products with valid images');
  console.log('✅ ML/Prediction collections (if you need smart predictions)');
  console.log('✅ The right source data for your client');
}

compareDatabases();
