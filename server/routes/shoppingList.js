const express = require('express');
const router = express.Router();
const {
  getItems,
  addItem,
  updateItem,
  deleteItem,
} = require('../controllers/shoppingListController');
const auth = require('../middleware/authMiddleware');

// GET /api/list 
router.get('/',auth, getItems);

// POST /api/list 
router.post('/',auth, addItem);

// PUT /api/list/:id 
router.put('/:id',auth, updateItem);

// DELETE /api/list/:id 
router.delete('/:id',auth, deleteItem);

module.exports = router;
