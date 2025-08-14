// server/routes/compareRoutes.js
const express = require('express');
const router = express.Router();
const List = require('../models/List');
const axios = require('axios');
const cheerio = require('cheerio');
const StorePriceCache = require('../models/StorePriceCache');
const { getDistances } = require('../services/distance');

// Add in-memory cache for better performance
const priceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// Rate limiting to prevent overwhelming the external API
const requestQueue = [];
let isProcessing = false;
const MAX_CONCURRENT_REQUESTS = 3;
let activeRequests = 0;

// Rate limiter function
async function rateLimitedRequest(url, params, headers) {
  return new Promise((resolve, reject) => {
    const request = { url, params, headers, resolve, reject };
    requestQueue.push(request);
    processQueue();
  });
}

async function processQueue() {
  if (isProcessing || activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return;
  }
  
  isProcessing = true;
  
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const request = requestQueue.shift();
    activeRequests++;
    
    try {
      const response = await fetchWithRetry(request.url, request.params, request.headers);
      request.resolve(response);
    } catch (error) {
      request.reject(error);
    } finally {
      activeRequests--;
      // Small delay between requests to be respectful to the external API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  isProcessing = false;
  
  // If there are still items in the queue, process them
  if (requestQueue.length > 0) {
    setTimeout(processQueue, 100);
  }
}

// Cache management functions
function getCacheKey(city, searchTerm) {
  return `${city}:${searchTerm}`;
}

function getFromCache(city, searchTerm) {
  const key = getCacheKey(city, searchTerm);
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCache(city, searchTerm, data) {
  const key = getCacheKey(city, searchTerm);
  priceCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// Clean old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of priceCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      priceCache.delete(key);
    }
  }
}, CACHE_TTL);

async function fetchWithRetry(url, params, headers, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, { 
        params, 
        headers,
        timeout: 5000 // Reduced from 10s to 5s
      });
      
      return response;
    } catch (error) {
      console.error(`Request failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Reduced delay between retries
      const delay = Math.pow(1.5, attempt) * 500; // 750ms, 1125ms instead of 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function fetchCompare(locationCity, searchTerm) {
  const streetId = 9000;
  const cityId = 0;
  const url = 'https://chp.co.il/main_page/compare_results';
  let allResults = []; // Local variable to accumulate results
  
  // Check cache first
  const cached = getFromCache(locationCity, searchTerm);
  if (cached) {
    return cached;
  }
  
  // Optimized search strategies - reduced from 7+ to 3-4 strategies
  const searchStrategies = [];
  
  // Strategy 1: Original search term (barcode or name)
  searchStrategies.push(searchTerm);
  
  // Strategy 2: Enhanced barcode handling - simplified
  if (/^\d+$/.test(searchTerm)) {
    if (searchTerm.length < 13) {
      // Only try the most common padding
      searchStrategies.push(searchTerm.padStart(13, '0'));
    }
    
    // Strategy 3: If it's a barcode, try without leading zeros
    if (searchTerm.length === 13 && searchTerm.startsWith('0')) {
      const trimmedBarcode = searchTerm.replace(/^0+/, '');
      searchStrategies.push(trimmedBarcode);
    }
  }
  
  // Strategy 4: Enhanced name variations - simplified
  if (!/^\d+$/.test(searchTerm)) {
    // Remove common suffixes like "800פג" from "תירס 800פג"
    const cleanName = searchTerm.replace(/\s+\d+.*$/, '').trim();
    if (cleanName !== searchTerm && cleanName.length >= 3) {
      searchStrategies.push(cleanName);
    }
    
    // Try brand name only (first word) - most effective strategy
    const words = searchTerm.split(' ');
    if (words.length > 1) {
      const brandName = words[0];
      if (brandName.length >= 2) {
        searchStrategies.push(brandName);
      }
    }
  }
  

  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Referer': 'https://chp.co.il/'
  };

  // Try each search strategy with early exit
  for (const strategy of searchStrategies) {
    try {
      const params = {
        shopping_address: locationCity,
        shopping_address_street_id: streetId,
        shopping_address_city_id: cityId,
        product_barcode: strategy,
        from: 0,
        num_results: 30,
      };
      
      const response = await rateLimitedRequest(url, params, headers);
      const { data: html } = response;
      
      // DEBUG: Log HTML structure (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 [HTML DEBUG] Product: ${strategy} - Length: ${html.length}`);
      }
      
      const $ = cheerio.load(html);
      const results = {};

      // Check if results table exists
      const resultsTable = $('.results-table tbody tr');
      if (process.env.NODE_ENV === 'development') {
        console.log(`   Results Table Rows Found: ${resultsTable.length}`);
      }
      
      if (resultsTable.length === 0) {
        continue; // Try next strategy
      }

      // Updated selector for results-table - Fixed column mapping
      resultsTable.each((i, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 5) {
          const storeName = cells.eq(0).text().trim();
          const branch = cells.eq(1).text().trim();
          const address = cells.eq(2).text().trim();
          
          // Try to find price in different columns
          let priceText = '';
          let quantityText = '';
          
          // Get text from columns 4 and 5
          const col4Text = cells.eq(3).text().trim();
          const col5Text = cells.eq(4).text().trim();
          
          // Priority: Column 4 (discounted price) if available, otherwise Column 5 (original price)
          if (/^\d+\.?\d*$/.test(col4Text)) {
            // Column 4 has a valid price (discounted price)
            priceText = col4Text;
            quantityText = col5Text;
          } else if (/^\d+\.?\d*$/.test(col5Text)) {
            // Column 4 is empty/invalid, use Column 5 (original price)
            priceText = col5Text;
            quantityText = col4Text;
          }
          
          // DEBUG: Log raw data being scraped (only in development)
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 [SCRAPING] ${searchTerm}: ${storeName} - ${branch} - ${priceText}`);
          }
          
          if (branch && address && priceText) {
            const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
            const quantity = parseInt(quantityText.replace(/[^\d]/g, '')) || 1;
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`   Parsed: ${price}₪ x${quantity}`);
            }
            
            if (!isNaN(price) && price > 0) {
              if (!results[branch]) {
                results[branch] = {
                  branch,
                  address,
                  totalPrice: 0,
                  itemsFound: 0,
                  itemPrices: {},
                  productDetails: {}
                };
              }
              
              results[branch].totalPrice += price;
              results[branch].itemsFound += 1;
              results[branch].itemPrices[searchTerm] = price;
              results[branch].productDetails[searchTerm] = {
                name: searchTerm,
                price: price,
                quantity: quantity
              };
            }
          }
        }
      });
      
      // If we found results, add them and potentially exit early
      if (Object.keys(results).length > 0) {
        allResults = Object.values(results);
        
        // Early exit: if we have good results, don't try more strategies
        if (allResults.length >= 2) {
          break;
        }
      }
      
    } catch (error) {
      console.error(`Strategy ${strategy} failed:`, error.message);
      continue; // Try next strategy
    }
  }
  
  // Cache the results
  setCache(locationCity, searchTerm, allResults);
  
  return allResults;
}

// Enhanced product search with aggressive fallback strategies
async function searchProductWithFallback(city, product) {
  const MultiScraper = require('../services/multiScraper');
  const multiScraper = new MultiScraper();
  
  let prodResults = [];
  
  // OPTIMIZED STRATEGIES FOR CHP.CO.IL - Focus on what actually works
  
  // Strategy 1: Try original barcode (MOST EFFECTIVE)
  if (product.barcode && product.barcode.length >= 3) {
    prodResults = await multiScraper.searchProduct(city, product.barcode);
    if (prodResults && prodResults.length > 0) {
      console.log(`✅ Found results for "${product.name}" using barcode: ${product.barcode}`);
      return multiScraper.aggregateResults(prodResults);
    }
  }
  
  // Strategy 2: Try padded barcode (if short)
  if (product.barcode && /^\d+$/.test(product.barcode) && product.barcode.length < 13) {
    const paddedBarcode = product.barcode.padStart(13, '0');
    prodResults = await multiScraper.searchProduct(city, paddedBarcode);
    if (prodResults && prodResults.length > 0) {
      console.log(`✅ Found results for "${product.name}" using padded barcode: ${paddedBarcode}`);
      return multiScraper.aggregateResults(prodResults);
    }
  }
  
  // Strategy 3: Try original name (SECOND MOST EFFECTIVE)
  if (product.name && product.name.length >= 3) {
    prodResults = await multiScraper.searchProduct(city, product.name);
    if (prodResults && prodResults.length > 0) {
      console.log(`✅ Found results for "${product.name}" using name: ${product.name}`);
      return multiScraper.aggregateResults(prodResults);
    }
  }
  
  // Strategy 4: Try cleaned name (remove weights/codes)
  if (product.name && !/^\d+$/.test(product.name)) {
    const cleanName = product.name
      .replace(/\d+[גקל]+\s*[ק"ג]?/g, '') // Remove weights like "1.9 ק"ג", "400גרם"
      .replace(/\d+\*?\d+[גקל]+/g, '') // Remove codes like "5*55ג+5*65ג"
      .replace(/\d+%/g, '') // Remove percentages like "30%"
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    if (cleanName !== product.name && cleanName.length >= 3) {
      prodResults = await multiScraper.searchProduct(city, cleanName);
      if (prodResults && prodResults.length > 0) {
        console.log(`✅ Found results for "${product.name}" using cleaned name: ${cleanName}`);
        return multiScraper.aggregateResults(prodResults);
      }
    }
  }
  
  // Strategy 5: Try brand name (first word)
  if (product.name && !/^\d+$/.test(product.name)) {
    const words = product.name.split(' ');
    if (words.length > 1) {
      const brandName = words[0];
      if (brandName.length >= 2) {
        prodResults = await multiScraper.searchProduct(city, brandName);
        if (prodResults && prodResults.length > 0) {
          console.log(`✅ Found results for "${product.name}" using brand name: ${brandName}`);
          return multiScraper.aggregateResults(prodResults);
        }
      }
    }
  }
  
  // Strategy 6: Try key product words (ONLY common ones that work)
  if (product.name) {
    const keyWords = [
      'חלב', 'לחם', 'ביצים', 'בשר', 'גבינה', 'יוגורט', 'מים', 'שמן', 'קפה', 'תה'
    ];
    
    for (const keyWord of keyWords) {
      if (product.name.includes(keyWord)) {
        prodResults = await multiScraper.searchProduct(city, keyWord);
        if (prodResults && prodResults.length > 0) {
          console.log(`✅ Found results for "${product.name}" using key word: ${keyWord}`);
          return multiScraper.aggregateResults(prodResults);
        }
      }
    }
  }
  
  console.log(`❌ No results found for "${product.name}" after trying optimized strategies`);
  return [];
}



function calculateProductTotal(quantity, regularPrice, salePrice, requiredQuantity) {
  if (!salePrice || !requiredQuantity || quantity < requiredQuantity) {
    return (regularPrice || 0) * quantity;
  }
  const numSaleGroups = Math.floor(quantity / requiredQuantity);
  const saleUnits = numSaleGroups * requiredQuantity;
  const regularUnits = quantity - saleUnits;
  return (numSaleGroups * salePrice * requiredQuantity) + (regularUnits * (regularPrice || 0));
}

// GET version
router.get('/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    const locationCity = req.query.location;
    const list = await List.findById(listId).populate('items.product').lean();

    if (!list) return res.status(404).json({ error: 'List not found' });
    const barcodes = list.items.map(i => i.product?.barcode).filter(Boolean);
    if (barcodes.length === 0) return res.status(400).json({ error: 'No barcodes' });

    const results = await fetchCompare(locationCity, barcodes);
    res.json(results);
  } catch (err) {
    console.error('[compare GET] error', err);
    res.status(500).json({ error: err.message });
  }
});

// POST version
router.post('/', async (req, res) => {
  try {
    const { city, barcodes } = req.body;
    if (!city || !Array.isArray(barcodes) || barcodes.length === 0) {
      return res.status(400).json({ error: 'Missing city or barcodes array' });
    }
    const results = await fetchCompare(city, barcodes);
    res.json(results);
  } catch (err) {
    console.error('[compare POST] error', err);
    res.status(500).json({ error: err.message });
  }
});

// MILESTONE 4: POST /api/compare/price
// Body: { city: string, products: [{ barcode: string, name: string, quantity: number }] }
router.post('/price', async (req, res) => {
  try {
    const { city, products } = req.body;
    console.log('🛒 Compare request:', { city, productsCount: products?.length });
    
    if (!city || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Missing city or products array. Please enter a valid city and add products to your list.' });
    }
    
    const startTime = Date.now();
    
    // BATCH OPTIMIZATION: Group similar products to reduce API calls
    const productGroups = new Map();
    
    for (const prod of products) {
      // Group by barcode (exact match)
      const barcodeKey = `barcode:${prod.barcode}`;
      if (productGroups.has(barcodeKey)) {
        productGroups.get(barcodeKey).push(prod);
      } else {
        productGroups.set(barcodeKey, [prod]);
      }
      
      // Group by brand name (first word)
      const words = prod.name.split(' ');
      if (words.length > 1) {
        const brandKey = `brand:${words[0]}`;
        if (productGroups.has(brandKey)) {
          productGroups.get(brandKey).push(prod);
        } else {
          productGroups.set(brandKey, [prod]);
        }
      }
    }
    
    // PARALLEL PROCESSING: Process unique products only
    const uniqueProducts = Array.from(new Set(products.map(p => p.barcode)));
    const uniqueProductData = products.filter((prod, index, arr) => 
      arr.findIndex(p => p.barcode === prod.barcode) === index
    );
    
    const productPromises = uniqueProductData.map(async (prod, index) => {
      try {
        // Use enhanced search with fallback
        const prodResults = await searchProductWithFallback(city, prod);
        return { product: prod, results: prodResults || [] };
      } catch (error) {
        console.error(`Error processing product ${prod.name}:`, error);
        return { product: prod, results: [] };
      }
    });
    
    // Wait for all unique products to be processed in parallel
    const productResults = await Promise.all(productPromises);
    console.log('Product processing completed. Results:', productResults.map(r => ({ 
      product: r.product.name, 
      storesFound: r.results.length 
    })));
    
    // Aggregate results by store
    let allStoreResults = {};
    
    for (const { product: prod, results: prodResults } of productResults) {
      for (const storeData of prodResults) {
        // Use branch name as store key to group all stores of the same chain
        const storeKey = storeData.branch;
        
        if (!allStoreResults[storeKey]) {
          allStoreResults[storeKey] = { 
            branch: storeData.branch,
            address: storeData.address,
            addresses: [storeData.address], // Track all addresses
            totalPrice: 0, 
            itemsFound: 0, 
            foundBarcodes: [],
            itemPrices: {},
            productDetails: {}
          };
        } else {
          // Add this address to the list if it's not already there
          if (!allStoreResults[storeKey].addresses.includes(storeData.address)) {
            allStoreResults[storeKey].addresses.push(storeData.address);
          }
        }
        
        // Add this product's price to the store (only real prices)
        // Try all the same search strategies that fetchCompare uses
        let productPrice = 0;

        // Strategy 1: Original barcode/name
        productPrice = storeData.itemPrices[prod.barcode] || 0;
        if (productPrice === 0 && prod.name) {
          productPrice = storeData.itemPrices[prod.name] || 0;
        }

        // Strategy 2: Enhanced barcode handling
        if (productPrice === 0 && /^\d+$/.test(prod.barcode)) {
          if (prod.barcode.length < 13) {
            productPrice = storeData.itemPrices[prod.barcode.padStart(13, '0')] || 0;
          }
          if (productPrice === 0 && prod.barcode.length === 13 && prod.barcode.startsWith('0')) {
            productPrice = storeData.itemPrices[prod.barcode.replace(/^0+/, '')] || 0;
          }
        }

        // Strategy 3: Enhanced name variations
        if (productPrice === 0 && prod.name && !/^\d+$/.test(prod.name)) {
          // Remove common suffixes like "800פג" from "תירס 800פג"
          const cleanName = prod.name.replace(/\s+\d+.*$/, '').trim();
          if (cleanName !== prod.name && cleanName.length >= 3) {
            productPrice = storeData.itemPrices[cleanName] || 0;
          }
          
          // Try brand name only (first word)
          if (productPrice === 0) {
            const words = prod.name.split(' ');
            if (words.length > 1) {
              const brandName = words[0];
              if (brandName.length >= 2) {
                productPrice = storeData.itemPrices[brandName] || 0;
              }
            }
          }
        }
        
        if (productPrice > 0) {
          // Only increment itemsFound if this is a new product (not already counted)
          if (!allStoreResults[storeKey].foundBarcodes.includes(prod.barcode)) {
            allStoreResults[storeKey].foundBarcodes.push(prod.barcode);
          }
          
          // Store individual item price using barcode as key for consistency
          allStoreResults[storeKey].itemPrices[prod.barcode] = productPrice;
          
          // Store product details including image
          allStoreResults[storeKey].productDetails[prod.barcode] = {
            name: prod.name,
            img: prod.img || prod.image, // Check both img and image fields
            price: productPrice
          };
          
          // Price added successfully
        } else {
          // No price found for this product
        }
      }
    }
    
    // Convert to array - only real prices
    let aggregated = Object.values(allStoreResults);
    
    // Calculate totals for real prices only
    aggregated.forEach((storeData) => {
      const totalPrice = Object.values(storeData.itemPrices).reduce((sum, price) => sum + price, 0);
      storeData.totalPrice = totalPrice;
      storeData.itemsFound = storeData.foundBarcodes.length;
    });
    
    // Calculate totals for real prices only
    
    if (aggregated.length === 0) {
      return res.status(404).json({ 
        error: 'No stores found for your city and products. Try a different city or product.',
        fallback: 'We could not find prices for some products in your area.'
      });
    }
    

    
    // Filter out stores with no products found for better UX
    aggregated = aggregated.filter(store => store.itemsFound > 0);
    
    if (aggregated.length === 0) {
      return res.status(404).json({ 
        error: 'No stores found with your products. Try a different city or check your product list.',
        fallback: 'We could not find any stores that carry the products in your list.'
      });
    }
    
    // Calculate scores for stores that have products - based on real prices only
    const maxPrice = Math.max(...aggregated.map(s => s.totalPrice), 1);
    const totalItems = products.length;
    
    aggregated.forEach(store => {
      const itemsFound = store.itemsFound;
      const totalPrice = store.totalPrice;
      
      // OPTIMIZED scoring formula for better percentages
      const quantityScore = itemsFound / totalItems;
      const priceScore = totalPrice / maxPrice;
      
      // Better formula: 80% weight on quantity, 20% on price
      const rawScore = (0.8 * quantityScore) - (0.2 * priceScore);
      const positiveScore = Math.max(0, rawScore) * 100;
      
      // Boost scores for stores with more items
      let finalScore = Math.round(positiveScore);
      if (itemsFound >= totalItems * 0.8) {
        finalScore = Math.min(100, finalScore + 20); // Bonus for high availability
      } else if (itemsFound >= totalItems * 0.5) {
        finalScore = Math.min(100, finalScore + 10); // Bonus for medium availability
      }
      
      store.score = finalScore;
      store.scorePercentage = `${store.score}%`;
      
      // Add availability status for better UX
      if (itemsFound === totalItems) {
        store.availability = "All products available";
      } else if (itemsFound >= totalItems * 0.8) {
        store.availability = "Most products available";
      } else if (itemsFound >= totalItems * 0.5) {
        store.availability = "Some products available";
      } else {
        store.availability = "Limited availability";
      }
    });
    
    // Sort by score (highest first)
    aggregated.sort((a, b) => b.score - a.score);
    // Distance calculation (optional, will be null if API key missing)
    const storeAddresses = aggregated.map(s => s.address);
    let distances = {};
    try {
      distances = await getDistances(city, storeAddresses);
    } catch (distErr) {
      console.error('[compare POST /price] Distance API error:', distErr);
    }
    aggregated.forEach(s => {
      s.distance = distances[s.address] || null;
    });
    res.json(aggregated.slice(0, 5));
  } catch (err) {
    console.error('[compare POST /price] error', err);
    res.status(500).json({ error: 'An unexpected server error occurred. Please try again later.' });
  }
});

module.exports = router;
