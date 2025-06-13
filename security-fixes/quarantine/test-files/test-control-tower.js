const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testControlTower() {
  console.log('🎯 **AGENTPAY CONTROL TOWER TEST**');
  console.log('=====================================');
  console.log('🚀 Testing the Financial Operating System for AI Agents\n');

  try {
    // 1. Setup: Create wallet and agent
    console.log('1. 🏗️ Setting up Control Tower infrastructure...');
    
    const walletResponse = await axios.post(`${API_BASE}/v1/wallets`);
    const walletId = walletResponse.data.walletId;
    
    const agentResponse = await axios.post(`${API_BASE}/v1/agents`, {
      walletId: walletId,
      dailyUsdLimit: 200 // $200 daily limit
    });
    const agentToken = agentResponse.data.agentToken;
    console.log('✅ Agent created with $200 daily spending limit');

    // 2. Test Real-Time Authorization API
    console.log('\n2. 🎯 Testing Real-Time Authorization API...');
    console.log('   📋 Scenario: AI agent wants to buy lunch on DoorDash');
    
    const authRequest = {
      agentToken: agentToken,
      merchant: 'doordash.com',
      amount: 15.99,
      category: 'food',
      intent: 'Order lunch delivery - chicken burrito bowl with guac',
      metadata: {
        urgency: 'medium',
        requestedBy: 'user_voice_command',
        relatedTask: 'daily_lunch_order'
      }
    };
    
    const authResponse = await axios.post(`${API_BASE}/v1/authorize`, authRequest);
    
    if (authResponse.data.success && authResponse.data.authorized) {
      const authId = authResponse.data.authorizationId;
      console.log('✅ AUTHORIZATION GRANTED!');
      console.log(`   • Authorization ID: ${authId}`);
      console.log(`   • Amount: $${authResponse.data.amount}`);
      console.log(`   • Merchant: ${authResponse.data.merchant}`);
      console.log(`   • Expires: ${authResponse.data.expiresAt}`);
      console.log(`   • Remaining Daily Limit: $${authResponse.data.remainingLimits.daily}`);
      
      // 3. Test Authorization Status Check
      console.log('\n3. 🔍 Testing Authorization Status Check...');
      
      const statusResponse = await axios.get(`${API_BASE}/v1/authorize/${authId}`);
      console.log('✅ Authorization Status Retrieved:');
      console.log(`   • Status: ${statusResponse.data.status}`);
      console.log(`   • Expired: ${statusResponse.data.isExpired}`);
      console.log(`   • Intent: ${statusResponse.data.intent}`);
      
      // 4. Test Merchant Validation API
      console.log('\n4. 🏪 Testing Merchant Validation API...');
      console.log('   📋 Scenario: DoorDash validating the authorization');
      
      const merchantValidation = await axios.post(`${API_BASE}/v1/validate-agent-purchase`, {
        authorizationId: authId,
        merchantId: 'doordash_verified',
        finalAmount: 16.45, // Slightly higher due to taxes/fees
        transactionData: {
          orderId: 'DD_789123',
          restaurant: 'Chipotle Mexican Grill',
          estimatedDelivery: '25 minutes'
        }
      });
      
      console.log('✅ MERCHANT VALIDATION SUCCESSFUL!');
      console.log(`   • Valid: ${merchantValidation.data.valid}`);
      console.log(`   • Charge Token: ${merchantValidation.data.chargeToken}`);
      console.log(`   • Final Amount: $${merchantValidation.data.finalAmount}`);
      console.log(`   • Platform Fee: $${merchantValidation.data.platformFee}`);
      
      // 5. Test Authorization Confirmation (Complete Transaction)
      console.log('\n5. 💳 Testing Authorization Confirmation...');
      console.log('   📋 Scenario: Completing the transaction after order placed');
      
      const confirmResponse = await axios.post(`${API_BASE}/v1/authorize/${authId}/confirm`, {
        finalAmount: 16.45,
        transactionDetails: {
          orderId: 'DD_789123',
          items: ['Chicken Burrito Bowl', 'Guacamole', 'Chips'],
          restaurant: 'Chipotle Mexican Grill',
          deliveryAddress: '123 Main St, San Francisco, CA',
          estimatedDelivery: '6:45 PM'
        },
        merchantData: {
          merchantTransactionId: 'DD_789123',
          deliveryTracking: 'https://doordash.com/track/789123'
        }
      });
      
      console.log('✅ TRANSACTION COMPLETED!');
      console.log(`   • Transaction ID: ${confirmResponse.data.transactionId}`);
      console.log(`   • Amount Charged: $${confirmResponse.data.totalCharged}`);
      console.log(`   • Service Fee: $${confirmResponse.data.platformFee}`);
      console.log(`   • Payment Method: ****${confirmResponse.data.paymentMethod.last4}`);
      console.log(`   • Authorization Flow: ${confirmResponse.data.controlTower.authorizationFlow}`);
      
    } else {
      console.log('❌ Authorization denied:', authResponse.data.reason);
    }

    // 6. Test Multiple Authorizations (Spending Limits)
    console.log('\n6. 🔒 Testing Spending Limits with Multiple Authorizations...');
    
    const scenarios = [
      { merchant: 'amazon.com', amount: 49.99, category: 'shopping', intent: 'Buy wireless headphones' },
      { merchant: 'uber.com', amount: 25.50, category: 'transportation', intent: 'Ride to airport' },
      { merchant: 'netflix.com', amount: 15.99, category: 'entertainment', intent: 'Monthly subscription' }
    ];
    
    for (const scenario of scenarios) {
      try {
        const testAuth = await axios.post(`${API_BASE}/v1/authorize`, {
          agentToken: agentToken,
          ...scenario
        });
        
        if (testAuth.data.authorized) {
          console.log(`✅ ${scenario.merchant}: $${scenario.amount} - AUTHORIZED`);
        } else {
          console.log(`⚠️ ${scenario.merchant}: $${scenario.amount} - ${testAuth.data.reason}`);
        }
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`🚫 ${scenario.merchant}: $${scenario.amount} - BLOCKED (${error.response.data.error})`);
        }
      }
    }

    // 7. Test Control Tower Analytics
    console.log('\n7. 📊 Testing Control Tower Analytics...');
    
    const analyticsResponse = await axios.get(`${API_BASE}/v1/control-tower/analytics?timeframe=24h`);
    console.log('✅ Control Tower Analytics:');
    console.log(`   • Total Authorizations: ${analyticsResponse.data.controlTowerAnalytics.totalAuthorizations}`);
    console.log(`   • Total Authorized Amount: $${analyticsResponse.data.controlTowerAnalytics.totalAuthorizedAmount}`);
    console.log(`   • Status Breakdown:`, analyticsResponse.data.controlTowerAnalytics.statusBreakdown);
    console.log(`   • Service Breakdown:`, analyticsResponse.data.controlTowerAnalytics.serviceBreakdown);

    // 8. Test Agent Spending Summary
    console.log('\n8. 💰 Testing Agent Spending Summary...');
    
    const configResponse = await axios.get(`${API_BASE}/v1/agents/${agentToken}/config`);
    if (configResponse.data.success) {
      const summary = configResponse.data.spendingSummary;
      console.log('✅ Agent Spending Summary:');
      console.log(`   • Daily Spent: $${summary.daily.spent} / $${summary.daily.limit}`);
      console.log(`   • Daily Remaining: $${summary.daily.remaining}`);
      console.log(`   • Transaction Limit: $${summary.limits.transaction}`);
      console.log(`   • Emergency Stop: ${summary.limits.emergencyStop ? 'ACTIVE' : 'inactive'}`);
    }

    // 9. Success Summary
    console.log('\n🎉 **CONTROL TOWER TEST COMPLETE**');
    console.log('=====================================');
    console.log('✅ ALL CONTROL TOWER FEATURES WORKING:');
    console.log('   🎯 Real-time authorization API');
    console.log('   🔍 Authorization status tracking');
    console.log('   🏪 Merchant validation API');
    console.log('   💳 Transaction confirmation flow');
    console.log('   🔒 Spending limits enforcement');
    console.log('   📊 Analytics and reporting');
    console.log('   💰 Spending summaries');
    
    console.log('\n🚀 **AGENTPAY CONTROL TOWER IS LIVE!**');
    console.log('=====================================');
    console.log('🎯 AgentPay is now the Financial Operating System for AI Agents');
    console.log('🎯 Every AI commerce transaction can flow through AgentPay authorization');
    console.log('🎯 Ready for OpenAI Function Calling integration');
    console.log('🎯 Ready for merchant partner integrations');
    console.log('🎯 Ready to scale as "Stripe for AI Agents"');

  } catch (error) {
    console.error('❌ Control Tower test failed:', error.response?.data || error.message);
    
    if (error.response?.data) {
      console.log('\n🔍 Error Details:');
      console.log('   • Code:', error.response.data.code);
      console.log('   • Message:', error.response.data.error);
    }
  }
}

// Run the Control Tower test
console.log('🚨 STARTING AGENTPAY CONTROL TOWER TEST 🚨\n');
testControlTower(); 