const io = require('socket.io-client');

console.log('📱 SIMULATING CLIENT REAL-TIME UPDATE SCENARIO');
console.log('=' .repeat(55));

// Configuration
const SERVER_URL = 'http://172.20.10.6:5000';

// Simulate a real group scenario
const groupId = 'family-group-123';
const listId = 'family-shopping-list-456';

// Create 2 clients: one adding items, one watching
const client1 = io(SERVER_URL, { timeout: 5000 });
const client2 = io(SERVER_URL, { timeout: 5000 });

client1.name = 'Mom (Adding Items)';
client2.name = 'Dad (Watching Updates)';

let client1Connected = false;
let client2Connected = false;
let updatesReceived = 0;

// Client 1: The one adding items
client1.on('connect', () => {
  console.log(`✅ ${client1.name} connected: ${client1.id}`);
  client1Connected = true;
  client1.emit('joinGroup', groupId);
});

client1.on('joinedGroup', (data) => {
  console.log(`👥 ${client1.name} joined group: ${data.groupId}`);
});

client1.on('listUpdate', (data) => {
  console.log(`📢 ${client1.name} received update: ${data.action || 'update'}`);
  updatesReceived++;
});

// Client 2: The one watching for updates
client2.on('connect', () => {
  console.log(`✅ ${client2.name} connected: ${client2.id}`);
  client2Connected = true;
  client2.emit('joinGroup', groupId);
});

client2.on('joinedGroup', (data) => {
  console.log(`👥 ${client2.name} joined group: ${data.groupId}`);
});

client2.on('listUpdate', (data) => {
  console.log(`📢 ${client2.name} received update: ${data.action || 'update'}`);
  updatesReceived++;
});

// Error handling
[client1, client2].forEach(client => {
  client.on('connect_error', (err) => {
    console.log(`❌ ${client.name} connection error:`, err.message);
  });
  
  client.on('disconnect', (reason) => {
    console.log(`🔌 ${client.name} disconnected:`, reason);
  });
});

// Wait for both clients to connect, then simulate real scenario
setTimeout(() => {
  if (!client1Connected || !client2Connected) {
    console.log('❌ One or both clients failed to connect');
    process.exit(1);
  }
  
  console.log('\n🛒 SIMULATING REAL SHOPPING SCENARIO');
  console.log('=' .repeat(40));
  
  // Simulate Mom adding items to the family shopping list
  const shoppingItems = [
    { name: 'Milk', action: 'itemAdded' },
    { name: 'Bread', action: 'itemAdded' },
    { name: 'Eggs', action: 'itemAdded' },
    { name: 'Bananas', action: 'itemAdded' },
    { name: 'Milk', action: 'itemRemoved' } // Mom removes milk (already bought)
  ];
  
  let itemIndex = 0;
  
  const addNextItem = () => {
    if (itemIndex >= shoppingItems.length) {
      // Test completed
      setTimeout(() => {
        console.log('\n📊 SCENARIO TEST RESULTS');
        console.log('=' .repeat(30));
        console.log(`📤 Items added/removed: ${shoppingItems.length}`);
        console.log(`📥 Updates received: ${updatesReceived}`);
        console.log(`📊 Success rate: ${((updatesReceived / (shoppingItems.length * 2)) * 100).toFixed(1)}%`);
        
        if (updatesReceived >= shoppingItems.length * 1.5) {
          console.log('✅ REAL-TIME UPDATES ARE WORKING PERFECTLY!');
          console.log('   Your client should see updates immediately when others add items.');
        } else if (updatesReceived >= shoppingItems.length) {
          console.log('⚠️ REAL-TIME UPDATES ARE MOSTLY WORKING');
          console.log('   Some updates might be missed, but overall functionality is good.');
        } else {
          console.log('❌ REAL-TIME UPDATES ARE NOT WORKING PROPERLY');
          console.log('   Your client will not see updates when others add items.');
        }
        
        // Cleanup
        client1.disconnect();
        client2.disconnect();
        
        console.log('\n🎯 WHAT THIS MEANS FOR YOUR CLIENT:');
        console.log('=' .repeat(40));
        console.log('✅ If success rate > 75%: Real-time updates work great');
        console.log('⚠️ If success rate 50-75%: Real-time updates work, but may miss some');
        console.log('❌ If success rate < 50%: Real-time updates are not working');
        
        process.exit(0);
      }, 2000);
      return;
    }
    
    const item = shoppingItems[itemIndex];
    console.log(`\n🛒 ${client1.name} ${item.action} "${item.name}" to the shopping list`);
    
    // Emit the update (simulating adding/removing item)
    client1.emit('listUpdate', {
      listId: listId,
      groupId: groupId,
      action: item.action,
      itemName: item.name,
      timestamp: Date.now()
    });
    
    itemIndex++;
    
    // Wait 1.5 seconds before next item (realistic timing)
    setTimeout(addNextItem, 1500);
  };
  
  // Start the scenario
  addNextItem();
  
}, 2000);

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Test timeout');
  client1.disconnect();
  client2.disconnect();
  process.exit(1);
}, 30000);
