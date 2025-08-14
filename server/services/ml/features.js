const PurchaseHistory = require('../../models/PurchaseHistory');
const RejectedProduct = require('../../models/RejectedProduct');
const Favorite = require('../../models/Favorite');
const Product = require('../../models/Product');
const Group = require('../../models/Group');

/**
 * Enhanced feature extraction for Smart_Buy ML system
 * Features similar to SmartCart but adapted for Smart_Buy's group-based system
 */

async function extractFeaturesForProducts(productIds, userId, groupId = null) {
  const featuresMap = new Map();

  // Initialize features for all products
  for (const productId of productIds) {
    featuresMap.set(productId.toString(), {
      isFavorite: 0,
      purchasedBefore: 0,
      timesPurchased: 0,
      recentlyPurchased: 0,
      timesWasRejectedByUser: 0,
      timesWasRejectedByGroup: 0,
      groupPopularity: 0,
      priceScore: 0,
      categoryPopularity: 0,
    });
  }

  const productIdStrings = productIds.map(id => id.toString());

  // Parallel feature extraction
  const [
    favorites,
    purchaseHistory,
    rejections,
    groupHistory,
    products
  ] = await Promise.all([
    // User favorites
    Favorite.find({ 
      user: userId, 
      productId: { $in: productIds } 
    }).lean(),

    // Purchase history (personal + group)
    PurchaseHistory.find({
      product: { $in: productIds },
      $or: [
        { user: userId },
        { group: groupId }
      ]
    }).lean(),

    // Rejections (personal + group)
    RejectedProduct.find({
      productId: { $in: productIds },
      $or: [
        { rejectedBy: userId },
        { groupId: groupId }
      ]
    }).lean(),

    // Group purchase history (for group popularity)
    groupId ? PurchaseHistory.find({
      group: groupId,
      product: { $in: productIds }
    }).lean() : [],

    // Product details for price and category features
    Product.find({ _id: { $in: productIds } }).lean()
  ]);

  // Process favorites
  for (const fav of favorites) {
    const productId = fav.productId.toString();
    if (featuresMap.has(productId)) {
      featuresMap.get(productId).isFavorite = 1;
    }
  }

  // Process purchase history
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const purchaseStats = new Map();

  for (const purchase of purchaseHistory) {
    const productId = purchase.product?.toString();
    if (!productId || !featuresMap.has(productId)) continue;

    if (!purchaseStats.has(productId)) {
      purchaseStats.set(productId, {
        purchasedBefore: 0,
        timesPurchased: 0,
        recentlyPurchased: 0,
      });
    }

    const stats = purchaseStats.get(productId);
    stats.timesPurchased += purchase.quantity;
    stats.purchasedBefore = 1;

    if (new Date(purchase.boughtAt) >= thirtyDaysAgo) {
      stats.recentlyPurchased = 1;
    }
  }

  // Apply purchase stats to features
  for (const [productId, stats] of purchaseStats) {
    if (featuresMap.has(productId)) {
      Object.assign(featuresMap.get(productId), stats);
    }
  }

  // Process rejections
  const rejectionStats = new Map();
  for (const rejection of rejections) {
    const productId = rejection.productId.toString();
    if (!featuresMap.has(productId)) continue;

    if (!rejectionStats.has(productId)) {
      rejectionStats.set(productId, {
        timesWasRejectedByUser: 0,
        timesWasRejectedByGroup: 0,
      });
    }

    const stats = rejectionStats.get(productId);
    if (rejection.rejectedBy.toString() === userId.toString()) {
      stats.timesWasRejectedByUser += 1;
    }
    if (rejection.groupId?.toString() === groupId?.toString()) {
      stats.timesWasRejectedByGroup += 1;
    }
  }

  // Apply rejection stats to features
  for (const [productId, stats] of rejectionStats) {
    if (featuresMap.has(productId)) {
      Object.assign(featuresMap.get(productId), stats);
    }
  }

  // Process group popularity
  if (groupId && groupHistory.length > 0) {
    const groupStats = new Map();
    for (const purchase of groupHistory) {
      const productId = purchase.product?.toString();
      if (!productId || !featuresMap.has(productId)) continue;

      if (!groupStats.has(productId)) {
        groupStats.set(productId, 0);
      }
      groupStats.set(productId, groupStats.get(productId) + purchase.quantity);
    }

    // Normalize group popularity (0-1 scale)
    const maxGroupPurchases = Math.max(...groupStats.values(), 1);
    for (const [productId, count] of groupStats) {
      if (featuresMap.has(productId)) {
        featuresMap.get(productId).groupPopularity = count / maxGroupPurchases;
      }
    }
  }

  // Process price and category features
  const categoryStats = new Map();
  const prices = [];

  for (const product of products) {
    if (product.price) prices.push(product.price);
    if (product.category) {
      if (!categoryStats.has(product.category)) {
        categoryStats.set(product.category, 0);
      }
      categoryStats.set(product.category, categoryStats.get(product.category) + 1);
    }
  }

  // Calculate price score (normalized 0-1, lower price = higher score)
  const maxPrice = Math.max(...prices, 1);
  const minPrice = Math.min(...prices, 0);

  for (const product of products) {
    const productId = product._id.toString();
    if (!featuresMap.has(productId)) continue;

    const features = featuresMap.get(productId);
    
    // Price score (inverted - lower price = higher score)
    if (product.price) {
      features.priceScore = 1 - ((product.price - minPrice) / (maxPrice - minPrice));
    }

    // Category popularity
    if (product.category && categoryStats.has(product.category)) {
      const maxCategoryCount = Math.max(...categoryStats.values());
      features.categoryPopularity = categoryStats.get(product.category) / maxCategoryCount;
    }
  }

  return featuresMap;
}

async function extractFeaturesForProduct(productId, userId, groupId = null) {
  const featuresMap = await extractFeaturesForProducts([productId], userId, groupId);
  return featuresMap.get(productId.toString()) || {};
}

module.exports = {
  extractFeaturesForProducts,
  extractFeaturesForProduct
}; 