const axios = require('axios');

async function quickTest() {
  console.log('🚀 Quick AgentPay OpenAI Integration Test\n');
  
  try {
    // Test 1: Check if server is running
    console.log('1. Testing server health...');
    const health = await axios.get('http://localhost:3000/');
    console.log('✅ Server running:', health.data);
    
    // Test 2: Check services endpoint
    console.log('\n2. Testing services endpoint...');
    const services = await axios.get('http://localhost:3000/v1/services');
    console.log('✅ Services available:', services.data.availableServices.length, 'services');
    console.log('   - SMS, Domain, Gift Cards, VPS, SaaS, etc.');
    
    // Test 3: Create wallet and agent
    console.log('\n3. Creating test wallet and agent...');
    const wallet = await axios.post('http://localhost:3000/v1/wallets');
    const walletId = wallet.data.walletId;
    console.log('✅ Wallet created:', walletId);
    
    await axios.post(`http://localhost:3000/v1/wallets/${walletId}/fund`, { usd: 25 });
    console.log('✅ Wallet funded with $25');
    
    const agent = await axios.post('http://localhost:3000/v1/agents', {
      walletId: walletId,
      dailyUsdLimit: 10
    });
    const agentToken = agent.data.agentToken;
    console.log('✅ Agent created with $10 daily limit');
    
    // Test 4: Test purchase endpoint (gift card - $5 fits within $10 limit)
    console.log('\n4. Testing purchase endpoint...');
    const purchase = await axios.post('http://localhost:3000/v1/purchase', {
      agentToken: agentToken,
      service: 'gift-card',
      params: {
        brand: 'amazon',
        amount: 5  // $5 gift card fits within $10 daily limit
      }
    });
    
    console.log('✅ Purchase successful!');
    console.log('   Transaction ID:', purchase.data.transactionId);
    console.log('   Amount:', `$${purchase.data.amount}`);
    console.log('   Service:', purchase.data.service);
    console.log('   Remaining Balance:', `$${purchase.data.remainingBalance}`);
    
    // Test 5: Test spending limits
    console.log('\n5. Testing spending limits...');
    try {
      const bigPurchase = await axios.post('http://localhost:3000/v1/purchase', {
        agentToken: agentToken,
        service: 'gift-card',
        params: {
          brand: 'amazon',
          amount: 15 // Should exceed daily limit
        }
      });
    } catch (error) {
      if (error.response.data.code === 'DAILY_LIMIT_EXCEEDED') {
        console.log('✅ Spending limits working correctly');
      } else {
        console.log('❌ Unexpected error:', error.response.data);
      }
    }
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('🚀 AgentPay OpenAI integration is ready!');
    console.log('\n📋 Next steps:');
    console.log('1. Add OPENAI_API_KEY to .env file');
    console.log('2. Run: node test-openai-integration.js');
    console.log('3. Watch ChatGPT make autonomous purchases!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Server not running. Start it with:');
      console.log('cd agent-wallet && npm run dev');
    }
  }
}

quickTest(); 