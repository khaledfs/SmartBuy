const fs = require('fs');
const path = require('path');

console.log('🔄 UPDATING DATABASE CONNECTION TO TEST DATABASE');
console.log('=' .repeat(50));

// Step 1: Create .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
const envTemplatePath = path.join(__dirname, 'env-template.txt');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  
  if (fs.existsSync(envTemplatePath)) {
    // Copy from template
    const templateContent = fs.readFileSync(envTemplatePath, 'utf8');
    const updatedContent = templateContent.replace(
      /MONGO_URI=.*/,
      'MONGO_URI=mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0'
    );
    fs.writeFileSync(envPath, updatedContent);
    console.log('✅ Created .env file from template');
  } else {
    // Create new .env file
    const envContent = `# MongoDB Connection String - TEST DATABASE
MONGO_URI=mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0

# JWT Secret (change this to a secure random string)
JWT_SECRET=your-super-secret-jwt-key-for-smart-buy-app-2024

# Google Maps API Key (if needed)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
`;
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created new .env file');
  }
} else {
  console.log('📝 Updating existing .env file...');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update MONGO_URI if it exists, otherwise add it
  if (envContent.includes('MONGO_URI=')) {
    envContent = envContent.replace(
      /MONGO_URI=.*/,
      'MONGO_URI=mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0'
    );
  } else {
    envContent = `MONGO_URI=mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0\n\n${envContent}`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env file');
}

// Step 2: Update server.js fallback (optional)
const serverPath = path.join(__dirname, 'server.js');
if (fs.existsSync(serverPath)) {
  console.log('📝 Checking server.js for fallback connection...');
  let serverContent = fs.readFileSync(serverPath, 'utf8');
  
  // Check if it has the old fallback
  if (serverContent.includes('ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy')) {
    console.log('⚠️  Found old fallback in server.js');
    console.log('💡 Consider updating the fallback in server.js line 67 to:');
    console.log('   mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
  } else {
    console.log('✅ server.js looks good');
  }
}

console.log('\n🎯 DATABASE UPDATE COMPLETE!');
console.log('=' .repeat(50));
console.log('✅ .env file updated with TEST database connection');
console.log('✅ MONGO_URI points to the correct database');
console.log('');
console.log('🚀 NEXT STEPS:');
console.log('1. Restart your server: npm start');
console.log('2. Check console for "Connected to MongoDB"');
console.log('3. Test with barcode: 7290110566579');
console.log('');
console.log('📊 EXPECTED IMPROVEMENTS:');
console.log('• 5,715 products (vs 60 before)');
console.log('• 5,498 Israeli barcodes (vs 12 before)');
console.log('• Better scraping results');
console.log('• Better product search');
console.log('');
console.log('🎉 Your client should see much better results now!');
