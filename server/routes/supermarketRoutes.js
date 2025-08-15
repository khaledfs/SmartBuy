// routes/supermarketRoutes.js
const express    = require('express')
const router     = express.Router()
const Supermarket = require('../models/Supermarket')

router.get('/', async (req, res) => {
    const list = await Supermarket.find().sort('name');
    res.json(list);
  });
router.post('/',     async (req, res) => { /* add new store */ })
router.patch('/:id', async (req, res) => { /* update store */ })
router.delete('/:id',async (req, res) => { /* delete store */ })

module.exports = router
