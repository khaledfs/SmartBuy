const io = require('socket.io-client');

console.log('🔌 TESTING SOCKET CONNECTION AND FUNCTIONALITY');
console.log('=' .repeat(50));

// Test 1: Basic connection
console.log('\n📡 Test 1: Basic Socket Connection');
const socket = io('http://172.20.10.6:5000', {
  timeout: 5000,
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Socket connected successfully');
  console.log('   Socket ID:', socket.id);
  console.log('   Transport:', socket.io.engine.transport.name);
  
  // Test 2: Join group room
  console.log('\n👥 Test 2: Joining Group Room');
  socket.emit('joinGroup', 'test-group-123');
});

socket.on('joinedGroup', (data) => {
  console.log('✅ Successfully joined group room:', data);
  
  // Test 3: Listen for list updates
  console.log('\n📢 Test 3: Listening for List Updates');
  socket.on('listUpdate', (data) => {
    console.log('✅ Received listUpdate event:', data);
  });
  
  // Test 4: Emit a test list update
  console.log('\n📤 Test 4: Emitting Test List Update');
  socket.emit('listUpdate', { listId: 'test-list-123' });
  
  // Test 5: Join list room
  console.log('\n📋 Test 5: Joining List Room');
  socket.emit('joinList', 'test-list-123');
  
  // Wait a bit then disconnect
  setTimeout(() => {
    console.log('\n🔌 Test 6: Disconnecting');
    socket.disconnect();
    console.log('✅ Socket disconnected');
    console.log('\n🎯 SOCKET TEST COMPLETED');
    process.exit(0);
  }, 2000);
});

socket.on('connect_error', (err) => {
  console.log('❌ Socket connection failed:', err.message);
  console.log('   Error details:', err);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket disconnected:', reason);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - socket may not be responding');
  process.exit(1);
}, 10000);
