const Item = require('../models/Item');

// קריאת כל הפריטים
exports.getItems = async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('Server error on getItems:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// הוספת פריט
exports.addItem = async (req, res) => {
    console.log('📥 Incoming item:', req.body);
  const { name, price, quantity, addedBy } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const newItem = new Item({
      name,
      price: price || 1,
      quantity: quantity || 1,
      addedBy
    });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    console.error('Server error on addItem:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// עדכון פריט (למשל שינוי כמות/מחיר)
exports.updateItem = async (req, res) => {
  const { id } = req.params;
  const { name, price, quantity } = req.body;

  try {
    const updated = await Item.findByIdAndUpdate(
      id,
      { name, price, quantity },
      { new: true } // מחזיר את הפריט המעודכן
    );
    res.json(updated);
  } catch (err) {
    console.error('Server error on updateItem:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// מחיקת פריט
exports.deleteItem = async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Server error on deleteItem:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};
