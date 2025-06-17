const mongoose = require('mongoose');

const purchaseHistorySchema = new mongoose.Schema({
  name:       { type: String, required: true },
  product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity:   { type: Number, required: true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  boughtAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('PurchaseHistory', purchaseHistorySchema);
