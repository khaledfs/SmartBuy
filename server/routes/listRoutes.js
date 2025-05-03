// server/routes/listRoutes.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const ctl     = require('../controllers/listController');

router.get('/',       auth, ctl.getLists);
router.get('/:id',    auth, ctl.getListById);    // ← new
router.post('/',      auth, ctl.createList);
router.patch('/:id',  auth, ctl.updateList);     // ← new
router.delete('/:id', auth, ctl.deleteList);

module.exports = router;
