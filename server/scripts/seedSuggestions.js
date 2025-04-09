// scripts/seedSuggestions.js
const mongoose = require('mongoose');
const Suggestion = require('../models/Suggestion');

const SUGGESTIONS = {
  'Cleaning Equipment': [
    { label: 'Broom', icon: 'https://img.icons8.com/?size=100&id=116707&format=png&color=000000' },
    { label: 'Detergent', icon: 'https://img.icons8.com/?size=100&id=3YZRvSb66SaF&format=png&color=000000' },
    { label: 'Sponge', icon: 'https://img.icons8.com/?size=100&id=uibV0dBxFsJa&format=png&color=000000' },
    { label: 'Glass Cleaner', icon: 'https://img.icons8.com/?size=100&id=fvKgFVN2XKu1&format=png&color=000000' },
  ],
  'Meat & Fish': [
    { label: 'Chicken', icon: 'https://img.icons8.com/?size=100&id=101707&format=png&color=000000' },
    { label: 'Salmon', icon: 'https://img.icons8.com/?size=100&id=RqlLQZrW8PFf&format=png&color=000000' },
    { label: 'Beef', icon: 'https://img.icons8.com/?size=100&id=70448&format=png&color=000000' },
    { label: 'Shrimp', icon: 'https://img.icons8.com/?size=100&id=rm2ULHn0Cvt9&format=png&color=000000' },
  ],
  'Milk & Eggs': [
    { label: 'Milk', icon: 'https://img.icons8.com/?size=100&id=NjN1tSA0Isfp&format=png&color=000000' },
    { label: 'Eggs', icon: 'https://img.icons8.com/?size=100&id=80533&format=png&color=000000' },
    { label: 'Yogurt', icon: 'https://img.icons8.com/?size=100&id=yBiUcz9I4Ypl&format=png&color=000000' },
    { label: 'Cheese', icon: 'https://img.icons8.com/?size=100&id=LSRddz1lzJP7&format=png&color=000000' },
  ],
};

const run = async () => {
  await mongoose.connect('mongodb://localhost:27017/smartbuy');

  const formatted = [];
  for (const [category, items] of Object.entries(SUGGESTIONS)) {
    for (const item of items) {
      formatted.push({
        name: { en: item.label },
        category,
        icon: { light: item.icon, dark: item.icon },
        key: item.label.toLowerCase().replace(/ /g, '_'),
      });
    }
  }

  await Suggestion.deleteMany({});
  await Suggestion.insertMany(formatted);
  console.log('✅ Suggestions seeded');
  process.exit();
};

run();
