// server/controllers/listController.js
const List = require('../models/List');
const Item = require('../models/Item');   

// GET all this user’s lists
exports.getLists = async (req, res) => {
  try {
    const lists = await List.find({ owner: req.userId })
                            .populate('items');
    res.json(lists);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET a single list by id
exports.getListById = async (req, res) => {
  try {
    const list = await List.findOne({ _id: req.params.id, owner: req.userId })
                           .populate('items');
    if (!list) return res.status(404).json({ message: 'List not found' });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST (create) a new list
exports.createList = async (req, res) => {
  const { name, items } = req.body;
  if (!name) return res.status(400).json({ message: 'List name is required' });

  try {
    const newList = new List({
      name,
      owner: req.userId,
      items: Array.isArray(items) ? items : []
    });
    await newList.save();
    await newList.populate('items');
    res.status(201).json(newList);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateList = async (req, res) => {
  const { id } = req.params;
  const { name, items } = req.body;

  try {
    // 1. fetch the list (and verify ownership)
    const list = await List.findOne({ _id: id, owner: req.userId });
    if (!list) return res.status(404).json({ message: 'List not found' });

    // 2. if the client sent a new items array, figure out which Item docs to delete
    if (Array.isArray(items)) {
      const newIds = items.map(i => i.toString());
      const toRemove = list.items
        .map(i => i.toString())
        .filter(oldId => !newIds.includes(oldId));

      // 3. delete those removed items from Mongo
      await Promise.all(toRemove.map(itemId => Item.findByIdAndDelete(itemId)));

      // 4. replace the list’s items
      list.items = newIds;
    }

    // 5. optionally update the name
    if (name) list.name = name;

    // 6. save and return
    await list.save();
    await list.populate('items');
    res.json(list);

  } catch (err) {
    console.error('Error updating list:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE a list
exports.deleteList = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find the list by ID and owner
    const list = await List.findOne({ _id: id, owner: req.userId });
    if (!list) {
      return res.status(404).json({ message: 'List not found or not yours' });
    }

    // 2. Delete all associated items
    await Promise.all(list.items.map(itemId => Item.findByIdAndDelete(itemId)));

    // 3. Delete the list itself
    await List.deleteOne({ _id: id });

    res.json({ message: 'List and its items deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};




// POST /api/list → Add one item to user's current list
exports.addItemToList = async (req, res) => {
  const { name, productId, icon } = req.body;
  console.log('📥 Adding item:', { name, productId, icon });

  try {
    const item = new Item({
      name,
      icon,
      product: productId,   // ✅ this links item to the Product
      quantity: 1,
      addedBy: req.userId
    });
    await item.save();

    // Attach to latest list (or create one if none exists)
    let list = await List.findOne({ owner: req.userId }).sort({ createdAt: -1 });
    if (!list) {
      list = new List({ name: 'My List', owner: req.userId, items: [] });
    }

    list.items.push(item._id);
    await list.save();
    await item.populate('product');

    res.status(201).json(item);
  } catch (err) {
    console.error('❌ Failed to add item:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


