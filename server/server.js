// Main server file for SmartBuy application
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');

require('dotenv').config();


// console.log('GOOGLE_MAPS_API_KEY:', process.env.GOOGLE_MAPS_API_KEY); // Debug: check if key is loaded

const app = express();
const server = http.createServer(app); // HTTP server for socket support
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development
  },
});

// Make socket.io available to controllers
app.set('io', io);

// Request logging middleware - only log important requests
app.use((req, res, next) => {
  // Only log non-asset requests and avoid logging product data
  if (!req.url.includes('/api/products') || req.method !== 'GET') {
    console.log(`${req.method} ${req.url}`);
  }
  next();
});

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/supermarkets', require('./routes/supermarketRoutes'));
app.use('/api/offers', require('./routes/offerRoutes'));
app.use('/api/list', require('./routes/listRoutes'));
app.use('/api/lists', require('./routes/listRoutes'));
app.use('/api/suggestions', require('./routes/suggestionRoutes'));
app.use('/api/compare', require('./routes/compareRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/favorites', require('./routes/favoriteRoutes'));
app.use('/api/rejections', require('./routes/rejectionRoutes'));

// Mock endpoint for groups (temporary for testing)
app.get('/api/groups/my', (req, res) => {
  res.json([
    {
      _id: 'dummy-group-id',
      name: 'Sample Group',
      list: { _id: 'dummy-list-id' }
    }
  ]);
});

// TEMPORARY: Debug route to check req.body
// app.post('/test-body', (req, res) => {
//   console.log('BODY:', req.body);
//   res.json({ body: req.body });
// });

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Khalid211:khalidkind211@cluster0.r7gzuda.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-smart-buy-app-2024';

// Set JWT_SECRET globally so authController can access it
process.env.JWT_SECRET = JWT_SECRET;

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Initialize ML model on server startup
const initializeMLModel = async () => {
  try {
    const Weights = require('./models/Weights');
    const latest = await Weights.findOne().sort({ updatedAt: -1 }).lean();

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (latest && now - new Date(latest.updatedAt).getTime() < oneDay) {
      console.log('🤖 ML model is up to date');
      return;
    }

    console.log('🤖 Initializing ML model...');
    console.time('ML model training duration');
    const { trainModel } = require('./services/ml/predictPurchases');
    await trainModel();
    console.timeEnd('ML model training duration');

    if (latest) {
      console.log('✅ ML model retraining complete');
    } else {
      console.log('✅ ML model initial training complete');
    }
  } catch (err) {
    console.error('❌ Error initializing ML model:', err.message);
    console.log('⚠️  ML model will use default weights');
  }
};

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.username = decoded.username;
    
    // Join user's personal room for direct notifications
    socket.join(decoded.id.toString());
    
    console.log(`🔐 Socket authenticated for user: ${decoded.username} (${decoded.id})`);
    next();
  } catch (error) {
    console.log('❌ Socket authentication failed:', error.message);
    next(new Error('Authentication failed'));
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected for user ${socket.username}:`, socket.id);

  // Handle group joining with verification
  socket.on('joinGroup', async (groupId) => {
    try {
      console.log(`👥 User ${socket.id} attempting to join group: ${groupId}`);
      
      // Store groupId in socket for later use
      socket.groupId = groupId;
    socket.join(groupId);
      
    console.log(`👥 Socket ${socket.id} joined group: ${groupId}`);
      
    // Send confirmation to client
    socket.emit('joinedGroup', { groupId, socketId: socket.id });
      
      // Also join the group's list room if available
      try {
        const Group = require('./models/Group');
        const group = await Group.findById(groupId).populate('list');
        if (group && group.list) {
          socket.join(group.list._id.toString());
          console.log(`📋 Socket ${socket.id} also joined list room: ${group.list._id}`);
        }
      } catch (err) {
        console.log(`⚠️ Could not join list room for group ${groupId}:`, err.message);
      }
    } catch (err) {
      console.error(`❌ Error joining group ${groupId}:`, err.message);
      socket.emit('joinGroupError', { groupId, error: err.message });
    }
  });

  // Handle list joining
  socket.on('joinList', (listId) => {
    socket.join(listId);
    console.log(`📋 Socket ${socket.id} joined list: ${listId}`);
  });

  // Handle list updates with improved broadcasting
  socket.on('listUpdate', (data) => {
    const { listId, groupId, action, itemName } = data;
    console.log(`📢 Broadcasting update to list ${listId} and group ${groupId}`);
    console.log(`📢 Action: ${action}, Item: ${itemName || 'N/A'}`);
    
    // Emit to both list room and group room for comprehensive coverage
    if (listId) {
      io.to(listId).emit('listUpdate', { 
        listId, 
        groupId, 
        action,
        itemName,
        timestamp: Date.now()
      });
      console.log(`📢 Emitted to list room: ${listId}`);
    }
    
    if (groupId) {
      io.to(groupId).emit('listUpdate', { 
        listId, 
        groupId, 
        action,
        itemName,
        timestamp: Date.now()
      });
      console.log(`📢 Emitted to group room: ${groupId}`);
    }
  });

  // Handle member added to group (from client socket)
  socket.on('memberAdded', (data) => {
    const { groupId, newMember, addedBy } = data;
    console.log(`👥 Broadcasting memberAdded to group ${groupId}`);
    
    if (groupId) {
      io.to(groupId).emit('memberAdded', {
        groupId,
        newMember,
        addedBy,
        timestamp: Date.now()
      });
      console.log(`📢 Emitted memberAdded to group room: ${groupId}`);
    }
  });

  // Handle suggestion updates (favorites, purchases, etc.)
  socket.on('suggestionUpdate', (data) => {
    const { groupId, productId, userId, action, ...additionalData } = data;
    console.log(`📊 Broadcasting suggestionUpdate to group ${groupId}`);
    
    if (groupId) {
      io.to(groupId).emit('suggestionUpdate', {
        groupId,
        productId,
        userId,
        action,
        ...additionalData,
        timestamp: Date.now()
      });
      console.log(`📢 Emitted suggestionUpdate to group room: ${groupId} - Action: ${action}`);
    }
  });

  // Handle group creation notifications
  socket.on('groupCreated', (data) => {
    const { groupId, groupName, createdBy, members } = data;
    console.log(`👥 Broadcasting groupCreated to members: ${members}`);
    members.forEach(memberId => {
      if (memberId !== createdBy) {
        io.to(memberId).emit('groupCreated', { groupId, groupName, createdBy, timestamp: Date.now() });
        console.log(`📢 Emitted groupCreated to member: ${memberId}`);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 5000;

// Test route to check if server is running
app.get('/', (req, res) => {
  res.send('Backend is working');
});

server.listen(PORT, () => {
  // Get custom branding from environment variables or use defaults
  const APP_NAME = process.env.APP_NAME || 'SmartBuy';
  const DEVELOPER_NAME = process.env.DEVELOPER_NAME || 'Your Name';
  const NETWORK_IP = process.env.NETWORK_IP || '192.168.201.100';
  
  console.log(`🚀 ${APP_NAME} Server Started`);
  console.log(`👨‍💻 Developer: ${DEVELOPER_NAME}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  
  console.log(`🌐 Network: http://${NETWORK_IP}:${PORT}`);
  console.log('📱 QR Code will appear below for mobile testing');
  console.log('─'.repeat(50));
  
  // Initialize ML model after server starts
  setTimeout(initializeMLModel, 2000); // Wait 2 seconds for MongoDB connection
});
