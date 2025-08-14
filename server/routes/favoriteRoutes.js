const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/favorites - Get user's favorites
router.get('/', favoriteController.getFavorites);

// POST /api/favorites - Add product to favorites
router.post('/', favoriteController.addToFavorites);

// DELETE /api/favorites/:productId - Remove from favorites
router.delete('/:productId', favoriteController.removeFromFavorites);

// PUT /api/favorites/:productId - Update favorite quantity
router.put('/:productId', favoriteController.updateFavoriteQuantity);

module.exports = router; 