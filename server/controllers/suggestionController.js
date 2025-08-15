const Product = require('../models/Product');
const List = require('../models/List');
const Item = require('../models/Item');
const Suggestion = require('../models/Suggestion');
const ProductHistory = require('../models/ProductHistory');
const UserFavorites = require('../models/UserFavorites');
const IntelligentFrequencyService = require('../services/intelligentFrequency');
const fs = require('fs');
const path = require('path');

// Simple cache for products.json
let productsCache = null;
let productsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for smart suggestions
let suggestionsCache = new Map();
const SUGGESTIONS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

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
function getProductsFromJson() {
  const now = Date.now();
  if (productsCache && (now - productsCacheTime) < CACHE_DURATION) {
    return productsCache;
  }
  
  try {
    const productsPath = path.resolve(__dirname, '../scripts/products.json');
    const data = fs.readFileSync(productsPath, 'utf-8');
    const products = JSON.parse(data);
    productsCache = products;
    productsCacheTime = now;
    return products;
  } catch (error) {
    console.error('Error reading products.json:', error);
    return [];
  }
}

// Helper to ensure a valid image URL
function getValidImage(img) {
  if (typeof img === 'string' && img.trim() && (img.startsWith('http') || img.startsWith('data:image/'))) {
    return img;
  }
  return 'https://via.placeholder.com/100';
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
      // Use MongoDB instead of old products.json for ALL card with pagination support
      console.log('🔄 ALL card: Fetching from MongoDB...');
      
      // Get offset from query params for pagination
      const offset = parseInt(req.query.offset) || 0;
      console.log(`📦 ALL card: Pagination - limit: ${limitNum}, offset: ${offset}`);
      
      // For infinite scroll, use a simpler approach that always returns products
      const totalCount = await Product.countDocuments();
      
      console.log(`📦 ALL card: Total products in DB: ${totalCount}, requesting: ${limitNum}, offset: ${offset}`);
      
      // Use a simple approach: always sample more than we need to ensure we get enough products
      const sampleSize = Math.min(limitNum * 3, totalCount); // Sample 3x what we need
      
      // First try to get products with valid images
      let products = await Product.aggregate([
        { $match: { 
          img: { $exists: true, $ne: null, $ne: '', $ne: 'https://via.placeholder.com/100' }
        }},
        { $sample: { size: sampleSize } },
        { $limit: limitNum },
        { $project: {
            _id: 1,
            name: 1,
            img: 1,
            barcode: 1
        }}
      ]);
      
      // If we don't have enough products with images, get more from all products
      if (products.length < limitNum) {
        const remainingNeeded = limitNum - products.length;
        const additionalProducts = await Product.aggregate([
          { $sample: { size: remainingNeeded * 2 } },
          { $limit: remainingNeeded },
          { $project: {
              _id: 1,
              name: 1,
              img: 1,
              barcode: 1
          }}
        ]);
        products = [...products, ...additionalProducts];
      }
      
      console.log(`📦 ALL card: Actually returned ${products.length} products`);
      
      // If we got less than requested, it means we're running out of products
      // But since we have 5715 products, this shouldn't happen for a while
      if (products.length < limitNum) {
        console.log(`📦 ALL card: WARNING - Got ${products.length} products, less than requested ${limitNum}`);
      }
      
      console.log(`📦 ALL card: Found ${products.length} products from MongoDB (offset: ${offset})`);
      
      suggestions = products.map(product => ({
        productId: product._id,
        name: product.name || 'Unknown Product',
        img: getValidImage(product.img),
        barcode: product.barcode || '',
        type: 'all',
        score: 1,
        frequency: 1
      }));
    } else if (type === 'recent') {
      // OPTIMIZED RECENT: Use aggregation pipeline for better performance
      const Group = require('../models/Group');
      const PurchaseHistory = require('../models/PurchaseHistory');
      
      try {
        // Check if group exists first
        const group = await Group.findById(groupId).lean();
        if (!group) {
          suggestions = [];
        } else {
          // Use aggregation to get recent items with product details in one query
          const recentItems = await PurchaseHistory.aggregate([
            { $match: { group: group._id } },
            { $sort: { boughtAt: -1 } },
            { $limit: 1 },
            { $lookup: {
                from: 'purchasehistories',
                let: { lastBoughtAt: '$boughtAt' },
                pipeline: [
                  { $match: { 
                      $expr: { 
                          $and: [
                              { $eq: ['$group', group._id] },
                              { $eq: ['$boughtAt', '$$lastBoughtAt'] }
                          ]
                      }
                  }},
                  { $sort: { createdAt: -1 } },
                  { $limit: limitNum }
                ],
                as: 'recentItems'
              }
            },
            { $unwind: '$recentItems' },
            { $replaceRoot: { newRoot: '$recentItems' } },
            { $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'productDetails'
              }
            },
            { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
            { $project: {
                productId: '$product',
                name: { $ifNull: ['$name', '$productDetails.name'] },
                img: { $ifNull: ['$img', '$productDetails.img'] },
                barcode: { $ifNull: ['$barcode', '$productDetails.barcode'] },
                quantity: { $ifNull: ['$quantity', 1] },
                boughtAt: '$boughtAt',
                type: { $literal: 'recent' }
              }
            }
          ]);
          
          suggestions = recentItems
            .filter(item => item.name && getValidImage(item.img) && item.img !== 'https://via.placeholder.com/100')
            .map(item => ({
              ...item,
              img: getValidImage(item.img),
                  tripDate: new Date(item.boughtAt).toLocaleDateString()
            }));
        }
      } catch (error) {
        console.error('Error fetching recent items:', error);
        // Fallback to random products if recent fails
        const products = await Product.aggregate([
          { $sample: { size: limitNum } },
          { $project: { _id: 1, name: 1, img: 1, barcode: 1 } }
        ]);
        suggestions = products.map(product => ({
          productId: product._id,
          name: product.name || 'Unknown Product',
          img: getValidImage(product.img),
          barcode: product.barcode || '',
          type: 'recent',
          quantity: 1,
          boughtAt: new Date(),
          tripDate: new Date().toLocaleDateString()
        }));
      }
    } else if (type === 'favorite') {
      // OPTIMIZED FAVORITE: Use aggregation for better performance
      const Group = require('../models/Group');
      
      console.log('💖 Fetching favorites for user:', req.user.id, 'GroupId:', groupId);
      
      try {
        const group = await Group.findById(groupId).lean();
      if (!group) {
          // Fallback: random products from MongoDB
          const products = await Product.aggregate([
            { $sample: { size: limitNum } },
            { $project: { _id: 1, name: 1, img: 1, barcode: 1 } }
          ]);
          suggestions = products.map(product => ({
            productId: product._id,
            name: product.name || 'Unknown Product',
            img: getValidImage(product.img),
            barcode: product.barcode || '',
            type: 'favorite'
          }));
        } else {
                // Get favorites for the current user only - SIMPLE APPROACH
        const userFavorites = await UserFavorites.find({ 
          groupId: group._id, 
          userId: req.user.id 
        }).limit(limitNum);
        
        console.log('💖 Found', userFavorites.length, 'user favorites');
        
        if (userFavorites.length === 0) {
          suggestions = [];
        } else {
          // Get product IDs from favorites
          const productIds = userFavorites.map(fav => fav.productId);
          console.log('💖 Product IDs from favorites:', productIds);
          
          // Fetch products directly
          const products = await Product.find({ _id: { $in: productIds } });
          console.log('💖 Found', products.length, 'products from database');
          
          // Map to suggestions format
          suggestions = products.map(product => ({
            productId: product._id,
            name: product.name || 'Unknown Product',
            img: getValidImage(product.img),
            barcode: product.barcode || '',
            type: 'favorite'
          }));
        }
          
          console.log('💖 Final suggestions count:', suggestions.length);
        }
      } catch (error) {
        console.error('Error fetching favorite items:', error);
        // Fallback to random products if favorites fail
        const products = await Product.aggregate([
          { $sample: { size: limitNum } },
          { $project: { _id: 1, name: 1, img: 1, barcode: 1 } }
        ]);
        suggestions = products.map(product => ({
          productId: product._id,
          name: product.name || 'Unknown Product',
          img: getValidImage(product.img),
          barcode: product.barcode || '',
                type: 'favorite'
        }));
        }
    } else if (type === 'frequent') {
      // OPTIMIZED FREQUENT: Use aggregation for better performance
      const Group = require('../models/Group');
      const PurchaseHistory = require('../models/PurchaseHistory');
      const UserFavorites = require('../models/UserFavorites');
      
      try {
        const group = await Group.findById(groupId).lean();
      if (!group) {
        suggestions = [];
      } else {
          // Use aggregation to get frequent items with product details in one query
          const frequentItems = await PurchaseHistory.aggregate([
            { $match: { group: group._id } },
            { $sort: { boughtAt: -1 } },
            { $group: {
                _id: '$product',
                count: { $sum: 1 },
                quantity: { $sum: { $ifNull: ['$quantity', 1] } },
                lastBought: { $max: '$boughtAt' },
                name: { $first: '$name' },
                img: { $first: '$img' },
                tripCount: { $addToSet: '$boughtAt' }
              }
            },
            { $addFields: {
                uniqueTrips: { $size: '$tripCount' }
              }
            },
            { $match: {
                $or: [
                  { uniqueTrips: { $gt: 1 } }, // Bought in multiple trips
                  { quantity: { $gt: 1 } }     // Or quantity > 1 in single trip
                ]
              }
            },
            { $sort: { count: -1, lastBought: -1 } },
            { $limit: limitNum },
            { $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'productDetails'
              }
            },
            { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
            { $lookup: {
                from: 'userfavorites',
                let: { productId: '$_id' },
                pipeline: [
                  { $match: {
                      $expr: {
                          $and: [
                              { $eq: ['$groupId', group._id] },
                              { $eq: ['$productId', '$$productId'] }
                        ]
                      }
                  }},
                  { $count: 'favoriteCount' }
                ],
                as: 'favorites'
              }
            },
            { $addFields: {
                favoriteCount: { $ifNull: [{ $arrayElemAt: ['$favorites.favoriteCount', 0] }, 0] }
              }
            },
            { $project: {
                productId: '$_id',
                name: { $ifNull: ['$name', '$productDetails.name'] },
                img: { $ifNull: ['$img', '$productDetails.img'] },
                barcode: '$productDetails.barcode',
                type: { $literal: 'frequent' },
                frequency: '$count',
                quantity: '$quantity',
                lastBought: '$lastBought',
                favoriteCount: '$favoriteCount'
              }
            }
          ]);
          
          suggestions = frequentItems
            .filter(item => item.name && getValidImage(item.img) && item.img !== 'https://via.placeholder.com/100')
            .map(item => ({
              ...item,
              img: getValidImage(item.img)
            }))
            .sort((a, b) => {
              // Sort by frequency desc, then favoriteCount desc, then lastBought desc
              if (b.frequency !== a.frequency) return b.frequency - a.frequency;
              if (b.favoriteCount !== a.favoriteCount) return b.favoriteCount - a.favoriteCount;
              return new Date(b.lastBought) - new Date(a.lastBought);
            })
            .slice(0, limitNum);
        }
      } catch (error) {
        console.error('Error fetching frequent items:', error);
        // Fallback to random products if frequent fails
        const products = await Product.aggregate([
          { $sample: { size: limitNum } },
          { $project: { _id: 1, name: 1, img: 1, barcode: 1 } }
        ]);
        suggestions = products.map(product => ({
          productId: product._id,
          name: product.name || 'Unknown Product',
          img: getValidImage(product.img),
          barcode: product.barcode || '',
          type: 'frequent',
          frequency: 1,
          quantity: 1,
          lastBought: new Date(),
          favoriteCount: 0
        }));
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

// Fallback function for user-based suggestions (when no group available)
async function getUserBasedSuggestions(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    // Get user's recent and favorite products
    const [recentProducts, favoriteProducts, frequentProducts] = await Promise.all([
      getRecentlyAddedProducts(userId, Math.ceil(limit / 3)),
      getFavoriteProducts(userId, Math.ceil(limit / 3)),
      getBasicFrequentProducts(userId, Math.ceil(limit / 3))
    ]);

    const suggestions = [...recentProducts, ...favoriteProducts, ...frequentProducts];

    res.json({
      success: true,
      suggestions: suggestions.slice(0, limit)
    });

  } catch (error) {
    console.error('Error getting user-based suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user-based suggestions'
    });
  }
}

// Get household frequent products (BLAZING FAST: SmartCart-style simple aggregation)
async function getHouseholdFrequentProducts(groupId, limit) {
  try {
    // ULTRA FAST: Check cache first
    const cached = getCachedFrequent(groupId);
    if (cached) {
      return cached.slice(0, limit);
    }

    const Group = require('../models/Group');
    const ProductHistory = require('../models/ProductHistory');
    
    const group = await Group.findById(groupId);
    if (!group) return await getRandomProducts(limit);
    
    const memberIds = group.members.map(m => m.user);
    
    // ULTRA FAST: SmartCart-style aggregation - count purchases by frequency
    const frequentByTimes = await ProductHistory.aggregate([
      { $match: { 
        userId: { $in: memberIds },
        action: { $in: ['added', 'purchased'] }
      }},
      { $group: {
        _id: '$productId',
        timesPurchased: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        lastPurchase: { $max: '$createdAt' }
      }},
      { $sort: { timesPurchased: -1, totalQuantity: -1 } },
      { $limit: limit }
    ]);

    if (!frequentByTimes.length) {
      const fallback = await getRandomProducts(limit);
      setCachedFrequent(groupId, fallback);
      return fallback;
    }

    // Get product details from MongoDB instead of old products.json
    const productIds = frequentByTimes.map(item => item._id);
    const products = await Product.find({ _id: { $in: productIds } }).select('name img').lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // ULTRA FAST: Simple mapping with SmartCart-style data
    const results = frequentByTimes.map(item => {
      const prod = productMap.get(item._id.toString());
      
      return {
        productId: item._id,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'frequent',
        timesPurchased: item.timesPurchased,
        totalQuantity: item.totalQuantity,
        lastPurchase: item.lastPurchase,
        frequency: item.timesPurchased,
        score: item.timesPurchased * item.totalQuantity // SmartCart-style scoring
      };
    });

    // ULTRA FAST: Cache results
    setCachedFrequent(groupId, results);
    return results;

  } catch (error) {
    console.error('[frequent] Error:', error.message);
    return await getRandomProducts(limit);
  }
}

// Get all products (for ALL card) - fetch from Product collection in the database
async function getAllProducts(limit = 20) {
  try {
    // Use MongoDB $sample for true random fast batches, only return essential fields
    const products = await Product.aggregate([
      { $sample: { size: limit } },
      { $project: {
          _id: 1,
          name: 1,
          img: 1
      }}
    ]);
    
    // Return empty array if no products found (no fallback to old file)
    if (!products.length) {
      console.log('⚠️ No products found in MongoDB for ALL card');
      return [];
    }
    
    return products.map(product => ({
      productId: product._id,
      name: product.name || 'Unknown Product',
      img: getValidImage(product.img),
      type: 'all',
      score: 1,
      frequency: 1
    }));
  } catch (error) {
    console.error('❌ Error getting all products from MongoDB:', error);
    // Return empty array instead of falling back to old file
    return [];
  }
}

// Fallback function for basic frequency (when no intelligent data exists)
async function getBasicFrequentProducts(userId, limit) {
  try {
    const ProductHistory = require('../models/ProductHistory');
    const Product = require('../models/Product');

    // Get user's purchase history
    const purchaseHistory = await ProductHistory.find({
      userId,
      action: { $in: ['purchased', 'added'] }
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

    if (!purchaseHistory.length) {
      return await getRandomProducts(limit);
    }

    // Count frequency of each product
    const productCounts = {};
    purchaseHistory.forEach(record => {
      const productId = record.productId.toString();
      if (!productCounts[productId]) {
        productCounts[productId] = {
          count: 0,
          lastPurchase: record.createdAt
        };
      }
      productCounts[productId].count++;
    });

    // Sort by frequency and get top products
    const sortedProducts = Object.entries(productCounts)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, limit)
      .map(([productId, data]) => ({
        productId,
        frequency: data.count,
        lastPurchase: data.lastPurchase
      }));

    if (!sortedProducts.length) {
      return await getRandomProducts(limit);
    }

    // Get product details
    const productIds = sortedProducts.map(p => p.productId);
    const products = await Product.find({ 
      _id: { $in: productIds } 
    }).select('name img').lean();

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    return sortedProducts.map(item => {
      const prod = productMap.get(item.productId);
      return {
        productId: item.productId,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'frequent',
        frequency: item.frequency,
        lastPurchase: item.lastPurchase
      };
    });

  } catch (error) {
    console.error('Error getting basic frequent products:', error);
    return await getRandomProducts(limit);
  }
}

// Get recently added products for a user
async function getRecentlyAddedProducts(userId, limit) {
  try {
    const ProductHistory = require('../models/ProductHistory');
    const Product = require('../models/Product');

    const recentProducts = await ProductHistory.find({
      userId,
      action: { $in: ['added', 'purchased'] }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

    if (!recentProducts.length) {
      return await getRandomProducts(limit);
    }

    // Get unique products
    const uniqueProducts = [];
    const seen = new Set();
    
    for (const record of recentProducts) {
      const productId = record.productId.toString();
      if (!seen.has(productId)) {
        seen.add(productId);
        uniqueProducts.push({
          productId,
          lastAdded: record.createdAt
        });
      }
    }

    // Get product details
    const productIds = uniqueProducts.map(p => p.productId);
    const products = await Product.find({ 
      _id: { $in: productIds } 
    }).select('name img').lean();

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    return uniqueProducts.map(item => {
      const prod = productMap.get(item.productId);
      return {
        productId: item.productId,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'recent',
        lastAdded: item.lastAdded
      };
    });

  } catch (error) {
    console.error('Error getting recently added products:', error);
    return await getRandomProducts(limit);
  }
}

// Get random products from the Product collection (FAST: MongoDB $sample)
async function getRandomProducts(limit) {
  try {
    // Use MongoDB $sample for true random fast sampling
    const products = await Product.aggregate([
      { $sample: { size: limit } },
      { $project: {
          _id: 1,
          name: 1,
          img: 1
      }}
    ]);
    
    // Return empty array if no products found (no fallback to old file)
    if (!products.length) {
      console.log('⚠️ No products found in MongoDB for random products');
      return [];
    }
    
    return products.map(product => ({
      productId: product._id,
      name: product.name || 'Unknown Product',
      img: getValidImage(product.img),
      type: 'all',
      score: 1,
      frequency: 1
    }));
  } catch (error) {
    console.error('❌ Error getting random products from MongoDB:', error);
    // Return empty array instead of falling back to old file
    return [];
  }
}

// Get user's favorite products
async function getFavoriteProducts(userId, limit) {
  try {
    const UserFavorites = require('../models/UserFavorites');
    const Product = require('../models/Product');

    const favoriteProducts = await UserFavorites.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit);

    if (!favoriteProducts.length) {
      return [];
    }

    // Get product details
    const productIds = favoriteProducts.map(fp => fp.productId);
    const products = await Product.find({ 
      _id: { $in: productIds } 
    }).select('name img').lean();

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    return favoriteProducts.map(favorite => {
      const prod = productMap.get(favorite.productId);
      return {
        productId: favorite.productId,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'favorite',
        isFavorited: true
      };
    });

  } catch (error) {
    console.error('Error getting favorite products:', error);
    return [];
  }
}

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

    console.log('✅ Creating favorite with:', { userId, groupId, productId });

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

    console.log('✅ Removing favorite with:', { userId, groupId, productId });

    const result = await UserFavorites.deleteOne({
      userId,
      groupId,
      productId: productId.toString() // Ensure it's a string
    });

    console.log('✅ Delete result:', result);

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

    console.log('✅ Checking favorite status with:', { userId, groupId, productId });

    const favorite = await UserFavorites.findOne({
      userId,
      groupId,
      productId: productId.toString() // Ensure it's a string
    });

    console.log('✅ Favorite check result:', !!favorite);

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

// Get recent products for all group members (FAST: cached, indexed queries like SmartCart)
async function getGroupRecentlyAddedProducts(groupId, limit) {
  try {
    // FAST: Check cache first
    const cached = getCachedRecent(groupId);
    if (cached) {
      return cached.slice(0, limit);
    }

    const Group = require('../models/Group');
    const ProductHistory = require('../models/ProductHistory');
    
    const group = await Group.findById(groupId);
    if (!group) return await getRandomProducts(limit);
    
    const memberIds = group.members.map(m => m.user);
    
    // FAST: Simple indexed query - get recent purchases with product info in one query
    const recentPurchases = await ProductHistory.aggregate([
      { $match: { 
        userId: { $in: memberIds }, 
        action: 'purchased' 
      }},
      { $sort: { createdAt: -1 } },
      { $limit: limit * 3 }, // Get more to filter
      { $group: {
        _id: '$productId',
        lastPurchase: { $first: '$createdAt' },
        count: { $sum: 1 }
      }},
      { $sort: { lastPurchase: -1 } },
      { $limit: limit }
    ]);

    if (!recentPurchases.length) {
      const fallback = await getRandomProducts(limit);
      setCachedRecent(groupId, fallback);
      return fallback;
    }

    // Get product details from MongoDB instead of old products.json
    const productIds = recentPurchases.map(r => r._id);
    const products = await Product.find({ _id: { $in: productIds } }).select('name img').lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // FAST: Return simple results immediately
    const results = recentPurchases.map(r => {
      const prod = productMap.get(r._id.toString());
      return {
        productId: r._id,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'recent',
        frequency: r.count || 1,
        lastPurchaseDate: r.lastPurchase
      };
    });

    // FAST: Cache results for next request
    setCachedRecent(groupId, results);
    return results;

  } catch (error) {
    console.error('[recent] Error:', error.message);
    return await getRandomProducts(limit);
  }
}

// Get favorite products for all group members (BLAZING FAST: minimal queries, direct lookups)
async function getGroupFavoriteProducts(groupId, limit) {
  try {
    // ULTRA FAST: Check cache first
    const cached = getCachedFavorites(groupId);
    if (cached) {
      return cached.slice(0, limit);
    }

    const Group = require('../models/Group');
    const ProductHistory = require('../models/ProductHistory');
    
    const group = await Group.findById(groupId);
    if (!group) return await getRandomProducts(limit);
    
    const memberIds = group.members.map(m => m.user);
    
    // ULTRA FAST: Simple query - just get recent interactions
    const recentInteractions = await ProductHistory.find({
      userId: { $in: memberIds },
      action: { $in: ['favorited', 'added', 'purchased'] }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 2) // Get more to filter
    .lean(); // Ultra fast - no mongoose overhead

    if (!recentInteractions.length) {
      const fallback = await getRandomProducts(limit);
      setCachedFavorites(groupId, fallback);
      return fallback;
    }

    // ULTRA FAST: Get unique product IDs
    const productIds = [...new Set(recentInteractions.map(r => r.productId.toString()))].slice(0, limit);
    
    // Get product details from MongoDB instead of old products.json
    const products = await Product.find({ _id: { $in: productIds } }).select('name img').lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // ULTRA FAST: Simple mapping with minimal processing
    const results = productIds.map(productId => {
      const prod = productMap.get(productId);
      const interactions = recentInteractions.filter(r => r.productId.toString() === productId);
      
      return {
        productId: productId,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'favorite',
        totalInteractions: interactions.length,
        lastInteraction: interactions[0]?.createdAt,
        isFavorited: interactions.some(i => i.action === 'favorited'),
        isPurchased: interactions.some(i => i.action === 'purchased'),
        isAdded: interactions.some(i => i.action === 'added'),
        frequency: interactions.length
      };
    });

    // ULTRA FAST: Cache results
    setCachedFavorites(groupId, results);
    return results;

  } catch (error) {
    console.error('[favorite] Error:', error.message);
    return await getRandomProducts(limit);
  }
}

// Export getValidImage function for use in other modules
module.exports = {
  getSmartSuggestions: exports.getSmartSuggestions,
  addToFavorites: exports.addToFavorites,
  removeFromFavorites: exports.removeFromFavorites,
  checkFavoriteStatus: exports.checkFavoriteStatus,
  getValidImage
}; 