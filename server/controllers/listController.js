const List = require('../models/List');
const Item = require('../models/Item');
const Group = require('../models/Group');

// 🔁 REUSABLE access-check helper
async function authorizeListAccess(listId, userId) {
  const list = await List.findById(listId).populate('group');
  if (
    !list ||
    (
      list.owner.toString() !== userId &&
      !(list.group && list.group.members.some(m => m.toString() === userId))
    )
  ) {
    return null;
  }
  return list;
}

const emitListUpdate = (req, list) => {
  const groupId = list.group?.toString();
  const roomId = groupId || list.owner.toString();
  req.app.get('io').to(roomId).emit('listUpdate');
};

// GET all this user’s lists (owned + shared)
exports.getLists = async (req, res) => {
  try {
    const ownedLists = await List.find({ owner: req.userId }).populate('items');
    const groupLists = await List.find({ group: { $ne: null } })
      .populate('items group')
      .where('group')
      .in(await Group.find({ members: req.userId }).distinct('_id'));

    res.json([...ownedLists, ...groupLists]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /lists/:id
exports.getListById = async (req, res) => {
  try {
    const list = await authorizeListAccess(req.params.id, req.userId);
    if (!list) return res.status(403).json({ message: 'Access denied' });
    await list.populate('items');
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /lists
exports.createList = async (req, res) => {
  const { name, items, group } = req.body;
  if (!name) return res.status(400).json({ message: 'List name is required' });

  try {
    if (group) {
      const g = await Group.findById(group);
      if (!g || !g.members.includes(req.userId)) {
        return res.status(403).json({ message: 'Not authorized to create list in this group' });
      }
      if (g.list) {
        return res.status(400).json({ message: 'This group already has a shared list' });
      }
    }

    const newList = new List({
      name,
      owner: req.userId,
      items: Array.isArray(items) ? items : [],
      group: group || null
    });

    await newList.save();
    await newList.populate('items');
    res.status(201).json(newList);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /lists/:id
exports.updateList = async (req, res) => {
  const { id } = req.params;
  const { name, items } = req.body;

  try {
    const list = await authorizeListAccess(id, req.userId);
    if (!list) return res.status(403).json({ message: 'Access denied' });

    if (Array.isArray(items)) {
      const newIds = items.map(i => i.toString());
      const toRemove = list.items.map(i => i.toString()).filter(oldId => !newIds.includes(oldId));
      await Promise.all(toRemove.map(itemId => Item.findByIdAndDelete(itemId)));
      list.items = newIds;
    }

    if (name) list.name = name;

    await list.save();
    await list.populate('items');

    emitListUpdate(req, list); // ✅ Emit list change
    res.json(list);
  } catch (err) {
    console.error('Error updating list:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /lists/:id
exports.deleteList = async (req, res) => {
  try {
    const list = await authorizeListAccess(req.params.id, req.userId);
    if (!list) return res.status(403).json({ message: 'Access denied' });

    await Promise.all(list.items.map(itemId => Item.findByIdAndDelete(itemId)));
    await List.deleteOne({ _id: list._id });

    emitListUpdate(req, list); // ✅ Emit removal
    res.json({ message: 'List and its items deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /list/item/:itemId
exports.deleteItemById = async (req, res) => {
  const { itemId } = req.params;

  try {
    const list = await List.findOne({ items: itemId }).populate('group');
    if (!list) return res.status(404).json({ message: 'List not found for this item' });

  
    const hasAccess =
      list.owner.toString() === req.userId ||
      (list.group && list.group.members.some(m => m.toString() === req.userId));

    if (!hasAccess) return res.status(403).json({ message: 'Access denied' });

    list.items = list.items.filter(i => i.toString() !== itemId);
    await list.save();
    await Item.findByIdAndDelete(itemId);

    emitListUpdate(req, list); // ✅ notify via socket
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('❌ Failed to delete item:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// POST /api/list
exports.addItemToList = async (req, res) => {
  const { name, productId, icon, listId } = req.body;
  console.log('📥 Adding item:', { name, productId, icon });

  try {
    const item = new Item({
      name,
      icon,
      product: productId,
      quantity: 1,
      addedBy: req.userId
    });
    await item.save();

    let list;
    if (listId) {
      list = await authorizeListAccess(listId, req.userId);
      if (!list) return res.status(403).json({ message: 'Access denied' });
    } else {
      list = await List.findOne({ owner: req.userId }).sort({ createdAt: -1 });
      if (!list) {
        list = new List({ name: 'My List', owner: req.userId, items: [] });
        await list.save();
      }
    }

    list.items.push(item._id);
    await list.save();
    await item.populate('product');

    emitListUpdate(req, list); // ✅ Emit item addition
    res.status(201).json(item);
  } catch (err) {
    console.error('❌ Failed to add item:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /lists/:id/items
exports.addItemToListById = async (req, res) => {
  const { name, productId, icon } = req.body;
  const listId = req.params.id;
  console.log('📥 Adding item to list:', listId, { name, productId });

  try {
    const item = new Item({
      name,
      icon,
      product: productId,
      quantity: 1,
      addedBy: req.userId
    });
    await item.save();

    const list = await authorizeListAccess(listId, req.userId);
    if (!list) return res.status(403).json({ message: 'Access denied' });

    list.items.push(item._id);
    await list.save();
    await item.populate('product');

    emitListUpdate(req, list); // ✅ Emit item addition
    res.status(201).json(item);
  } catch (err) {
    console.error('❌ Failed to add item:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /list/item/:itemId/quantity
exports.updateQuantity = async (req, res) => {
  const { itemId } = req.params;
  const { change } = req.body;

  try {
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.quantity += change;

    if (item.quantity < 1) {
      await item.remove();

      // emit listUpdate to group if item was removed
      const list = await List.findOne({ items: itemId }).populate('group');
      if (list) emitListUpdate(req, list);

      return res.json({ deleted: true });
    }

    await item.save();

    // emit listUpdate to group if item was changed
    const list = await List.findOne({ items: itemId }).populate('group');
    if (list) emitListUpdate(req, list);

    res.json(item);
  } catch (err) {
    console.error('❌ Quantity update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
