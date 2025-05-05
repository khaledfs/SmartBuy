// server/scripts/seedOffers.js
require('dotenv').config();
const mongoose    = require('mongoose');
const Offer       = require('../models/Offer');
const Product     = require('../models/Product');
const Supermarket = require('../models/Supermarket');
const offers      = require('./offers.json');
// offers.json: [ { productName, supermarketName, price }, … ]

;(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🗑 Clearing offers…');
  await Offer.deleteMany({});

  for (let { productName, supermarketName, price } of offers) {
    const product     = await Product.findOne({ name: productName });
    const supermarket = await Supermarket.findOne({ name: supermarketName });
    if (product && supermarket) {
      await Offer.create({
        product:     product._id,
        supermarket: supermarket._id,
        price
      });
    }
  }

  console.log('✅ Done.');
  process.exit();
})();
