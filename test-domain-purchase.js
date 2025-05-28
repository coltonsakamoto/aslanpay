const axios = require('axios');

async function testDomainPurchase() {
  console.log('🌐 TESTING AI AGENT DOMAIN PURCHASE! 🌐\n');

  try {
    // 1. Create wallet and fund it
    console.log('1. Creating & funding wallet...');
    const wallet = await axios.post('http://localhost:3000/v1/wallets');
    const walletId = wallet.data.walletId;
    
    await axios.post(`http://localhost:3000/v1/wallets/${walletId}/fund`, { usd: 50 });
    console.log('✅ Wallet funded with $50');

    // 2. Create AI agent with higher limits for domain purchases
    console.log('\n2. Creating AI agent...');
    const agent = await axios.post('http://localhost:3000/v1/agents', {
      walletId: walletId,
      dailyUsdLimit: 30 // Domains cost more than SMS
    });
    const agentToken = agent.data.agentToken;
    console.log('✅ AI agent created with $30 daily limit');

    // 3. **DOMAIN PURCHASE** - AI agent buys a domain
    console.log('\n3. 🌐 AI AGENT PURCHASING DOMAIN! 🌐');
    
    const domainName = 'my-ai-startup-2025.com';
    const years = 2;
    
    console.log(`🔍 Agent attempting to purchase: ${domainName} for ${years} years`);
    
    const purchase = await axios.post('http://localhost:3000/v1/purchase', {
      agentToken: agentToken,
      service: 'domain',
      params: {
        domain: domainName,
        years: years
      }
    });

    console.log('\n🎉 DOMAIN PURCHASE SUCCESSFUL!');
    console.log('🌐 Domain Details:', purchase.data);
    console.log('💰 Cost:', `$${purchase.data.amount}`);
    console.log('🆔 Transaction ID:', purchase.data.transactionId);
    console.log('📅 Domain Details:');
    console.log('   Domain:', purchase.data.details.domain);
    console.log('   Years:', purchase.data.details.years);
    console.log('   Registrar:', purchase.data.details.registrar);
    console.log('   Expires:', purchase.data.details.expires);
    console.log('💰 Remaining Balance:', `$${purchase.data.remainingBalance}`);

    // 4. Try purchasing another domain to test limits
    console.log('\n4. 🔄 Testing spending limits with another domain...');
    
    try {
      const purchase2 = await axios.post('http://localhost:3000/v1/purchase', {
        agentToken: agentToken,
        service: 'domain',
        params: {
          domain: 'another-ai-domain.com',
          years: 1
        }
      });
      console.log('✅ Second domain purchased:', purchase2.data.details.domain);
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('limit')) {
        console.log('⚠️ Daily spending limit reached - AI agent properly restricted!');
        console.log('   This proves spending controls work correctly! 🔒');
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // 5. Check final wallet status
    console.log('\n5. Final wallet status...');
    const finalWallet = await axios.get(`http://localhost:3000/v1/wallets/${walletId}`);
    console.log('✅ Final wallet state:', {
      walletId: finalWallet.data.walletId,
      balanceUSD: finalWallet.data.balanceUSD,
      balanceSat: finalWallet.data.balanceSat,
      balanceBTC: finalWallet.data.balanceBTC
    });

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

console.log('🌐 Testing AI Agent Domain Purchases');
console.log('💡 This demonstrates autonomous domain registration with spending limits\n');

testDomainPurchase(); 