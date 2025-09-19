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
    console.log('[DEBUG] User info:', user);

    for (const boughtItem of itemsToProcess) {
      

      //console.log('[DEBUG] Bought item details:', boughtItem);
      await PurchaseHistory.create({
        name: boughtItem.name,
        product: boughtItem.productId || boughtItem.product || null, // Handle both product ID and product object
        quantity: boughtItem.quantity,
        user: userId,
        group: groupId,
        tripId: tripHistory._id,
        boughtAt: now,
        img: boughtItem.img || boughtItem.icon || '',
        metadata: store ? { store } : {},
      });
    }

    const boughtBarcodes = Object.entries(store?.itemPrices || {})
      .filter(([barcode, price]) => parseFloat(price) > 0)
      .map(([barcode]) => barcode);

    console.log('[DEBUG] Keeping items with price 0, bought barcodes:', boughtBarcodes);

    // Delete only bought items
    for (const item of items) {
      if (boughtBarcodes.includes(item.barcode)) {
        await Item.findByIdAndDelete(item._id);
      }
    }

    // Keep only unbought items in the list
    list.items = items.filter(item => !boughtBarcodes.includes(item.barcode));
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
