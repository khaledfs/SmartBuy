const axios = require('axios');
const cheerio = require('cheerio');

// Import the actual scraping logic
const MultiScraper = require('./services/multiScraper');

// Test the fixed MultiScraper
async function testFixedMultiScraper() {
  console.log('=== TESTING FIXED MULTISCRAPER ===');
  
  const multiScraper = new MultiScraper();
  
  // Test with the client's barcode
  const product = {
    barcode: '7290110566579',
    name: 'דבש לחיץ',
    quantity: 1
  };
  
  console.log('Testing with product:', product);
  
  // Test Strategy 1: Original barcode
  console.log('\n--- Strategy 1: Original barcode ---');
  let results = await multiScraper.searchProduct('רמת גן', product.barcode);
  console.log('Results found:', results.length);
  if (results.length > 0) {
    console.log('First result:', results[0]);
    console.log('All results:');
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.branch} - ${result.address} - ${result.price}₪`);
    });
  }
  
  // Test aggregation
  console.log('\n--- Testing aggregation ---');
  const aggregatedResults = multiScraper.aggregateResults(results);
  console.log('Aggregated results:', aggregatedResults.length);
  if (aggregatedResults.length > 0) {
    console.log('First aggregated result:', aggregatedResults[0]);
  }
  
  return results.length > 0;
}

// Run the test
testFixedMultiScraper().then(success => {
  if (success) {
    console.log('\n✅ FIX SUCCESSFUL! The scraping should now work for your client.');
  } else {
    console.log('\n❌ FIX FAILED! There might be another issue.');
  }
}); 