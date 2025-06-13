#!/usr/bin/env node

/**
 * Aslan SaaS Demo Script
 * 
 * This script demonstrates the complete SaaS experience:
 * 1. Public signup (no manual deployment needed)
 * 2. Instant API key generation
 * 3. Immediate payment processing
 * 
 * Run with: node saas-demo.js
 */

const readline = require('readline');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Helper functions
function log(message) {
    console.log(`🦁 ${message}`);
}

function success(message) {
    console.log(`✅ ${message}`);
}

function error(message) {
    console.log(`❌ ${message}`);
}

function warning(message) {
    console.log(`⚠️  ${message}`);
}

function info(message) {
    console.log(`ℹ️  ${message}`);
}

function question(prompt) {
    return new Promise(resolve => {
        rl.question(prompt, resolve);
    });
}

async function makeRequest(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const text = await response.text();
        let data;
        
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { error: 'Invalid JSON response', raw: text };
        }

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            data
        };
    } catch (err) {
        return {
            ok: false,
            status: 0,
            statusText: 'Network Error',
            data: { error: err.message }
        };
    }
}

async function displayHeader() {
    console.clear();
    console.log(`
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   🦁 ASLAN SAAS DEMO - Payment Infrastructure for AI       │
│                                                             │
│   This demo shows how developers can get started with      │
│   Aslan in under 60 seconds:                               │
│                                                             │
│   1. Sign up for account                                    │
│   2. Get instant API key                                    │
│   3. Process payments immediately                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
`);
}

async function checkServerHealth() {
    log('Checking server health...');
    
    const response = await makeRequest('/health');
    
    if (!response.ok) {
        error(`Server is not responding: ${response.statusText}`);
        error(`Make sure the server is running at ${BASE_URL}`);
        return false;
    }
    
    success('Server is healthy!');
    info(`Connected to: ${BASE_URL}`);
    
    if (response.data.security?.hasWarnings) {
        warning('Server has some configuration warnings (this is normal for development)');
    }
    
    return true;
}

async function signupDemo() {
    console.log('\n┌─ STEP 1: SAAS SIGNUP ─────────────────────────────────────┐');
    
    // Get user input
    const email = await question('Enter your email address: ');
    const password = await question('Enter a password (min 8 chars): ');
    const name = await question('Enter your name: ');
    const orgName = await question('Enter organization name (optional): ') || `${name}'s Organization`;
    
    log('Creating your Aslan account...');
    
    const response = await makeRequest('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
            email,
            password,
            name,
            organizationName: orgName
        })
    });
    
    if (!response.ok) {
        error(`Signup failed: ${response.data.error || 'Unknown error'}`);
        if (response.data.code === 'USER_EXISTS') {
            warning('This email is already registered. Try logging in instead.');
        }
        return null;
    }
    
    success('Account created successfully!');
    success(`Organization: ${response.data.tenant.name}`);
    success(`Plan: ${response.data.tenant.plan}`);
    
    console.log('\n📧 Welcome email sent with:');
    console.log(`   • Dashboard access`);
    console.log(`   • API documentation links`);
    console.log(`   • Your production-ready API key`);
    
    return {
        user: response.data.user,
        tenant: response.data.tenant,
        apiKey: response.data.apiKey.key
    };
}

async function demonstrateApiUsage(apiKey) {
    console.log('\n┌─ STEP 2: API KEY USAGE ──────────────────────────────────┐');
    
    success(`Your API Key: ${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 8)}`);
    info('This key is production-ready and can process real payments!');
    
    // Check limits
    log('Checking your account limits...');
    
    const limitsResponse = await makeRequest('/v1/limits', {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });
    
    if (limitsResponse.ok) {
        const limits = limitsResponse.data;
        console.log('\n📊 Account Limits:');
        console.log(`   • Daily Limit: $${limits.limits.daily / 100}`);
        console.log(`   • Per Transaction: $${limits.limits.per_transaction / 100}`);
        console.log(`   • API Calls: ${limits.limits.api_calls.toLocaleString()}`);
        console.log(`   • Plan: ${limits.tenant.plan}`);
        
        console.log('\n📈 Current Usage:');
        console.log(`   • Daily Spent: $${limits.usage.daily_spent / 100}`);
        console.log(`   • Remaining Today: $${limits.remaining.daily / 100}`);
    } else {
        warning('Could not fetch account limits');
    }
    
    // Get tenant info
    const tenantResponse = await makeRequest('/v1/tenant', {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });
    
    if (tenantResponse.ok) {
        const tenant = tenantResponse.data;
        console.log('\n🏢 Organization Details:');
        console.log(`   • Name: ${tenant.name}`);
        console.log(`   • Plan: ${tenant.plan}`);
        console.log(`   • Users: ${tenant.stats.users}`);
        console.log(`   • API Keys: ${tenant.stats.api_keys}`);
        console.log(`   • Transactions: ${tenant.stats.transactions}`);
    }
    
    return true;
}

async function processPaymentDemo(apiKey) {
    console.log('\n┌─ STEP 3: PAYMENT PROCESSING ─────────────────────────────┐');
    
    info('Now let\'s process some payments with your API key!');
    
    // Demo payment 1: Small amount
    log('Processing demo payment #1 ($25.00)...');
    
    const payment1 = await makeRequest('/v1/authorize', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            amount: 2500, // $25.00 in cents
            description: 'Demo Payment #1 - AI Agent Service',
            agentId: 'demo-gpt-4-agent',
            metadata: {
                demo: true,
                customer: 'demo-customer',
                service: 'ai-assistant'
            }
        })
    });
    
    if (payment1.ok) {
        success(`Payment authorized: ${payment1.data.id}`);
        console.log(`   • Amount: $${payment1.data.amount / 100}`);
        console.log(`   • Status: ${payment1.data.status}`);
        console.log(`   • Agent: ${payment1.data.agentId}`);
        console.log(`   • Expires: ${new Date(payment1.data.expires_at * 1000).toLocaleTimeString()}`);
    } else {
        error(`Payment failed: ${payment1.data.error}`);
        return false;
    }
    
    // Demo payment 2: Larger amount
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    log('Processing demo payment #2 ($47.50)...');
    
    const payment2 = await makeRequest('/v1/authorize', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            amount: 4750, // $47.50 in cents
            description: 'Demo Payment #2 - Custom AI Model',
            agentId: 'demo-claude-agent',
            metadata: {
                demo: true,
                model: 'claude-3-opus',
                tokens: 15000
            }
        })
    });
    
    if (payment2.ok) {
        success(`Payment authorized: ${payment2.data.id}`);
        console.log(`   • Amount: $${payment2.data.amount / 100}`);
        console.log(`   • Status: ${payment2.data.status}`);
        console.log(`   • Agent: ${payment2.data.agentId}`);
    } else {
        error(`Payment failed: ${payment2.data.error}`);
        return false;
    }
    
    // Show transaction list
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    log('Fetching your transaction history...');
    
    const transactions = await makeRequest('/v1/transactions', {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });
    
    if (transactions.ok) {
        success(`Found ${transactions.data.total_count} transactions`);
        console.log('\n📋 Recent Transactions:');
        
        transactions.data.data.slice(0, 5).forEach((tx, i) => {
            const time = new Date(tx.created * 1000).toLocaleTimeString();
            console.log(`   ${i + 1}. $${tx.amount / 100} - ${tx.description} (${time})`);
        });
        
        if (transactions.data.has_more) {
            info(`+ ${transactions.data.total_count - 5} more transactions`);
        }
    }
    
    return true;
}

async function showCodeExamples(apiKey) {
    console.log('\n┌─ INTEGRATION EXAMPLES ───────────────────────────────────┐');
    
    console.log(`
📝 Ready to integrate? Here are code examples:

🐍 Python:
import requests

response = requests.post('${BASE_URL}/api/v1/authorize', 
    headers={'Authorization': 'Bearer ${apiKey}'},
    json={
        'amount': 2500,
        'description': 'AI Assistant Service',
        'agentId': 'my-gpt-agent'
    }
)
print(response.json())

🟨 JavaScript:
const response = await fetch('${BASE_URL}/api/v1/authorize', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ${apiKey}',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        amount: 2500,
        description: 'AI Assistant Service',
        agentId: 'my-gpt-agent'
    })
});
const result = await response.json();

🦀 Rust:
use reqwest::Client;
use serde_json::json;

let client = Client::new();
let response = client
    .post("${BASE_URL}/api/v1/authorize")
    .header("Authorization", "Bearer ${apiKey}")
    .json(&json!({
        "amount": 2500,
        "description": "AI Assistant Service",
        "agentId": "my-gpt-agent"
    }))
    .send()
    .await?;

🐹 Go:
import (
    "bytes"
    "encoding/json"
    "net/http"
)

payload := map[string]interface{}{
    "amount": 2500,
    "description": "AI Assistant Service",
    "agentId": "my-gpt-agent",
}

jsonData, _ := json.Marshal(payload)
req, _ := http.NewRequest("POST", "${BASE_URL}/api/v1/authorize", bytes.NewBuffer(jsonData))
req.Header.Set("Authorization", "Bearer ${apiKey}")
req.Header.Set("Content-Type", "application/json")

client := &http.Client{}
resp, _ := client.Do(req)
`);
    
    console.log('\n🔗 Resources:');
    console.log(`   • Dashboard: ${BASE_URL}/dashboard.html`);
    console.log(`   • Documentation: ${BASE_URL}/docs.html`);
    console.log(`   • API Reference: ${BASE_URL}/docs.html#api-reference`);
    console.log(`   • Live Demo: ${BASE_URL}/demo.html`);
}

async function showUpgradePath() {
    console.log('\n┌─ PRODUCTION READY ───────────────────────────────────────┐');
    
    console.log(`
🚀 Your account is already production-ready!

🎁 Sandbox Plan (Current):
   • $100/day spending limit
   • Perfect for testing and development
   • All features included

💎 Production Plan:
   • Unlimited daily spending
   • 2.9% + 30¢ per successful transaction
   • Priority support
   • Advanced analytics

🏢 Enterprise Plan:
   • Volume discounts
   • Custom spending limits
   • Dedicated infrastructure
   • 24/7 phone support
   • SLA guarantees

Ready to upgrade? Visit ${BASE_URL}/#pricing
`);
}

async function main() {
    try {
        await displayHeader();
        
        // Check server health
        const serverHealthy = await checkServerHealth();
        if (!serverHealthy) {
            process.exit(1);
        }
        
        console.log('\nPress Enter to start the demo...');
        await question('');
        
        // Step 1: Signup
        const signupResult = await signupDemo();
        if (!signupResult) {
            error('Demo failed at signup step');
            process.exit(1);
        }
        
        // Step 2: API Usage
        const apiUsageSuccess = await demonstrateApiUsage(signupResult.apiKey);
        if (!apiUsageSuccess) {
            warning('API usage demonstration had issues, but continuing...');
        }
        
        // Step 3: Payment Processing
        const paymentSuccess = await processPaymentDemo(signupResult.apiKey);
        if (!paymentSuccess) {
            error('Payment demo failed');
            process.exit(1);
        }
        
        // Show integration examples
        await showCodeExamples(signupResult.apiKey);
        
        // Show upgrade path
        await showUpgradePath();
        
        console.log('\n┌─ DEMO COMPLETE ──────────────────────────────────────────┐');
        success('You\'ve successfully completed the Aslan SaaS demo!');
        console.log(`
🎉 What you accomplished:
   ✅ Created a production-ready account in seconds
   ✅ Received instant API keys (no approval process)
   ✅ Processed real payment authorizations
   ✅ Viewed real-time analytics and transaction history
   ✅ Got ready-to-use code examples

🦁 Welcome to the future of AI payments!

Your account is ready at: ${BASE_URL}/dashboard.html
Questions? Reply to your welcome email or visit our docs.
`);
        
    } catch (error) {
        console.error('\n❌ Demo failed with error:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the demo
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = {
    main,
    checkServerHealth,
    signupDemo,
    demonstrateApiUsage,
    processPaymentDemo
}; 