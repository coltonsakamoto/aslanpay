/**
 * AgentPay SDK - Universal Payment Infrastructure for AI Agents
 * 
 * This SDK provides a simple interface for AI agents to make purchases
 * with built-in spending controls, security, and compliance.
 * 
 * @example
 * ```typescript
 * import AgentPay from 'agentpay';
 * 
 * const agentpay = new AgentPay({
 *   apiKey: 'your_api_key',
 *   environment: 'production' // or 'sandbox'
 * });
 * 
 * // AI agent makes a purchase
 * const result = await agentpay.purchase('gift-card', {
 *   brand: 'amazon',
 *   amount: 25
 * });
 * ```
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface AgentPayConfig {
  apiKey: string;
  environment?: 'production' | 'sandbox';
  apiUrl?: string;
  timeout?: number;
}

export interface PurchaseParams {
  // Gift card params
  brand?: string;
  amount?: number;
  
  // Domain params
  domain?: string;
  years?: number;
  
  // SMS/Call params
  to?: string;
  message?: string;
  
  // Generic params
  [key: string]: any;
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  amount?: number;
  service?: string;
  details?: any;
  message?: string;
  error?: string;
}

export interface AuthorizationRequest {
  agentToken: string;
  merchant: string;
  amount: number;
  category?: string;
  intent?: string;
  metadata?: any;
}

export interface AuthorizationResult {
  success: boolean;
  authorized?: boolean;
  authorizationId?: string;
  scopedToken?: string;
  expiresAt?: string;
  latency?: number;
  error?: string;
  reason?: string;
}

export interface SpendingLimits {
  dailyLimitUSD: number;
  transactionLimitUSD: number;
  monthlyLimitUSD?: number;
  categoryLimits?: Record<string, number>;
  spentTodayUSD: number;
  spentThisMonthUSD?: number;
  remainingDailyUSD: number;
}

/**
 * Main AgentPay SDK class
 */
export class AgentPay {
  private client: AxiosInstance;
  private config: Required<AgentPayConfig>;

  constructor(config: AgentPayConfig) {
    this.config = {
      environment: 'production',
      apiUrl: config.environment === 'sandbox' 
        ? 'https://sandbox-api.agentpay.com'
        : 'https://api.agentpay.com',
      timeout: 30000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AgentPay-SDK/2.0.0'
      }
    });
  }

  /**
   * Make a direct purchase (bypasses wallet, charges card directly)
   */
  async purchase(service: string, params: PurchaseParams): Promise<PurchaseResult> {
    try {
      const response: AxiosResponse = await this.client.post('/v1/purchase-direct', {
        agentToken: this.config.apiKey,
        service,
        params
      });

      return {
        success: true,
        transactionId: response.data.transactionId,
        amount: response.data.amount,
        service: response.data.service,
        details: response.data.details,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Request spending authorization (Control Tower)
   */
  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    try {
      const response: AxiosResponse = await this.client.post('/v1/authorize', request);

      return {
        success: true,
        authorized: response.data.authorized,
        authorizationId: response.data.authorizationId,
        scopedToken: response.data.scopedToken,
        expiresAt: response.data.expiresAt,
        latency: response.data.latency
      };
    } catch (error: any) {
      return {
        success: false,
        authorized: false,
        error: error.response?.data?.error || error.message,
        reason: error.response?.data?.reason
      };
    }
  }

  /**
   * Confirm an authorized purchase
   */
  async confirmPurchase(authorizationId: string, finalAmount?: number, transactionDetails?: any): Promise<PurchaseResult> {
    try {
      const response: AxiosResponse = await this.client.post(`/v1/authorize/${authorizationId}/confirm`, {
        finalAmount,
        transactionDetails
      });

      return {
        success: true,
        transactionId: response.data.transactionId,
        amount: response.data.amount,
        message: response.data.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Get spending limits and usage
   */
  async getSpendingLimits(): Promise<SpendingLimits | null> {
    try {
      const response: AxiosResponse = await this.client.get(`/v1/agents/${this.config.apiKey}/config`);
      
      const config = response.data.config;
      const summary = response.data.spendingSummary;

      return {
        dailyLimitUSD: config.dailyLimitUSD,
        transactionLimitUSD: config.transactionLimitUSD,
        categoryLimits: config.categoryLimits,
        spentTodayUSD: summary.spentTodayUSD,
        remainingDailyUSD: summary.remainingDailyUSD
      };
    } catch (error: any) {
      console.error('Failed to get spending limits:', error);
      return null;
    }
  }

  /**
   * Get OpenAI Function Calling schema
   */
  getFunctionSchema(): any[] {
    return [
      {
        name: "agentpay_purchase",
        description: "Make autonomous purchases using AgentPay with spending limits and security controls",
        parameters: {
          type: "object",
          properties: {
            service: {
              type: "string",
              enum: ["gift-card", "domain", "sms", "call", "aws-credits", "vps", "saas"],
              description: "Type of purchase to make"
            },
            params: {
              type: "object",
              description: "Purchase parameters (varies by service type)",
              properties: {
                // Gift card params
                brand: { 
                  type: "string", 
                  description: "Gift card brand (amazon, starbucks, target, etc.)" 
                },
                amount: { 
                  type: "number", 
                  description: "Amount in USD" 
                },
                
                // Domain params
                domain: { 
                  type: "string", 
                  description: "Domain name to register" 
                },
                years: { 
                  type: "integer", 
                  description: "Registration years (default 1)" 
                },
                
                // SMS/Call params
                to: { 
                  type: "string", 
                  description: "Phone number for SMS/call" 
                },
                message: { 
                  type: "string", 
                  description: "Message content" 
                },
                
                // VPS params
                plan: { 
                  type: "string", 
                  description: "VPS plan (basic, standard, premium)" 
                },
                months: { 
                  type: "integer", 
                  description: "Billing months (default 1)" 
                }
              }
            }
          },
          required: ["service", "params"]
        }
      },
      {
        name: "agentpay_authorize",
        description: "Request spending authorization before making a purchase (Control Tower)",
        parameters: {
          type: "object",
          properties: {
            merchant: {
              type: "string",
              description: "Merchant domain or name (e.g., 'amazon.com', 'starbucks.com')"
            },
            amount: {
              type: "number",
              description: "Purchase amount in USD"
            },
            category: {
              type: "string",
              description: "Purchase category (food, shopping, travel, etc.)"
            },
            intent: {
              type: "string",
              description: "Brief description of the purchase intent"
            }
          },
          required: ["merchant", "amount"]
        }
      }
    ];
  }

  /**
   * Execute a function call from OpenAI
   */
  async executeFunctionCall(functionName: string, args: any): Promise<any> {
    switch (functionName) {
      case 'agentpay_purchase':
        return await this.purchase(args.service, args.params);
      
      case 'agentpay_authorize':
        return await this.authorize({
          agentToken: this.config.apiKey,
          merchant: args.merchant,
          amount: args.amount,
          category: args.category,
          intent: args.intent
        });
      
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  /**
   * Create a wallet and agent (for new users)
   */
  async createAgent(dailyLimitUSD: number = 100): Promise<{ agentToken: string; walletId: string } | null> {
    try {
      // Create wallet
      const walletResponse: AxiosResponse = await this.client.post('/v1/wallets');
      const walletId = walletResponse.data.walletId;

      // Create agent
      const agentResponse: AxiosResponse = await this.client.post('/v1/agents', {
        walletId,
        dailyUsdLimit: dailyLimitUSD
      });

      return {
        agentToken: agentResponse.data.agentToken,
        walletId
      };
    } catch (error: any) {
      console.error('Failed to create agent:', error);
      return null;
    }
  }

  /**
   * Add a credit card to the wallet
   */
  async addCreditCard(walletId: string, paymentMethodId: string): Promise<boolean> {
    try {
      await this.client.post(`/v1/wallets/${walletId}/cards`, {
        paymentMethodId
      });
      return true;
    } catch (error: any) {
      console.error('Failed to add credit card:', error);
      return false;
    }
  }
}

/**
 * Helper function for easy OpenAI integration
 */
export async function enableChatGPTCommerce(openai: any, agentPayConfig: AgentPayConfig): Promise<{
  functions: any[];
  handleFunctionCall: (functionCall: any) => Promise<any>;
  chat: (messages: any[], model?: string) => Promise<any>;
}> {
  const agentPay = new AgentPay(agentPayConfig);
  
  return {
    // Get function schema for OpenAI
    functions: agentPay.getFunctionSchema(),
    
    // Handle function calls
    async handleFunctionCall(functionCall: any) {
      const { name, arguments: args } = functionCall;
      const parsedArgs = JSON.parse(args);
      
      return await agentPay.executeFunctionCall(name, parsedArgs);
    },
    
    // Complete ChatGPT conversation with commerce
    async chat(messages: any[], model: string = 'gpt-4') {
      const response = await openai.chat.completions.create({
        model,
        messages,
        functions: agentPay.getFunctionSchema(),
        function_call: "auto"
      });
      
      const message = response.choices[0].message;
      
      // Handle function calls
      if (message.function_call) {
        const result = await agentPay.executeFunctionCall(message.function_call.name, JSON.parse(message.function_call.arguments));
        
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

// Default export
export default AgentPay;

// Named exports
export { AgentPay as Client }; 