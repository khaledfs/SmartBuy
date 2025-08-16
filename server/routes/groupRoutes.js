const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const groupController = require('../controllers/groupController');
const listController = require('../controllers/listController');
const groupListController = require('../controllers/groupListController');

// Create group + shared list
router.post('/', auth, groupController.createGroup);

// Get all groups this user belongs to
router.get('/my', auth, groupController.getMyGroups);

// Get group details by ID
router.get('/:id', auth, groupController.getGroupById);

// Add member to group
router.post('/:id/addMember', auth, groupController.addMember);

// Request to join group
router.post('/:id/requestJoin', auth, groupController.requestJoin);

// Approve join request
router.post('/:id/approveJoin', auth, groupController.approveJoin);

// Reject join request
router.post('/:id/rejectJoin', auth, groupController.rejectJoin);

// Change member role (owner only)
router.patch('/:id/changeRole', auth, groupController.changeRole);

// Remove user from group
router.patch('/:id/removeUser', auth, groupController.removeUser);

// Leave group
router.post('/:id/leave', auth, groupController.leaveGroup);

// Delete group
router.delete('/:id', auth, groupController.deleteGroup);

// Add item to a group's shared list
router.post('/:groupId/list/items', auth, async (req, res) => {
  try {
    const Group = require('../models/Group');
    console.log('POST /groups/:groupId/list/items called');
    console.log('groupId:', req.params.groupId);
    console.log('userId:', req.userId);
    
    const group = await Group.findById(req.params.groupId).populate('list');
    if (!group) {
      console.log('Group not found');
      return res.status(404).json({ message: 'Group not found' });
    }
    if (!group.list) {
      console.log('Group has no shared list');
      return res.status(404).json({ message: 'Group has no shared list' });
    }
    
    // Check if user is a member of the group
    console.log('Group members:', group.members);
    console.log('User ID:', req.userId);
    
    // Check if user is in the members array (members are objects with user and role)
    const isMember = group.members.some(member => member.user.toString() === req.userId);
    console.log('Is user a member?', isMember);
    
    if (!isMember) {
      console.log('User is not a member of this group');
      return res.status(403).json({ message: 'You are not a member of this group' });
    }
    
    console.log('Group and list found:', group.list._id);
    req.params.id = group.list._id;
    return listController.addItemToList(req, res);
  } catch (err) {
    console.error('Failed to add item to group shared list:', err);
    res.status(500).json({ message: 'Server error', error: err.stack });
  }
});

// Fetch items in a group's shared list
router.get('/:groupId/list/items', auth, async (req, res) => {
  try {
    const Group = require('../models/Group');
    const group = await Group.findById(req.params.groupId).populate({
      path: 'list',
      populate: { path: 'items', populate: { path: 'addedBy', select: 'username profilePicUrl' } }
    });
    if (!group || !group.list) {
      return res.status(404).json({ message: 'Group or shared list not found' });
    }
    res.json(group.list.items);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.stack });
  }
});

// Delete item from a group's shared list
router.delete('/:groupId/list/items/:itemId', auth, async (req, res) => {
  console.log('DELETE /groups/:groupId/list/items/:itemId called');
  console.log('groupId:', req.params.groupId, 'itemId:', req.params.itemId, 'userId:', req.userId);
  try {
    const Group = require('../models/Group');
    const group = await Group.findById(req.params.groupId).populate('list');
    if (!group || !group.list) {
      console.log('Group or shared list not found');
      return res.status(404).json({ message: 'Group or shared list not found' });
    }
    req.params.id = group.list._id; // set listId for controller
    return listController.deleteItemById(req, res);
  } catch (err) {
    console.error('Error in DELETE /groups/:groupId/list/items/:itemId:', err);
    res.status(500).json({ message: 'Server error', error: err.stack });
  }
});

// Group shared list summary (current, last bought, trip count)
router.get('/:groupId/list/summary', auth, groupListController.getGroupListSummary);
// Complete a group trip (move current list to history, clear list)
router.post('/:groupId/list/complete-trip', auth, groupListController.completeGroupTrip);

// Trip history endpoints
router.get('/:groupId/trips', auth, groupListController.getTripHistory);
router.get('/:groupId/trips/:tripId', auth, groupListController.getTripItems);

module.exports = router;