const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const ctl = require('../controllers/groupController');

router.post('/', auth, ctl.createGroup);
router.get('/my', auth, ctl.getMyGroups);
router.post('/:id/addUser', auth, ctl.addUserToGroup);
router.patch('/:id/removeUser', auth, ctl.removeUser);
router.post('/:id/leave', auth, ctl.leaveGroup);
router.delete('/:id', auth, ctl.deleteGroup);

module.exports = router;
