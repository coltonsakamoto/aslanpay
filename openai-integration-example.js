const OpenAI = require('openai');
const axios = require('axios');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// AgentPay functions that OpenAI can call
const agentPayFunctions = [
  {
    name: "make_purchase",
    description: "Make a purchase using AgentPay wallet with spending limits",
    parameters: {
      type: "object",
      properties: {
        service: {
          type: "string",
          enum: ["sms", "domain", "flight", "hotel", "ecommerce", "gift-card"],
          description: "Type of purchase to make"
        },
        params: {
          type: "object",
          description: "Purchase parameters (varies by service type)"
        },
        maxAmount: {
          type: "number",
          description: "Maximum amount willing to spend in USD"
        }
      },
      required: ["service", "params", "maxAmount"]
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
  },
  {
    name: "browse_and_buy",
    description: "Use browser automation to purchase from any website",
    parameters: {
      type: "object", 
      properties: {
        website: {
          type: "string",
          description: "Website domain (e.g., 'amazon.com', 'united.com')"
        },
        searchQuery: {
          type: "string",
          description: "What to search for or purchase"
        },
        maxPrice: {
          type: "number",
          description: "Maximum price willing to pay"
        }
      },
      required: ["website", "searchQuery", "maxPrice"]
    }
  }
];

// Function implementations that call AgentPay API
async function makePurchase(service, params, maxAmount, agentToken) {
  try {
    const response = await axios.post('https://api.agentpay.com/v1/purchase', {
      agentToken: agentToken,
      service: service,
      params: params
    });
    
    return {
      success: true,
      transactionId: response.data.transactionId,
      amount: response.data.amount,
      details: response.data.details,
      remainingBalance: response.data.remainingBalance
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
    const response = await axios.get(`https://api.agentpay.com/v1/wallets/${walletId}`);
    return {
      walletId: response.data.walletId,
      balanceUSD: response.data.balanceUSD,
      balanceBTC: response.data.balanceBTC
    };
  } catch (error) {
    return { error: error.response?.data?.error || error.message };
  }
}

async function browseAndBuy(website, searchQuery, maxPrice, agentToken) {
  try {
    const response = await axios.post('https://api.agentpay.com/v1/browse-purchase', {
      agentToken: agentToken,
      website: website,
      searchQuery: searchQuery,
      maxPrice: maxPrice
    });
    
    return {
      success: true,
      transactionId: response.data.transactionId,
      amount: response.data.amount,
      details: response.data.details,
      screenshots: response.data.screenshots
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

// Example: ChatGPT with AgentPay integration
async function chatWithPurchasePowers(userMessage, agentToken) {
  console.log('🤖 ChatGPT with AgentPay purchase powers activated!\n');
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are an AI assistant with the ability to make real purchases using AgentPay. 
        You can buy domains, send SMS, book flights, shop on websites, and more.
        Always check spending limits and confirm purchases with the user.
        Your AgentPay token: ${agentToken}`
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
      case 'make_purchase':
        functionResult = await makePurchase(
          functionArgs.service, 
          functionArgs.params, 
          functionArgs.maxAmount,
          agentToken
        );
        break;
        
      case 'check_wallet_balance':
        functionResult = await checkWalletBalance(functionArgs.walletId);
        break;
        
      case 'browse_and_buy':
        functionResult = await browseAndBuy(
          functionArgs.website,
          functionArgs.searchQuery, 
          functionArgs.maxPrice,
          agentToken
        );
        break;
    }
    
    console.log(`✅ Purchase result:`, functionResult);
    
    // Send function result back to ChatGPT
    const followUpResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant with AgentPay purchase powers."
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

// Example usage
async function demo() {
  const agentToken = "your_agentpay_token_here";
  
  console.log('🎯 Demo: ChatGPT with AgentPay Integration\n');
  
  // Example 1: Domain purchase
  let response = await chatWithPurchasePowers(
    "I need to register the domain 'my-ai-startup-2025.com' for 2 years", 
    agentToken
  );
  console.log('🤖 ChatGPT:', response);
  
  // Example 2: Flight booking
  response = await chatWithPurchasePowers(
    "Book me a flight from Portland to New York for June 15th, budget under $400",
    agentToken
  );
  console.log('🤖 ChatGPT:', response);
  
  // Example 3: Shopping
  response = await chatWithPurchasePowers(
    "Buy a laptop under $800 from Best Buy",
    agentToken
  );
  console.log('🤖 ChatGPT:', response);
}

// Uncomment to run demo
// demo(); 