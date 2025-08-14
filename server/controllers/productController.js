const fs = require('fs');
const path = require('path');

// Simple cache for products.json
let productsCache = null;
let productsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getProductsFromJson() {
  const now = Date.now();
  if (productsCache && (now - productsCacheTime) < CACHE_DURATION) {
    return productsCache;
  }
  try {
    const productsPath = path.resolve(__dirname, '../scripts/products.json');
    const data = fs.readFileSync(productsPath, 'utf-8');
    const products = JSON.parse(data);
    productsCache = products;
    productsCacheTime = now;
    return products;
  } catch (error) {
    console.error('Error reading products.json:', error);
    return [];
  }
}

// GET /api/products/:id
exports.getProductById = (req, res) => {
  const { id } = req.params;
  const products = getProductsFromJson();
  const product = products.find(p => p._id == id || p.productId == id || p.barcode == id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.json(product);
}; 