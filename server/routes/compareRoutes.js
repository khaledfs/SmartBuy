// server/routes/compareRoutes.js
const express = require('express');
const router = express.Router();
const List = require('../models/List');
const axios = require('axios');
const cheerio = require('cheerio');

async function fetchCompare(locationCity, barcodes) {
  const streetId = 9000;
  const cityId = 0;
  const url = 'https://chp.co.il/main_page/compare_results';
  const params = {
    shopping_address: locationCity,
    shopping_address_street_id: streetId,
    shopping_address_city_id: cityId,
    product_barcode: barcodes.join('_'),
    from: 0,
    num_results: 30,
  };
  const headers = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': '*/*',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://chp.co.il/'
  };

  console.log('[compare] _fetchCompare →', params);

  const { data: html } = await axios.get(url, { params, headers });
  const $ = cheerio.load(html);
  const results = {};

  $('table tr').each((_, row) => {
    const tds = $(row).find('td');
    if (tds.length >= 3) {
      const price = parseFloat($(tds[0]).text().trim());
      const branch = $(tds[1]).text().trim();
      const address = $(tds[2]).text().trim();

      if (!isNaN(price) && branch) {
        const key = `${branch} - ${address}`;
        if (!results[key]) {
          results[key] = { branch, address, totalPrice: 0, itemsFound: 0 };
        }
        results[key].totalPrice += price;
        results[key].itemsFound += 1;
      }
    }
  });

  return Object.values(results).map(r => ({
    branch: r.branch,
    address: r.address,
    totalPrice: r.totalPrice.toFixed(2),
    itemsFound: r.itemsFound
  }));
}

// GET version
router.get('/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    const locationCity = req.query.location;
    const list = await List.findById(listId).populate('items.product').lean();

    if (!list) return res.status(404).json({ error: 'List not found' });
    const barcodes = list.items.map(i => i.product?.barcode).filter(Boolean);
    if (barcodes.length === 0) return res.status(400).json({ error: 'No barcodes' });

    console.log('[compare GET] listId:', listId, 'locationCity:', locationCity);
    const results = await fetchCompare(locationCity, barcodes);
    res.json(results);
  } catch (err) {
    console.error('[compare GET] error', err);
    res.status(500).json({ error: err.message });
  }
});

// POST version
router.post('/', async (req, res) => {
  try {
    const { city, barcodes } = req.body;
    if (!city || !Array.isArray(barcodes) || barcodes.length === 0) {
      return res.status(400).json({ error: 'Missing city or barcodes array' });
    }
    console.log('[compare POST] barcodes length:', barcodes.length, 'city:', city);
    const results = await fetchCompare(city, barcodes);
    res.json(results);
  } catch (err) {
    console.error('[compare POST] error', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
