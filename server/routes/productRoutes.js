// routes/productRoutes.js
const express = require('express')
const router  = express.Router()
const Product = require('../models/Product')

// GET /api/products
router.get('/', async (req, res) => {
    const { q, category } = req.query;
    const filter = {};
    if (q)        filter.name     = new RegExp(q, 'i');
    if (category) filter.category = category;
    const list = await Product.find(filter).sort('name');
    res.json(list);
  });
// POST /api/products
router.post('/', async (req, res) => { /* ... */ })

// PATCH /api/products/:id
router.patch('/:id', async (req, res) => { /* ... */ })

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => { /* ... */ })

module.exports = router
