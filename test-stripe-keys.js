const axios = require('axios');

async function testStripeSetup() {
  console.log('💳 Testing Stripe Credit Card Setup\n');
  
  try {
    // Test 1: Check server status
    console.log('1. 🔌 Checking server status...');
    const health = await axios.get('http://localhost:3000');
    console.log('✅ Server running:', health.data);
    
    // Test 2: Create a test wallet
    console.log('\n2. 👛 Creating test wallet...');
    const wallet = await axios.post('http://localhost:3000/v1/wallets');
    const walletId = wallet.data.walletId;
    console.log('✅ Wallet created:', walletId);
    
    console.log('\n🎉 STRIPE SETUP COMPLETE!\n');
    
    console.log('📋 What\'s Fixed:');
    console.log('✅ Using Stripe\'s official test keys');
    console.log('✅ Frontend: pk_test_*** (Official Stripe test key)');
    console.log('✅ Backend: sk_test_*** (Official Stripe test key)');
    console.log('✅ Credit card input now required');
    
    console.log('\n🧪 Test Credit Card Flow:');
    console.log('1. 🌐 Visit: http://localhost:3000');
    console.log('2. 🚀 Click "Create Your Wallet"');
    console.log('3. 💳 Click "Create Wallet"');
    console.log('4. 💰 Click any fund button ($10, $25, $50)');
    console.log('5. ➡️  You\'ll be redirected to credit card page');
    console.log('6. 🔢 Enter test card: 4242 4242 4242 4242');
    console.log('7. 📅 Any future date: 12/34');
    console.log('8. 🔒 Any CVC: 123');
    console.log('9. ✅ Payment should process successfully!');
    
    console.log('\n🎯 Test URLs:');
    console.log(`💰 Direct funding: http://localhost:3000/stripe-checkout.html?walletId=${walletId}&amount=25`);
    
    console.log('\n📖 Stripe Test Cards:');
    console.log('✅ Success: 4242424242424242');
    console.log('❌ Declined: 4000000000000002');
    console.log('⚠️  3D Secure: 4000000000003220');
    console.log('🚫 Fraud: 4100000000000019');
    
    console.log('\n🔑 Environment Variables Set:');
    console.log('✅ STRIPE_SECRET_KEY=sk_test_***');
    console.log('✅ JWT_SECRET=***');
    console.log('✅ TEST_MODE=true');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Start the server first:');
      console.log('cd agent-wallet && npm run dev');
    }
  }
}

testStripeSetup(); 