/**
 * AslanPay API Key Test Script
 * Tests the newly implemented API key authentication system
 */

const axios = require('axios').default;

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_API_KEY; // Will be provided by user

async function testApiKeyAuthentication() {
    console.log('🧪 Testing AslanPay API Key Authentication\n');
    
    if (!TEST_API_KEY) {
        console.log('❌ No API key provided. Please:');
        console.log('1. Start the server: npm run dev');
        console.log('2. Sign up at http://localhost:3000/auth.html');
        console.log('3. Copy your API key from the dashboard');
        console.log('4. Run: TEST_API_KEY=ak_live_your_key node test-api-keys.js\n');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        // Test 1: API Key validation
        console.log('🔑 Test 1: API Key Validation');
        const testResponse = await axios.get(`${BASE_URL}/api/v1/test`, { headers });
        console.log('✅ API Key is valid!');
        console.log(`   User: ${testResponse.data.user.email}`);
        console.log(`   Key Name: ${testResponse.data.apiKey.name}`);
        console.log(`   Usage Count: ${testResponse.data.apiKey.usageCount}\n`);

        // Test 2: Payment Authorization
        console.log('💳 Test 2: Payment Authorization');
        const authResponse = await axios.post(`${BASE_URL}/api/v1/authorize`, {
            amount: 2500, // $25.00
            description: 'Test payment for AI agent',
            agentId: 'test-agent-001',
            metadata: { test: true, purpose: 'api_key_validation' }
        }, { headers });
        
        console.log('✅ Payment authorized successfully!');
        console.log(`   Authorization ID: ${authResponse.data.id}`);
        console.log(`   Amount: $${authResponse.data.amount / 100}`);
        console.log(`   Description: ${authResponse.data.description}\n`);

        // Test 3: Payment Confirmation
        console.log('✅ Test 3: Payment Confirmation');
        const confirmResponse = await axios.post(`${BASE_URL}/api/v1/confirm`, {
            authorizationId: authResponse.data.id,
            finalAmount: 2500
        }, { headers });
        
        console.log('✅ Payment confirmed successfully!');
        console.log(`   Payment ID: ${confirmResponse.data.id}`);
        console.log(`   Transaction ID: ${confirmResponse.data.transaction.id}`);
        console.log(`   Status: ${confirmResponse.data.status}\n`);

        // Test 4: Refund
        console.log('💰 Test 4: Refund Processing');
        const refundResponse = await axios.post(`${BASE_URL}/api/v1/refund`, {
            transactionId: confirmResponse.data.transaction.id,
            amount: 1000, // Partial refund of $10.00
            reason: 'test_refund'
        }, { headers });
        
        console.log('✅ Refund processed successfully!');
        console.log(`   Refund ID: ${refundResponse.data.id}`);
        console.log(`   Refund Amount: $${Math.abs(refundResponse.data.amount) / 100}`);
        console.log(`   Reason: ${refundResponse.data.reason}\n`);

        // Test 5: Tenant Information
        console.log('🏢 Test 5: Tenant Information');
        const tenantResponse = await axios.get(`${BASE_URL}/api/v1/tenant`, { headers });
        console.log('✅ Tenant information retrieved!');
        console.log(`   Organization: ${tenantResponse.data.name}`);
        console.log(`   API Keys: ${tenantResponse.data.stats.api_keys}`);
        console.log(`   API Calls: ${tenantResponse.data.usage.apiCalls}\n`);

        console.log('🎉 All tests passed! Your API keys are working correctly!');
        console.log('\n📋 Next Steps:');
        console.log('• Your API keys now authenticate all payment endpoints');
        console.log('• You can use these keys in your AI agents');
        console.log('• Check the README.md for integration examples');
        console.log('• Monitor usage in the dashboard\n');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            console.log('\n🔧 Troubleshooting:');
            console.log('• Check your API key format (should start with ak_live_ or ak_test_)');
            console.log('• Ensure you copied the full key from the dashboard');
            console.log('• Verify the server is running on the correct port');
        }
    }
}

// Error handling for missing axios
if (typeof axios === 'undefined') {
    console.log('❌ axios not found. Please install dependencies:');
    console.log('npm install axios');
} else {
    testApiKeyAuthentication();
} 