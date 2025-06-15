#!/usr/bin/env node

/**
 * 🚀 AgentPay + OpenAI Demo
 * 2-minute integration example
 * 
 * This shows ChatGPT making real purchases autonomously!
 */

const OpenAI = require('openai');
const axios = require('axios');

// Initialize OpenAI (set OPENAI_API_KEY environment variable)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// AgentPay configuration
const AGENTPAY_CONFIG = {
  apiUrl: process.env.AGENTPAY_API_URL || 'https://api.agentpay.com',
  agentToken: process.env.AGENTPAY_TOKEN // Get this from agentpay.com/dashboard
};

// AgentPay function schema for OpenAI
const AGENTPAY_FUNCTIONS = [
  {
    name: "agentpay_purchase",
    description: "Make autonomous purchases using AgentPay with spending limits",
    parameters: {
      type: "object",
      properties: {
        service: {
          type: "string", 
          enum: ["gift-card", "domain", "sms", "aws-credits"],
          description: "Type of purchase to make"
        },
        params: {
          type: "object",
          description: "Purchase parameters",
          properties: {
            brand: { type: "string", description: "Gift card brand (amazon, starbucks, etc.)" },
            amount: { type: "number", description: "Amount in USD" },
            domain: { type: "string", description: "Domain name to register" },
            to: { type: "string", description: "Phone number for SMS" },
            message: { type: "string", description: "SMS message content" }
          }
        }
      },
      required: ["service", "params"]
    }
  }
];

// Execute AgentPay purchase
async function executeAgentPayPurchase(service, params) {
  try {
    console.log(`💳 AgentPay: Processing ${service} purchase...`);
    
    const response = await axios.post(`${AGENTPAY_CONFIG.apiUrl}/v1/purchase-direct`, {
      agentToken: AGENTPAY_CONFIG.agentToken,
      service: service,
      params: params
    });
    
    return {
      success: true,
      transactionId: response.data.transactionId,
      amount: response.data.amount,
      service: response.data.service,
      details: response.data.details,
      message: response.data.message
    };
    
  } catch (error) {
    console.error('❌ AgentPay purchase failed:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

// Main demo function
async function runDemo() {
  console.log('🚀 AgentPay + OpenAI Demo Starting...\n');
  
  // Check configuration
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Please set OPENAI_API_KEY environment variable');
    console.log('Get your key from: https://platform.openai.com/api-keys');
    process.exit(1);
  }
  
  if (!AGENTPAY_CONFIG.agentToken) {
    console.error('❌ Please set AGENTPAY_TOKEN environment variable');
    console.log('Get your token from: https://agentpay.com/dashboard');
    process.exit(1);
  }
  
  // Demo conversation
  const userMessage = "Buy me a $10 Amazon gift card";
  console.log(`🗣️ User: "${userMessage}"\n`);
  
  try {
    // Send request to OpenAI with AgentPay functions
    console.log('🤖 OpenAI: Processing request...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant with AgentPay integration. You can make real purchases for users.
          
          When users ask you to buy something, use the agentpay_purchase function.
          Always confirm the purchase details with the user.`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      functions: AGENTPAY_FUNCTIONS,
      function_call: "auto"
    });
    
    const message = response.choices[0].message;
    
    if (message.function_call && message.function_call.name === 'agentpay_purchase') {
      // OpenAI wants to make a purchase!
      const functionArgs = JSON.parse(message.function_call.arguments);
      console.log(`🎯 OpenAI decided to purchase: ${functionArgs.service}`);
      console.log(`📋 Parameters:`, functionArgs.params);
      
      // Execute the purchase via AgentPay
      const purchaseResult = await executeAgentPayPurchase(
        functionArgs.service,
        functionArgs.params
      );
      
      // Send result back to OpenAI for final response
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant. Summarize the purchase result for the user."
          },
          {
            role: "user",
            content: userMessage
          },
          {
            role: "assistant",
            content: message.content,
            function_call: message.function_call
          },
          {
            role: "function",
            name: "agentpay_purchase",
            content: JSON.stringify(purchaseResult)
          }
        ]
      });
      
      console.log('\n🤖 OpenAI:', finalResponse.choices[0].message.content);
      
      if (purchaseResult.success) {
        console.log('\n✅ DEMO SUCCESS!');
        console.log(`💳 Transaction ID: ${purchaseResult.transactionId}`);
        console.log(`💰 Amount: $${purchaseResult.amount}`);
        console.log(`📧 Gift card details sent to your email`);
      } else {
        console.log('\n❌ Purchase failed:', purchaseResult.error);
      }
      
    } else {
      // Regular conversation
      console.log('\n🤖 OpenAI:', message.content);
    }
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    
    if (error.code === 'invalid_api_key') {
      console.log('Please check your OPENAI_API_KEY');
    }
  }
}

// Example usage info
function showUsageExample() {
  console.log('\n📚 INTEGRATION GUIDE:\n');
  
  console.log('1. Install AgentPay:');
  console.log('   npm install agentpay\n');
  
  console.log('2. Set environment variables:');
  console.log('   export OPENAI_API_KEY=your_openai_key');
  console.log('   export AGENTPAY_TOKEN=your_agentpay_token\n');
  
  console.log('3. Use in your code:');
  console.log(`   const agentpay = require('agentpay');
   const functions = agentpay.getFunctionSchema();
   
   // Add to your OpenAI completion call:
   const response = await openai.chat.completions.create({
     model: "gpt-4",
     messages: messages,
     functions: functions,
     function_call: "auto"
   });\n`);
  
  console.log('🎯 More examples: https://docs.agentpay.com');
}

// Run demo
if (require.main === module) {
  runDemo()
    .then(() => showUsageExample())
    .catch(console.error);
}

module.exports = { runDemo, executeAgentPayPurchase }; 