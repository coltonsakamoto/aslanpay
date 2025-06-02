#!/usr/bin/env node

/**
 * 🦜 LangChain + Aslan Integration Example
 * 
 * This example shows how to create a LangChain agent that can make autonomous
 * purchases using Aslan payment infrastructure as custom tools.
 */

require('dotenv').config();

// Mock LangChain implementation (replace with actual LangChain)
class MockLangChainAgent {
    constructor(tools) {
        this.tools = tools;
        this.name = "Purchase Assistant Agent";
    }
    
    async run(input) {
        console.log(`🦜 LangChain Agent thinking about: "${input}"`);
        
        // Simulate agent reasoning
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Simple decision logic (in real LangChain, this would be LLM-powered)
        if (input.toLowerCase().includes('aws') || input.toLowerCase().includes('credits')) {
            console.log('🤔 Agent reasoning: User wants AWS credits, I should check spending limits first...');
            
            // Check limits first
            const limits = await this.tools.check_spending_limits.func({});
            console.log('💰 Current limits:', limits);
            
            if (input.includes('$')) {
                // Extract amount (simplified)
                const amount = parseInt(input.match(/\$(\d+)/)?.[1] || '25') * 100;
                
                console.log(`🤔 Agent reasoning: Extracted amount $${amount/100}, proceeding with authorization...`);
                
                // Authorize payment
                const auth = await this.tools.authorize_payment.func({
                    amount: amount,
                    description: 'AWS credits',
                    merchant: 'Amazon Web Services'
                });
                
                return `I've successfully authorized a payment of $${amount/100} for AWS credits. Authorization ID: ${auth.id}. The payment is ready to execute when you're ready!`;
            }
        }
        
        if (input.toLowerCase().includes('subscription') || input.toLowerCase().includes('github')) {
            console.log('🤔 Agent reasoning: User wants a subscription, checking GitHub Pro pricing...');
            
            const auth = await this.tools.authorize_payment.func({
                amount: 400, // $4 for GitHub Pro
                description: 'GitHub Pro subscription',
                merchant: 'GitHub'
            });
            
            return `I've authorized a $4 payment for GitHub Pro subscription. Authorization ID: ${auth.id}`;
        }
        
        return "I'm not sure how to help with that purchase. Can you be more specific about what you'd like to buy?";
    }
}

// Aslan payment tools for LangChain
const aslanPaymentTools = {
    authorize_payment: {
        name: "authorize_payment",
        description: "Authorize a payment for making a purchase",
        func: async (args) => {
            const { amount, description, merchant = 'Unknown' } = args;
            
            console.log(`💳 ASLAN TOOL: Authorizing $${(amount/100).toFixed(2)} for "${description}"`);
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Mock authorization response
            return {
                id: `auth_${Date.now()}`,
                amount: amount,
                description: description,
                merchant: merchant,
                status: 'authorized',
                created_at: new Date().toISOString()
            };
        }
    },
    
    check_spending_limits: {
        name: "check_spending_limits", 
        description: "Check current spending limits and available balance",
        func: async (args) => {
            console.log(`📊 ASLAN TOOL: Checking spending limits`);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 200));
            
            return {
                daily_limit: 50000,    // $500
                daily_spent: 8500,     // $85
                remaining: 41500,      // $415
                transaction_limit: 10000, // $100 per transaction
                currency: 'USD'
            };
        }
    },
    
    confirm_payment: {
        name: "confirm_payment",
        description: "Execute a previously authorized payment",
        func: async (args) => {
            const { authorizationId } = args;
            
            console.log(`✅ ASLAN TOOL: Confirming payment ${authorizationId}`);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 400));
            
            return {
                id: `pay_${Date.now()}`,
                authorizationId: authorizationId,
                status: 'completed',
                receipt_url: `https://aslanpay.xyz/receipts/pay_${Date.now()}`,
                completed_at: new Date().toISOString()
            };
        }
    },
    
    get_transaction_history: {
        name: "get_transaction_history",
        description: "Get recent transaction history",
        func: async (args) => {
            console.log(`📋 ASLAN TOOL: Fetching transaction history`);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 250));
            
            return {
                transactions: [
                    {
                        id: 'pay_123456',
                        amount: 2500,
                        description: 'AWS credits',
                        status: 'completed',
                        date: '2024-01-15T10:00:00Z'
                    },
                    {
                        id: 'pay_123457', 
                        amount: 400,
                        description: 'GitHub Pro subscription',
                        status: 'completed',
                        date: '2024-01-14T15:30:00Z'
                    }
                ],
                total_count: 2,
                total_amount: 2900
            };
        }
    }
};

// Demo scenarios
async function runLangChainDemo() {
    console.log('🚀 Starting LangChain + Aslan Integration Demo\n');
    
    // Create LangChain agent with Aslan tools
    const agent = new MockLangChainAgent(aslanPaymentTools);
    
    console.log(`🤖 Agent: ${agent.name} is ready!\n`);
    
    // Demo scenarios
    const scenarios = [
        "I need to buy $50 worth of AWS credits for my machine learning project",
        "Can you help me get a GitHub Pro subscription?",
        "Show me my recent transaction history"
    ];
    
    for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        
        console.log(`\n📋 Scenario ${i + 1}:`);
        console.log(`👤 User: "${scenario}"`);
        console.log('');
        
        try {
            const response = await agent.run(scenario);
            console.log(`🦜 Agent: ${response}`);
            
        } catch (error) {
            console.error(`❌ Scenario ${i + 1} failed:`, error.message);
        }
        
        console.log('\n' + '─'.repeat(60));
    }
}

// Advanced workflow demo
async function runAdvancedWorkflow() {
    console.log('\n🎯 Advanced Workflow Demo: Multi-step Purchase');
    console.log('═'.repeat(60));
    
    const agent = new MockLangChainAgent(aslanPaymentTools);
    
    try {
        // Step 1: Check spending limits
        console.log('\n📊 Step 1: Checking spending limits...');
        const limits = await aslanPaymentTools.check_spending_limits.func({});
        console.log(`✅ Available balance: $${limits.remaining/100}`);
        
        // Step 2: Authorize payment
        console.log('\n💳 Step 2: Authorizing payment...');
        const auth = await aslanPaymentTools.authorize_payment.func({
            amount: 3000, // $30
            description: 'OpenAI API credits',
            merchant: 'OpenAI'
        });
        console.log(`✅ Authorization: ${auth.id}`);
        
        // Step 3: Confirm payment
        console.log('\n🔒 Step 3: Confirming payment...');
        const payment = await aslanPaymentTools.confirm_payment.func({
            authorizationId: auth.id
        });
        console.log(`✅ Payment completed: ${payment.id}`);
        console.log(`📧 Receipt: ${payment.receipt_url}`);
        
        // Step 4: Update transaction history
        console.log('\n📋 Step 4: Updated transaction history...');
        const history = await aslanPaymentTools.get_transaction_history.func({});
        console.log(`📊 Total transactions: ${history.total_count}`);
        console.log(`💰 Total spent: $${history.total_amount/100}`);
        
        console.log('\n🎉 Multi-step workflow completed successfully!');
        
    } catch (error) {
        console.error('❌ Advanced workflow failed:', error.message);
    }
}

// Run demos
if (require.main === module) {
    Promise.resolve()
        .then(() => runLangChainDemo())
        .then(() => runAdvancedWorkflow())
        .then(() => {
            console.log('\n✨ LangChain integration demo completed!');
            console.log('\n📚 Next steps:');
            console.log('   • Replace mock implementations with real LangChain');
            console.log('   • Add LLM backing for smarter decision making');
            console.log('   • Integrate with real Aslan SDK');
            console.log('   • Check out the Python version: langchain_agent.py');
        })
        .catch(error => {
            console.error('💥 Demo crashed:', error);
            process.exit(1);
        });
} 