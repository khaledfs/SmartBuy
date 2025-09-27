const RejectedProduct = require('../models/RejectedProduct');
const Product = require('../models/Product');
const Group = require('../models/Group');
const TrainingExample = require('../models/TrainingExample');
const { extractFeaturesForProduct } = require('../services/ml/features');
const { Types } = require('mongoose');
const ProductFreq = require('../models/ProductFreq');
const Suggestsmart = require('../models/Suggestsmart');


async function recordAddAndUpdatefreq({
  barcode,            // string (preferred, but will be fetched if missing)
  groupId,            // ObjectId|string (required)
  productId = null,   // ObjectId|string (preferred)
  productname = ''    // string (optional)
}) {
  console.log('recordAddAndUpdatefreq called with:', { barcode, groupId, productId, productname });
  if (!groupId) throw new Error('groupId is required');
  if (!productId && !barcode) throw new Error('productId or barcode is required');

  // If productId present but we lack barcode/name, pull from Product
  if (productId && (!barcode || !productname)) {
    const p = await Product.findById(productId).select('barcode name').lean();
    if (p) {
      if (!barcode) barcode = p.barcode || '';
      if (!productname) productname = p.name || productname;
    }
  }

  if (!productId && barcode) {
    const p = await Product.findOne({ barcode }).select('_id name').lean();
    if (p) {
      productId = p._id;
      if (!productname) productname = p.name || productname;
    }
  }

  if (!productId) throw new Error('Unable to resolve productId');

  // Try to find existing ProductFreq record 
  let doc =
    (await ProductFreq.findOne({ product: productId, group: groupId })) ||
    (barcode ? await ProductFreq.findOne({ productbarcode: barcode, group: groupId }) : null);

  const now = new Date();

  if (!doc) {
    try {
      return await ProductFreq.create({
        productname: productname || 'Unknown',
        productbarcode: barcode || '',
        product: productId,
        group: groupId,
        addedgap: 0,
        gapCount: 0,
        totaladded: 0,
        totoalrejected: 1,
        lastRejected: now,
        createdAt: now
      });
    } catch (err) {
      if (err && err.code === 11000) {
        doc =
          (await ProductFreq.findOne({ product: productId, group: groupId })) ||
          (barcode ? await ProductFreq.findOne({ productbarcode: barcode, group: groupId }) : null);
        if (!doc) throw err;
      } else {
        throw err;
      }
    }
  }
  const updates = { $inc: { totoalrejected: 1 }, $set: { lastRejected: now } };
  if (String(doc.product) !== String(productId)) updates.$set.product = productId;
  if (barcode && doc.productbarcode !== barcode) updates.$set.productbarcode = barcode;
  if (productname && !doc.productname) updates.$set.productname = productname;
  return ProductFreq.findByIdAndUpdate(doc._id, updates, { new: true });
}

// POST /api/rejections - Reject a product suggestion
exports.rejectProduct = async (req, res) => {
  const { productId, groupId, barcode } = req.body;
  const userId = req.user?.id || req.userId;

  if (!productId || !Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid product ID' });
  }

  if (!groupId && !Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({ message: 'Invalid group ID' });
  }

  if (!productId) {
    return res.status(400).json({ message: 'Product ID is required' });
  }

  try {
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      console.log("Product not found  for rejection:", productId);
      return res.status(404).json({ message: 'Product not found' });
    }

    // If groupId provided, verify user is member
    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) {
        console.log("User not in group for rejection:", req.userId, groupId);
        return res.status(403).json({ message: 'Not authorized for this group' });
      }
    }

    // Create rejection record
    const rejection = new RejectedProduct({

      productId: productId,
      rejectedBy: req.userId,
      groupId: groupId || null
    });

    await rejection.save();

    // Feed into ML training system
    try {
      const features = await extractFeaturesForProduct(productId, req.userId, groupId);
      const featuresArray = {
        bias: 1,
        isFavorite: features.isFavorite || 0,
        addedBefore: features.addedBefore || 0,
        timesAdded: features.timesAdded || 0,
        recentlyadded: features.recentlyadded || 0,
        AddedFrequency: features.AddedFrequency || 0,
        timesRejected: features.timesRejected || 0,
      };

      await TrainingExample.create({
        userId: req.userId,
        productId: productId,
        features: featuresArray,
        label: 0 // 0 = rejected
      });
      await recordAddAndUpdatefreq({ barcode, groupId, productId }).catch(err => {
        console.log('recordAddAndUpdatefreq error:', err.message);
      })

      let suggestion = await Suggestsmart.findOne({ group: groupId });
      if (suggestion) {

        suggestion.products = suggestion.products.filter(p => p.product.toString() !== productId.toString());

        await suggestion.save({ optimisticConcurrency: false });
      }
    } catch (mlError) {
      console.error('ML training error:', mlError);
      // Don't fail the request if ML training fails
    }

    res.status(201).json({ message: 'Product rejected successfully' });
  } catch (error) {
    console.error('Error rejecting product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/rejections - Get user's rejected products
exports.getRejections = async (req, res) => {
  const { groupId } = req.query;

  try {
    const query = { rejectedBy: req.userId };
    if (groupId) {
      query.groupId = groupId;
    }

    const rejections = await RejectedProduct.find(query)
      .populate('product')
      .populate('groupId', 'name')
      .sort({ createdAt: -1 });

    res.json(rejections);
  } catch (error) {
    console.error('Error fetching rejections:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/rejections/:productId - Remove rejection (undo)
exports.removeRejection = async (req, res) => {
  const { productId } = req.params;
  const { groupId } = req.query;

  try {
    const query = {
      productId: productId,
      rejectedBy: req.userId
    };

    if (groupId) {
      query.groupId = groupId;
    }

    const rejection = await RejectedProduct.findOneAndDelete(query);

    if (!rejection) {
      return res.status(404).json({ message: 'Rejection not found' });
    }

    // Remove corresponding training example
    try {
      await TrainingExample.deleteOne({
        productId: productId,
        label: 0
      });
    } catch (mlError) {
      console.error('ML cleanup error:', mlError);
    }

    res.json({ message: 'Rejection removed successfully' });
  } catch (error) {
    console.error('Error removing rejection:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 
