const Group = require('../models/Group');
const List = require('../models/List');
const Item = require('../models/Item');
const PurchaseHistory = require('../models/PurchaseHistory');
const TripHistory = require('../models/TripHistory');
const User = require('../models/User');

// GET /groups/:groupId/list/summary
exports.getGroupListSummary = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    console.log(`[DEBUG] Getting summary for group: ${groupId}`);
    
    const group = await Group.findById(groupId).populate({
      path: 'list',
      populate: { path: 'items', populate: { path: 'addedBy', select: 'username profilePicUrl' } }
    });
    
    if (!group || !group.list) {
      console.log(`[DEBUG] Group or list not found for groupId: ${groupId}`);
      return res.status(404).json({ message: 'Group or shared list not found' });
    }
    
    // Current list items - filter to ensure only valid items
    const currentList = group.list.items
      .filter(item => 
        item && 
        item.name // Only require name, allow items without barcodes
      )
      .map(item => ({
        _id: item._id,
        name: item.name,
        barcode: item.barcode,
        quantity: item.quantity || 1,
        img: item.img || null,
        icon: item.icon || null,
        addedBy: item.addedBy,
        createdAt: item.createdAt,
        productId: item.productId
      }));
    
    console.log(`[DEBUG] Group ${groupId} has ${group.list.items.length} total items`);
    console.log(`[DEBUG] Group ${groupId} has ${currentList.length} valid items with barcodes`);
    console.log(`[DEBUG] Items in group ${groupId}:`, currentList.map(item => `${item.name} (${item.barcode})`));
    
    // DEBUG: Check if images are being preserved
    console.log(`[DEBUG] === CHECKING IMAGES IN CURRENT LIST ===`);
    currentList.forEach((item, index) => {
      console.log(`[DEBUG] Item ${index + 1}: ${item.name}`);
      console.log(`[DEBUG]   - Has img field: ${!!item.img}`);
      console.log(`[DEBUG]   - Has icon field: ${!!item.icon}`);
      console.log(`[DEBUG]   - img length: ${item.img ? item.img.length : 0}`);
      console.log(`[DEBUG]   - icon length: ${item.icon ? item.icon.length : 0}`);
    });
    
    // Last bought: get most recent group trip from TripHistory
    const lastTrip = await TripHistory.findOne({ group: groupId })
      .sort({ completedAt: -1 })
      .limit(1);
    
    let lastBought = [];
    let lastStore = null;
    let currentTripNumber = 0;
    
    if (lastTrip) {
      // Get all items from the most recent trip
      lastBought = await PurchaseHistory.find({ 
        group: groupId, 
        tripId: lastTrip._id 
      }).populate('user', 'username');
      
      // Debug: Log the user data
      console.log('[DEBUG] Last bought items:', lastBought.map(item => ({
        name: item.name,
        user: item.user,
        img: item.img ? 'Has image' : 'No image'
      })));
      
      lastStore = lastTrip.store;
      currentTripNumber = lastTrip.tripNumber;
    }
    
    // Get total trip count
    const tripCount = await TripHistory.countDocuments({ group: groupId });
    
    const result = { 
      currentList, 
      lastBought, 
      lastStore, 
      tripCount,
      currentTripNumber 
    };
    console.log(`[DEBUG] Returning summary for group ${groupId}:`, {
      currentListCount: currentList.length,
      lastBoughtCount: lastBought.length,
      tripCount,
      currentTripNumber
    });
    
    res.json(result);
  } catch (err) {
    console.error('Error in getGroupListSummary:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /groups/:groupId/list/complete-trip
exports.completeGroupTrip = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.userId;
    const { store, boughtProducts } = req.body || {};
    
    const group = await Group.findById(groupId).populate({
      path: 'list',
      populate: { path: 'items' }
    });
    
    if (!group || !group.list) {
      return res.status(404).json({ message: 'Group or shared list not found' });
    }
    
    const list = group.list;
    const items = list.items;
    
    if (!items.length) {
      return res.status(400).json({ message: 'No items to complete trip' });
    }
    
    // If boughtProducts is provided, use only those items for "Last Bought"
    // Otherwise, fall back to the old behavior (all items)
    const itemsToProcess = boughtProducts && boughtProducts.length > 0 
      ? boughtProducts 
      : items;
    
    console.log(`[DEBUG] Completing trip for group ${groupId}`);
    console.log(`[DEBUG] Total items in list: ${items.length}`);
    console.log(`[DEBUG] Items to mark as bought: ${itemsToProcess.length}`);
    console.log(`[DEBUG] Items that will be lost: ${items.length - itemsToProcess.length}`);

    // Get next trip number for this group
    const lastTrip = await TripHistory.findOne({ group: groupId })
      .sort({ tripNumber: -1 })
      .limit(1);
    
    const tripNumber = lastTrip ? lastTrip.tripNumber + 1 : 1;

    // Get user info for participants
    const user = await User.findById(userId).select('username');
    
    // Create trip history record
    const tripHistory = await TripHistory.create({
      group: groupId,
      tripNumber,
      completedAt: new Date(),
      store: store ? {
        ...store,
        totalPrice: store.totalPrice ? parseFloat(store.totalPrice) : 0
      } : {},
      participants: [{
        user: userId,
        username: user?.username || 'Unknown'
      }],
      itemCount: itemsToProcess.length,
      totalSpent: store?.totalPrice ? parseFloat(store.totalPrice) : 0,
    });

    // Record each bought item in PurchaseHistory with trip reference
    const now = new Date();
    console.log('[DEBUG] User ID for purchase:', userId);
    console.log('[DEBUG] User info:', user);
    
    for (const boughtItem of itemsToProcess) {
      console.log('[DEBUG] Creating purchase record for:', {
        name: boughtItem.name,
        img: boughtItem.img ? 'Has image' : 'No image',
        icon: boughtItem.icon ? 'Has icon' : 'No icon'
      });
      
      await PurchaseHistory.create({
        name: boughtItem.name,
        product: boughtItem.productId || boughtItem.product || null, // Handle both product ID and product object
        quantity: boughtItem.quantity,
        user: userId,
        group: groupId,
        tripId: tripHistory._id,
        boughtAt: now,
        img: boughtItem.img || boughtItem.icon || '', // Save image for last bought
        metadata: store ? { store } : {},
      });
    }

    // Clear the entire list (all items are lost, only bought items go to "Last Bought")
    for (const item of items) {
      await Item.findByIdAndDelete(item._id);
    }
    list.items = [];
    await list.save();
    
    res.json({ 
      message: 'Trip completed', 
      tripNumber,
      boughtAt: now,
      tripId: tripHistory._id
    });
  } catch (err) {
    console.error('Error in completeGroupTrip:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /groups/:groupId/trips - Get trip history (last 10 trips)
exports.getTripHistory = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    
    const trips = await TripHistory.find({ group: groupId })
      .sort({ completedAt: -1 })
      .limit(10)
      .populate('participants.user', 'username');
    
    const tripHistory = trips.map(trip => ({
      _id: trip._id,
      tripNumber: trip.tripNumber,
      completedAt: trip.completedAt,
      store: trip.store,
      participants: trip.participants,
      itemCount: trip.itemCount,
      totalSpent: trip.totalSpent,
    }));
    
    res.json(tripHistory);
  } catch (err) {
    console.error('Error in getTripHistory:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /groups/:groupId/trips/:tripId - Get items from specific trip
exports.getTripItems = async (req, res) => {
  try {
    const { groupId, tripId } = req.params;
    
    // Verify trip belongs to group
    const trip = await TripHistory.findOne({ 
      _id: tripId, 
      group: groupId 
    });
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    // Get all items from this trip
    const items = await PurchaseHistory.find({ 
      group: groupId, 
      tripId: tripId 
    }).populate('user', 'username');
    
    const tripItems = items.map(item => ({
      _id: item._id,
      name: item.name,
      quantity: item.quantity,
      img: item.img,
      addedBy: item.user,
      boughtAt: item.boughtAt,
      price: item.price,
    }));
    
    res.json({
      trip: {
        _id: trip._id,
        tripNumber: trip.tripNumber,
        completedAt: trip.completedAt,
        store: trip.store,
        participants: trip.participants,
        itemCount: trip.itemCount,
        totalSpent: trip.totalSpent,
      },
      items: tripItems
    });
  } catch (err) {
    console.error('Error in getTripItems:', err);
    res.status(500).json({ message: 'Server error' });
  }
}; 