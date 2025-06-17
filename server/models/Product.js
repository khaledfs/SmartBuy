// server/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name:     { type: String },
  barcode:      { type: Number },
  img:  { type: String },
  count:    { type: Number,  }  
});

module.exports = mongoose.model('Product', productSchema);