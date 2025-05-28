const axios = require('axios');

/**
 * Test AgentPay Control Tower Integration with LangChain & CrewAI
 * 
 * This script simulates how LangChain and CrewAI frameworks would
 * integrate with AgentPay's /v1/authorize → /confirm flow
 */

class AgentPayControlTowerTest {
  constructor() {
    this.apiBase = 'http://localhost:3000';
    this.agentToken = null;
  }

  async setupTestEnvironment() {
    console.log('🏗️ Setting up AgentPay test environment...\n');
    
    try {
      // Create test wallet
      const walletResponse = await axios.post(`${this.apiBase}/v1/wallets`);
      const walletId = walletResponse.data.walletId;
      console.log(`✅ Created test wallet: ${walletId}`);
      
      // Create test agent
      const agentResponse = await axios.post(`${this.apiBase}/v1/agents`, {
        walletId: walletId,
        dailyUsdLimit: 500 // $500 daily limit
      });
      this.agentToken = agentResponse.data.agentToken;
      console.log(`✅ Created test agent with $500 daily limit`);
      
      // Add test payment method
      const cardResponse = await axios.post(`${this.apiBase}/v1/wallets/${walletId}/cards`, {
        paymentMethodId: 'pm_card_visa' // Test card
      });
      console.log(`✅ Added test payment method: ****${cardResponse.data.last4}`);
      
      console.log('🎯 Test environment ready!\n');
      
    } catch (error) {
      console.error('❌ Setup failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Simulate LangChain Agent Integration
   * Uses the /v1/authorize → /confirm flow
   */
  async testLangChainIntegration() {
    console.log('🦜 **LANGCHAIN INTEGRATION TEST**');
    console.log('================================\n');
    
    try {
      // Simulate LangChain agent deciding to make a purchase
      const purchaseRequest = {
        merchant: 'doordash.com',
        amount: 24.99,
        category: 'food',
        intent: 'Order chicken burrito bowl with guacamole for lunch',
        metadata: {
          framework: 'langchain',
          agent_type: 'food_ordering_specialist',
          user_request: 'I want healthy lunch delivered'
        }
      };
      
      console.log('🎯 LangChain Agent Request:');
      console.log(`   • Merchant: ${purchaseRequest.merchant}`);
      console.log(`   • Amount: $${purchaseRequest.amount}`);
      console.log(`   • Intent: ${purchaseRequest.intent}`);
      console.log('');
      
      // Step 1: Request authorization from AgentPay Control Tower
      console.log('📝 Step 1: Requesting authorization from Control Tower...');
      const authResponse = await axios.post(`${this.apiBase}/v1/authorize`, {
        agentToken: this.agentToken,
        ...purchaseRequest
      });
      
      if (!authResponse.data.authorized) {
        throw new Error(`Authorization denied: ${authResponse.data.reason}`);
      }
      
      const authorizationId = authResponse.data.authorizationId;
      const scopedToken = authResponse.data.scopedToken;
      const latency = authResponse.data.latency;
      
      console.log(`✅ Authorization granted in ${latency}ms`);
      console.log(`   • Authorization ID: ${authorizationId}`);
      console.log(`   • Scoped Token: ${scopedToken ? 'Issued ✅' : 'None'}`);
      console.log(`   • Expires: ${authResponse.data.expiresAt}`);
      console.log('');
      
      // Step 2: Simulate LangChain agent executing purchase at merchant
      console.log('🛍️ Step 2: LangChain agent executing purchase at DoorDash...');
      
      // In real implementation, this would be browser automation or API calls
      const merchantResult = await this.simulateMerchantPurchase(
        purchaseRequest.merchant,
        purchaseRequest.amount,
        authorizationId,
        'LangChain Agent',
        scopedToken
      );
      
      if (!merchantResult.success) {
        throw new Error(`Merchant purchase failed: ${merchantResult.error}`);
      }
      
      console.log(`✅ Purchase completed at ${purchaseRequest.merchant}`);
      console.log(`   • Order ID: ${merchantResult.order_id}`);
      console.log(`   • Final Amount: $${merchantResult.final_amount}`);
      console.log('');
      
      // Step 3: Confirm transaction with AgentPay
      console.log('💳 Step 3: Confirming transaction with AgentPay...');
      const confirmResponse = await axios.post(
        `${this.apiBase}/v1/authorize/${authorizationId}/confirm`,
        {
          finalAmount: merchantResult.final_amount,
          transactionDetails: merchantResult.transaction_details,
          merchantData: {
            framework: 'langchain',
            agent_execution_time: '2.3s'
          }
        }
      );
      
      if (!confirmResponse.data.success) {
        throw new Error(`Transaction confirmation failed: ${confirmResponse.data.error}`);
      }
      
      console.log(`✅ Transaction confirmed and charged`);
      console.log(`   • Transaction ID: ${confirmResponse.data.transactionId}`);
      console.log(`   • Total Charged: $${confirmResponse.data.totalCharged}`);
      console.log(`   • Platform Fee: $${confirmResponse.data.platformFee}`);
      console.log(`   • Payment Method: ${confirmResponse.data.paymentMethod.type} ****${confirmResponse.data.paymentMethod.last4}`);
      console.log('');
      
      console.log('🎉 LangChain integration test PASSED!\n');
      return {
        success: true,
        authorizationId,
        transactionId: confirmResponse.data.transactionId,
        totalCharged: confirmResponse.data.totalCharged
      };
      
    } catch (error) {
      console.error('❌ LangChain integration test FAILED:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Simulate CrewAI Integration
   * Uses the same /v1/authorize → /confirm flow but with crew coordination
   */
  async testCrewAIIntegration() {
    console.log('🤖 **CREWAI INTEGRATION TEST**');
    console.log('=============================\n');
    
    try {
      // Simulate CrewAI crew with multiple agents coordinating
      const purchaseRequest = {
        merchant: 'amazon.com',
        amount: 49.99,
        category: 'shopping',
        intent: 'Buy wireless Bluetooth headphones for office work',
        metadata: {
          framework: 'crewai',
          crew_name: 'office_supplies_crew',
          validator_agent: 'purchase_validator',
          executor_agent: 'purchase_specialist',
          user_request: 'I need good headphones for video calls'
        }
      };
      
      console.log('🎯 CrewAI Crew Purchase Request:');
      console.log(`   • Merchant: ${purchaseRequest.merchant}`);
      console.log(`   • Amount: $${purchaseRequest.amount}`);
      console.log(`   • Intent: ${purchaseRequest.intent}`);
      console.log(`   • Crew: ${purchaseRequest.metadata.crew_name}`);
      console.log('');
      
      // Simulate crew validation step
      console.log('👥 CrewAI Validation Phase:');
      console.log('   • Validator Agent: Checking purchase reasonableness...');
      console.log('   • ✅ Amount reasonable for electronics category');
      console.log('   • ✅ Merchant (Amazon) is trusted and legitimate');
      console.log('   • ✅ Intent is clear and specific');
      console.log('   • ✅ Purchase approved by validation agent');
      console.log('');
      
      // Step 1: Request authorization from AgentPay Control Tower
      console.log('📝 Step 1: Purchase Specialist requesting authorization...');
      const authResponse = await axios.post(`${this.apiBase}/v1/authorize`, {
        agentToken: this.agentToken,
        ...purchaseRequest
      });
      
      if (!authResponse.data.authorized) {
        throw new Error(`Authorization denied: ${authResponse.data.reason}`);
      }
      
      const authorizationId = authResponse.data.authorizationId;
      const scopedToken = authResponse.data.scopedToken;
      const latency = authResponse.data.latency;
      
      console.log(`✅ Authorization granted in ${latency}ms`);
      console.log(`   • Authorization ID: ${authorizationId}`);
      console.log(`   • Scoped Token: ${scopedToken ? 'Issued ✅' : 'None'}`);
      console.log(`   • Security Level: ${authResponse.data.security?.securityLevel || 'Standard'}`);
      console.log('');
      
      // Step 2: Simulate CrewAI crew executing purchase
      console.log('🛍️ Step 2: CrewAI Purchase Specialist executing at Amazon...');
      console.log('   • Browser Agent: Navigating to Amazon.com...');
      console.log('   • Search Agent: Finding wireless Bluetooth headphones...');
      console.log('   • Selection Agent: Choosing highly-rated option...');
      console.log('   • Checkout Agent: Completing purchase...');
      console.log('');
      
      const merchantResult = await this.simulateMerchantPurchase(
        purchaseRequest.merchant,
        purchaseRequest.amount,
        authorizationId,
        'CrewAI Purchase Specialist',
        scopedToken
      );
      
      if (!merchantResult.success) {
        throw new Error(`Merchant purchase failed: ${merchantResult.error}`);
      }
      
      console.log(`✅ Purchase completed by CrewAI crew`);
      console.log(`   • Order ID: ${merchantResult.order_id}`);
      console.log(`   • Final Amount: $${merchantResult.final_amount} (incl. tax)`);
      console.log(`   • Crew Coordination: Successful ✅`);
      console.log('');
      
      // Step 3: Confirm transaction with AgentPay
      console.log('💳 Step 3: Confirming transaction with AgentPay...');
      const confirmResponse = await axios.post(
        `${this.apiBase}/v1/authorize/${authorizationId}/confirm`,
        {
          finalAmount: merchantResult.final_amount,
          transactionDetails: merchantResult.transaction_details,
          merchantData: {
            framework: 'crewai',
            crew_execution_time: '4.7s',
            agents_involved: ['validator', 'browser', 'search', 'selection', 'checkout']
          }
        }
      );
      
      if (!confirmResponse.data.success) {
        throw new Error(`Transaction confirmation failed: ${confirmResponse.data.error}`);
      }
      
      console.log(`✅ Transaction confirmed and charged`);
      console.log(`   • Transaction ID: ${confirmResponse.data.transactionId}`);
      console.log(`   • Total Charged: $${confirmResponse.data.totalCharged}`);
      console.log(`   • Platform Fee: $${confirmResponse.data.platformFee}`);
      console.log(`   • Payment Method: ${confirmResponse.data.paymentMethod.type} ****${confirmResponse.data.paymentMethod.last4}`);
      console.log('');
      
      console.log('🎉 CrewAI integration test PASSED!\n');
      return {
        success: true,
        authorizationId,
        transactionId: confirmResponse.data.transactionId,
        totalCharged: confirmResponse.data.totalCharged
      };
      
    } catch (error) {
      console.error('❌ CrewAI integration test FAILED:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test cross-framework coordination
   * One framework requests authorization, another confirms
   */
  async testCrossFrameworkCoordination() {
    console.log('🔗 **CROSS-FRAMEWORK COORDINATION TEST**');
    console.log('========================================\n');
    
    try {
      console.log('Scenario: LangChain agent requests authorization, CrewAI crew executes purchase');
      console.log('');
      
      // LangChain agent requests authorization
      console.log('🦜 LangChain Agent: Requesting authorization for Uber ride...');
      const authResponse = await axios.post(`${this.apiBase}/v1/authorize`, {
        agentToken: this.agentToken,
        merchant: 'uber.com',
        amount: 18.75,
        category: 'transportation',
        intent: 'Ride to airport for business trip',
        metadata: {
          requesting_framework: 'langchain',
          executing_framework: 'crewai',
          coordination_test: true
        }
      });
      
      if (!authResponse.data.authorized) {
        throw new Error(`Authorization denied: ${authResponse.data.reason}`);
      }
      
      const authorizationId = authResponse.data.authorizationId;
      console.log(`✅ LangChain authorization granted: ${authorizationId}`);
      console.log('');
      
      // CrewAI crew executes the purchase
      console.log('🤖 CrewAI Crew: Executing Uber ride booking...');
      const merchantResult = await this.simulateMerchantPurchase(
        'uber.com',
        18.75,
        authorizationId,
        'CrewAI Transportation Crew',
        authResponse.data.scopedToken
      );
      
      if (!merchantResult.success) {
        throw new Error(`CrewAI execution failed: ${merchantResult.error}`);
      }
      
      console.log(`✅ CrewAI crew completed ride booking: ${merchantResult.order_id}`);
      console.log('');
      
      // Confirmation can be done by either framework
      console.log('💳 LangChain Agent: Confirming transaction...');
      const confirmResponse = await axios.post(
        `${this.apiBase}/v1/authorize/${authorizationId}/confirm`,
        {
          finalAmount: merchantResult.final_amount,
          transactionDetails: merchantResult.transaction_details,
          merchantData: {
            coordination: 'langchain_auth_crewai_execute',
            success: true
          }
        }
      );
      
      if (!confirmResponse.data.success) {
        throw new Error(`Transaction confirmation failed: ${confirmResponse.data.error}`);
      }
      
      console.log(`✅ Cross-framework coordination successful!`);
      console.log(`   • Authorized by: LangChain`);
      console.log(`   • Executed by: CrewAI`);
      console.log(`   • Confirmed by: LangChain`);
      console.log(`   • Transaction ID: ${confirmResponse.data.transactionId}`);
      console.log('');
      
      console.log('🎉 Cross-framework coordination test PASSED!\n');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Cross-framework coordination test FAILED:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Simulate merchant purchase execution
   * In real implementation, this would be browser automation or API calls
   */
  async simulateMerchantPurchase(merchant, amount, authId, executorName, scopedToken) {
    // Simulate processing time based on merchant
    const processingTimes = {
      'doordash.com': 2000,
      'amazon.com': 3000,
      'uber.com': 1500,
      'default': 2000
    };
    
    const processingTime = processingTimes[merchant] || processingTimes.default;
    
    console.log(`   • ${executorName}: Processing ${merchant} purchase...`);
    console.log(`   • Using authorization: ${authId}`);
    if (scopedToken) {
      console.log(`   • Using scoped token: ${scopedToken.substring(0, 20)}...`);
    }
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      return {
        success: false,
        error: `${merchant} temporarily unavailable`
      };
    }
    
    // Simulate successful purchase with realistic variations
    const finalAmount = amount + Math.round((Math.random() * 3.00) * 100) / 100; // Add taxes/fees
    const orderId = `${merchant.split('.')[0].toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    return {
      success: true,
      order_id: orderId,
      final_amount: finalAmount,
      transaction_details: {
        orderId,
        merchant,
        original_amount: amount,
        final_amount: finalAmount,
        taxes_fees: finalAmount - amount,
        authorization_id: authId,
        executor: executorName,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Get final spending summary
   */
  async getSpendingSummary() {
    try {
      const configResponse = await axios.get(`${this.apiBase}/v1/agents/${this.agentToken}/config`);
      return configResponse.data.spendingSummary;
    } catch (error) {
      console.error('Failed to get spending summary:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log('🚀 **AGENTPAY CONTROL TOWER INTEGRATION TESTS**');
    console.log('================================================\n');
    
    try {
      // Setup test environment
      await this.setupTestEnvironment();
      
      // Run individual framework tests
      const langchainResult = await this.testLangChainIntegration();
      const crewaiResult = await this.testCrewAIIntegration();
      const coordinationResult = await this.testCrossFrameworkCoordination();
      
      // Get final spending summary
      console.log('📊 **FINAL SPENDING SUMMARY**');
      console.log('============================\n');
      
      const spendingSummary = await this.getSpendingSummary();
      if (spendingSummary) {
        console.log(`💰 Total Spent Today: $${spendingSummary.todaySpent}`);
        console.log(`📈 Daily Limit: $${spendingSummary.dailyLimit}`);
        console.log(`📉 Remaining: $${spendingSummary.remainingToday}`);
        console.log(`🔢 Transactions: ${spendingSummary.transactionCount}`);
        console.log('');
      }
      
      // Overall results
      console.log('🏆 **INTEGRATION TEST RESULTS**');
      console.log('===============================\n');
      
      const results = {
        langchain: langchainResult.success,
        crewai: crewaiResult.success,
        coordination: coordinationResult.success
      };
      
      const passedTests = Object.values(results).filter(Boolean).length;
      const totalTests = Object.keys(results).length;
      
      console.log(`✅ LangChain Integration: ${results.langchain ? 'PASSED' : 'FAILED'}`);
      console.log(`✅ CrewAI Integration: ${results.crewai ? 'PASSED' : 'FAILED'}`);
      console.log(`✅ Cross-Framework Coordination: ${results.coordination ? 'PASSED' : 'FAILED'}`);
      console.log('');
      console.log(`📊 Overall Score: ${passedTests}/${totalTests} tests passed`);
      
      if (passedTests === totalTests) {
        console.log('🎉 **ALL INTEGRATION TESTS PASSED!**');
        console.log('🚀 AgentPay Control Tower is ready for production use with both LangChain and CrewAI!');
      } else {
        console.log('⚠️ **SOME TESTS FAILED**');
        console.log('Please review the failures above before deploying to production.');
      }
      
    } catch (error) {
      console.error('❌ Integration test suite failed:', error.message);
    }
  }
}

// Run the comprehensive integration tests
if (require.main === module) {
  const tester = new AgentPayControlTowerTest();
  tester.runAllTests().catch(console.error);
}

module.exports = AgentPayControlTowerTest; 