// server/routes/listRoutes.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const ctl     = require('../controllers/listController');

// Get all user's lists (owned + group)
router.get('/',       auth, ctl.getLists);

// Get single list (if user has access)
router.get('/:id',    auth, ctl.getListById);

// Create new list (can be group-owned)
router.post('/',      auth, ctl.createList);

// Update list (name or items)
router.put('/:id', auth, ctl.updateList); 

// Delete list
router.delete('/:id', auth, ctl.deleteList);

// Add item to a list
router.post('/:id/items', auth, ctl.addItemToList);

// Add item to a list by product ID
router.post('/:id/items/:productId', auth, ctl.addItemToListById);

// Delete item from list
router.delete('/:id/items/:itemId', auth, ctl.deleteItemById); 

// Mark item as bought
router.put('/:id/items/:itemId/buy', auth, ctl.markItemAsBought);

module.exports = router;
