const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:5000/api';
const TEST_TOKEN = 'your-test-token-here'; // You'll need to replace this with a real token

async function testFavoritesEndpoint() {
  try {
    console.log('🧪 Testing favorites endpoint directly...');
    
    // Test data
    const testData = {
      productId: '507f1f77bcf86cd799439013',
      groupId: '507f1f77bcf86cd799439012'
    };
    
    console.log('📤 Sending request to add favorite...');
    console.log('Request data:', testData);
    
    const response = await axios.post(`${API_BASE_URL}/suggestions/favorites/add`, testData, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response received:', response.data);
    
  } catch (error) {
    console.error('❌ Error occurred:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
  }
}

// Run the test
testFavoritesEndpoint(); 