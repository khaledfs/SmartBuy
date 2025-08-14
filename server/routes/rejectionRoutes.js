const express = require('express');
const router = express.Router();
const rejectionController = require('../controllers/rejectionController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /api/rejections - Reject a product suggestion
router.post('/', rejectionController.rejectProduct);

// GET /api/rejections - Get user's rejected products
router.get('/', rejectionController.getRejections);

// DELETE /api/rejections/:productId - Remove rejection (undo)
router.delete('/:productId', rejectionController.removeRejection);

module.exports = router; 