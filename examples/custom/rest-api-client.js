#!/usr/bin/env node

/**
 * 🔧 Custom Framework + Aslan REST API Integration Example
 * 
 * This example shows how to integrate Aslan payment infrastructure 
 * with any custom framework using direct REST API calls.
 */

require('dotenv').config();

// Simple HTTP client (can be replaced with axios, fetch, etc.)
class SimpleHTTPClient {
    constructor(baseURL, apiKey) {
        this.baseURL = baseURL;
        this.apiKey = apiKey;
    }
    
    async request(method, endpoint, data = null) {
        const url = `${this.baseURL}${endpoint}`;
        
        const options = {
            method: method,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Custom-Framework/1.0'
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        // Use node-fetch or built-in fetch in newer Node.js versions
        const fetch = require('node-fetch').default || global.fetch;
        
        try {
            const response = await fetch(url, options);
            const responseData = await response.json();
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseData.error?.message || 'Unknown error'}`);
            }
            
            return responseData;
            
        } catch (error) {
            // Handle network errors
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw new Error('Unable to connect to Aslan API. Check your internet connection.');
            }
            throw error;
        }
    }
    
    async get(endpoint) {
        return this.request('GET', endpoint);
    }
    
    async post(endpoint, data) {
        return this.request('POST', endpoint, data);
    }
}

// Aslan API Client for Custom Frameworks
class AslanAPIClient {
    constructor(apiKey, baseURL = 'https://aslanpay.xyz/api') {
        this.http = new SimpleHTTPClient(baseURL, apiKey);
        this.apiKey = apiKey;
    }
    
    async authorize(amount, description, options = {}) {
        console.log(`💳 Authorizing payment: $${(amount/100).toFixed(2)} for "${description}"`);
        
        const payload = {
            amount: amount,
            description: description,
            agentId: options.agentId || 'custom-framework-agent',
            metadata: options.metadata || {}
        };
        
        try {
            const response = await this.http.post('/v1/authorize', payload);
            console.log(`✅ Authorization successful: ${response.id || response.data?.id}`);
            return response;
            
        } catch (error) {
            console.error(`❌ Authorization failed: ${error.message}`);
            throw error;
        }
    }
    
    async confirm(authorizationId) {
        console.log(`🔒 Confirming payment: ${authorizationId}`);
        
        try {
            const response = await this.http.post('/v1/confirm', {
                authorizationId: authorizationId
            });
            console.log(`✅ Payment confirmed: ${response.id || response.data?.id}`);
            return response;
            
        } catch (error) {
            console.error(`❌ Confirmation failed: ${error.message}`);
            throw error;
        }
    }
    
    async checkStatus() {
        console.log(`📊 Checking Aslan system status...`);
        
        try {
            const response = await this.http.get('/status');
            console.log(`✅ System status: ${response.status}`);
            return response;
            
        } catch (error) {
            console.error(`❌ Status check failed: ${error.message}`);
            throw error;
        }
    }
    
    async getTransactions(limit = 10) {
        console.log(`📋 Fetching transaction history (limit: ${limit})...`);
        
        try {
            const response = await this.http.get(`/v1/transactions?limit=${limit}`);
            console.log(`✅ Retrieved ${response.data?.length || 0} transactions`);
            return response;
            
        } catch (error) {
            console.error(`❌ Transaction fetch failed: ${error.message}`);
            throw error;
        }
    }
}

// Example Custom Framework Integration
class CustomAIFramework {
    constructor(name) {
        this.name = name;
        this.tools = new Map();
        this.agents = new Map();
    }
    
    addTool(name, toolFunction) {
        this.tools.set(name, toolFunction);
        console.log(`🔧 Added tool: ${name}`);
    }
    
    createAgent(name, config = {}) {
        const agent = {
            name: name,
            id: `agent_${Date.now()}`,
            tools: Array.from(this.tools.keys()),
            config: config
        };
        
        this.agents.set(name, agent);
        console.log(`🤖 Created agent: ${name} with ${agent.tools.length} tools`);
        return agent;
    }
    
    async runAgent(agentName, task) {
        const agent = this.agents.get(agentName);
        if (!agent) {
            throw new Error(`Agent '${agentName}' not found`);
        }
        
        console.log(`🚀 Agent ${agentName} starting task: "${task}"`);
        
        // Simple task processing (in real framework, this would be more sophisticated)
        if (task.toLowerCase().includes('buy') || task.toLowerCase().includes('purchase')) {
            if (this.tools.has('purchase')) {
                // Extract amount and description (simplified)
                const amount = this.extractAmount(task) || 2500; // Default $25
                const description = this.extractDescription(task) || 'AI agent purchase';
                
                console.log(`🤔 Agent reasoning: User wants to purchase something, using purchase tool...`);
                
                try {
                    const purchaseTool = this.tools.get('purchase');
                    const result = await purchaseTool(amount, description, { agentId: agent.id });
                    
                    return {
                        agent: agentName,
                        task: task,
                        action: 'purchase_authorized',
                        result: result,
                        success: true
                    };
                    
                } catch (error) {
                    return {
                        agent: agentName,
                        task: task,
                        action: 'purchase_failed',
                        error: error.message,
                        success: false
                    };
                }
            }
        }
        
        if (task.toLowerCase().includes('status') || task.toLowerCase().includes('health')) {
            if (this.tools.has('check_status')) {
                console.log(`🤔 Agent reasoning: User wants system status, checking...`);
                
                const statusTool = this.tools.get('check_status');
                const result = await statusTool();
                
                return {
                    agent: agentName,
                    task: task,
                    action: 'status_check',
                    result: result,
                    success: true
                };
            }
        }
        
        return {
            agent: agentName,
            task: task,
            action: 'unknown',
            message: "I'm not sure how to handle that task",
            success: false
        };
    }
    
    extractAmount(text) {
        const match = text.match(/\$(\d+(?:\.\d{2})?)/);
        return match ? Math.round(parseFloat(match[1]) * 100) : null;
    }
    
    extractDescription(text) {
        if (text.includes('AWS')) return 'AWS credits';
        if (text.includes('GitHub')) return 'GitHub subscription';
        if (text.includes('API')) return 'API credits';
        return 'Custom purchase';
    }
}

// Demo function
async function runCustomFrameworkDemo() {
    console.log('🚀 Starting Custom Framework + Aslan Integration Demo\n');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Initialize Aslan API client
    const aslanClient = new AslanAPIClient(
        process.env.ASLAN_API_KEY || 'ak_test_demo_key',
        process.env.ASLAN_BASE_URL || 'https://aslanpay.xyz/api'
    );
    
    // Create custom framework
    const framework = new CustomAIFramework('MyAIFramework');
    
    // Add Aslan tools to the framework
    framework.addTool('purchase', aslanClient.authorize.bind(aslanClient));
    framework.addTool('check_status', aslanClient.checkStatus.bind(aslanClient));
    framework.addTool('get_transactions', aslanClient.getTransactions.bind(aslanClient));
    
    console.log('');
    
    // Create AI agents
    const purchaseAgent = framework.createAgent('PurchaseAgent', {
        specialization: 'purchasing',
        budget_limit: 10000 // $100
    });
    
    const statusAgent = framework.createAgent('StatusAgent', {
        specialization: 'monitoring',
        check_interval: 60000 // 1 minute
    });
    
    console.log('');
    
    // Demo scenarios
    const scenarios = [
        {
            agent: 'PurchaseAgent',
            task: 'Buy $35 worth of AWS credits for machine learning'
        },
        {
            agent: 'StatusAgent', 
            task: 'Check the system status and health'
        },
        {
            agent: 'PurchaseAgent',
            task: 'Purchase GitHub Pro subscription'
        }
    ];
    
    // Run scenarios
    for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        
        console.log(`📋 Scenario ${i + 1}:`);
        console.log(`Agent: ${scenario.agent}`);
        console.log(`Task: "${scenario.task}"`);
        console.log('─'.repeat(50));
        
        try {
            const result = await framework.runAgent(scenario.agent, scenario.task);
            
            console.log(`\n📊 Result:`);
            console.log(`   • Action: ${result.action}`);
            console.log(`   • Success: ${result.success ? '✅' : '❌'}`);
            
            if (result.success && result.result) {
                if (result.result.id) {
                    console.log(`   • ID: ${result.result.id}`);
                }
                if (result.result.amount) {
                    console.log(`   • Amount: $${result.result.amount / 100}`);
                }
                if (result.result.status) {
                    console.log(`   • Status: ${result.result.status}`);
                }
            }
            
            if (!result.success && result.error) {
                console.log(`   • Error: ${result.error}`);
            }
            
        } catch (error) {
            console.error(`❌ Scenario ${i + 1} failed:`, error.message);
        }
        
        console.log('\n' + '═'.repeat(50) + '\n');
    }
}

// Error handling demo
async function runErrorHandlingDemo() {
    console.log('🛡️ Error Handling Demo\n');
    
    const aslanClient = new AslanAPIClient('invalid_api_key');
    
    console.log('Testing with invalid API key...');
    
    try {
        await aslanClient.authorize(1000, 'Test purchase');
    } catch (error) {
        console.log(`✅ Properly caught error: ${error.message}`);
    }
    
    console.log('Testing with invalid amount...');
    
    const validClient = new AslanAPIClient(process.env.ASLAN_API_KEY || 'ak_test_demo_key');
    
    try {
        await validClient.authorize(-100, 'Invalid purchase');
    } catch (error) {
        console.log(`✅ Properly caught error: ${error.message}`);
    }
}

// Run demos
if (require.main === module) {
    Promise.resolve()
        .then(() => runCustomFrameworkDemo())
        .then(() => runErrorHandlingDemo())
        .then(() => {
            console.log('\n✨ Custom framework integration demo completed!');
            console.log('\n📚 Next steps:');
            console.log('   • Replace demo API key with your real Aslan API key');
            console.log('   • Customize the framework for your specific use case');
            console.log('   • Add more sophisticated agent reasoning');
            console.log('   • Implement webhook handling for real-time updates');
            console.log('   • Check out language-specific examples (Python, etc.)');
        })
        .catch(error => {
            console.error('💥 Demo crashed:', error);
            process.exit(1);
        });
} 