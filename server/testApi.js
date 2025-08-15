const axios = require('axios');

// Test the smart suggestions API
async function testSmartSuggestions() {
  try {
    console.log('Testing smart suggestions API...');
    
    // Test without authentication (should fail)
    console.log('\n1. Testing without authentication:');
    try {
      const response = await axios.get('http://172.20.10.6:5000/api/suggestions/smart');
      console.log('✅ Success without auth:', response.data);
    } catch (error) {
      console.log('❌ Expected failure without auth:', error.response?.status, error.response?.data?.message);
    }
    
    // Test with invalid token
    console.log('\n2. Testing with invalid token:');
    try {
      const response = await axios.get('http://172.20.10.6:5000/api/suggestions/smart', {
        headers: { Authorization: 'Bearer invalid-token' }
      });
      console.log('✅ Success with invalid token:', response.data);
    } catch (error) {
      console.log('❌ Expected failure with invalid token:', error.response?.status, error.response?.data?.message);
    }
    
    // Test basic server connectivity
    console.log('\n3. Testing basic server connectivity:');
    try {
      const response = await axios.get('http://172.20.10.6:5000/');
      console.log('✅ Server is running:', response.data);
    } catch (error) {
      console.log('❌ Server not accessible:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testSmartSuggestions(); 