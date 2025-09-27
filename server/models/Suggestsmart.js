const mongoose = require('mongoose');

const SuggestsmartSchema = new mongoose.Schema({
  group: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Group', 
    required: true 
  },
  suggestedAt: { type: Date, default: Date.now },
  products: {
    type: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }
      }
    ],
    default: [] 
  }
}, {
  timestamps: true
});

SuggestsmartSchema.index({ group: 1 }, { unique: true });

module.exports = mongoose.model('Suggestsmart', SuggestsmartSchema);
