/**
 * AgentPay SDK - Dead simple AI agent payments
 * 
 * Usage:
 *   const agentpay = require('agentpay');
 *   agentpay.configure({ token: 'your_agent_token' });
 *   const result = await agentpay.pay('food-delivery', 25.00, { restaurant: 'Pizza Palace' });
 *   console.log(result.success); // true
 */

const fetch = require('node-fetch');

// Global configuration
let config = {
  token: null,
  baseUrl: 'https://api.agentpay.org',
  timeout: 30000
};

/**
 * Configure AgentPay SDK
 * @param {Object} options - Configuration options
 * @param {string} options.token - Agent token (can also be set via AGENTPAY_TOKEN env var)
 * @param {string} options.baseUrl - API base URL (defaults to production)
 * @param {number} options.timeout - Request timeout in milliseconds
 */
function configure(options = {}) {
  if (options.token) {
    config.token = options.token;
  } else if (process.env.AGENTPAY_TOKEN) {
    config.token = process.env.AGENTPAY_TOKEN;
  }
  
  if (options.baseUrl) {
    config.baseUrl = options.baseUrl.replace(/\/$/, '');
  }
  
  if (options.timeout) {
    config.timeout = options.timeout;
  }
}

/**
 * Make a payment with AgentPay
 * @param {string} intent - What to buy (e.g., 'food-delivery', 'flight', 'gift-card')
 * @param {number} amount - Maximum amount to spend (optional for some services)
 * @param {Object} details - Service-specific parameters
 * @param {Object} options - Additional options
 * @param {string} options.token - Override configured token
 * @param {boolean} options.directCard - Use direct card charging (recommended)
 * @returns {Promise<Object>} Payment result
 */
async function pay(intent, amount = null, details = {}, options = {}) {
  // Get token from parameter, global config, or environment
  const agentToken = options.token || config.token || process.env.AGENTPAY_TOKEN;
  
  if (!agentToken) {
    throw new Error('No agent token provided. Call agentpay.configure({ token: "..." }) or set AGENTPAY_TOKEN env var');
  }
  
  // Prepare request
  const directCard = options.directCard !== false; // Default to true
  const endpoint = directCard ? '/v1/purchase-direct' : '/v1/purchase';
  const url = `${config.baseUrl}${endpoint}`;
  
  // Build payload
  const payload = {
    agentToken,
    service: intent,
    params: { ...details }
  };
  
  // Add amount to params if provided
  if (amount !== null) {
    payload.params.maxPrice = amount;
    payload.params.budget = amount;
  }
  
  try {
    // Make HTTP request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'agentpay-js/0.1.0',
        'X-SDK-Version': '0.1.0'
      },
      body: JSON.stringify(payload),
      timeout: config.timeout
    });
    
    // Parse response
    let data;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error(`Invalid JSON response from AgentPay API (status ${response.status})`);
    }
    
    // Handle success
    if (response.status === 200 && data.success) {
      return {
        success: true,
        transactionId: data.transactionId,
        amount: data.amount,
        service: data.service,
        message: data.message,
        details: data.details || {}
      };
    }
    
    // Handle approval required (direct card only)
    if (response.status === 202 && data.requiresApproval) {
      return {
        success: false,
        error: 'approval_required',
        message: data.message || 'Purchase requires user approval',
        details: {
          approvalId: data.approvalId,
          action: data.action,
          estimatedAmount: data.estimatedAmount
        }
      };
    }
    
    // Handle errors
    return {
      success: false,
      error: data.code || 'UNKNOWN_ERROR',
      message: data.error || `Request failed with status ${response.status}`,
      details: data.details || {}
    };
    
  } catch (error) {
    throw new Error(`Network error connecting to AgentPay API: ${error.message}`);
  }
}

// Convenience functions for common use cases
async function buyFood(restaurant, budget = 30.0, options = {}) {
  return pay('food-delivery', budget, { restaurant, ...options });
}

async function bookFlight(from, to, budget = 500.0, options = {}) {
  return pay('flight', budget, { from, to, ...options });
}

async function buyGiftCard(brand, amount) {
  return pay('gift-card', amount, { brand });
}

async function sendSMS(phone, message) {
  return pay('sms', null, { to: phone, message });
}

// Auto-configure from environment on require
if (process.env.AGENTPAY_TOKEN) {
  configure();
}

module.exports = {
  configure,
  pay,
  buyFood,
  bookFlight,
  buyGiftCard,
  sendSMS
}; 