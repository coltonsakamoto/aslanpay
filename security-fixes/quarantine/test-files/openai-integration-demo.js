// 🤖 OpenAI + AgentPay Integration Demo
// This shows how ANY AI agent can use AgentPay for commerce

const OpenAI = require('openai');
const axios = require('axios');

// Initialize OpenAI (you'll need your API key)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
});

// AgentPay function definition for OpenAI
const AGENTPAY_FUNCTIONS = [
  {
    name: "agentpay_purchase",
    description: "Make autonomous purchases on any website using browser automation. Can buy products, book flights, reserve hotels, etc.",
    parameters: {
      type: "object",
      properties: {
        service: {
          type: "string",
          enum: ["shopping", "flight", "hotel", "restaurant", "tickets", "domain", "saas"],
          description: "Type of purchase service"
        },
        params: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query (for shopping/general searches)" },
            maxPrice: { type: "number", description: "Maximum price willing to pay" },
            minRating: { type: "number", description: "Minimum rating requirement (1-5 stars)" },
            from: { type: "string", description: "Departure location (for flights)" },
            to: { type: "string", description: "Destination (for flights/hotels)" },
            departDate: { type: "string", description: "Departure date YYYY-MM-DD (for flights)" },
            passengers: { type: "integer", description: "Number of passengers (for flights)" },
            location: { type: "string", description: "Location for hotel/restaurant" },
            checkIn: { type: "string", description: "Check-in date YYYY-MM-DD (for hotels)" },
            checkOut: { type: "string", description: "Check-out date YYYY-MM-DD (for hotels)" },
            rooms: { type: "integer", description: "Number of rooms (for hotels)" },
            guests: { type: "integer", description: "Number of guests (for hotels)" }
          },
          required: ["maxPrice"]
        }
      },
      required: ["service", "params"]
    }
  }
];

// Mock AgentPay credentials (replace with real ones)
const AGENTPAY_CONFIG = {
  apiUrl: 'http://localhost:3000',
  agentToken: null // Will be set when we create an agent
};

// Function to execute AgentPay purchases
async function executeAgentPayPurchase(service, params) {
  try {
    console.log(`🤖 OpenAI requesting AgentPay to handle: ${service}`);
    console.log('📋 Parameters:', params);
    
    const response = await axios.post(`${AGENTPAY_CONFIG.apiUrl}/v1/purchase`, {
      agentToken: AGENTPAY_CONFIG.agentToken,
      service: service,
      params: params
    });
    
    const result = response.data;
    console.log('✅ AgentPay completed purchase:', result);
    
    return {
      success: result.success,
      message: `Successfully ${service === 'shopping' ? 'purchased' : 'booked'} ${result.details.product || result.details.hotel || 'item'} for $${result.amount} (including $${result.platformFee} platform fee)`,
      details: result.details,
      transactionId: result.transactionId,
      totalCost: result.amount
    };
    
  } catch (error) {
    console.error('❌ AgentPay purchase failed:', error.response?.data || error.message);
    return {
      success: false,
      message: `Purchase failed: ${error.response?.data?.error || error.message}`,
      error: error.response?.data
    };
  }
}

// Main chat function with AgentPay integration
async function chatWithAgentPayIntegration(userMessage) {
  try {
    console.log('\n🗣️ User:', userMessage);
    console.log('🤖 OpenAI is thinking...\n');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant with access to AgentPay, a universal commerce platform that can make purchases on any website using browser automation.

When users ask you to buy, purchase, book, or order anything, use the agentpay_purchase function.

AgentPay can:
- Shop on Amazon, Best Buy, Target, etc. (use service: "shopping")
- Book flights on Google Flights, Kayak, etc. (use service: "flight") 
- Reserve hotels on Booking.com, Hotels.com, etc. (use service: "hotel")
- Make restaurant reservations (use service: "restaurant")
- Buy event tickets (use service: "tickets")
- Register domains (use service: "domain")
- Subscribe to SaaS services (use service: "saas")

Always ask for budget/price limits and provide helpful details about what you're purchasing.`
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
    
    if (message.function_call) {
      // OpenAI wants to use AgentPay!
      const functionName = message.function_call.name;
      const functionArgs = JSON.parse(message.function_call.arguments);
      
      console.log(`🎯 OpenAI decided to use AgentPay: ${functionName}`);
      console.log('📋 Arguments:', functionArgs);
      
      if (functionName === 'agentpay_purchase') {
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
              content: "You are an AI assistant. Summarize the purchase result for the user in a friendly way."
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
              name: functionName,
              content: JSON.stringify(purchaseResult)
            }
          ]
        });
        
        return {
          aiResponse: finalResponse.choices[0].message.content,
          purchaseResult: purchaseResult,
          functionUsed: functionName
        };
      }
    } else {
      // Regular conversation, no purchase needed
      return {
        aiResponse: message.content,
        purchaseResult: null,
        functionUsed: null
      };
    }
    
  } catch (error) {
    console.error('❌ OpenAI integration failed:', error);
    return {
      aiResponse: "Sorry, I encountered an error processing your request.",
      purchaseResult: null,
      error: error.message
    };
  }
}

// Demo conversation examples
async function runIntegrationDemo() {
  console.log('🚀 OpenAI + AgentPay Integration Demo\n');
  console.log('This shows how AI agents can use AgentPay for autonomous commerce!\n');
  
  // First, set up AgentPay credentials
  try {
    console.log('🔧 Setting up AgentPay credentials...');
    
    // Create wallet
    const walletResponse = await axios.post(`${AGENTPAY_CONFIG.apiUrl}/v1/wallets`);
    const walletId = walletResponse.data.walletId;
    
    // Fund wallet
    await axios.post(`${AGENTPAY_CONFIG.apiUrl}/v1/wallets/${walletId}/fund`, {
      usd: 1000
    });
    
    // Create agent
    const agentResponse = await axios.post(`${AGENTPAY_CONFIG.apiUrl}/v1/agents`, {
      walletId: walletId,
      dailyUsdLimit: 500
    });
    
    AGENTPAY_CONFIG.agentToken = agentResponse.data.agentToken;
    console.log('✅ AgentPay ready!\n');
    
  } catch (error) {
    console.error('❌ AgentPay setup failed:', error.response?.data || error.message);
    return;
  }
  
  // Demo conversations
  const demoMessages = [
    "Buy me wireless headphones under $100",
    "Find and order a USB-C cable under $25 with good reviews",
    "Book me a flight from SF to NYC next month under $400"
  ];
  
  for (const message of demoMessages) {
    console.log('='.repeat(60));
    
    const result = await chatWithAgentPayIntegration(message);
    
    console.log('🤖 OpenAI Response:', result.aiResponse);
    
    if (result.purchaseResult) {
      console.log('\n💰 Purchase Summary:');
      console.log('  ✅ Success:', result.purchaseResult.success);
      console.log('  💳 Total Cost:', `$${result.purchaseResult.totalCost}`);
      console.log('  🆔 Transaction:', result.purchaseResult.transactionId);
      console.log('  📝 Details:', result.purchaseResult.message);
    }
    
    console.log('\n⏸️ Waiting 3 seconds before next demo...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('🎊 Demo Complete!');
  console.log('\n🌟 KEY ACHIEVEMENTS:');
  console.log('✅ OpenAI can now make real purchases via AgentPay');
  console.log('✅ Universal commerce access (millions of websites)');
  console.log('✅ No custom integrations needed');
  console.log('✅ Revenue generated on every transaction');
  console.log('\n💡 This same pattern works for:');
  console.log('🤖 Anthropic Claude');
  console.log('💼 Microsoft Copilot');
  console.log('🏢 Enterprise AI assistants');
  console.log('🎮 Gaming AI NPCs');
  console.log('🏪 E-commerce AI assistants');
}

// Export for use in other projects
module.exports = {
  chatWithAgentPayIntegration,
  executeAgentPayPurchase,
  AGENTPAY_FUNCTIONS
};

// Run demo if called directly
if (require.main === module) {
  runIntegrationDemo().catch(console.error);
} 