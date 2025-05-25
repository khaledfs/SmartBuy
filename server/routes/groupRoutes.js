const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const groupController = require('../controllers/groupController');

// Create group + shared list
router.post('/', auth, groupController.createGroup);

// Get all groups this user belongs to
router.get('/my', auth, groupController.getMyGroups);

// Add user by username
router.post('/:id/addUser', auth, groupController.addUserToGroup);

// Remove a user from group (admin only)
router.patch('/:id/removeUser', auth, groupController.removeUser);

// Leave group (non-admin only)
router.post('/:id/leave', auth, groupController.leaveGroup);

// Delete group (admin only)
router.delete('/:id', auth, groupController.deleteGroup);

module.exports = router;