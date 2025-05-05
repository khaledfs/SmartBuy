// server/scripts/seedProducts.js
require('dotenv').config();
const mongoose = require('mongoose');
const Product  = require('../models/Product');
const data     = require('./products.json');  
// products.json is an array of { name, iconUrl, category }

;(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🗑 Clearing products…');
  await Product.deleteMany({});
  console.log(`📥 Inserting ${data.length} products…`);
  await Product.insertMany(data);
  console.log('✅ Done.');
  process.exit();
})();
