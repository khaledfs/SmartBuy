// server/scripts/seedSuggestions.js
const mongoose   = require('mongoose');
require('dotenv').config();           // will load server/.env
const Suggestion = require('../models/Suggestion');
const SUGGESTIONS = require('./products.json');

const run = async () => {
  console.log('→ Connecting to', process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI);
  await Suggestion.deleteMany({});
  const docs = SUGGESTIONS.map(p => ({
    name: { en: p.name },
    category: p.category,
    icon: { light: p.iconUrl, dark: p.iconUrl },
    key: p.name.toLowerCase().replace(/ /g, '_'),
    price:    p.price 
  }));
  await Suggestion.insertMany(docs);
  console.log('✅ Seeded with prices');
  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
