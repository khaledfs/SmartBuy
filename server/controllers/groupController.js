const Group = require('../models/Group');
const User = require('../models/User');
const List = require('../models/List');

// POST /groups
exports.createGroup = async (req, res) => {
  console.log('Received group creation request:', req.body);
  const { name, members = [] } = req.body;
  if (!name) return res.status(400).json({ message: 'Group name is required' });

  try {
    // Always add the creator as owner
    const groupMembers = [{ user: req.userId, role: 'owner' }];
    // Validate and add each member (skip if same as creator)
    for (const identifier of members) {
      // Try to find user by username, email, or phone (case-insensitive)
      const user = await User.findOne({
        $or: [
          { username: new RegExp('^' + identifier + '$', 'i') },
          { email: new RegExp('^' + identifier + '$', 'i') },
          { phone: new RegExp('^' + identifier + '$', 'i') }
        ]
      });
      if (!user) {
        return res.status(400).json({ message: `User '${identifier}' not found. All members must be registered users.` });
      }
      if (user._id.toString() !== req.userId && !groupMembers.some(m => m.user.toString() === user._id.toString())) {
        groupMembers.push({ user: user._id, role: 'member' });
      }
    }
    const group = new Group({
      name,
      members: groupMembers,
      waitingList: []
    });
    await group.save();

    const list = new List({
      name: `${name}'s Shared List`,
      owner: req.userId,
      group: group._id,
      items: [],
    });
    await list.save();

    group.list = list._id;
    await group.save();

    // Emit socket event to notify all new members about the group creation
    const io = req.app.get('io');
    if (io) {
      const groupCreatedEvent = {
        groupId: group._id.toString(),
        groupName: group.name,
        createdBy: req.userId,
        members: groupMembers.map(m => m.user.toString()),
        timestamp: Date.now()
      };
      
      // Emit to each new member individually
      groupMembers.forEach(member => {
        if (member.user.toString() !== req.userId) { // Don't emit to creator
          io.to(member.user.toString()).emit('groupCreated', groupCreatedEvent);
          console.log(`📢 Emitted groupCreated event to user ${member.user}:`, groupCreatedEvent);
        }
      });
    }

    const populated = await Group.findById(group._id)
      .populate('members.user', 'username profilePicUrl')
      .populate('waitingList', 'username profilePicUrl')
      .populate({ path: 'list', populate: { path: 'items' } });

    res.status(201).json(populated);
  } catch (err) {
    console.error('❌ Error creating group:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /groups/my - OPTIMIZED for performance
exports.getMyGroups = async (req, res) => {
  try {
    // OPTIMIZED: Reduced populate depth and added lean() for better performance
    const groups = await Group.find({ 'members.user': req.userId })
      .populate('members.user', 'username profilePicUrl')
      .populate('waitingList', 'username profilePicUrl')
      .populate({ 
        path: 'list', 
        select: 'name items',
        populate: { 
          path: 'items',
          select: 'name quantity addedBy',
          populate: { path: 'addedBy', select: 'username' }
        }
      })
      .lean(); // Use lean() for better performance
      
    console.log(`👥 Groups API: ${groups.length} groups returned for user ${req.userId}`);
    res.json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /groups/:id
exports.getGroupById = async (req, res) => {
  const { id } = req.params;
  try {
    const group = await Group.findById(id)
      .populate('members.user', 'username profilePicUrl')
      .populate('waitingList', 'username profilePicUrl')
      .populate({ path: 'list', populate: { path: 'items' } });
    if (!group) return res.status(404).json({ message: 'Group not found' });
    // Check if the requesting user is a member
    const isMember = group.members.some(m => m.user && m.user._id && m.user._id.toString() === req.userId);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this group' });
    res.json(group);
  } catch (err) {
    console.error('Error fetching group by id:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /groups/:id/requestJoin
exports.requestJoin = async (req, res) => {
  const { id } = req.params;
  try {
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.members.some(m => m.user.toString() === req.userId))
      return res.status(400).json({ message: 'Already a member' });
    if (group.waitingList.includes(req.userId))
      return res.status(400).json({ message: 'Already requested to join' });
    group.waitingList.push(req.userId);
    await group.save();
    res.json({ message: 'Join request sent' });
  } catch (err) {
    console.error('Request join error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /groups/:id/approveJoin
exports.approveJoin = async (req, res) => {
  const { id } = req.params;
  const { userId, role } = req.body; // role: 'member' or 'admin'
  try {
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const actingMember = group.members.find(m => m.user.toString() === req.userId);
    if (!actingMember || (actingMember.role !== 'owner' && actingMember.role !== 'admin'))
      return res.status(403).json({ message: 'Only owner/admin can approve' });
    if (!group.waitingList.includes(userId))
      return res.status(400).json({ message: 'User not in waiting list' });
    group.waitingList = group.waitingList.filter(u => u.toString() !== userId);
    group.members.push({ user: userId, role: role || 'member' });
    await group.save();
    res.json({ message: 'User approved and added to group' });
  } catch (err) {
    console.error('Approve join error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /groups/:id/rejectJoin
exports.rejectJoin = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const actingMember = group.members.find(m => m.user.toString() === req.userId);
    if (!actingMember || (actingMember.role !== 'owner' && actingMember.role !== 'admin'))
      return res.status(403).json({ message: 'Only owner/admin can reject' });
    if (!group.waitingList.includes(userId))
      return res.status(400).json({ message: 'User not in waiting list' });
    group.waitingList = group.waitingList.filter(u => u.toString() !== userId);
    await group.save();
    res.json({ message: 'User rejected' });
  } catch (err) {
    console.error('Reject join error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /groups/:id/addMember
exports.addMember = async (req, res) => {
  const { id } = req.params; // groupId
  const { identifier } = req.body; // username/email/phone
  try {
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    // Check if requester is owner/admin
    const actingMember = group.members.find(m => m.user.toString() === req.userId);
    if (!actingMember || (actingMember.role !== 'owner' && actingMember.role !== 'admin')) {
      return res.status(403).json({ message: 'Only owner/admin can add members' });
    }
    // Find user to add (case-insensitive)
    const user = await User.findOne({
      $or: [
        { username: new RegExp('^' + identifier + '$', 'i') },
        { email: new RegExp('^' + identifier + '$', 'i') },
        { phone: new RegExp('^' + identifier + '$', 'i') }
      ]
    });
    if (!user) return res.status(400).json({ message: 'User not found' });
    // Check if already a member
    if (group.members.some(m => m.user.toString() === user._id.toString())) {
      return res.status(400).json({ message: 'User already in group' });
    }
    // Add as member
    group.members.push({ user: user._id, role: 'member' });
    await group.save();
    
    // Emit socket event to notify group members about new member
    const io = req.app.get('io');
    if (io) {
      const memberAddedEvent = {
        groupId: id,
        newMember: {
          userId: user._id,
          username: user.username,
          profilePicUrl: user.profilePicUrl,
          role: 'member'
        },
        addedBy: req.userId,
        timestamp: Date.now()
      };
      
      // Emit to the group room
      io.to(id).emit('memberAdded', memberAddedEvent);
      console.log(`📢 Emitted memberAdded event for group ${id}:`, memberAddedEvent);
    }
    
    // Return updated group (populated)
    const updated = await Group.findById(id)
      .populate('members.user', 'username profilePicUrl')
      .populate('waitingList', 'username profilePicUrl')
      .populate({ path: 'list', populate: { path: 'items' } });
    res.json(updated);
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /groups/:id/changeRole
exports.changeRole = async (req, res) => {
  const { id } = req.params;
  const { userId, newRole } = req.body; // newRole: 'admin' or 'member'
  try {
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const actingMember = group.members.find(m => m.user.toString() === req.userId);
    if (!actingMember || actingMember.role !== 'owner')
      return res.status(403).json({ message: 'Only owner can change roles' });
    const member = group.members.find(m => m.user.toString() === userId);
    if (!member) return res.status(404).json({ message: 'User not in group' });
    if (member.role === 'owner')
      return res.status(400).json({ message: 'Cannot change owner role' });
    member.role = newRole;
    await group.save();
    res.json({ message: 'Role updated' });
  } catch (err) {
    console.error('Change role error:', err);
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
    const actingMember = group.members.find(m => m.user.toString() === req.userId);
    if (!actingMember || (actingMember.role !== 'owner' && actingMember.role !== 'admin'))
      return res.status(403).json({ message: 'Only owner/admin can remove users' });
    const member = group.members.find(m => m.user.toString() === userId);
    if (!member) return res.status(404).json({ message: 'User not in group' });
    if (member.role === 'owner')
      return res.status(400).json({ message: 'Cannot remove owner' });
    group.members = group.members.filter(m => m.user.toString() !== userId);
    await group.save();
    res.json({ message: 'User removed from group' });
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
    const member = group.members.find(m => m.user.toString() === req.userId);
    if (!member) return res.status(404).json({ message: 'Not a group member' });
    if (member.role === 'owner') {
      // Transfer ownership to an admin, or member if no admin
      const admins = group.members.filter(m => m.role === 'admin');
      const nextOwner = admins[0] || group.members.find(m => m.user.toString() !== req.userId);
      if (nextOwner) {
        nextOwner.role = 'owner';
        group.members = group.members.filter(m => m.user.toString() !== req.userId);
        await group.save();
        return res.json({ message: 'Ownership transferred and left group' });
      } else {
        // Last member, delete group
        await List.findByIdAndDelete(group.list);
        await group.deleteOne();
        return res.json({ message: 'Group deleted (last member left)' });
      }
    }
    group.members = group.members.filter(m => m.user.toString() !== req.userId);
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
    const actingMember = group.members.find(m => m.user.toString() === req.userId);
    if (!actingMember || actingMember.role !== 'owner')
      return res.status(403).json({ message: 'Only owner can delete the group' });
    await List.findByIdAndDelete(group.list);
    await group.deleteOne();
    res.json({ message: 'Group and shared list deleted successfully' });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
