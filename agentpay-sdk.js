// 🚀 AgentPay SDK for OpenAI Integration
// Enables ChatGPT to make autonomous purchases

const axios = require('axios');

class AgentPaySDK {
  constructor(apiUrl = 'http://localhost:3000') {
    this.apiUrl = apiUrl;
  }

  // OpenAI Function Calling schema for AgentPay
  getFunctionSchema() {
    return [
      {
        name: "agentpay_purchase",
        description: "Make autonomous purchases using AgentPay with spending limits and fraud protection",
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
              description: "Purchase parameters (varies by service type)",
              properties: {
                // SMS/Call params
                to: { type: "string", description: "Phone number for SMS/call" },
                message: { type: "string", description: "Message content" },
                
                // Domain params
                domain: { type: "string", description: "Domain name to register" },
                years: { type: "integer", description: "Registration years (default 1)" },
                
                // Gift card params
                brand: { type: "string", description: "Gift card brand (amazon, starbucks, target, etc.)" },
                amount: { type: "number", description: "Gift card amount in USD" },
                
                // VPS params
                plan: { type: "string", description: "VPS plan (basic, standard, premium, enterprise)" },
                months: { type: "integer", description: "Billing months (default 1)" },
                
                // SaaS params
                service: { type: "string", description: "SaaS service name" },
                plan: { type: "string", description: "Service plan" }
              }
            }
          },
          required: ["service", "params"]
        }
      },
      {
        name: "agentpay_balance",
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
  }

  // Execute AgentPay function calls
  async executeFunction(functionName, args, agentToken) {
    switch (functionName) {
      case 'agentpay_purchase':
        return await this.makePurchase(args.service, args.params, agentToken);
      case 'agentpay_balance':
        return await this.getBalance(args.walletId);
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  // Make a purchase
  async makePurchase(service, params, agentToken) {
    try {
      const response = await axios.post(`${this.apiUrl}/v1/purchase`, {
        agentToken,
        service,
        params
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
        error: error.response?.data?.error || error.message,
        code: error.response?.data?.code || 'UNKNOWN_ERROR'
      };
    }
  }

  // Check wallet balance
  async getBalance(walletId) {
    try {
      const response = await axios.get(`${this.apiUrl}/v1/wallets/${walletId}`);
      return {
        success: true,
        walletId: response.data.walletId,
        balanceUSD: response.data.balanceUSD,
        balanceBTC: response.data.balanceBTC,
        balanceFormatted: response.data.balanceUsdFormatted
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  // Get available services
  async getServices() {
    try {
      const response = await axios.get(`${this.apiUrl}/v1/services`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get services: ${error.message}`);
    }
  }

  // Create wallet and agent (for setup)
  async createWalletAndAgent(dailyLimit = 100) {
    try {
      // Create wallet
      const walletResponse = await axios.post(`${this.apiUrl}/v1/wallets`);
      const walletId = walletResponse.data.walletId;

      // Fund wallet
      await axios.post(`${this.apiUrl}/v1/wallets/${walletId}/fund`, { 
        usd: dailyLimit * 2 // Fund with 2x daily limit
      });

      // Create agent
      const agentResponse = await axios.post(`${this.apiUrl}/v1/agents`, {
        walletId,
        dailyUsdLimit: dailyLimit
      });

      return {
        walletId,
        agentToken: agentResponse.data.agentToken,
        dailyLimit,
        initialBalance: dailyLimit * 2
      };
    } catch (error) {
      throw new Error(`Setup failed: ${error.message}`);
    }
  }
}

// Helper function for easy ChatGPT integration
async function enableChatGPTCommerce(openai, agentToken, options = {}) {
  const agentPay = new AgentPaySDK(options.apiUrl);
  
  return {
    // Get function schema for OpenAI
    functions: agentPay.getFunctionSchema(),
    
    // Handle function calls
    async handleFunctionCall(functionCall) {
      const { name, arguments: args } = functionCall;
      const parsedArgs = JSON.parse(args);
      
      return await agentPay.executeFunction(name, parsedArgs, agentToken);
    },
    
    // Complete ChatGPT conversation with commerce
    async chat(messages, model = 'gpt-4') {
      const response = await openai.chat.completions.create({
        model,
        messages,
        functions: agentPay.getFunctionSchema(),
        function_call: "auto"
      });
      
      const message = response.choices[0].message;
      
      // Handle function calls
      if (message.function_call) {
        const result = await this.handleFunctionCall(message.function_call);
        
        // Continue conversation with function result
        const followUp = await openai.chat.completions.create({
          model,
          messages: [
            ...messages,
            message,
            {
              role: "function",
              name: message.function_call.name,
              content: JSON.stringify(result)
            }
          ]
        });
        
        return {
          response: followUp.choices[0].message.content,
          functionCall: message.function_call.name,
          functionResult: result
        };
      }
      
      return {
        response: message.content,
        functionCall: null,
        functionResult: null
      };
    }
  };
}

// Export for different module systems
module.exports = {
  AgentPaySDK,
  enableChatGPTCommerce
};

// Example usage:
/*
const OpenAI = require('openai');
const { enableChatGPTCommerce } = require('./agentpay-sdk');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function example() {
  // Enable commerce for ChatGPT
  const commerce = await enableChatGPTCommerce(openai, 'your-agent-token');
  
  // Chat with purchase powers
  const result = await commerce.chat([
    {
      role: "system", 
      content: "You can make purchases using AgentPay"
    },
    {
      role: "user",
      content: "Buy me a $10 Amazon gift card"
    }
  ]);
  
  console.log(result.response);
  if (result.functionCall) {
    console.log('Purchase made:', result.functionResult);
  }
}
*/ 