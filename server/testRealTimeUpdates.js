const io = require('socket.io-client');
const axios = require('axios');

console.log('🧪 TESTING REAL-TIME UPDATES FOR GROUP SYSTEM');
console.log('=' .repeat(60));

// Configuration
const SERVER_URL = 'http://172.20.10.6:5000';
const API_URL = 'http://172.20.10.6:5000/api';

// Test data
const testGroupId = 'test-group-real-time-123';
const testListId = 'test-list-real-time-456';

// Simulate multiple clients
const clients = [];
const clientNames = ['Alice', 'Bob', 'Charlie'];

console.log('\n📱 SIMULATING MULTIPLE PHONES:');
console.log(`   - ${clientNames[0]} (Client 1)`)
console.log(`   - ${clientNames[1]} (Client 2)`)
console.log(`   - ${clientNames[2]} (Client 3)`)

// Create 3 test clients to simulate different phones
for (let i = 0; i < 3; i++) {
  const client = io(SERVER_URL, {
    timeout: 5000,
    transports: ['websocket', 'polling']
  });
  
  client.name = clientNames[i];
  client.receivedUpdates = [];
  clients.push(client);
  
  // Connection events
  client.on('connect', () => {
    console.log(`✅ ${client.name} connected: ${client.id}`);
    
    // Join the test group
    client.emit('joinGroup', testGroupId);
  });
  
  client.on('joinedGroup', (data) => {
    console.log(`👥 ${client.name} joined group: ${data.groupId}`);
  });
  
  // Listen for list updates
  client.on('listUpdate', (data) => {
    console.log(`📢 ${client.name} received listUpdate:`, data);
    client.receivedUpdates.push(data);
  });
  
  client.on('connect_error', (err) => {
    console.log(`❌ ${client.name} connection error:`, err.message);
  });
  
  client.on('disconnect', (reason) => {
    console.log(`🔌 ${client.name} disconnected:`, reason);
  });
}

// Wait for all clients to connect, then test real-time updates
setTimeout(async () => {
  console.log('\n📤 TESTING REAL-TIME UPDATE SCENARIOS');
  console.log('=' .repeat(50));
  
  // Test 1: Client 1 emits a list update
  console.log('\n🔍 Test 1: Alice adds an item to the shared list');
  clients[0].emit('listUpdate', { 
    listId: testListId, 
    groupId: testGroupId,
    action: 'itemAdded',
    itemName: 'Milk'
  });
  
  // Wait for updates to propagate
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Client 2 emits a list update
  console.log('\n🔍 Test 2: Bob adds another item to the shared list');
  clients[1].emit('listUpdate', { 
    listId: testListId, 
    groupId: testGroupId,
    action: 'itemAdded',
    itemName: 'Bread'
  });
  
  // Wait for updates to propagate
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: Client 3 emits a list update
  console.log('\n🔍 Test 3: Charlie removes an item from the shared list');
  clients[2].emit('listUpdate', { 
    listId: testListId, 
    groupId: testGroupId,
    action: 'itemRemoved',
    itemName: 'Milk'
  });
  
  // Wait for updates to propagate
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Analyze results
  console.log('\n📊 REAL-TIME UPDATE ANALYSIS');
  console.log('=' .repeat(40));
  
  clients.forEach((client, index) => {
    console.log(`\n📱 ${client.name} (Client ${index + 1}):`);
    console.log(`   Total updates received: ${client.receivedUpdates.length}`);
    
    if (client.receivedUpdates.length > 0) {
      client.receivedUpdates.forEach((update, updateIndex) => {
        console.log(`   Update ${updateIndex + 1}: ${update.action} - ${update.itemName || 'N/A'}`);
      });
    } else {
      console.log(`   ❌ No updates received`);
    }
  });
  
  // Test summary
  console.log('\n🎯 TEST SUMMARY:');
  console.log('=' .repeat(30));
  
  const totalUpdates = clients.reduce((sum, client) => sum + client.receivedUpdates.length, 0);
  const expectedUpdates = 3; // 3 updates emitted
  
  console.log(`📤 Updates emitted: ${expectedUpdates}`);
  console.log(`📥 Updates received: ${totalUpdates}`);
  console.log(`📊 Success rate: ${((totalUpdates / (expectedUpdates * 3)) * 100).toFixed(1)}%`);
  
  if (totalUpdates >= expectedUpdates * 2) {
    console.log('✅ REAL-TIME UPDATES ARE WORKING WELL!');
  } else if (totalUpdates >= expectedUpdates) {
    console.log('⚠️ REAL-TIME UPDATES ARE PARTIALLY WORKING');
  } else {
    console.log('❌ REAL-TIME UPDATES ARE NOT WORKING PROPERLY');
  }
  
  // Test API integration (simulate adding items via API)
  console.log('\n🔗 TESTING API INTEGRATION');
  console.log('=' .repeat(30));
  
  try {
    console.log('📡 Testing API connectivity...');
    const response = await axios.get(`${API_URL}/products?limit=1`);
    console.log('✅ API is accessible');
    console.log(`   Found ${response.data.length} products`);
  } catch (error) {
    console.log('❌ API connectivity issue:', error.message);
  }
  
  // Cleanup
  setTimeout(() => {
    console.log('\n🔌 DISCONNECTING ALL CLIENTS');
    clients.forEach(client => {
      client.disconnect();
    });
    
    console.log('✅ All clients disconnected');
    console.log('\n🎉 REAL-TIME UPDATE TEST COMPLETED');
    console.log('\n📋 RECOMMENDATIONS:');
    console.log('✅ If success rate > 66%: Real-time updates are working');
    console.log('⚠️ If success rate 33-66%: Some issues, check network');
    console.log('❌ If success rate < 33%: Major issues, check socket implementation');
    
    process.exit(0);
  }, 2000);
  
}, 3000);

// Timeout after 15 seconds
setTimeout(() => {
  console.log('⏰ Test timeout');
  clients.forEach(client => client.disconnect());
  process.exit(1);
}, 15000);
