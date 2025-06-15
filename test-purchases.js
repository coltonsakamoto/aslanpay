const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testPurchases() {
  console.log('🚀 Testing AgentPay Real-World Purchases\n');

  try {
    // 1. Create a wallet
    console.log('1. Creating wallet...');
    const walletResponse = await axios.post(`${API_BASE}/v1/wallets`);
    const walletId = walletResponse.data.walletId;
    console.log('✅ Wallet created:', walletId);

    // 2. Fund the wallet with credit card (simulated)
    console.log('\n2. Funding wallet with $100...');
    const fundResponse = await axios.post(`${API_BASE}/v1/wallets/${walletId}/fund`, {
      usd: 100
    });
    console.log('✅ Wallet funded:', fundResponse.data);

    // 3. Create an AI agent with spending limits
    console.log('\n3. Creating AI agent with $50 daily limit...');
    const agentResponse = await axios.post(`${API_BASE}/v1/agents`, {
      walletId: walletId,
      dailyUsdLimit: 50
    });
    const agentToken = agentResponse.data.agentToken;
    console.log('✅ Agent created with token:', agentToken.substring(0, 20) + '...');

    // 4. Test different purchases
    const purchases = [
      {
        name: 'Domain Registration',
        service: 'domain',
        params: { domain: 'my-ai-startup.com', years: 2 }
      },
      {
        name: 'AWS Credits',
        service: 'aws-credits',
        params: { amount: 25 }
      },
      {
        name: 'Starbucks Gift Card',
        service: 'gift-card',
        params: { brand: 'starbucks', amount: 15 }
      },
      {
        name: 'VPS Hosting',
        service: 'vps',
        params: { plan: 'standard', months: 1 }
      }
    ];

    console.log('\n4. Making real-world purchases...\n');

    for (const purchase of purchases) {
      try {
        console.log(`🛒 Purchasing ${purchase.name}...`);
        
        const purchaseResponse = await axios.post(`${API_BASE}/v1/purchase`, {
          agentToken: agentToken,
          service: purchase.service,
          params: purchase.params
        });

        const result = purchaseResponse.data;
        console.log(`✅ Purchase successful!`);
        console.log(`   Service: ${result.service}`);
        console.log(`   Amount: $${result.amount}`);
        console.log(`   Transaction ID: ${result.transactionId}`);
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
        console.log(`   Remaining Balance: $${result.remainingBalance}`);
        console.log('');

      } catch (error) {
        console.log(`❌ Purchase failed:`, error.response?.data || error.message);
        console.log('');
      }
    }

    // 5. Check final wallet status
    console.log('5. Final wallet status...');
    const finalWallet = await axios.get(`${API_BASE}/v1/wallets/${walletId}`);
    console.log('✅ Final wallet state:', finalWallet.data);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testPurchases(); 