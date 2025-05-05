// server.js
const express       = require('express');
const mongoose      = require('mongoose');
const cors          = require('cors');

require('dotenv').config();

const app = express();

app.use(cors());

app.use(express.json());






// auth (login / signup)
app.use('/api/auth', require('./routes/authRoutes'));

// --- your new catalog & pricing endpoints ---
// product catalog
app.use('/api/products', require('./routes/productRoutes'));

// list of stores / supermarkets
app.use('/api/supermarkets', require('./routes/supermarketRoutes'));

// offers: product ↔ supermarket ↔ price
app.use('/api/offers', require('./routes/offerRoutes'));

// --- your existing list endpoints ---
// “basket” endpoint (temporary in-flight shopping list)
app.use('/api/list', require('./routes/shoppingList'));

// saved lists
app.use('/api/lists', require('./routes/listRoutes'));

// suggestions (for autocomplete)
app.use('/api/suggestions', require('./routes/suggestionRoutes'));

// connect to Mongo
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
