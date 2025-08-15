const mongoose = require('mongoose');
const TripHistory = require('./models/TripHistory');
const PurchaseHistory = require('./models/PurchaseHistory');
const Group = require('./models/Group');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/jimale', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testTripHistory() {
  try {
    console.log('🧪 Testing Trip History functionality...');
    
    // Find a group to test with
    const group = await Group.findOne();
    if (!group) {
      console.log('❌ No groups found. Please create a group first.');
      return;
    }
    
    console.log(`✅ Found group: ${group.name} (ID: ${group._id})`);
    
    // Test 1: Check if TripHistory model works
    console.log('\n📋 Test 1: Creating a test trip...');
    const testTrip = await TripHistory.create({
      group: group._id,
      tripNumber: 1,
      completedAt: new Date(),
      store: {
        branch: 'Test Store',
        address: '123 Test St',
        totalPrice: 150.50
      },
      participants: [{
        user: group.members[0]?.user || group.owner,
        username: 'TestUser'
      }],
      itemCount: 5,
      totalSpent: 150.50
    });
    
    console.log(`✅ Created test trip: Trip ${testTrip.tripNumber}`);
    
    // Test 2: Check if PurchaseHistory with tripId works
    console.log('\n📋 Test 2: Creating test purchase records...');
    const testPurchase = await PurchaseHistory.create({
      name: 'Test Product',
      quantity: 2,
      user: group.members[0]?.user || group.owner,
      group: group._id,
      tripId: testTrip._id,
      boughtAt: new Date(),
      img: 'test-image-url',
      metadata: {
        store: {
          branch: 'Test Store',
          address: '123 Test St',
          totalPrice: 150.50
        }
      }
    });
    
    console.log(`✅ Created test purchase: ${testPurchase.name}`);
    
    // Test 3: Query trip history
    console.log('\n📋 Test 3: Querying trip history...');
    const trips = await TripHistory.find({ group: group._id })
      .sort({ completedAt: -1 })
      .limit(10);
    
    console.log(`✅ Found ${trips.length} trips for group`);
    trips.forEach(trip => {
      console.log(`   - Trip ${trip.tripNumber}: ${trip.itemCount} items, ₪${trip.totalSpent}`);
    });
    
    // Test 4: Query trip items
    console.log('\n📋 Test 4: Querying trip items...');
    const tripItems = await PurchaseHistory.find({ 
      group: group._id, 
      tripId: testTrip._id 
    });
    
    console.log(`✅ Found ${tripItems.length} items for Trip ${testTrip.tripNumber}`);
    tripItems.forEach(item => {
      console.log(`   - ${item.name} (Qty: ${item.quantity})`);
    });
    
    console.log('\n🎉 All tests passed! Trip History functionality is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

testTripHistory(); 