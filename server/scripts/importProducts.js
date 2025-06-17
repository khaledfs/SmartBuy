// scripts/importProducts.js
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');

const MONGO_URI = 'mongodb://localhost:27017/smartbuy'; // Update if different
const DATA_FILE = path.join(__dirname, '../models/Data.json');

async function importProducts() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  try {
    const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
    const jsonData = JSON.parse(rawData);

    const validProducts = jsonData.filter(
      (p) => p.barcode !== undefined && p.barcode !== null
    );

    const inserted = [];
    for (const p of validProducts) {
      try {
        await Product.updateOne(
          { barcode: p.barcode }, // use barcode as unique identifier
          {
            $setOnInsert: {
              name: p.name,
              barcode: p.barcode,
              img: p.img,
              count: p.count ?? 1
            }
          },
          { upsert: true }
        );
        inserted.push(p.barcode);
      } catch (err) {
        console.warn(`Skipped barcode ${p.barcode}: ${err.message}`);
      }
    }

    console.log(`✔ Imported ${inserted.length} new products`);
  } catch (err) {
    console.error('❌ Error reading or inserting data:', err.message);
  }

  await mongoose.disconnect();
  console.log('Disconnected');
}

importProducts();
