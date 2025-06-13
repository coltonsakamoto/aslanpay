const axios = require('axios');

async function debugPaymentIssue() {
  console.log('🔍 Debugging Payment Processing Issue\n');
  
  try {
    // Test 1: Create wallet
    console.log('1. 👛 Creating test wallet...');
    const wallet = await axios.post('http://localhost:3000/v1/wallets');
    const walletId = wallet.data.walletId;
    console.log('✅ Wallet created:', walletId);
    
    // Test 2: Try to process a payment with minimal data
    console.log('\n2. 💳 Testing payment processing...');
    try {
      const paymentData = {
        paymentMethodId: 'pm_card_visa', // Stripe test payment method
        walletId: walletId,
        amount: 10
      };
      
      console.log('Sending payment data:', paymentData);
      
      const response = await axios.post('http://localhost:3000/v1/process-payment', paymentData);
      console.log('✅ Payment successful:', response.data);
      
    } catch (paymentError) {
      console.log('❌ Payment failed with status:', paymentError.response?.status);
      console.log('❌ Payment error details:', paymentError.response?.data);
      console.log('❌ Raw error message:', paymentError.message);
      
      // Let's check if it's a Stripe-specific error
      if (paymentError.response?.data?.details) {
        console.log('🔍 Stripe error details:', paymentError.response.data.details);
      }
    }
    
    console.log('\n🔍 Debugging Information:');
    console.log('- Server is running ✅');
    console.log('- Wallet creation works ✅');
    console.log('- Payment processing failed ❌');
    console.log('\nLikely issues:');
    console.log('1. Stripe payment method creation/confirmation');
    console.log('2. Database schema mismatch');
    console.log('3. Missing customer creation in Stripe');
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.response?.data || error.message);
  }
}

debugPaymentIssue(); 