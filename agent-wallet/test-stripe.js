const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testStripeKeys() {
  try {
    console.log('🔑 Testing Stripe secret key...');
    const account = await stripe.accounts.retrieve();
    console.log('✅ Secret key works! Account ID:', account.id);
    console.log('📊 Account details:', {
      country: account.country,
      default_currency: account.default_currency,
      type: account.type,
      business_type: account.business_type
    });
    
    // Test creating a customer
    console.log('\n👤 Testing customer creation...');
    const customer = await stripe.customers.create({
      metadata: { test: 'stripe-key-verification' }
    });
    console.log('✅ Customer created:', customer.id);
    
    // Clean up
    await stripe.customers.del(customer.id);
    console.log('🧹 Test customer deleted');
    
  } catch (error) {
    console.error('❌ Stripe key test failed:', error.message);
    console.error('❌ Error type:', error.type);
    console.error('❌ Error code:', error.code);
  }
}

testStripeKeys(); 