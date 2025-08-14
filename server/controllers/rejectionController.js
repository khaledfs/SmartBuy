const RejectedProduct = require('../models/RejectedProduct');
const Product = require('../models/Product');
const Group = require('../models/Group');
const TrainingExample = require('../models/TrainingExample');
const { extractFeaturesForProduct } = require('../services/ml/features');

// POST /api/rejections - Reject a product suggestion
exports.rejectProduct = async (req, res) => {
  const { productId, groupId } = req.body;

  if (!productId) {
    return res.status(400).json({ message: 'Product ID is required' });
  }

  try {
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // If groupId provided, verify user is member
    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group || !group.members.includes(req.userId)) {
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
      const featuresArray = [
        1, // bias term
        features.isFavorite || 0,
        features.purchasedBefore || 0,
        features.timesPurchased || 0,
        features.recentlyPurchased || 0,
        features.timesWasRejectedByUser || 0,
        features.timesWasRejectedByGroup || 0,
        features.groupPopularity || 0,
        features.priceScore || 0,
        features.categoryPopularity || 0
      ];

      await TrainingExample.create({
        productId: productId,
        features: featuresArray,
        label: 0 // 0 = rejected
      });
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