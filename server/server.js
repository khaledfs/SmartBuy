// server.js
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');

require('dotenv').config();

const app = express();
const server = http.createServer(app); // use raw HTTP server for socket support
const io = new Server(server, {
  cors: {
    origin: '*', // adjust for production
  },
});

// Attach io to app so controllers can emit events
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Auth
app.use('/api/auth', require('./routes/authRoutes'));

// Catalog & pricing
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/supermarkets', require('./routes/supermarketRoutes'));
app.use('/api/offers', require('./routes/offerRoutes'));

// Shopping lists
app.use('/api/list', require('./routes/listRoutes'));
app.use('/api/lists', require('./routes/listRoutes'));

// Suggestions
app.use('/api/suggestions', require('./routes/suggestionRoutes'));

// Price comparison
app.use('/api/compare', require('./routes/compareRoutes'));

// Groups
app.use('/api/groups', require('./routes/groupRoutes'));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// 🔌 Socket.IO
io.on('connection', (socket) => {
  console.log('📡 Socket connected:', socket.id);

  // GROUPS
  socket.on('joinGroup', (groupId) => {
    socket.join(groupId);
    console.log(`👥 Socket ${socket.id} joined group: ${groupId}`);
  });

  // LISTS
  socket.on('joinList', (listId) => {
    socket.join(listId);
    console.log(`🛒 Socket ${socket.id} joined list: ${listId}`);
  });

  socket.on('listUpdate', ({ listId }) => {
    console.log(`🔄 Broadcasting update to list ${listId}`);
    io.to(listId).emit('listUpdate', { listId });
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
