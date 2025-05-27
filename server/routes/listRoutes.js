// server/routes/listRoutes.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const ctl     = require('../controllers/listController');

// Get all user’s lists (owned + group)
router.get('/',       auth, ctl.getLists);

router.patch('/item/:itemId/quantity', auth, ctl.updateQuantity);

// Get single list (if user has access)
router.get('/:id',    auth, ctl.getListById);

// Create new list (can be group-owned)
router.post('/',      auth, ctl.createList);

// Update list (name or items)
router.patch('/:id', auth, ctl.updateList); 

// Delete list
router.delete('/:id', auth, ctl.deleteList);

//Delte item
router.delete('/item/:itemId', auth, ctl.deleteItemById); 

// Add item to a list
router.post('/:id/items', auth, ctl.addItemToListById);


module.exports = router;
