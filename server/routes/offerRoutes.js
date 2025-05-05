// routes/offerRoutes.js
const express = require('express')
const router  = express.Router()
const Offer   = require('../models/Offer')

// GET  /api/offers                 → list all price‐offers
// GET  /api/offers?product=:prod   → all offers for a product
// GET  /api/offers?store=:store    → all offers at a store
router.get('/', async (req, res) => {
    const { product, supermarket } = req.query;
    const filter = {};
    if (product)     filter.product     = product;
    if (supermarket) filter.supermarket = supermarket;
    const offers = await Offer.find(filter)
      .populate('product', 'name iconUrl')
      .populate('supermarket', 'name address');
    res.json(offers);
  });
// POST /api/offers                 → create new price entry
router.post('/', async (req, res) => { /* ... */ })

// PATCH /api/offers/:id            → update price
router.patch('/:id', async (req, res) => { /* ... */ })

// DELETE /api/offers/:id
router.delete('/:id', async (req, res) => { /* ... */ })

module.exports = router
