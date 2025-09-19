const mongoose = require('mongoose');

const ProductFreqSchema = new mongoose.Schema({
    productname: { type: String, required: true },
    productbarcode: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    addedgap: { type: Number, default: 0 },
    gapCount: { type: Number, default: 0 },
    totaladded: { type: Number, default: 0 },
    totoalrejected: { type: Number, default: 0 },
    lastAdded: { type: Date, default: null },
    lastRejected: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

ProductFreqSchema.index({ product: 1, group: 1 }, { unique: true });
ProductFreqSchema.index({ productbarcode: 1, group: 1 }, { unique: true });

module.exports = mongoose.model('ProductFreq', ProductFreqSchema);
