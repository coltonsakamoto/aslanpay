const axios = require('axios');

async function testRealSMS() {
  console.log('🚨 TESTING REAL AI AGENT SMS PURCHASE! 🚨\n');

  try {
    // 1. Create wallet and fund it (same as before)
    console.log('1. Creating & funding wallet...');
    const wallet = await axios.post('http://localhost:3000/v1/wallets');
    const walletId = wallet.data.walletId;
    
    await axios.post(`http://localhost:3000/v1/wallets/${walletId}/fund`, { usd: 10 });
    console.log('✅ Wallet funded with $10');

    // 2. Create AI agent 
    console.log('\n2. Creating AI agent...');
    const agent = await axios.post('http://localhost:3000/v1/agents', {
      walletId: walletId,
      dailyUsdLimit: 5
    });
    const agentToken = agent.data.agentToken;
    console.log('✅ AI agent created');

    // 3. **REAL PURCHASE** - AI agent sends SMS
    console.log('\n3. 🚨 AI AGENT MAKING REAL SMS PURCHASE! 🚨');
    
    const phoneNumber = '+15038099355'; // Your personal phone number!
    const message = 'Hello! This SMS was purchased and sent by an AI agent using AgentPay! 🤖⚡';
    
    const purchase = await axios.post('http://localhost:3000/v1/purchase', {
      agentToken: agentToken,
      service: 'sms',
      params: {
        to: phoneNumber,
        message: message
      }
    });

    console.log('🎉 REAL PURCHASE SUCCESSFUL!');
    console.log('📱 SMS Details:', purchase.data);
    console.log('💰 Cost:', `$${purchase.data.amount}`);
    console.log('🆔 Transaction ID:', purchase.data.transactionId);
    console.log('📲 Check your phone for the message!');

  } catch (error) {
    if (error.response?.data?.error?.includes('Twilio credentials')) {
      console.log('⚠️  Need to set up Twilio first!');
      console.log('1. Sign up at twilio.com (2 minutes)');
      console.log('2. Add your credentials to .env file');
      console.log('3. Run this script again');
    } else {
      console.error('❌ Error:', error.response?.data || error.message);
    }
  }
}

// Replace with your phone number to test!
console.log('📞 CHANGE THE PHONE NUMBER IN THIS SCRIPT TO YOUR NUMBER!');
console.log('📞 Then run: node test-real-sms.js\n');

testRealSMS(); 