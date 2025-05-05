// server/scripts/seedSupermarkets.js
require('dotenv').config();
const mongoose     = require('mongoose');
const Supermarket  = require('../models/Supermarket');
const list          = require('./supermarkets.json');
// supermarkets.json: [ { name, address }, … ]

;(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🗑 Clearing supermarkets…');
  await Supermarket.deleteMany({});
  console.log(`📥 Inserting ${list.length} supermarkets…`);
  await Supermarket.insertMany(list);
  console.log('✅ Done.');
  process.exit();
})();
