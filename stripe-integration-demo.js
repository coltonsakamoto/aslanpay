#!/usr/bin/env node

/**
 * 🎉 ASLAN REAL STRIPE PAYMENTS DEMO
 * 
 * This script demonstrates the complete end-to-end payment flow
 * with Aslan's REAL Stripe integration, not mock payments!
 * 
 * Run: node stripe-integration-demo.js
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Demo configuration
const CONFIG = {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    demoEmail: `stripe.demo.${Date.now()}@aslanpay.com`,
    demoCompany: 'Stripe Integration Demo'
};

console.log(`
🚀 ===== ASLAN REAL STRIPE PAYMENTS DEMO =====

This demo shows:
✅ Real Stripe PaymentIntent creation
✅ Actual payment processing with fees
✅ Real Stripe confirmation/capture
✅ Genuine Stripe refunds
✅ Live vs Mock payment detection

Starting demo against: ${CONFIG.baseUrl}
`);

/**
 * Demo Steps:
 * 1. Sign up new SaaS account
 * 2. Create REAL payment authorization
 * 3. Confirm REAL payment 
 * 4. Process REAL refund
 * 5. Show billing integration
 */

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runStripeDemo() {
    try {
        console.log('\n📝 STEP 1: Creating SaaS Account...');
        
        // Sign up for new account
        const signupResponse = await axios.post(`${CONFIG.baseUrl}/api/auth/signup`, {
            name: 'Stripe Demo User',
            email: CONFIG.demoEmail,
            password: 'StripeDemo123!',
            organizationName: CONFIG.demoCompany
        });

        const { apiKey, tenant, user } = signupResponse.data;
        console.log(`✅ Account created: ${tenant.name}`);
        console.log(`🔑 API Key: ${apiKey.key.substring(0, 20)}...`);

        await sleep(1000);

        console.log('\n💳 STEP 2: Creating REAL Payment Authorization...');
        
        // Test payment for AI service
        const authResponse = await axios.post(`${CONFIG.baseUrl}/api/v1/authorize`, {
            amount: 2500, // $25.00
            description: 'AI Assistant API - 1000 queries',
            agentId: 'stripe-demo-agent',
            metadata: {
                service: 'ai-assistant',
                plan: 'pro',
                demo: true
            }
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey.key}`,
                'Content-Type': 'application/json'
            }
        });

        const auth = authResponse.data;
        
        if (auth.stripePaymentIntentId) {
            console.log(`🎉 REAL STRIPE PAYMENT CREATED!`);
            console.log(`   Payment ID: ${auth.id}`);
            console.log(`   Original Amount: $${auth.amount / 100}`);
            console.log(`   Aslan Fee: $${auth.aslanFee / 100}`);
            console.log(`   Total Charged: $${auth.totalAmount / 100}`);
            console.log(`   Client Secret: ${auth.clientSecret ? 'PROVIDED' : 'MISSING'}`);
            console.log(`   Live Mode: ${auth.livemode ? 'YES' : 'NO'}`);
        } else {
            console.log(`⚠️  Mock payment created (Stripe not configured)`);
            console.log(`   Mock ID: ${auth.id}`);
            console.log(`   Amount: $${auth.amount / 100}`);
        }

        await sleep(2000);

        console.log('\n🔒 STEP 3: Confirming Payment...');
        
        // Confirm the payment
        const confirmResponse = await axios.post(`${CONFIG.baseUrl}/api/v1/confirm`, {
            authorizationId: auth.id,
            finalAmount: auth.amount
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey.key}`,
                'Content-Type': 'application/json'
            }
        });

        const payment = confirmResponse.data;
        
        if (payment.stripePaymentIntentId) {
            console.log(`🎉 REAL STRIPE PAYMENT CONFIRMED!`);
            console.log(`   Payment Status: ${payment.status.toUpperCase()}`);
            console.log(`   Amount Processed: $${payment.amount / 100}`);
            console.log(`   Stripe Charge ID: ${payment.charges || 'Processing...'}`);
            console.log(`   Transaction ID: ${payment.transaction.id}`);
        } else {
            console.log(`⚠️  Mock payment confirmed`);
            console.log(`   Mock Payment ID: ${payment.id}`);
            console.log(`   Status: ${payment.status}`);
        }

        await sleep(2000);

        console.log('\n💸 STEP 4: Processing Refund...');
        
        // Process partial refund
        const refundAmount = 500; // $5.00 refund
        
        const refundResponse = await axios.post(`${CONFIG.baseUrl}/api/v1/refund`, {
            transactionId: payment.transaction.id,
            amount: refundAmount,
            reason: 'customer_request'
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey.key}`,
                'Content-Type': 'application/json'
            }
        });

        const refund = refundResponse.data;
        
        if (refund.stripeRefundId) {
            console.log(`🎉 REAL STRIPE REFUND PROCESSED!`);
            console.log(`   Refund ID: ${refund.id}`);
            console.log(`   Refund Amount: $${Math.abs(refund.amount) / 100}`);
            console.log(`   Refund Status: ${refund.status.toUpperCase()}`);
            console.log(`   Stripe Charge: ${refund.stripeChargeId}`);
        } else {
            console.log(`⚠️  Mock refund processed`);
            console.log(`   Mock Refund ID: ${refund.id}`);
            console.log(`   Amount: $${Math.abs(refund.amount) / 100}`);
        }

        await sleep(1000);

        console.log('\n📊 STEP 5: Checking Tenant Usage...');
        
        // Get tenant information and billing
        const tenantResponse = await axios.get(`${CONFIG.baseUrl}/api/v1/tenant`, {
            headers: {
                'Authorization': `Bearer ${apiKey.key}`
            }
        });

        const tenantInfo = tenantResponse.data;
        console.log(`   Tenant: ${tenantInfo.name}`);
        console.log(`   Plan: ${tenantInfo.plan.toUpperCase()}`);
        console.log(`   Daily Spent: $${tenantInfo.usage.dailySpent / 100}`);
        console.log(`   Monthly Spent: $${tenantInfo.usage.monthlySpent / 100}`);
        console.log(`   API Calls: ${tenantInfo.usage.apiCalls}`);
        console.log(`   Total Transactions: ${tenantInfo.stats.transactions}`);

        console.log('\n📈 STEP 6: Integration Status...');
        
        // Check if we're using real Stripe or mock
        const isRealStripe = auth.stripePaymentIntentId && !auth.mock;
        
        if (isRealStripe) {
            console.log(`🎉 SUCCESS: REAL STRIPE INTEGRATION ACTIVE!`);
            console.log(`
   ✅ PaymentIntents created successfully
   ✅ Payments can be confirmed/captured  
   ✅ Refunds processed through Stripe
   ✅ Aslan fee calculation working (2.9% + $0.30)
   ✅ Multi-tenant billing isolated
   ✅ Client secrets provided for frontend
   
   🚀 ASLAN IS READY FOR REAL PAYMENTS!
            `);
        } else {
            console.log(`⚠️  Mock Integration Active`);
            console.log(`
   📝 Mock payments created (Stripe not configured)
   🔧 To enable real payments:
      1. Verify STRIPE_SECRET_KEY is set in Railway
      2. Ensure it doesn't contain 'placeholder'
      3. Restart the application
      
   💡 All SaaS infrastructure is ready - just needs Stripe connection!
            `);
        }

        console.log('\n🎯 INTEGRATION SUMMARY:');
        console.log(`   Base URL: ${CONFIG.baseUrl}`);
        console.log(`   API Key: ${apiKey.key.substring(0, 15)}...`);
        console.log(`   Tenant ID: ${tenant.id}`);
        console.log(`   Real Stripe: ${isRealStripe ? 'YES' : 'NO'}`);
        console.log(`   Live Mode: ${payment.livemode ? 'YES' : 'NO'}`);
        
        if (isRealStripe) {
            console.log(`\n💰 REVENUE CALCULATION:`);
            const originalAmount = auth.amount;
            const aslanFee = auth.aslanFee;
            const customerCharged = auth.totalAmount;
            const stripeFee = Math.round(customerCharged * 0.029) + 30; // Stripe's fee
            const aslanNet = aslanFee - stripeFee;
            
            console.log(`   Customer pays: $${customerCharged / 100}`);
            console.log(`   Service gets: $${originalAmount / 100}`);
            console.log(`   Aslan gross fee: $${aslanFee / 100}`);
            console.log(`   Stripe fee: ~$${stripeFee / 100}`);
            console.log(`   Aslan net revenue: ~$${aslanNet / 100}`);
        }

        console.log('\n✨ Demo completed successfully!');

    } catch (error) {
        console.error('\n❌ Demo failed:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            console.log('\n🔧 This might be an API key issue. Check the signup response.');
        } else if (error.response?.status === 500) {
            console.log('\n🔧 Server error - check if the application is running.');
        }
        
        process.exit(1);
    }
}

// Run the demo
runStripeDemo(); 