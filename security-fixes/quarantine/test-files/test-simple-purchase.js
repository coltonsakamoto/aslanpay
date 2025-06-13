const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testSimplePurchase() {
  console.log('🚀 AgentPay Purchase Execution Test\n');

  try {
    // 1. Create wallet and agent with higher limits
    console.log('1. Creating wallet and agent...');
    const walletResponse = await axios.post(`${API_BASE}/v1/wallets`);
    const walletId = walletResponse.data.walletId;
    
    const agentResponse = await axios.post(`${API_BASE}/v1/agents`, {
      walletId: walletId,
      dailyUsdLimit: 200  // Higher limit
    });
    const agentToken = agentResponse.data.agentToken;
    console.log('✅ Agent created');

    // 2. Test simple purchase
    console.log('\n2. Testing purchase execution...');
    
    const purchaseResponse = await axios.post(`${API_BASE}/v1/purchase-direct`, {
      agentToken: agentToken,
      service: 'domain',  // Simple service
      params: {
        domain: `test-${Date.now()}.com`,
        years: 1
      }
    });

    console.log('📋 Purchase Response:');
    console.log(JSON.stringify(purchaseResponse.data, null, 2));

    if (purchaseResponse.data.success) {
      console.log('\n✅ PURCHASE EXECUTED SUCCESSFULLY!');
      console.log('🎯 This proves AgentPay can execute real purchases, not just charge cards!');
    } else {
      console.log('\n❌ Purchase result:', purchaseResponse.data.error);
    }

  } catch (error) {
    console.log('\n📊 Response details:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

testSimplePurchase(); 