const UserFavorites = require('../models/UserFavorites');
const Product = require('../models/Product');
const Item = require('../models/Item');

// GET /api/favorites - Get user's favorites with cart integration (SmartCart-style)
exports.getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const groupId = req.query.groupId;

    // Get user's favorites with product details and cart status
    const favoritesWithProducts = await UserFavorites.aggregate([
      { $match: { userId: new require('mongoose').Types.ObjectId(userId) } },
      { $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product'
      }},
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $lookup: {
        from: 'items',
        let: { productId: '$productId', listId: groupId },
        pipeline: [
          { $match: { 
            $expr: { 
              $and: [
                { $eq: ['$productId', '$$productId'] },
                { $eq: ['$listId', '$$listId'] }
              ]
            }
          }}
        ],
        as: 'cartItem'
      }},
      { $addFields: {
        isInCart: { $gt: [{ $size: '$cartItem' }, 0] },
        cartQuantity: { $ifNull: [{ $arrayElemAt: ['$cartItem.quantity', 0] }, 0] }
      }},
      { $project: {
        _id: 0,
        productId: 1,
        name: '$product.name',
        img: '$product.img',
        quantity: 1,
        isInCart: 1,
        cartQuantity: 1,
        addedAt: 1
      }},
      { $sort: { addedAt: -1 } }
    ]);

    res.json({
      success: true,
      favorites: favoritesWithProducts
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// POST /api/favorites - Add product to favorites (SmartCart-style)
exports.addToFavorites = async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const userId = req.user.id;

  if (!productId) {
    return res.status(400).json({ 
      success: false,
      message: 'Product ID is required' 
    });
  }

  try {
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }

    // Check if already in favorites
    const existingFavorite = await UserFavorites.findOne({
      userId,
      productId: productId
    });

    if (existingFavorite) {
      return res.status(200).json({ 
        success: true,
        message: 'Product already in favorites',
        favorite: existingFavorite
      });
    }

    const favorite = new UserFavorites({
      userId,
      productId: productId,
      quantity: quantity
    });

    await favorite.save();

    res.status(201).json({
      success: true,
      message: 'Product added to favorites successfully',
      favorite: favorite
    });
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// DELETE /api/favorites/:productId - Remove from favorites
exports.removeFromFavorites = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;

  try {
    const favorite = await UserFavorites.findOneAndDelete({
      userId,
      productId: productId
    });

    if (!favorite) {
      return res.status(404).json({ 
        success: false,
        message: 'Favorite not found' 
      });
    }

    res.json({ 
      success: true,
      message: 'Removed from favorites' 
    });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// PUT /api/favorites/:productId - Update favorite quantity (SmartCart-style)
exports.updateFavoriteQuantity = async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  const userId = req.user.id;

  if (quantity < 1) {
    return res.status(400).json({ 
      success: false,
      message: 'Quantity must be at least 1' 
    });
  }

  try {
    const favorite = await UserFavorites.findOneAndUpdate(
      { userId, productId: productId },
      { quantity: quantity },
      { new: true }
    );

    if (!favorite) {
      return res.status(404).json({ 
        success: false,
        message: 'Favorite not found' 
      });
    }

    res.json({
      success: true,
      message: 'Favorite quantity updated successfully',
      favorite: favorite
    });
  } catch (error) {
    console.error('Error updating favorite:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
}; 

// GET /api/favorites/check/:productId - Check if product is in user's favorites
exports.checkFavorite = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;
  try {
    const favorite = await UserFavorites.findOne({ userId, productId });
    res.json({ isFavorited: !!favorite });
  } catch (error) {
    console.error('Error checking favorite:', error);
    res.status(500).json({ isFavorited: false, error: 'Server error' });
  }
}; 