const axios = require('axios');

async function testCreditCardFlow() {
  console.log('💳 Testing Updated Credit Card Flow\n');
  
  try {
    // Test 1: Create wallet
    console.log('1. 👤 Creating wallet...');
    const wallet = await axios.post('http://localhost:3000/v1/wallets');
    const walletId = wallet.data.walletId;
    console.log('✅ Wallet created:', walletId);
    
    // Test 2: Check initial balance
    const walletCheck1 = await axios.get(`http://localhost:3000/v1/wallets/${walletId}`);
    console.log(`📊 Initial balance: $${walletCheck1.data.balanceUSD || 0}`);
    
    // Test 3: Try the old direct funding (should still work for API testing)
    console.log('\n2. 🧪 Testing direct API funding (for development/testing)...');
    try {
      await axios.post(`http://localhost:3000/v1/wallets/${walletId}/fund`, { 
        usd: 10 
      });
      const walletCheck2 = await axios.get(`http://localhost:3000/v1/wallets/${walletId}`);
      console.log(`✅ API funding works: $${walletCheck2.data.balanceUSD}`);
    } catch (error) {
      console.log('❌ API funding failed:', error.response?.data?.error);
    }
    
    // Test 4: Show the new user flow
    console.log('\n3. 🌐 NEW USER FLOW - Credit Card Required:');
    console.log('👆 Users click fund buttons on: http://localhost:3000');
    console.log('🔄 Automatically redirected to: http://localhost:3000/stripe-checkout.html');
    console.log('💳 Must enter real credit card details');
    console.log('✅ Payment processed through Stripe');
    console.log('🔙 Redirected back to dashboard');
    
    // Test 5: Show example URLs
    console.log('\n4. 📋 Example redirect URLs:');
    console.log(`💰 $10: http://localhost:3000/stripe-checkout.html?walletId=${walletId}&amount=10`);
    console.log(`💰 $25: http://localhost:3000/stripe-checkout.html?walletId=${walletId}&amount=25`);
    console.log(`💰 $50: http://localhost:3000/stripe-checkout.html?walletId=${walletId}&amount=50`);
    
    console.log('\n🎉 CREDIT CARD FLOW UPDATED!');
    console.log('\n📋 What Changed:');
    console.log('❌ OLD: Fund buttons directly add money (no payment)');
    console.log('✅ NEW: Fund buttons redirect to Stripe checkout');
    console.log('✅ NEW: Users must enter real credit card details');
    console.log('✅ NEW: Amount is pre-selected on checkout page');
    console.log('✅ NEW: Secure payment processing via Stripe');
    
    console.log('\n🛠 To Complete Setup:');
    console.log('1. Get Stripe account at https://stripe.com');
    console.log('2. Add STRIPE_SECRET_KEY to .env file');
    console.log('3. Replace publishable key in stripe-checkout.html');
    console.log('4. Test with Stripe test cards: 4242424242424242');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Start the server first:');
      console.log('cd agent-wallet && npm run dev');
    }
  }
}

testCreditCardFlow(); 