const express = require('express');
const router = express.Router();
const List = require('../models/List');
const Stock = require('../models/Stock');
const Supermarket = require('../models/Supermarket');
const mongoose = require('mongoose');

// GET /api/compare/:listId
router.get('/:listId', async (req, res) => {
  try {
    const { listId } = req.params;

    // Populate list items with products
    const list = await List.findById(listId)
      .populate({ path: 'items', populate: { path: 'product' } })
      .lean();

    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    const productIds = list.items
      .map(item => item.product?._id)
      .filter(Boolean)
      .map(id => new mongoose.Types.ObjectId(id));

    // For now: compare prices across all supermarkets (no GPS yet)
    const supermarkets = await Supermarket.find();

    const results = await Promise.all(supermarkets.map(async (market) => {
      const stockItems = await Stock.find({
        supermarket: market._id,
        product: { $in: productIds }
      }).populate('product');

      let totalPrice = 0;
      const matchedNames = new Set();

      stockItems.forEach(stock => {
        totalPrice += stock.price;
        if (stock.product?.name) matchedNames.add(stock.product.name);
      });

      return {
        supermarket: market.name,
        address: market.address,
        matched: matchedNames.size,
        totalPrice: totalPrice.toFixed(2),
        itemsFound: Array.from(matchedNames)
      };
    }));

    res.json(results);
  } catch (err) {
    console.error('❌ Compare route error:', err);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
});

module.exports = router;
