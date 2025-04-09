const List = require('../models/List');

exports.getLists = async (req, res) => {
  try {
    const lists = await List.find().sort({ createdAt: -1 });
    res.json(lists);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createList = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'List name is required' });

  try {
    const newList = new List({ name });
    await newList.save();
    res.status(201).json(newList);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteList = async (req, res) => {
  try {
    const { id } = req.params;
    await List.findByIdAndDelete(id);
    res.status(200).json({ message: 'List deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
