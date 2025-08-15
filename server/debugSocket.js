const io = require('socket.io-client');

console.log('🔍 DEBUGGING SOCKET BROADCASTING');
console.log('=' .repeat(40));

const SERVER_URL = 'http://172.20.10.6:5000';
const groupId = 'debug-group-123';

// Create two clients
const sender = io(SERVER_URL);
const receiver = io(SERVER_URL);

sender.name = 'Sender';
receiver.name = 'Receiver';

let senderConnected = false;
let receiverConnected = false;

// Sender setup
sender.on('connect', () => {
  console.log(`✅ ${sender.name} connected: ${sender.id}`);
  senderConnected = true;
  sender.emit('joinGroup', groupId);
});

sender.on('joinedGroup', (data) => {
  console.log(`👥 ${sender.name} joined group: ${data.groupId}`);
});

sender.on('listUpdate', (data) => {
  console.log(`📢 ${sender.name} received update:`, data);
});

// Receiver setup
receiver.on('connect', () => {
  console.log(`✅ ${receiver.name} connected: ${receiver.id}`);
  receiverConnected = true;
  receiver.emit('joinGroup', groupId);
});

receiver.on('joinedGroup', (data) => {
  console.log(`👥 ${receiver.name} joined group: ${data.groupId}`);
});

receiver.on('listUpdate', (data) => {
  console.log(`📢 ${receiver.name} received update:`, data);
});

// Error handling
[sender, receiver].forEach(client => {
  client.on('connect_error', (err) => {
    console.log(`❌ ${client.name} connection error:`, err.message);
  });
  
  client.on('disconnect', (reason) => {
    console.log(`🔌 ${client.name} disconnected:`, reason);
  });
});

// Test broadcasting
setTimeout(() => {
  if (!senderConnected || !receiverConnected) {
    console.log('❌ Clients not connected');
    process.exit(1);
  }
  
  console.log('\n📤 TESTING BROADCASTING');
  console.log('=' .repeat(30));
  
  console.log(`\n📤 ${sender.name} emitting listUpdate...`);
  sender.emit('listUpdate', {
    listId: 'test-list-123',
    groupId: groupId,
    action: 'itemAdded',
    itemName: 'Test Item'
  });
  
  setTimeout(() => {
    console.log('\n📊 TEST COMPLETE');
    console.log('=' .repeat(20));
    console.log('If you see "received update" messages above, broadcasting is working.');
    console.log('If not, there is an issue with the socket broadcasting.');
    
    sender.disconnect();
    receiver.disconnect();
    process.exit(0);
  }, 3000);
  
}, 2000);

setTimeout(() => {
  console.log('⏰ Test timeout');
  sender.disconnect();
  receiver.disconnect();
  process.exit(1);
}, 10000);
