const io = require('socket.io-client');

console.log('🧪 TESTING GROUP SOCKET FUNCTIONALITY');
console.log('=' .repeat(50));

// Test multiple clients to simulate group members
const clients = [];
const testGroupId = 'test-group-123';
const testListId = 'test-list-456';

// Create 3 test clients to simulate group members
for (let i = 1; i <= 3; i++) {
  const client = io('http://172.20.10.6:5000', {
    timeout: 5000,
    transports: ['websocket', 'polling']
  });
  
  client.name = `Client-${i}`;
  clients.push(client);
  
  client.on('connect', () => {
    console.log(`✅ ${client.name} connected:`, client.id);
    
    // Join the test group
    client.emit('joinGroup', testGroupId);
  });
  
  client.on('joinedGroup', (data) => {
    console.log(`👥 ${client.name} joined group:`, data);
  });
  
  client.on('listUpdate', (data) => {
    console.log(`📢 ${client.name} received listUpdate:`, data);
  });
  
  client.on('connect_error', (err) => {
    console.log(`❌ ${client.name} connection error:`, err.message);
  });
}

// Wait for all clients to connect, then test list updates
setTimeout(() => {
  console.log('\n📤 TESTING LIST UPDATE BROADCASTING');
  console.log('=' .repeat(40));
  
  // Simulate a list update from client 1
  console.log(`\n📤 ${clients[0].name} emitting listUpdate...`);
  clients[0].emit('listUpdate', { 
    listId: testListId, 
    groupId: testGroupId 
  });
  
  // Wait a bit, then disconnect all clients
  setTimeout(() => {
    console.log('\n🔌 DISCONNECTING ALL CLIENTS');
    clients.forEach(client => {
      client.disconnect();
    });
    
    console.log('✅ All clients disconnected');
    console.log('\n🎯 GROUP SOCKET TEST COMPLETED');
    console.log('\n📊 EXPECTED RESULTS:');
    console.log('✅ All 3 clients should connect successfully');
    console.log('✅ All 3 clients should join the group room');
    console.log('✅ All 3 clients should receive the listUpdate event');
    console.log('✅ Real-time updates should work for group members');
    
    process.exit(0);
  }, 3000);
  
}, 2000);

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout');
  clients.forEach(client => client.disconnect());
  process.exit(1);
}, 10000);
