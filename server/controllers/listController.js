const List = require('../models/List');
const Item = require('../models/Item');
const Group = require('../models/Group');
const PurchaseHistory = require('../models/PurchaseHistory');
const TrainingExample = require('../models/TrainingExample');
const ProductHistory = require('../models/ProductHistory');
const { extractFeaturesForProduct } = require('../services/ml/features');
const ProductFreq = require('../models/ProductFreq');
// 🔁 REUSABLE access-check helper
async function authorizeListAccess(listId, userId) {
  console.log('🔐 authorizeListAccess called');


  const list = await List.findById(listId).populate('group');
  console.log('List found:', !!list);

  if (!list) {
    console.log('❌ List not found');
    return null;
  }


  if (list.group) {
    // Check if user is in the members array (members are objects with user and role)
    const isInGroup = list.group.members.some(member => member.user.toString() === userId);
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

const emitListUpdate = (req, list, action = 'itemUpdated', itemName = null, itemId = null) => {
  const groupId = list.group?.toString();
  const listId = list._id.toString();


  const io = req.app.get('io');

  const updateData = {
    listId: listId,
    groupId: groupId,
    timestamp: Date.now(),
    action: action,
    itemName: itemName,
    itemId: itemId
  };

  // Emit to both group room and list room for comprehensive coverage
  if (groupId) {
    io.to(groupId).emit('listUpdate', updateData);
  }

  if (listId) {
    io.to(listId).emit('listUpdate', updateData);
  }

  // Also emit to owner's room if it's a personal list
  if (!groupId && list.owner) {
    io.to(list.owner.toString()).emit('listUpdate', updateData);
  }
};

// GET all this user's lists (owned + shared)
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
      populate: {
        path: 'product',
        select: 'name barcode image price'
      }
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /lists
exports.createList = async (req, res) => {
  try {
    const { name, groupId } = req.body;
    const list = new List({
      name,
      owner: req.userId,
      group: groupId || null
    });
    await list.save();
    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /lists/:id
exports.updateList = async (req, res) => {
  try {
    const list = await authorizeListAccess(req.params.id, req.userId);
    if (!list) return res.status(403).json({ message: 'Access denied' });

    Object.assign(list, req.body);
    await list.save();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};




const DAY_MS = 24 * 60 * 60 * 1000;

async function recordAddAndUpdateGap({
  barcode,            // string (preferred, but will be fetched if missing)
  groupId,            // ObjectId|string (required)
  productId = null,   // ObjectId|string (preferred)
  productname = '',    // string (optional)
  quantity = 1        // number (optional, default 1)
}) {
  console.log('recordAddAndUpdateGap called with:', { barcode, groupId, productId, productname });
  if (!groupId) throw new Error('groupId is required');
  if (!productId && !barcode) throw new Error('productId or barcode is required');

  // If productId present but we lack barcode/name, pull from Product
  if (productId && (!barcode || !productname)) {
    const p = await Product.findById(productId).select('barcode name').lean();
    if (p) {
      if (!barcode) barcode = p.barcode || '';
      if (!productname) productname = p.name || productname;
    }
  }

  if (!productId && barcode) {
    const p = await Product.findOne({ barcode }).select('_id name').lean();
    if (p) {
      productId = p._id;
      if (!productname) productname = p.name || productname;
    }
  }

  if (!productId) throw new Error('Unable to resolve productId');

  let doc =
    (await ProductFreq.findOne({ product: productId, group: groupId })) ||
    (barcode ? await ProductFreq.findOne({ productbarcode: barcode, group: groupId }) : null);

  const now = new Date();

  if (!doc) {
    try {
      return await ProductFreq.create({
        productname: productname || 'Unknown',
        productbarcode: barcode || '',
        product: productId,
        group: groupId,
        addedgap: 0,
        gapCount: 0,
        totaladded: quantity,
        lastAdded: now,
        createdAt: now
      });
    } catch (err) {
      if (err && err.code === 11000) {
        doc =
          (await ProductFreq.findOne({ product: productId, group: groupId })) ||
          (barcode ? await ProductFreq.findOne({ productbarcode: barcode, group: groupId }) : null);
        if (!doc) throw err;
      } else {
        throw err;
      }
    }
  }

  const updates = { $inc: { totaladded: quantity}, $set: { lastAdded: now } };

  if (String(doc.product) !== String(productId)) updates.$set.product = productId;
  if (barcode && doc.productbarcode !== barcode) updates.$set.productbarcode = barcode;
  if (productname && !doc.productname) updates.$set.productname = productname;

  if (doc.lastAdded) {
    const days = Math.max(0, (now - doc.lastAdded) / DAY_MS);
    if (true) {
      const prevAvg = doc.addedgap || 0;
      const n = doc.gapCount || 0;
      const newAvg = n === 0 ? days : ((prevAvg * n) + days) / (n + 1);
      updates.$set.addedgap = newAvg;
      updates.$inc.gapCount = 1;
    }
  }
  return ProductFreq.findByIdAndUpdate(doc._id, updates, { new: true });
}
exports.addItemToList = async (req, res) => {
  try {
    const { id } = req.params; // listId
    const { name, productId, barcode, icon } = req.body;
    const List = require('../models/List');
    const Item = require('../models/Item');

    const list = await List.findById(id).populate('items');
    if (!list) return res.status(404).json({ message: 'List not found' });

    // Check for existing item by productId or name
    let existing = list.items.find(
      i => (i.productId && productId && i.productId.toString() === productId.toString()) ||
        (i.name && name && i.name.toLowerCase() === name.toLowerCase())
    );
    if (existing) {
      console.log('Item already in list, incrementing quantity');
      existing.quantity = (existing.quantity || 1) + 1;
      await existing.save();

      return res.json(existing);
    }

    // If not found, create new item
    const item = new Item({
      name,
      productId,
      barcode,
      icon,
      quantity: 1,
      addedBy: req.userId,
    });
    await item.save();

    list.items.push(item._id);
    await list.save();
    let mlWarning = null;
    if (productId) {
      try {
        const features = await extractFeaturesForProduct(productId, req.userId, list.group._id);
        const featuresArray = {
          bias: 1,
          isFavorite: features.isFavorite || 0,
          addedBefore: features.addedBefore || 0,
          timesAdded: features.timesAdded || 0,
          recentlyadded: features.recentlyadded || 0,
          AddedFrequency: features.AddedFrequency || 0,
          timesRejected: features.timesRejected || 0,
        };
        console.log('Extracted features for ML:', featuresArray);
        await TrainingExample.create({
          userId: req.userId,
          productId: productId,
          features: featuresArray,
          label: 1
        });
      } catch (mlError) {
        console.error('ML training error:', mlError);
        mlWarning = 'ML training failed: ' + mlError.message;
      }
    }


    emitListUpdate(req, list, 'itemAdded', item.name, item._id);
    await recordAddAndUpdateGap({ barcode, groupId: list.group._id, productId, productname: name }).catch(err => {
      console.log('RecordAddAndUpdateGap error:', err.message);
    })
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.stack });
  }
};


// DELETE /lists/:id/items/:itemId
exports.deleteItemById = async (req, res) => {
  try {
    const { id: listId, itemId } = req.params;

    const list = await authorizeListAccess(listId, req.userId);
    if (!list) {
      console.log('Access denied to list');
      return res.status(403).json({ message: 'Access denied' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Remove item from list
    list.items = list.items.filter(id => id.toString() !== itemId);
    await list.save();

    // Delete the item
    await Item.findByIdAndDelete(itemId);

    console.log('Item deleted from list');

    emitListUpdate(req, list, 'itemDeleted', item.name, itemId); // ✅ Emit item deletion

    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('❌ Failed to delete item:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /lists/:id/items/:itemId/buy
exports.markItemAsBought = async (req, res) => {
  try {

    const { id: listId, itemId } = req.params;

    const list = await authorizeListAccess(listId, req.userId);
    if (!list) {
      console.log('Access denied to list');
      return res.status(403).json({ message: 'Access denied' });
    }


    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    // Log purchase history
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

    // Remove item from list
    list.items = list.items.filter(id => id.toString() !== itemId);
    await list.save();

    // Delete the item
    await Item.findByIdAndDelete(itemId);

    console.log('Item marked as bought and archived');

    emitListUpdate(req, list, 'itemPurchased', item.name, itemId); // ✅ Emit item purchase
    res.json({ message: 'Item marked as bought and archived' });
  } catch (err) {
    console.error('❌ Failed to mark item as bought:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /lists/:id/items/:itemId/qty
exports.updateItemQty = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { quantity, name, productId, barcode, icon } = req.body;
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    const List = require('../models/List');
    const Item = require('../models/Item');

    const list = await List.findById(id).populate('items');
    if (!list) return res.status(404).json({ message: 'List not found' });


    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    let oldQty = item.quantity || 1;
    item.quantity = quantity;
    let itemChanged = quantity - oldQty;
    console.log('Item quantity change:', oldQty, '->', quantity, ' (change:', itemChanged, ')');
    await item.save();
    let mlWarning = null;
    if (itemChanged > 0) {
      if (productId) {

        try {
          const features = await extractFeaturesForProduct(productId, req.userId, list.group._id);

          const featuresArray = {
            bias: 1,
            isFavorite: features.isFavorite || 0,
            addedBefore: features.addedBefore || 0,
            timesAdded: features.timesAdded || 0,
            recentlyadded: features.recentlyadded || 0,
            AddedFrequency: features.AddedFrequency || 0,
            timesRejected: features.timesRejected || 0,
          };
          console.log('Extracted features for ML:', featuresArray);
          await TrainingExample.create({
            userId: req.userId,
            productId: productId,
            features: featuresArray,
            label: 1
          });
        } catch (mlError) {
          console.error('ML training error:', mlError);
          mlWarning = 'ML training failed: ' + mlError.message;
        }
      }
      await recordAddAndUpdateGap({ barcode, groupId: list.group._id, productId, productname: name, quantity: itemChanged }).catch(err => {
        console.log('RecordAddAndUpdateGap error:', err.message);
      })
    }
    emitListUpdate(req, list, 'itemAdded', item.name, item._id);

  
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.stack });
  }
};
