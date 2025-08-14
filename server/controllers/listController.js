const List = require('../models/List');
const Item = require('../models/Item');
const Group = require('../models/Group');
const PurchaseHistory = require('../models/PurchaseHistory');
const TrainingExample = require('../models/TrainingExample');
const ProductHistory = require('../models/ProductHistory');
const { extractFeaturesForProduct } = require('../services/ml/features');

/* ----------------------------- helpers ----------------------------- */

const toId = v => (v?.toString ? v.toString() : String(v));

const groupIdOf = g =>
  g
    ? (g._id ? g._id.toString()
             : (typeof g === 'string' ? g : null))
    : null;

const isMember = (groupDocOrId, userId) => {
  // If it's just an id, assume membership checked elsewhere
  if (!groupDocOrId || typeof groupDocOrId === 'string') return false;
  const members = groupDocOrId.members || [];
  return members.some(m => toId(m.user) === toId(userId));
};

// 🔁 REUSABLE access-check helper
async function authorizeListAccess(listId, userId) {
  const list = await List.findById(listId).populate('group');
  if (!list) return null;

  const owner = toId(list.owner);
  const ok =
    owner === toId(userId) ||
    (list.group && isMember(list.group, userId));

  return ok ? list : null;
}

const emitListUpdate = (req, list, action = 'itemUpdated', itemName = null, itemId = null) => {
  const gid = groupIdOf(list.group);
  const lid = toId(list._id);
  const io = req.app.get('io');

  const updateData = {
    listId: lid,
    groupId: gid,
    timestamp: Date.now(),
    action,
    itemName,
    itemId
  };

  if (gid) io.to(gid).emit('listUpdate', updateData);
  if (lid) io.to(lid).emit('listUpdate', updateData);
  if (!gid && list.owner) io.to(toId(list.owner)).emit('listUpdate', updateData);
};

/* ------------------------------ routes ----------------------------- */

// GET all this user's lists (owned + shared)
exports.getLists = async (req, res) => {
  try {
    const userId = toId(req.userId);

    // groups where the user is a member
    const myGroupIds = await Group.find({ 'members.user': userId }).distinct('_id');

    const lists = await List.find({
      $or: [{ owner: userId }, { group: { $in: myGroupIds } }]
    }).populate('items group');

    res.json(lists);
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
  if (!name) return res.status(400).json({ message: 'List name is required' });

  try {
    if (group) {
      const g = await Group.findById(group);
      if (!g) return res.status(404).json({ message: 'Group not found' });

      const inGroup = g.members.some(m => toId(m.user) === toId(req.userId));
      if (!inGroup) {
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
      const newIds = items.map(i => toId(i));
      const toRemove = list.items.map(i => toId(i)).filter(oldId => !newIds.includes(oldId));
      await Promise.all(toRemove.map(itemId => Item.findByIdAndDelete(itemId)));
      list.items = newIds;
    }

    if (name) list.name = name;

    await list.save();
    await list.populate('items');

    emitListUpdate(req, list, 'listUpdated');
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

    emitListUpdate(req, list, 'listDeleted');
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
    let item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // find the parent list *before* deletion for access + emit
    const list = await List.findOne({ items: itemId }).populate('group');
    if (!list) {
      await Item.findByIdAndDelete(itemId);
      return res.json({ message: 'Item deleted (no list found)' });
    }

    const owner = toId(list.owner) === toId(req.userId);
    const member = list.group && isMember(list.group, req.userId);
    if (!owner && !member) return res.status(403).json({ message: 'Access denied' });

    // audit trail
    try {
      item.actionHistory.push({
        action: 'deleted',
        userId: req.userId,
        timestamp: new Date(),
        previousState: { ...item.toObject() }
      });
      await item.save();
    } catch (err) {
      if (err.name !== 'VersionError') throw err;
      return res.json({ message: 'Item already deleted' });
    }

    // pull from list and delete
    list.items = list.items.filter(i => toId(i) !== toId(itemId));
    await list.save();
    await Item.findByIdAndDelete(itemId);

    emitListUpdate(req, list, 'itemDeleted', item.name, toId(itemId));
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
    const item = await Item.create({
      name,
      icon,
      product: productId,
      quantity: 1,
      addedBy: req.userId,
      barcode: req.body.barcode || ''
    });

    let list;
    if (listId) {
      list = await authorizeListAccess(listId, req.userId);
      if (!list) return res.status(403).json({ message: 'Access denied' });
    } else {
      list = await List.findOne({ owner: req.userId }).sort({ createdAt: -1 });
      if (!list) list = await List.create({ name: 'My List', owner: req.userId, items: [] });
    }

    list.items.push(item._id);
    await list.save();
    await item.populate('product');

    // ProductHistory (best-effort)
    ProductHistory.create({
      userId: req.userId,
      productId,
      action: 'added',
      createdAt: new Date()
    }).catch(e => console.error('Failed to log ProductHistory:', e));

    // Feed into ML training system (best-effort)
    let mlWarning = null;
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
        productId,
        features: featuresArray,
        label: 1 // accepted/added
      });
    } catch (mlError) {
      console.error('ML training error:', mlError);
      mlWarning = 'ML training failed: ' + mlError.message;
    }

    emitListUpdate(req, list, 'itemAdded', item.name, toId(item._id));
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
  if (!name || !productId) {
    return res.status(400).json({ message: 'Product name and productId are required' });
  }
  try {
    const list = await authorizeListAccess(listId, req.userId);
    if (!list) return res.status(403).json({ message: 'Access denied' });

    const item = await Item.create({
      name,
      icon,
      product: productId,
      quantity: 1,
      addedBy: req.userId,
      barcode: req.body.barcode || ''
    });

    list.items.push(item._id);
    await list.save();
    await item.populate('product');

    // ProductHistory (best-effort)
    ProductHistory.create({
      userId: req.userId,
      productId,
      action: 'added',
      createdAt: new Date()
    }).catch(e => console.error('Failed to log ProductHistory:', e));

    let mlWarning = null;
    try {
      const features = await extractFeaturesForProduct(productId, req.userId, list.group);
      const featuresArray = [
        1,
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
        productId,
        features: featuresArray,
        label: 1
      });
    } catch (mlError) {
      console.error('ML training error:', mlError);
      mlWarning = 'ML training failed: ' + mlError.message;
    }

    emitListUpdate(req, list, 'itemAdded', item.name, toId(item._id));
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

    const list = await List.findOne({ items: itemId }).populate('group');
    if (!list) return res.status(404).json({ message: 'List not found for this item' });

    const owner = toId(list.owner) === toId(req.userId);
    const member = list.group && isMember(list.group, req.userId);
    if (!owner && !member) return res.status(403).json({ message: 'Access denied' });

    item.quantity += Number(change || 0);

    if (item.quantity < 1) {
      // remove from list and delete item
      list.items = list.items.filter(i => toId(i) !== toId(itemId));
      await list.save();
      await Item.findByIdAndDelete(itemId);

      emitListUpdate(req, list, 'itemDeleted', item.name, toId(itemId));
      return res.json({ deleted: true });
    }

    await item.save();

    emitListUpdate(req, list, 'itemUpdated', item.name, toId(itemId));
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

    const owner = toId(list.owner) === toId(req.userId);
    const member = list.group && isMember(list.group, req.userId);
    if (!owner && !member) return res.status(403).json({ message: 'Access denied' });

    await PurchaseHistory.create({
      name: item.name,
      product: item.product,
      quantity: item.quantity,
      user: req.userId,
      group: list.group?._id || null,
      boughtAt: new Date()
    });

    await ProductHistory.create({
      userId: req.userId,
      productId: toId(item.product),
      listId: list._id,
      action: 'purchased',
      quantity: item.quantity,
      metadata: {
        groupId: list.group?._id || null,
        boughtAt: new Date()
      }
    });

    list.items = list.items.filter(i => toId(i) !== toId(itemId));
    await list.save();
    await Item.findByIdAndDelete(itemId);

    emitListUpdate(req, list, 'itemPurchased', item.name, toId(itemId));
    res.json({ message: 'Item marked as bought and archived' });
  } catch (err) {
    console.error('❌ Failed to mark item as bought:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
