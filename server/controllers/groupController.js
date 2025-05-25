const Group = require('../models/Group');
const User = require('../models/User');
const List = require('../models/List');

// POST /groups
// POST /groups
exports.createGroup = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Group name is required' });

  try {
    // Step 1: Create the group first
    const group = new Group({
      name,
      admin: req.userId,
      members: [req.userId],
    });

    await group.save();

    // Step 2: Create a brand-new shared list (not reusing any)
    const list = new List({
      name: `${name}'s Shared List`,
      owner: req.userId,
      group: group._id,
      items: [], // ✅ ensure it's completely empty
    });

    await list.save();

    // Step 3: Link the new list back to the group
    group.list = list._id;
    await group.save();

    // Step 4: Return populated group
    const populated = await Group.findById(group._id)
      .populate('admin members', 'username profilePicUrl')
      .populate({ path: 'list', populate: { path: 'items' } });

    res.status(201).json(populated);
  } catch (err) {
    console.error('❌ Error creating group:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /groups/my
exports.getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userId })
      .populate('admin members', 'username profilePicUrl')
      .populate({
        path: 'list',
        populate: { path: 'items' }
      });
    res.json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /groups/:id/addUser
exports.addUserToGroup = async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  try {
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.admin.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only admin can add users' });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (group.members.includes(user._id)) {
      return res.status(400).json({ message: 'User already in group' });
    }

    group.members.push(user._id);
    await group.save();

    const updated = await Group.findById(id)
      .populate('admin members', 'username profilePicUrl')
      .populate({ path: 'list', populate: { path: 'items' } });

    res.json(updated);
  } catch (err) {
    console.error('Add user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /groups/:id/removeUser
exports.removeUser = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.admin.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only admin can remove users' });
    }

    if (userId === group.admin.toString()) {
      return res.status(400).json({ message: 'Admin cannot remove themselves' });
    }

    group.members = group.members.filter(m => m.toString() !== userId);
    await group.save();

    const updated = await Group.findById(id)
      .populate('admin members', 'username profilePicUrl')
      .populate({ path: 'list', populate: { path: 'items' } });

    res.json(updated);
  } catch (err) {
    console.error('Remove user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /groups/:id/leave
exports.leaveGroup = async (req, res) => {
  const { id } = req.params;
  try {
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.admin.toString() === req.userId) {
      return res.status(400).json({ message: 'Admin cannot leave. Delete group instead.' });
    }

    group.members = group.members.filter(m => m.toString() !== req.userId);
    await group.save();

    res.json({ message: 'Left group successfully' });
  } catch (err) {
    console.error('Leave group error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /groups/:id
exports.deleteGroup = async (req, res) => {
  const { id } = req.params;
  try {
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.admin.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only admin can delete the group' });
    }

    await List.findByIdAndDelete(group.list); // ✅ delete attached shared list
    await group.deleteOne();

    res.json({ message: 'Group and shared list deleted successfully' });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
