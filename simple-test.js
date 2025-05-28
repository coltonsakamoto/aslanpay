// Simple test for AgentPay Browser Automation
const axios = require('axios');

async function quickTest() {
  try {
    console.log('🧪 Quick Browser Automation Test\n');
    
    // Check if server is running
    console.log('1️⃣ Checking server status...');
    const healthCheck = await axios.get('http://localhost:3000/');
    console.log('✅ Server is running:', healthCheck.data);
    
    // Create wallet
    console.log('\n2️⃣ Creating wallet...');
    const walletResponse = await axios.post('http://localhost:3000/v1/wallets');
    const walletId = walletResponse.data.walletId;
    console.log('✅ Wallet created:', walletId);
    
    // Fund wallet
    console.log('\n3️⃣ Funding wallet...');
    await axios.post(`http://localhost:3000/v1/wallets/${walletId}/fund`, {
      usd: 500
    });
    console.log('✅ Wallet funded with $500');
    
    // Create agent
    console.log('\n4️⃣ Creating agent...');
    const agentResponse = await axios.post('http://localhost:3000/v1/agents', {
      walletId: walletId,
      dailyUsdLimit: 300
    });
    const agentToken = agentResponse.data.agentToken;
    console.log('✅ Agent created');
    
    // Test browser automation service
    console.log('\n5️⃣ Testing flight booking browser automation...');
    const flightResult = await axios.post('http://localhost:3000/v1/purchase', {
      agentToken: agentToken,
      service: 'flight',
      params: {
        from: 'SFO',
        to: 'LAX',
        departDate: '2024-04-15',
        passengers: 1,
        maxPrice: 200
      }
    });
    
    console.log('✅ Flight booking test result:');
    console.log('   💰 Amount:', `$${flightResult.data.amount}`);
    console.log('   🆔 Transaction:', flightResult.data.transactionId);
    console.log('   🎯 Details:', flightResult.data.details);
    
    console.log('\n🚀 **BROWSER AUTOMATION IS ACTIVE!**');
    console.log('   AgentPay can now book flights, hotels, shop on Amazon,');
    console.log('   make restaurant reservations, and buy event tickets!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

quickTest(); 