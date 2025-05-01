// server/controllers/listController.js
const List = require('../models/List');

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

// PATCH (update) list name and/or items
exports.updateList = async (req, res) => {
  const { name, items } = req.body;
  const updateObj = {};
  if (name)  updateObj.name  = name;
  if (items) updateObj.items = Array.isArray(items) ? items : [];

  try {
    const updated = await List.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      updateObj,
      { new: true }
    ).populate('items');

    if (!updated) return res.status(404).json({ message: 'List not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE a list
exports.deleteList = async (req, res) => {
  try {
    await List.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    res.json({ message: 'List deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/lists/:id
exports.getList = async (req, res) => {
  try {
    const { id } = req.params;
    const list = await List.findOne({ _id: id, owner: req.userId }).populate('items');
    if (!list) return res.status(404).json({ message: 'List not found' });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

