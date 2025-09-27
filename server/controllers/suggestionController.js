const Product = require('../models/Product');
const ProductFreq = require('../models/ProductFreq');
const ProductHistory = require('../models/ProductHistory');
const UserFavorites = require('../models/UserFavorites');
const RejectedProduct = require('../models/RejectedProduct');
const Suggestsmart = require('../models/Suggestsmart');
const { rankProducts } = require('../services/ml/predictPurchases')
const { Types } = require('mongoose');
const IntelligentFrequencyService = require('../services/intelligentFrequency');
const fs = require('fs');
const path = require('path');

const { extractFeaturesForProduct } = require('../services/ml/features');

const PurchaseHistory = require('../models/PurchaseHistory');
const Group = require('../models/Group');


// Simple cache for products.json
let productsCache = null;
let productsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for smart suggestions
let suggestionsCache = new Map();
const SUGGESTIONS_CACHE_DURATION = 0;

// Function to clear cache for a specific user/group
function clearSuggestionsCache(userId, groupId) {
  const keysToDelete = [];
  for (const [key, value] of suggestionsCache.entries()) {
    if (key.includes(userId) || key.includes(groupId)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => suggestionsCache.delete(key));
  console.log(`🗑️ Cleared ${keysToDelete.length} cache entries for user: ${userId}, group: ${groupId}`);
}

// Get products from products.json with caching


// Helper to ensure a valid image URL
function getValidImage(img) {
  if (typeof img === 'string' && img.trim() && (img.startsWith('http') || img.startsWith('data:image/'))) {
    return img;
  }
  return 'https://via.placeholder.com/100';
}

async function getTopRankedItems(groupId, userId, limit = 20) {
  // Get top products
  const topAllTime = await getTopProductsAllTime(limit);
  const topRecent = await getRec(groupId, limit);
  const topFavorites = await getFavorites(groupId, limit);

  // Merge all items into one map by productId to avoid duplicates
  const mergedMap = new Map();
  [...topAllTime, ...topRecent, ...topFavorites].forEach(product => {
    if (!mergedMap.has(product.productId.toString())) {
      mergedMap.set(product.productId.toString(), product);
    }
  });
  // Extract features and prepare for ranking
  const productFeatureMap = new Map();
  // For each unique product, extract features
  for (const [productId, product] of mergedMap.entries()) {

    const features = await extractFeaturesForProduct(productId, userId, groupId);

    productFeatureMap.set(productId, {
      ...product,
      bias: 1,
      isFavorite: features.isFavorite || 0,
      addedBefore: features.addedBefore || 0,
      timesAdded: features.timesAdded || 0,
      recentlyadded: features.recentlyadded || 0,
      AddedFrequency: features.AddedFrequency || 0,
      timesRejected: features.timesRejected || 0,
    });
  }

  const rankedProducts = await rankProducts(productFeatureMap);

  return rankedProducts.slice(0, limit); // Return only top 'limit' products
}


async function getTopProductsAllTime(limit = 20) {
  try {
    const pipeline = [
      { $match: { product: { $ne: null } } },
      {
        $group: {
          _id: '$product',
          totalAdded: { $sum: { $ifNull: ['$totaladded', 0] } },
          lastAdded: { $max: '$lastAdded' }
        }
      },
      { $sort: { totalAdded: -1, lastAdded: -1, _id: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          name: '$product.name',
          img: '$product.img',
          barcode: '$product.barcode',
          totalAdded: 1,
          lastAdded: 1
        }
      }
    ];

    const rows = await ProductFreq.aggregate(pipeline, { allowDiskUse: true });

    // normalize to suggestions format
    return rows.map(r => ({
      productId: r.productId,
      name: r.name || 'Unknown Product',
      img: getValidImage(r.img),
      barcode: r.barcode || '',
      type: 'SmartShop',          // label for your card
      score: r.totalAdded || 0,   // you can display/sort by this on UI
      frequency: r.totalAdded || 0,
      lastAdded: r.lastAdded || null
    }));
  } catch (err) {
    console.error('Error in getTopProductsAllTime:', err);
    return [];
  }
}


async function getSuggestions(groupId, userId, limitNum = 20) {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  let suggestion = await Suggestsmart.findOne({ group: groupId });

  if (!suggestion || suggestion.suggestedAt < oneDayAgo || suggestion.products.length === 0) {
    const newProducts = await getTopRankedItems(groupId, userId, limitNum);

    const productsToSave = newProducts.map(p => ({
      product: p.productId
    }));
    if (!suggestion) {
      suggestion = new Suggestsmart({
        group: groupId,
        products: productsToSave
      });
    } else {
      suggestion.products = productsToSave;
      suggestion.suggestedAt = new Date();
    }

    await suggestion.save();

    return newProducts.map(p => ({
      productId: p.productId,
      name: p.name,
      img: p.img,
      barcode: p.barcode,
      type: "SmartShop"
    }));
  } else {

    await suggestion.populate('products.product');

    return suggestion.products.map(p => ({
      productId: p.product._id,
      name: p.product.name,
      img: p.product.img,
      barcode: p.product.barcode,
      type: "SmartShop"
    }));
  }
}
async function getRec(groupId, limit = 20) {
  const limitNum = parseInt(limit, 10) || 20;
  try {
    const group = await Group.findById(groupId).lean();
    if (!group) return [];

    const recentItems = await PurchaseHistory.aggregate([
      { $match: { group: group._id } },
      { $sort: { boughtAt: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'purchasehistories',
          let: { lastBoughtAt: '$boughtAt' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$group', group._id] },
                    { $eq: ['$boughtAt', '$$lastBoughtAt'] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: limitNum }
          ],
          as: 'recentItems'
        }
      },
      { $unwind: '$recentItems' },
      { $replaceRoot: { newRoot: '$recentItems' } },
      {
        $addFields: {
          productObjId: {
            $cond: [
              { $eq: [{ $type: '$product' }, 'string'] },
              { $toObjectId: '$product' },
              '$product'
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'products',
          let: { pid: '$productObjId', pname: { $ifNull: ['$name', null] } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [{ $ne: ['$$pid', null] }, { $eq: ['$_id', '$$pid'] }] },
                    {
                      $and: [
                        { $ne: ['$$pname', null] },
                        { $eq: [{ $toLower: '$name' }, { $toLower: '$$pname' }] }
                      ]
                    }
                  ]
                }
              }
            },
            { $project: { _id: 1, name: 1, img: 1, barcode: 1 } },
            { $limit: 1 }
          ],
          as: 'productDetails'
        }
      },
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: {
            $ifNull: ['$productDetails._id', { $ifNull: ['$productObjId', '$product'] }]
          },
          name: { $ifNull: ['$name', '$productDetails.name'] },
          img: { $ifNull: ['$img', '$productDetails.img'] },
          barcode: '$productDetails.barcode',
          quantity: { $ifNull: ['$quantity', 1] },
          boughtAt: '$boughtAt',
          type: { $literal: 'recent' }
        }
      }
    ]);

    return recentItems
      .filter(item => item.name && getValidImage(item.img) && item.img !== 'https://via.placeholder.com/100')
      .map(item => ({
        ...item,
        img: getValidImage(item.img),
        tripDate: new Date(item.boughtAt).toLocaleDateString()
      }));
  } catch (error) {
    console.error('Error fetching recent items:', error);
    return [];
  }
}

// Get favorite products for a group, limit default 20
async function getFavorites(groupId, limit = 20) {
  const limitNum = parseInt(limit, 10) || 20;

  try {
    const group = await Group.findById(groupId).lean();
    if (!group) return [];

    const groupFavorites = await UserFavorites.find({ groupId: group._id }).limit(limitNum);
    if (!groupFavorites.length) return [];

    const productIds = groupFavorites.map(fav => fav.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    return products.map(product => ({
      productId: product._id,
      name: product.name || 'Unknown Product',
      img: getValidImage(product.img),
      barcode: product.barcode || '',
      type: 'favorite'
    }));
  } catch (error) {
    console.error('Error fetching favorite items:', error);
    return [];
  }
}
// Get smart suggestions - OPTIMIZED VERSION with caching
exports.getSmartSuggestions = async (req, res) => {
  try {
    const { type, limit = 20, groupId } = req.query;
    const limitNum = parseInt(limit, 10) || 20;
    const userId = req.user?.id;

    // Check cache first
    const cacheKey = `${type}-${groupId}-${limitNum}-${userId}`;
    const cached = suggestionsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < SUGGESTIONS_CACHE_DURATION) {
      console.log(`📦 Smart suggestions cache hit for: ${type}`);
      return res.json({
        success: true,
        suggestions: cached.data
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authe'
      });
    }

    let suggestions = [];

    if (type === 'all') {


      const offset = parseInt(req.query.offset) || 0;

      // For infinite scroll, use a simpler approach that always returns products
      const totalCount = await Product.countDocuments();


      // Use a simple approach: always sample more than we need to ensure we get enough products
      const sampleSize = Math.min(limitNum * 3, totalCount); // Sample 3x what we need

      // First try to get products with valid images
      let products = await Product.aggregate([
        {
          $match: {
            img: { $exists: true, $ne: null, $ne: '', $ne: 'https://via.placeholder.com/100' }
          }
        },
        { $sample: { size: sampleSize } },
        { $limit: limitNum },
        {
          $project: {
            _id: 1,
            name: 1,
            img: 1,
            barcode: 1
          }
        }
      ]);

      // If we don't have enough products with images, get more from all products
      if (products.length < limitNum) {
        const remainingNeeded = limitNum - products.length;
        const additionalProducts = await Product.aggregate([
          { $sample: { size: remainingNeeded * 2 } },
          { $limit: remainingNeeded },
          {
            $project: {
              _id: 1,
              name: 1,
              img: 1,
              barcode: 1
            }
          }
        ]);
        products = [...products, ...additionalProducts];
      }


      // If we got less than requested, it means we're running out of products
      // But since we have 5715 products, this shouldn't happen for a while
      if (products.length < limitNum) {
        console.log(`📦 ALL card: WARNING - Got ${products.length} products, less than requested ${limitNum}`);
      }


      suggestions = products.map(product => ({
        productId: product._id,
        name: product.name || 'Unknown Product',
        img: getValidImage(product.img),
        barcode: product.barcode || '',
        type: 'all',
        score: 1,
        frequency: 1
      }));
      suggestions.map(s => console.log(s.productId + " " + s.name + " " + " " + s.type + " " + s.score + " " + s.frequency))
    } else if (type === 'recent') {
      suggestions = await getRec(groupId);
    } else if (type === 'favorite') {
      suggestions = await getFavorites(groupId);
    } else if (type === 'SmartShop') {
      const Group = require('../models/Group');
      const PurchaseHistory = require('../models/PurchaseHistory');
      const UserFavorites = require('../models/UserFavorites');

      try {
        const group = await Group.findById(groupId).lean();
        if (!group) {
          suggestions = [];
        } else {

          suggestions = await getSuggestions(groupId, userId);
        }
      } catch (error) {
        console.error('Error fetching smart items:', error);
        suggestions = [];
      }
    } else {
      // Fallback: random product IDs
      const shuffled = allProducts.sort(() => Math.random() - 0.5);
      suggestions = shuffled.slice(0, limitNum).map(product => ({
        productId: product._id || product.productId,
        barcode: product.barcode || '',
        type: 'all'
      }));
    }

    // Cache the results
    suggestionsCache.set(cacheKey, {
      data: suggestions,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      suggestions: suggestions
    });
  } catch (error) {
    console.error('Error getting smart suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get smart suggestions'
    });
  }
};








// Track product interaction for suggestions
exports.trackProductInteraction = async (req, res) => {
  try {
    const { productId, action, listId, groupId, quantity = 1, metadata = {} } = req.body;
    const userId = req.user.id;

    // Save product history with string productId
    const productHistory = new ProductHistory({
      userId,
      productId: productId, // Keep as string
      listId,
      action,
      quantity,
      metadata
    });

    await productHistory.save();

    // Update intelligent frequency tracking for household
    if (groupId) {
      try {
        await IntelligentFrequencyService.updateHouseholdFrequency(groupId, productId, action, userId, {
          listId,
          quantity,
          timestamp: new Date(),
          ...metadata
        });
      } catch (freqError) {
        console.error('Error updating household frequency tracking:', freqError);
        // Don't fail the request if frequency tracking fails
      }
    }

    res.json({
      success: true,
      message: 'Product interaction tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking product interaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track product interaction'
    });
  }
};

// Mark product as purchased (essential for intelligent frequency predictions)
exports.markAsPurchased = async (req, res) => {
  try {
    const { productId, listId, groupId, quantity = 1, price, store, metadata = {} } = req.body;
    const userId = req.user.id;

    // Save purchase history with string productId
    const productHistory = new ProductHistory({
      userId,
      productId: productId, // Keep as string
      listId,
      action: 'purchased',
      quantity,
      metadata: {
        ...metadata,
        purchasedAt: new Date(),
        price,
        store
      }
    });

    await productHistory.save();

    // Update intelligent frequency tracking for household
    if (groupId) {
      try {
        await IntelligentFrequencyService.updateHouseholdFrequency(groupId, productId, 'purchased', userId, {
          listId,
          quantity,
          price,
          store,
          timestamp: new Date(),
          ...metadata
        });
      } catch (freqError) {
        console.error('Error updating household frequency tracking for purchase:', freqError);
      }

      // Emit socket event to notify all group members about the new purchase
      const io = req.app.get('io');
      if (io) {
        const purchaseEvent = {
          groupId: groupId,
          productId: productId.toString(),
          userId: userId,
          action: 'productPurchased',
          quantity: quantity,
          price: price,
          store: store,
          timestamp: Date.now()
        };

        io.to(groupId).emit('suggestionUpdate', purchaseEvent);
      }
    }

    res.json({
      success: true,
      message: 'Product marked as purchased successfully'
    });

  } catch (error) {
    console.error('Error marking product as purchased:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark product as purchased'
    });
  }
};

// Add product to favorites
exports.addToFavorites = async (req, res) => {
  try {
    const { productId, groupId } = req.body;

    // Reduced logging for better performance
    console.log('🔍 addToFavorites called for product:', productId);
    const userId = req.user?.id;

    if (!userId) {
      console.error('❌ No user ID found in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!productId) {
      console.error('❌ No product ID provided');
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    if (!groupId) {
      console.error('❌ No group ID provided');
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    // OPTIMIZED: Skip expensive validations for better performance
    // Only validate if we're in debug mode or if the request fails
    const isDebugMode = process.env.NODE_ENV === 'development';

    if (isDebugMode) {
      // Validate that the group exists (only in debug mode)
      try {
        const Group = require('../models/Group');
        const group = await Group.findById(groupId);
        if (!group) {
          console.error('❌ Group not found:', groupId);
          return res.status(404).json({
            success: false,
            message: 'Group not found'
          });
        }
      } catch (groupError) {
        console.error('❌ Error validating group:', groupError);
        return res.status(400).json({
          success: false,
          message: 'Invalid group ID'
        });
      }

      // Validate that the product exists (only in debug mode)
      try {
        const product = await Product.findById(productId);
        if (!product) {
          console.error('❌ Product not found:', productId);
          return res.status(404).json({
            success: false,
            message: 'Product not found'
          });
        }
      } catch (productError) {
        console.error('❌ Error validating product:', productError);
        return res.status(400).json({
          success: false,
          message: 'Invalid product ID'
        });
      }
    }


    try {
      // Check if favorite already exists
      const existingFavorite = await UserFavorites.findOne({
        userId,
        groupId,
        productId: productId.toString() // Ensure it's a string
      });

      if (existingFavorite) {
        console.log('⚠️  Favorite already exists');
        return res.json({
          success: true,
          message: 'Product is already in favorites'
        });
      }

      // Create new favorite
      const newFavorite = await UserFavorites.create({
        userId,
        groupId,
        productId: productId.toString() // Ensure it's a string
      });

      console.log('✅ Favorite created successfully:', newFavorite._id);

      // Clear cache to ensure fresh data is fetched
      clearSuggestionsCache(userId, groupId);

      // Emit socket event to notify all group members about the new favorite
      const io = req.app.get('io');
      if (io) {
        const favoriteEvent = {
          groupId: groupId,
          productId: productId.toString(),
          userId: userId,
          action: 'favoriteAdded',
          timestamp: Date.now()
        };

        io.to(groupId).emit('suggestionUpdate', favoriteEvent);
      }

      res.json({
        success: true,
        message: 'Product added to favorites',
        favoriteId: newFavorite._id
      });
    } catch (error) {
      console.error('❌ Error creating favorite:', error);
      if (error.code === 11000) {
        console.log('⚠️  Duplicate key error - product already favorited');
        res.json({
          success: true,
          message: 'Product is already in favorites'
        });
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Error adding to favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add to favorites',
      error: error.message
    });
  }
};

// Remove product from favorites
exports.removeFromFavorites = async (req, res) => {
  try {
    const { productId, groupId } = req.body;

    // Reduced logging for better performance
    console.log('🔍 removeFromFavorites called for product:', productId);
    const userId = req.user?.id;

    if (!userId) {
      console.error('❌ No user ID found in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!productId) {
      console.error('❌ No product ID provided');
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    if (!groupId) {
      console.error('❌ No group ID provided');
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }


    const result = await UserFavorites.deleteOne({
      userId,
      groupId,
      productId: productId.toString() // Ensure it's a string
    });

    console.log('✅ Deleted:', result);

    if (result.deletedCount === 0) {
      console.log('⚠️  No favorite found to delete');
      return res.status(404).json({
        success: false,
        message: 'Product not found in favorites'
      });
    }

    console.log('✅ Favorite removed successfully');

    // Clear cache to ensure fresh data is fetched
    clearSuggestionsCache(userId, groupId);

    // Emit socket event to notify all group members about the removed favorite
    const io = req.app.get('io');
    if (io) {
      const favoriteEvent = {
        groupId: groupId,
        productId: productId.toString(),
        userId: userId,
        action: 'favoriteRemoved',
        timestamp: Date.now()
      };

      io.to(groupId).emit('suggestionUpdate', favoriteEvent);
    }

    res.json({
      success: true,
      message: 'Product removed from favorites'
    });

  } catch (error) {
    console.error('❌ Error removing from favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove from favorites',
      error: error.message
    });
  }
};

// Check if product is favorited
exports.checkFavoriteStatus = async (req, res) => {
  try {
    const { productId } = req.params;

    // Reduced logging for better performance
    console.log('🔍 checkFavoriteStatus called for product:', productId);
    const { groupId } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      console.error('❌ No user ID found in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!productId) {
      console.error('❌ No product ID provided');
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    if (!groupId) {
      console.error('❌ No group ID provided');
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    console.log('✅ Checking group favorite status with:', { groupId, productId });

    const favorite = await UserFavorites.findOne({
      groupId,
      productId: productId.toString() // Check if ANY group member favorited this
    });

    console.log('✅ Group favorite check result:', !!favorite);

    res.json({
      success: true,
      isFavorited: !!favorite
    });

  } catch (error) {
    console.error('❌ Error checking favorite status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check favorite status',
      error: error.message
    });
  }
};

// ML Model Management (admin endpoints)
exports.trainMLModel = async (req, res) => {
  try {
    // For now, return a placeholder response
    // In a real implementation, this would trigger ML model training
    res.json({
      success: true,
      message: 'ML model training initiated (placeholder)',
      status: 'pending',
      estimatedTime: '5-10 minutes'
    });
  } catch (error) {
    console.error('Error training ML model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to train ML model'
    });
  }
};

exports.getFeatureImportance = async (req, res) => {
  try {
    // For now, return placeholder feature importance data
    // In a real implementation, this would return actual ML feature importance
    res.json({
      success: true,
      features: [
        { name: 'purchase_frequency', importance: 0.85 },
        { name: 'time_since_last_purchase', importance: 0.72 },
        { name: 'household_size', importance: 0.68 },
        { name: 'seasonal_patterns', importance: 0.54 },
        { name: 'price_sensitivity', importance: 0.48 }
      ],
      modelVersion: '1.0.0',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting feature importance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feature importance'
    });
  }
};


// Export getValidImage function for use in other modules
module.exports = {
  getSmartSuggestions: exports.getSmartSuggestions,
  addToFavorites: exports.addToFavorites,
  removeFromFavorites: exports.removeFromFavorites,
  checkFavoriteStatus: exports.checkFavoriteStatus,
  getValidImage
}; 
