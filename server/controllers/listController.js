const List = require('../models/List');
const Item = require('../models/Item');
const Group = require('../models/Group');
const PurchaseHistory = require('../models/PurchaseHistory');
const TrainingExample = require('../models/TrainingExample');
const ProductHistory = require('../models/ProductHistory');
const { extractFeaturesForProduct } = require('../services/ml/features');

// 🔁 REUSABLE access-check helper
async function authorizeListAccess(listId, userId) {
  console.log('🔐 authorizeListAccess called');
  console.log('listId:', listId);
  console.log('userId:', userId);
  
  const list = await List.findById(listId).populate('group');
  console.log('List found:', !!list);
  
  if (!list) {
    console.log('❌ List not found');
    return null;
  }
  
  console.log('List owner:', list.owner.toString());
  console.log('Is user owner?', list.owner.toString() === userId);
  
  if (list.group) {
    console.log('Group members:', list.group.members);
    // Check if user is in the members array (members are objects with user and role)
    const isInGroup = list.group.members.some(member => member.user.toString() === userId);
    console.log('Is user in group?', isInGroup);
  }
  
  if (
    list.owner.toString() !== userId &&
    !(list.group && list.group.members.some(member => member.user.toString() === userId))
  ) {
    console.log('❌ Access denied - user is not owner or group member');
    return null;
  }
  
  console.log('✅ Access granted');
  return list;
}

const emitListUpdate = (req, list) => {
  const groupId = list.group?.toString();
  const listId = list._id.toString();
  
  console.log(`📢 Emitting listUpdate to group: ${groupId}, list: ${listId}`);
  
  const io = req.app.get('io');
  
  // Emit to both group room and list room for comprehensive coverage
  if (groupId) {
    io.to(groupId).emit('listUpdate', { 
      listId: listId,
      groupId: groupId,
      timestamp: Date.now(),
      action: 'itemUpdated'
    });
    console.log(`📢 Emitted to group room: ${groupId}`);
  }
  
  if (listId) {
    io.to(listId).emit('listUpdate', { 
      listId: listId,
      groupId: groupId,
      timestamp: Date.now(),
      action: 'itemUpdated'
    });
    console.log(`📢 Emitted to list room: ${listId}`);
  }
  
  // Also emit to owner's room if it's a personal list
  if (!groupId && list.owner) {
    io.to(list.owner.toString()).emit('listUpdate', { 
      listId: listId,
      groupId: null,
      timestamp: Date.now(),
      action: 'itemUpdated'
    });
    console.log(`📢 Emitted to owner room: ${list.owner}`);
  }
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
    await list.populate({
      path: 'items',
      populate: { path: 'addedBy', select: 'username profilePicUrl' }
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /lists
exports.createList = async (req, res) => {
  const { name, items, group } = req.body;
  console.log('POST /lists called');
  console.log('Request body:', req.body);
  console.log('Authenticated userId:', req.userId);
  if (!name) return res.status(400).json({ message: 'List name is required' });

  try {
    if (group) {
      const g = await Group.findById(group);
      if (!g || !g.members.includes(req.userId)) {
        console.log('Not authorized to create list in this group');
        return res.status(403).json({ message: 'Not authorized to create list in this group' });
      }
      if (g.list) {
        console.log('This group already has a shared list');
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
    console.error('❌ Error in createList:', err);
    res.status(500).json({ message: 'Server error', error: err.stack });
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
    console.log('deleteItemById called with itemId:', itemId, 'userId:', req.userId);
    let item = await Item.findById(itemId);
    if (!item) {
      console.log('Item not found');
      return res.status(404).json({ message: 'Item not found' });
    }

    try {
      item.actionHistory.push({
        action: 'deleted',
        userId: req.userId,
        timestamp: new Date(),
        previousState: { ...item.toObject() }
      });
      await item.save();
    } catch (err) {
      if (err.name === 'VersionError') {
        console.log('VersionError: Item was already deleted or modified. Treating as deleted.');
        return res.json({ message: 'Item already deleted' });
      } else {
        throw err;
      }
    }

    const list = await List.findOne({ items: itemId }).populate('group');
    if (!list) {
      console.log('No list found for item, deleting item directly');
      await Item.findByIdAndDelete(itemId);
      return res.json({ message: 'Item deleted (no list found)' });
    }

    const hasAccess =
      list.owner.toString() === req.userId ||
      (list.group && list.group.members.some(m => m.toString() === req.userId));

    if (!hasAccess) {
      console.log('Access denied: user', req.userId, 'is not owner or group member');
      return res.status(403).json({ message: 'Access denied' });
    }

    list.items = list.items.filter(i => i.toString() !== itemId);
    await list.save();
    await Item.findByIdAndDelete(itemId);

    emitListUpdate(req, list); // ✅ notify via socket
    console.log('Item deleted successfully');
    res.json({ message: 'Item deleted', deletedBy: req.userId, deletedAt: new Date(), itemName: item.name });
  } catch (err) {
    console.error('❌ Failed to delete item:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// POST /api/list
exports.addItemToList = async (req, res) => {
  const { name, productId, icon, listId } = req.body;
  if (!name || !productId) {
    return res.status(400).json({ message: 'Product name and productId are required' });
  }
  try {
    const item = new Item({
      name,
      icon,
      product: productId,
      quantity: 1,
      addedBy: req.userId,
      barcode: req.body.barcode || '',
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

    // Log to ProductHistory for ML
    try {
      await ProductHistory.create({
        userId: req.userId,
        productId: productId,
        action: 'added',
        createdAt: new Date()
      });
    } catch (phErr) {
      console.error('Failed to log ProductHistory:', phErr);
    }

    // Feed into ML training system when product is added
    let mlWarning = null;
    if (productId) {
      try {
        const features = await extractFeaturesForProduct(productId, req.userId, list.group);
        const featuresArray = [
          1, // bias term
          features.isFavorite || 0,
          features.purchasedBefore || 0,
          features.timesPurchased || 0,
          features.recentlyPurchased || 0,
          features.timesWasRejectedByUser || 0,
          features.timesWasRejectedByGroup || 0,
          features.groupPopularity || 0,
          features.priceScore || 0,
          features.categoryPopularity || 0
        ];
        await TrainingExample.create({
          productId: productId,
          features: featuresArray,
          label: 1 // 1 = accepted/added
        });
      } catch (mlError) {
        console.error('ML training error:', mlError);
        mlWarning = 'ML training failed: ' + mlError.message;
      }
    }

    emitListUpdate(req, list); // ✅ Emit item addition
    res.status(201).json({ item, mlWarning });
  } catch (err) {
    console.error('❌ Failed to add item:', err);
    res.status(500).json({ message: 'Failed to add item', error: err.message });
  }
};

// POST /lists/:id/items
exports.addItemToListById = async (req, res) => {
  const { name, productId, icon } = req.body;
  const listId = req.params.id;
  console.log('addItemToListById called');
  console.log('Request body:', req.body);
  console.log('Target listId:', listId);
  if (!name || !productId) {
    console.log('Missing name or productId');
    return res.status(400).json({ message: 'Product name and productId are required' });
  }
  try {
    const item = new Item({
      name,
      icon,
      product: productId,
      quantity: 1,
      addedBy: req.userId,
      barcode: req.body.barcode || '',
    });
    await item.save();
    console.log('Item created:', item._id);

    const list = await authorizeListAccess(listId, req.userId);
    if (!list) {
      console.log('Access denied to list');
      return res.status(403).json({ message: 'Access denied' });
    }

    list.items.push(item._id);
    await list.save();
    await item.populate('product');
    console.log('Item added to list and saved');

    // Log to ProductHistory for ML
    try {
      await ProductHistory.create({
        userId: req.userId,
        productId: productId,
        action: 'added',
        createdAt: new Date()
      });
    } catch (phErr) {
      console.error('Failed to log ProductHistory:', phErr);
    }

    let mlWarning = null;
    if (productId) {
      try {
        const features = await extractFeaturesForProduct(productId, req.userId, list.group);
        const featuresArray = [
          1, // bias term
          features.isFavorite || 0,
          features.purchasedBefore || 0,
          features.timesPurchased || 0,
          features.recentlyPurchased || 0,
          features.timesWasRejectedByUser || 0,
          features.timesWasRejectedByGroup || 0,
          features.groupPopularity || 0,
          features.priceScore || 0,
          features.categoryPopularity || 0
        ];
        await TrainingExample.create({
          userId: req.userId,
          productId: productId,
          features: featuresArray,
          label: 1 // 1 = accepted/added
        });
      } catch (mlError) {
        console.error('ML training error:', mlError);
        mlWarning = 'ML training failed: ' + mlError.message;
      }
    }

    emitListUpdate(req, list); // ✅ Emit item addition
    console.log('emitListUpdate called');
    res.status(201).json({ item, mlWarning });
  } catch (err) {
    console.error('❌ Failed to add item:', err);
    res.status(500).json({ message: 'Failed to add item', error: err.message });
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


exports.markItemAsBought = async (req, res) => {
  const { id: itemId } = req.params;

  try {
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const list = await List.findOne({ items: itemId }).populate('group');
    if (!list) return res.status(404).json({ message: 'List not found for this item' });

    const hasAccess =
      list.owner.toString() === req.userId ||
      (list.group && list.group.members.some(m => m.toString() === req.userId));

    if (!hasAccess) return res.status(403).json({ message: 'Access denied' });

    // سجل في التاريخ
    await PurchaseHistory.create({
      name: item.name,
      product: item.product,
      quantity: item.quantity,
      user: req.userId,
      group: list.group?._id || null,
      boughtAt: new Date()
    });

    // Also log to ProductHistory for smart suggestions
    await ProductHistory.create({
      userId: req.userId,
      productId: item.product.toString(),
      listId: list._id,
      action: 'purchased',
      quantity: item.quantity,
      metadata: {
        groupId: list.group?._id || null,
        boughtAt: new Date()
      }
    });

    // احذف من القائمة
    list.items = list.items.filter(i => i.toString() !== itemId);
    await list.save();
    await Item.findByIdAndDelete(itemId);

    emitListUpdate(req, list);
    res.json({ message: 'Item marked as bought and archived' });

  } catch (err) {
    console.error('❌ Failed to mark item as bought:', err);
    res.status(500).json({ message: 'Server error' });
  }
};