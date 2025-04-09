const express = require('express');
const router = express.Router();
const {
  getItems,
  addItem,
  updateItem,
  deleteItem,
} = require('../controllers/shoppingListController');

// GET /api/list 
router.get('/', getItems);

// POST /api/list 
router.post('/', addItem);

// PUT /api/list/:id 
router.put('/:id', updateItem);

// DELETE /api/list/:id 
router.delete('/:id', deleteItem);

module.exports = router;
