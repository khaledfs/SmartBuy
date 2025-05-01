const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '3d' });
};

// controllers/authController.js
exports.signup = async (req, res) => {
  const { username, phone, password } = req.body;
  if (!username || !phone || !password)
    return res.status(400).json({ message: 'All fields are required' });

  try {
    // ONE round-trip to the DB
    const existingUser = await User.findOne({
      $or: [{ username }, { phone }]
    });

    if (existingUser) {
      const field = existingUser.username === username ? 'username' : 'phone';
      return res.status(409).json({ message: `${field} already exists` });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, phone, password: hashed });

    const token = createToken(newUser._id);
    res.status(201).json({ message: 'User created', token });
  } catch (err) {
    // duplicate-key fallback (if unique index catches it first)
    if (err.code === 11000) {
      const dupField = Object.keys(err.keyValue)[0];
      return res.status(409).json({ message: `${dupField} already exists` });
    }
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// controllers/authController.js
exports.login = async (req, res) => {
  const { identifier, password } = req.body;          
  if (!identifier || !password) {
    return res
      .status(400)
      .json({ message: 'Identifier (username or phone) and password required' });
  }

  try {
    // one query, two possible matches
    const user = await User.findOne({
      $or: [{ username: identifier }, { phone: identifier }]
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = createToken(user._id);
    res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

