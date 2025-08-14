const mongoose = require('mongoose');

const storePriceCacheSchema = new mongoose.Schema({
  city: { type: String, required: true },
  barcodes: [{ type: String, required: true }],
  results: { type: Array, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 } // 24 hours
});

storePriceCacheSchema.index({ city: 1, barcodes: 1 }, { unique: true });

module.exports = mongoose.model('StorePriceCache', storePriceCacheSchema); 