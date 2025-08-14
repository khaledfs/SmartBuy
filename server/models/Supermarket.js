// server/models/Supermarket.js
const mongoose = require('mongoose');

const supermarketSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true },
  address:     { type: String },
  location:    {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number], // [ longitude, latitude ]
  }
});
supermarketSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Supermarket', supermarketSchema);
