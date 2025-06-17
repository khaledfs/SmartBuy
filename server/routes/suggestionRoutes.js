// routes/suggestionRoutes.js
const express = require('express');
const router = express.Router();
const Suggestion = require('../models/Suggestion');

// GET /api/suggestions?page=1&limit=30&q=milk
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 30, q } = req.query;

    const filter = {};
    if (q) {
      filter.name = new RegExp(q, 'i'); // بحث غير حساس لحالة الأحرف
    }

    const total = await Suggestion.countDocuments(filter);
    const suggestions = await Suggestion.find(filter)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      suggestions,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('❌ Error in /suggestions:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
