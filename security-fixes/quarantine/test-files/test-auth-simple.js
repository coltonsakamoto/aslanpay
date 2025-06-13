const axios = require('axios');

async function testSimpleAuth() {
  console.log('🎯 Simple Control Tower Test\n');

  try {
    // 1. Create wallet and agent
    console.log('1. Creating wallet and agent...');
    
    const walletResponse = await axios.post('http://localhost:3000/v1/wallets');
    const walletId = walletResponse.data.walletId;
    
    const agentResponse = await axios.post('http://localhost:3000/v1/agents', {
      walletId: walletId,
      dailyUsdLimit: 100
    });
    const agentToken = agentResponse.data.agentToken;
    console.log('✅ Setup complete');

    // 2. Test authorization endpoint
    console.log('\n2. Testing authorization endpoint...');
    
    const authResponse = await axios.post('http://localhost:3000/v1/authorize', {
      agentToken: agentToken,
      merchant: 'doordash.com',
      amount: 15.99,
      category: 'food',
      intent: 'Order lunch - chicken bowl'
    });
    
    console.log('✅ AUTHORIZATION ENDPOINT WORKING!');
    console.log('Response:', JSON.stringify(authResponse.data, null, 2));

  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testSimpleAuth(); 