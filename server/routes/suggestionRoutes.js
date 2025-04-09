// server/routes/suggestionRoutes.js
const express = require('express');
const router = express.Router();
const Suggestion = require('../models/Suggestion');

router.get('/', async (req, res) => {
  try {
    const suggestions = await Suggestion.find();
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch suggestions' });
  }
});

module.exports = router;
