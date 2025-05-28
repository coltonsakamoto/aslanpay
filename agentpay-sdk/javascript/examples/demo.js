#!/usr/bin/env node
/**
 * AgentPay SDK Demo - Dead Simple AI Agent Payments
 * 
 * This demo shows how easy it is to give any AI agent purchasing power.
 * Just 5 lines of code to go from zero to buying things!
 */

const agentpay = require('../index.js');

async function main() {
  console.log('🤖 AgentPay JavaScript SDK Demo');
  console.log('='.repeat(50));
  
  // Step 1: Configure (auto-loads from AGENTPAY_TOKEN env var if set)
  const token = process.env.AGENTPAY_TOKEN || 'demo_agent_token_123';
  agentpay.configure({ token });
  console.log(`✅ Configured with token: ${token.substring(0, 10)}...`);
  
  console.log('\n🛍️ Testing Various Purchases:');
  console.log('-'.repeat(30));
  
  // Step 2: Make purchases - dead simple!
  const purchases = [
    ['food-delivery', 25.00, { restaurant: 'Pizza Palace', items: ['Large Pizza'] }],
    ['gift-card', 50.00, { brand: 'amazon' }],
    ['sms', null, { to: '+1234567890', message: 'Hello from AI agent!' }],
    ['flight', 400.00, { from: 'SFO', to: 'LAX', date: '2025-02-01' }],
  ];
  
  for (const [intent, amount, details] of purchases) {
    console.log(`\n🔄 Purchasing: ${intent}`);
    
    try {
      // This is the magic - one line to buy anything!
      const result = await agentpay.pay(intent, amount, details);
      
      if (result.success) {
        console.log(`   ✅ SUCCESS: ${result.message}`);
        console.log(`   💰 Amount: $${result.amount}`);
        console.log(`   🔗 Transaction: ${result.transactionId}`);
      } else {
        console.log(`   ❌ FAILED: ${result.error}`);
        console.log(`   📝 Message: ${result.message}`);
      }
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Demo Complete!');
  console.log('\nTo use in your AI agent:');
  console.log('1. npm install agentpay');
  console.log('2. agentpay.configure({ token: "your_token" })');
  console.log('3. const result = await agentpay.pay(intent, amount, details)');
  console.log('4. Check result.success');
  console.log('5. Done! 🚀');
}

if (require.main === module) {
  main().catch(console.error);
} 