#!/usr/bin/env node

/**
 * 🤖 OpenAI + Aslan Basic Integration Example
 * 
 * This example shows how to enable GPT models to make autonomous purchases
 * using Aslan's payment infrastructure via function calling.
 */

require('dotenv').config();
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Aslan payment functions for OpenAI
const ASLAN_FUNCTIONS = [{
    type: "function",
    function: {
        name: "authorize_payment",
        description: "Authorize a payment for the AI agent to make a purchase",
        parameters: {
            type: "object",
            properties: {
                amount: {
                    type: "number",
                    description: "Amount in cents (e.g., 2500 for $25.00)"
                },
                description: {
                    type: "string", 
                    description: "What the purchase is for"
                },
                merchant: {
                    type: "string",
                    description: "The merchant or service being purchased from"
                }
            },
            required: ["amount", "description"]
        }
    }
}, {
    type: "function",
    function: {
        name: "check_spending_limit",
        description: "Check current spending limits and available balance",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
}];

// Mock Aslan API calls (replace with actual Aslan SDK)
async function authorizePayment(amount, description, merchant = 'Unknown') {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log(`💳 ASLAN: Authorizing payment of $${(amount/100).toFixed(2)} for "${description}"`);
    
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

async function checkSpendingLimit() {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
        daily_limit: 50000, // $500
        daily_spent: 12500, // $125  
        remaining: 37500,   // $375
        transaction_limit: 10000 // $100 per transaction
    };
}

// Handle OpenAI function calls
async function handleFunctionCall(functionCall) {
    const { name, arguments: args } = functionCall;
    const parsedArgs = JSON.parse(args);
    
    console.log(`🔧 Executing function: ${name}`);
    console.log(`📊 Arguments:`, parsedArgs);
    
    switch (name) {
        case 'authorize_payment':
            const { amount, description, merchant } = parsedArgs;
            return await authorizePayment(amount, description, merchant);
            
        case 'check_spending_limit':
            return await checkSpendingLimit();
            
        default:
            throw new Error(`Unknown function: ${name}`);
    }
}

// Main demo function
async function runOpenAIDemo() {
    console.log('🚀 Starting OpenAI + Aslan Integration Demo\n');
    
    const userRequest = "I need to buy $30 worth of AWS credits for my machine learning project. Can you help me with that?";
    
    console.log(`👤 User Request: "${userRequest}"\n`);
    console.log('🤖 Sending to OpenAI...\n');
    
    try {
        // Initial OpenAI request with function calling enabled
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{
                role: "user",
                content: userRequest
            }],
            tools: ASLAN_FUNCTIONS,
            tool_choice: "auto"
        });
        
        const message = response.choices[0].message;
        console.log(`🤖 OpenAI Response: ${message.content || 'Function call requested'}\n`);
        
        // Check if OpenAI wants to call a function
        if (message.tool_calls) {
            console.log('🔧 OpenAI is requesting function calls:\n');
            
            // Process each function call
            const functionResults = [];
            for (const toolCall of message.tool_calls) {
                try {
                    const result = await handleFunctionCall(toolCall.function);
                    functionResults.push({
                        tool_call_id: toolCall.id,
                        result: JSON.stringify(result)
                    });
                    
                    console.log(`✅ Function completed successfully\n`);
                } catch (error) {
                    console.error(`❌ Function failed:`, error.message);
                    functionResults.push({
                        tool_call_id: toolCall.id,
                        result: JSON.stringify({ error: error.message })
                    });
                }
            }
            
            // Send function results back to OpenAI for final response
            console.log('📤 Sending function results back to OpenAI...\n');
            
            const finalResponse = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "user", content: userRequest },
                    message,
                    ...functionResults.map(result => ({
                        role: "tool",
                        content: result.result,
                        tool_call_id: result.tool_call_id
                    }))
                ]
            });
            
            console.log('🎯 Final OpenAI Response:');
            console.log(finalResponse.choices[0].message.content);
            
        } else {
            console.log('💬 OpenAI provided a direct response without function calls.');
        }
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

// Run the demo
if (require.main === module) {
    runOpenAIDemo().then(() => {
        console.log('\n✨ Demo completed!');
        console.log('\n📚 Next steps:');
        console.log('   • Check out advanced-example.js for more complex workflows');
        console.log('   • Visit https://aslanpay.xyz/docs for full documentation');
        console.log('   • Replace mock functions with real Aslan SDK calls');
    }).catch(error => {
        console.error('💥 Demo crashed:', error);
        process.exit(1);
    });
} 