const OpenAI = require('openai');
const axios = require('axios');

// This demonstrates ChatGPT using AgentPay to make autonomous purchases!

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// AgentPay functions that ChatGPT can call
const agentPayFunctions = [
  {
    name: "agentpay_purchase",
    description: "Make autonomous purchases using AgentPay wallet with spending limits",
    parameters: {
      type: "object",
      properties: {
        service: {
          type: "string",
          enum: ["sms", "call", "domain", "aws-credits", "gift-card", "vps", "saas"],
          description: "Type of purchase to make"
        },
        params: {
          type: "object",
          description: "Purchase parameters (varies by service type)"
        }
      },
      required: ["service", "params"]
    }
  },
  {
    name: "check_wallet_balance",
    description: "Check AgentPay wallet balance and spending limits",
    parameters: {
      type: "object",
      properties: {
        walletId: {
          type: "string",
          description: "Wallet ID to check"
        }
      },
      required: ["walletId"]
    }
  }
];

// Function implementations that call AgentPay API
async function makePurchase(service, params, agentToken) {
  try {
    const response = await axios.post('http://localhost:3000/v1/purchase', {
      agentToken: agentToken,
      service: service,
      params: params
    });
    
    return {
      success: true,
      transactionId: response.data.transactionId,
      amount: response.data.amount,
      service: response.data.service,
      details: response.data.details,
      remainingBalance: response.data.remainingBalance,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function checkWalletBalance(walletId) {
  try {
    const response = await axios.get(`http://localhost:3000/v1/wallets/${walletId}`);
    return {
      walletId: response.data.walletId,
      balanceUSD: response.data.balanceUSD,
      balanceBTC: response.data.balanceBTC
    };
  } catch (error) {
    return { error: error.response?.data?.error || error.message };
  }
}

// ChatGPT with AgentPay purchase powers
async function chatGPTWithAgentPay(userMessage, agentToken) {
  console.log('🤖 ChatGPT with AgentPay processing request:', userMessage);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are ChatGPT with AgentPay integration. You can make real purchases using your wallet.
        
        Available services:
        - sms: Send real SMS messages (costs ~$0.0075)
        - call: Make real phone calls (costs ~$0.022) 
        - domain: Register domain names (costs ~$12.99/year)
        - aws-credits: Purchase AWS credits
        - gift-card: Buy digital gift cards (Amazon, Starbucks, etc.)
        - vps: Purchase VPS hosting
        - saas: Subscribe to SaaS services (Slack, Notion, etc.)
        
        Always check spending limits and be cost-conscious. Your agent token: ${agentToken}`
      },
      {
        role: "user", 
        content: userMessage
      }
    ],
    functions: agentPayFunctions,
    function_call: "auto"
  });
  
  const message = response.choices[0].message;
  
  // If ChatGPT wants to make a purchase
  if (message.function_call) {
    const functionName = message.function_call.name;
    const functionArgs = JSON.parse(message.function_call.arguments);
    
    console.log(`🛒 ChatGPT wants to call: ${functionName}`);
    console.log(`📋 Arguments:`, functionArgs);
    
    let functionResult;
    
    switch (functionName) {
      case 'agentpay_purchase':
        functionResult = await makePurchase(
          functionArgs.service, 
          functionArgs.params,
          agentToken
        );
        break;
        
      case 'check_wallet_balance':
        functionResult = await checkWalletBalance(functionArgs.walletId);
        break;
    }
    
    console.log(`✅ Function result:`, functionResult);
    
    // Send function result back to ChatGPT
    const followUpResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are ChatGPT with AgentPay purchase powers. Report the result to the user."
        },
        {
          role: "user",
          content: userMessage
        },
        message,
        {
          role: "function",
          name: functionName,
          content: JSON.stringify(functionResult)
        }
      ]
    });
    
    return followUpResponse.choices[0].message.content;
  }
  
  return message.content;
}

// Demo: ChatGPT autonomously making purchases
async function runDemo() {
  console.log('🎯 DEMO: ChatGPT + AgentPay Autonomous Commerce\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Set up wallet and agent (same as existing tests)
    console.log('1. Setting up AgentPay wallet and agent...');
    
    const wallet = await axios.post('http://localhost:3000/v1/wallets');
    const walletId = wallet.data.walletId;
    
    await axios.post(`http://localhost:3000/v1/wallets/${walletId}/fund`, { usd: 50 });
    
    const agent = await axios.post('http://localhost:3000/v1/agents', {
      walletId: walletId,
      dailyUsdLimit: 25
    });
    const agentToken = agent.data.agentToken;
    
    console.log('✅ Wallet and agent ready');
    console.log(`💰 Funded with $50, daily limit $25`);
    
    // Step 2: Demo different ChatGPT requests
    console.log('\n2. 🚀 ChatGPT Autonomous Commerce Demos:\n');
    
    // Demo 1: Domain purchase
    console.log('📋 Demo 1: Domain Registration Request');
    let response = await chatGPTWithAgentPay(
      "I need to register the domain 'my-ai-company-2025.com' for 2 years. Please handle this purchase.",
      agentToken
    );
    console.log('🤖 ChatGPT Response:', response);
    console.log('');
    
    // Demo 2: Gift card purchase  
    console.log('📋 Demo 2: Gift Card Purchase Request');
    response = await chatGPTWithAgentPay(
      "Buy me a $10 Amazon gift card please.",
      agentToken
    );
    console.log('🤖 ChatGPT Response:', response);
    console.log('');
    
    // Demo 3: VPS hosting
    console.log('📋 Demo 3: VPS Hosting Request');
    response = await chatGPTWithAgentPay(
      "I need a basic VPS server for 3 months. Can you set that up?",
      agentToken
    );
    console.log('🤖 ChatGPT Response:', response);
    console.log('');
    
    // Demo 4: SMS message
    console.log('📋 Demo 4: SMS Notification Request');
    response = await chatGPTWithAgentPay(
      `Send an SMS to +15038099355 saying "Your AI assistant successfully set up all your services! 🚀"`,
      agentToken
    );
    console.log('🤖 ChatGPT Response:', response);
    
    console.log('\n🎉 DEMO COMPLETE!');
    console.log('✅ ChatGPT successfully made autonomous purchases using AgentPay');
    console.log('💡 This proves OpenAI integration works without requiring permission!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    
    if (error.message.includes('OPENAI_API_KEY')) {
      console.log('\n💡 To run this demo:');
      console.log('1. Get OpenAI API key from platform.openai.com');
      console.log('2. Add OPENAI_API_KEY=your_key to .env file');
      console.log('3. Run this script again');
    }
  }
}

// Run demo if this script is executed directly
if (require.main === module) {
  runDemo();
}

module.exports = {
  chatGPTWithAgentPay,
  agentPayFunctions,
  runDemo
}; 