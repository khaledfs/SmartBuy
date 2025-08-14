// routes/suggestionRoutes.js
const express = require('express');
const router = express.Router();
const suggestionController = require('../controllers/suggestionController');
const favoriteController = require('../controllers/favoriteController');
const authMiddleware = require('../middleware/authMiddleware');

// Enable real authentication for all suggestion routes
router.use(authMiddleware);

// Add error handling middleware for this router
router.use((err, req, res, next) => {
  console.error('Suggestion route error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error in suggestions',
    error: err.message
  });
});

// Get smart suggestions for the authenticated user
router.get('/smart', (req, res, next) => {
  console.log('GET /suggestions/smart called with query:', req.query);
  suggestionController.getSmartSuggestions(req, res, next);
});

// Track product interaction for suggestions
router.post('/track', (req, res, next) => {
  console.log('POST /suggestions/track called with body:', req.body);
  suggestionController.trackProductInteraction(req, res, next);
});

// Mark product as purchased (essential for intelligent frequency predictions)
router.post('/purchase', (req, res, next) => {
  console.log('POST /suggestions/purchase called with body:', req.body);
  suggestionController.markAsPurchased(req, res, next);
});

// Favorites management
router.post('/favorites/add', (req, res, next) => {
  console.log('POST /suggestions/favorites/add called with body:', req.body);
  suggestionController.addToFavorites(req, res, next);
});

router.post('/favorites/remove', (req, res, next) => {
  console.log('POST /suggestions/favorites/remove called with body:', req.body);
  suggestionController.removeFromFavorites(req, res, next);
});

router.get('/favorites/check/:productId', (req, res, next) => {
  console.log('GET /suggestions/favorites/check called with params:', req.params);
  suggestionController.checkFavoriteStatus(req, res, next);
});

// ML Model Management (admin endpoints)
router.post('/train', (req, res, next) => {
  console.log('POST /suggestions/train called');
  suggestionController.trainMLModel(req, res, next);
});

router.get('/features/importance', (req, res, next) => {
  console.log('GET /suggestions/features/importance called');
  suggestionController.getFeatureImportance(req, res, next);
});

module.exports = router;
