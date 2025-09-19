// services/ml/features.js
const mongoose = require('mongoose');
const PurchaseHistory = require('../../models/PurchaseHistory'); // not used here but keep if you need later
const RejectedProduct = require('../../models/RejectedProduct');
const Favorite = require('../../models/UserFavorites');
const Product = require('../../models/Product');
const Group = require('../../models/Group');
const ProductFreq = require('../../models/ProductFreq');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function gapDaysToFreqScore(gapDays) {
  if (!gapDays || gapDays <= 0) return 0;
  return 1 / (1 + gapDays);

}

function toIdStr(x) {
  return x ? x.toString() : '';
}


async function extractFeaturesForProducts(productIds, userId, groupId = null) {
  const featuresMap = new Map();
  const productIdStrs = productIds.map(toIdStr);

  // Init defaults
  for (const pid of productIdStrs) {
    featuresMap.set(pid, {
      isFavorite: 0,
      addedBefore: 0,
      timesAdded: 0,
      recentlyadded: 0,
      AddedFrequency: 0,
      timesRejected: 0,
    });
  }

  const favQuery = {
    productId: { $in: productIdStrs },
    $or: [
      { userId: userId },
      { user: userId },
      ...(groupId ? [{ groupId: toIdStr(groupId) }] : [])
    ]
  };

  const favorites = await Favorite.find(favQuery).lean().catch(() => []);
  for (const fav of favorites) {
    const pidStr = toIdStr(fav.productId);
    if (featuresMap.has(pidStr)) {
      featuresMap.get(pidStr).isFavorite = 1;
    }
  }

  const freqDocs = await ProductFreq.find({
    product: { $in: productIds },
    group: groupId ?? null,
  }).select('product totaladded lastAdded addedgap').lean();

  const now = Date.now();
  for (const doc of freqDocs) {
    const pidStr = toIdStr(doc.product);
    if (!featuresMap.has(pidStr)) continue;

    const feats = featuresMap.get(pidStr);
    const total = doc.totaladded || 0;
    feats.addedBefore = total > 0 ? 1 : 0;
    feats.timesAdded = total;

    const lastAdded = doc.lastAdded ? new Date(doc.lastAdded).getTime() : 0;
    feats.recentlyadded = lastAdded && (now - lastAdded) <= THIRTY_DAYS_MS ? 1 : 0;

    feats.AddedFrequency = doc.addedgap;
    feats.timesRejected = doc.timesRejected
  }
  return featuresMap;
}

/**
 * Convenience wrapper for a single product.
 */
async function extractFeaturesForProduct(productId, userId, groupId = null) {
  const map = await extractFeaturesForProducts([productId], userId, groupId);
  const feats = map.get(toIdStr(productId)) || {};
  // Ensure all keys exist (avoids undefined in your array build)
  return {
    isFavorite: feats.isFavorite ?? 0,
    addedBefore: feats.addedBefore ?? 0,
    timesAdded: feats.timesAdded ?? 0,
    recentlyadded: feats.recentlyadded ?? 0,
    AddedFrequency: feats.AddedFrequency ?? 0,
    timesRejected: feats.timesRejected ?? 0,
  };
}

module.exports = {
  extractFeaturesForProducts,
  extractFeaturesForProduct,
};
