const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// שימוש בנתיבים (Routes):
app.use('/api/list', require('./routes/shoppingList'));
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const listRoutes = require('./routes/listRoutes');
app.use('/api/lists', listRoutes);

const suggestionRoutes = require('./routes/suggestionRoutes');
app.use('/api/suggestions', suggestionRoutes);


// התחברות ל-MongoDB:
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
