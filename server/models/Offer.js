const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product',      required: true },
  supermarket: { type: mongoose.Schema.Types.ObjectId, ref: 'Supermarket',  required: true },
  price:       { type: Number,                          required: true },
  createdAt:   { type: Date,                            default: Date.now }
});

module.exports = mongoose.model('Offer', offerSchema);
