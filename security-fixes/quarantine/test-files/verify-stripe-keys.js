require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function verifyStripeAccount() {
  try {
    console.log('🔑 Verifying Stripe account with secret key...');
    
    const account = await stripe.accounts.retrieve();
    
    console.log('✅ Account verified!');
    console.log('📊 Account Details:');
    console.log('   Account ID:', account.id);
    console.log('   Country:', account.country);
    console.log('   Default Currency:', account.default_currency);
    console.log('   Business Type:', account.business_type);
    console.log('   Created:', new Date(account.created * 1000).toISOString());
    
    console.log('\n🔑 Secret Key Pattern:', process.env.STRIPE_SECRET_KEY.substring(0, 20) + '...');
    console.log('📝 Your publishable key should start with: pk_live_' + process.env.STRIPE_SECRET_KEY.substring(8, 28));
    
    return account;
  } catch (error) {
    console.error('❌ Error verifying account:', error.message);
    throw error;
  }
}

verifyStripeAccount(); 