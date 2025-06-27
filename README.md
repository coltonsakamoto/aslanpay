# 🦁 Aslan - Payment Infrastructure for AI Agents

> Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions in the real world.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Railway Deploy](https://img.shields.io/badge/Deploy-Railway-purple.svg)](https://railway.app)
[![API Status](https://img.shields.io/badge/API-Production%20Ready-green.svg)](https://aslanpay.xyz/health)
[![Run on Replit](https://replit.com/badge/github/coltonsakamoto/aslanpay)](https://replit.com/@coltonsakamoto/aslanpay?v=1)

**Aslan** is the universal payment infrastructure that enables AI agents to make autonomous purchases with enterprise-grade security, real-time spending controls, and sub-400ms authorization.

🌐 **Live Demo:** [aslanpay.xyz](https://aslanpay.xyz)  
📚 **Documentation:** [aslanpay.xyz/docs](https://aslanpay.xyz/docs)  
🎮 **Interactive Demo:** [aslanpay.xyz/demo](https://aslanpay.xyz/demo)  
📖 **API Reference:** [aslanpay.xyz/api](https://aslanpay.xyz/api)

## 🎯 Production Readiness Status

| Feature | Status | Documentation |
|---------|--------|---------------|
| **Basic Integration** | ⭐⭐⭐⭐⭐ Production Ready | [Quick Start](#-quick-start) |
| **Advanced Features** | ⭐⭐⭐⭐⚫ Stable Beta | [Advanced Configuration](#-advanced-configuration) |
| **Multi-User Setup** | ⭐⭐⭐⭐⚫ Production Ready | [Multi-User Architecture](#-multi-user-architecture) |
| **API Reference** | ⭐⭐⭐⭐⭐ Complete | [API Documentation](#-complete-api-reference) |
| **Error Handling** | ⭐⭐⭐⭐⭐ Production Ready | [Error Handling](#-error-handling-patterns) |
| **Webhooks** | ⭐⭐⭐⭐⭐ Production Ready | [Webhook Guide](#-webhook-integration) |
| **Testing/Sandbox** | ⭐⭐⭐⭐⭐ Complete | [Testing Guide](#-testing--sandbox) |

## ✨ Features

- **🤖 Universal AI Support** - Works with OpenAI, Anthropic, LangChain, CrewAI, and any AI framework
- **⚡ Sub-400ms Authorization** - Lightning-fast payment processing for real-time AI decisions
- **🛡️ Enterprise Security** - JWT authentication, spending limits, audit trails, and fraud detection
- **💳 Stripe Integration** - Secure payment processing with industry-standard compliance
- **👥 Multi-User Architecture** - Complete user isolation, sub-accounts, and enterprise features
- **📊 Real-time Analytics** - Monitor AI agent spending and transaction patterns
- **🔧 Easy Integration** - 2-minute setup with comprehensive SDKs and examples
- **🪝 Webhook Support** - Real-time event notifications for all transactions
- **🧪 Complete Testing Suite** - Sandbox environment with comprehensive test scenarios

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/coltonsakamoto/aslanpay.git
cd aslanpay
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Development Server

```bash
npm run dev
```

Your local server will start on `http://localhost:3000`.

**🌐 Try the Live Demo:** [aslanpay.xyz](https://aslanpay.xyz) - No setup required!

## 🔧 Configuration

### Required Environment Variables

```bash
# Security (generate strong random values)
JWT_SECRET=<generate_with_crypto_randomBytes_32_hex>
SESSION_SECRET=your-super-secure-session-secret

# Stripe (get from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Database (Production)
DATABASE_URL=postgresql://user:password@host:port/database

# Email (choose one provider)
SENDGRID_API_KEY=your_sendgrid_api_key
# OR
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
```

### Advanced Configuration

```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000        # 1 minute
RATE_LIMIT_MAX_REQUESTS=100       # 100 requests per window

# Spending Controls
DEFAULT_DAILY_LIMIT=100000        # $1,000 daily limit
DEFAULT_TRANSACTION_LIMIT=50000   # $500 per transaction
DEFAULT_VELOCITY_LIMIT=10         # 10 transactions per hour

# Multi-User Settings
ENABLE_USER_REGISTRATION=true
REQUIRE_EMAIL_VERIFICATION=true
ENABLE_OAUTH=true

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
WEBHOOK_TIMEOUT=30000            # 30 seconds
```

## 👥 Multi-User Architecture

### User Isolation

Aslan provides complete user isolation with:

- **Separate API keys** per user account
- **Individual spending limits** and controls
- **Isolated transaction history** and analytics
- **User-specific webhook endpoints**
- **Role-based access control** for teams

### Enterprise Setup

```javascript
// Create enterprise account with sub-users
const aslan = new Aslan({
  apiKey: 'your_enterprise_api_key',
  userId: 'enterprise_account_123'
});

// Create sub-account for team member
const subAccount = await aslan.users.create({
  email: 'agent-operator@company.com',
  name: 'AI Agent Team',
  role: 'agent_operator',
  limits: {
    daily: 50000,        // $500 daily limit
    perTransaction: 10000 // $100 per transaction
  }
});

// Sub-account gets their own API key
const subApiKey = await aslan.apiKeys.create({
  userId: subAccount.id,
  name: 'Production AI Agent',
  permissions: ['purchase', 'read']
});
```

### Team Management

```javascript
// Add team member to existing account
await aslan.teams.addMember({
  email: 'newmember@company.com',
  role: 'admin',           // admin, operator, viewer
  permissions: ['read', 'purchase', 'manage_users']
});

// Set team-wide spending controls
await aslan.teams.setLimits({
  daily: 1000000,          // $10,000 team daily limit
  monthly: 30000000,       // $300,000 team monthly limit
  perUser: 100000          // $1,000 per user daily limit
});
```

## 📖 Complete API Reference

### Authentication

All API requests require authentication via API key in the header:

```bash
Authorization: Bearer ak_live_your_api_key_here
```

### Core Endpoints

#### POST /api/v1/authorize

Authorize a payment for an AI agent.

**Request:**
```json
{
  "amount": 2500,
  "description": "AWS credits for computation",
  "agentId": "gpt-4-assistant",
  "userId": "user_123",
  "metadata": {
    "purpose": "model_training",
    "project": "nlp_research"
  }
}
```

**Response:**
```json
{
  "id": "auth_1234567890",
  "amount": 2500,
  "status": "authorized",
  "description": "AWS credits for computation",
  "agentId": "gpt-4-assistant",
  "userId": "user_123",
  "created_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-01-15T10:40:00Z",
  "metadata": {
    "purpose": "model_training",
    "project": "nlp_research"
  }
}
```

#### POST /api/v1/confirm

Confirm and capture an authorized payment.

**Request:**
```json
{
  "authorizationId": "auth_1234567890",
  "finalAmount": 2500
}
```

#### POST /api/v1/refund

Refund a completed transaction.

**Request:**
```json
{
  "transactionId": "txn_1234567890",
  "amount": 1000,
  "reason": "partial_refund"
}
```

#### GET /api/v1/transactions

List transactions with filtering.

**Query Parameters:**
- `userId` - Filter by user
- `agentId` - Filter by AI agent
- `status` - Filter by status (authorized, completed, failed)
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)
- `limit` - Number of results (default: 50, max: 1000)
- `offset` - Pagination offset

### User Management Endpoints

#### POST /api/v1/users

Create a new user account.

#### GET /api/v1/users/{userId}

Retrieve user details and spending statistics.

#### PUT /api/v1/users/{userId}/limits

Update user spending limits.

#### POST /api/v1/users/{userId}/api-keys

Generate new API key for user.

### Webhook Management

#### POST /api/v1/webhooks

Create webhook endpoint.

#### GET /api/v1/webhooks

List webhook endpoints.

#### DELETE /api/v1/webhooks/{webhookId}

Delete webhook endpoint.

## ⚠️ Error Handling Patterns

### Standard Error Response

```json
{
  "error": {
    "code": "insufficient_funds",
    "message": "User has exceeded their daily spending limit",
    "details": {
      "userId": "user_123",
      "currentSpent": 95000,
      "dailyLimit": 100000,
      "requestedAmount": 10000
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_1234567890"
  }
}
```

### Error Codes Reference

| Code | HTTP Status | Description | Retry Strategy |
|------|-------------|-------------|----------------|
| `insufficient_funds` | 402 | Spending limit exceeded | Don't retry, adjust limits |
| `invalid_api_key` | 401 | API key invalid/expired | Don't retry, update key |
| `rate_limited` | 429 | Too many requests | Exponential backoff |
| `invalid_amount` | 400 | Amount validation failed | Don't retry, fix amount |
| `payment_failed` | 402 | Stripe payment failed | Retry with different payment method |
| `user_not_found` | 404 | User doesn't exist | Don't retry, create user first |
| `internal_error` | 500 | Server error | Exponential backoff |

### Error Handling Examples

```javascript
try {
  const result = await aslan.authorize({
    amount: 5000,
    description: "Test purchase"
  });
} catch (error) {
  switch (error.code) {
    case 'insufficient_funds':
      console.log(`Limit exceeded. Current: $${error.details.currentSpent/100}`);
      // Request limit increase or wait for reset
      break;
      
    case 'rate_limited':
      // Exponential backoff retry
      await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
      return retry();
      
    case 'payment_failed':
      console.log('Payment failed:', error.details.stripeError);
      // Try different payment method
      break;
      
    default:
      console.error('Unexpected error:', error.message);
  }
}
```

## 🪝 Webhook Integration

### Setting Up Webhooks

```javascript
// Create webhook endpoint
const webhook = await aslan.webhooks.create({
  url: 'https://your-app.com/webhooks/aslan',
  events: [
    'payment.authorized',
    'payment.completed', 
    'payment.failed',
    'user.limit_exceeded'
  ],
  secret: 'your_webhook_secret'
});
```

### Webhook Event Types

| Event | Description | When Triggered |
|-------|-------------|----------------|
| `payment.authorized` | Payment authorized | After successful authorization |
| `payment.completed` | Payment captured | After confirm() succeeds |
| `payment.failed` | Payment failed | Authorization or capture fails |
| `payment.refunded` | Payment refunded | After successful refund |
| `user.limit_exceeded` | Spending limit hit | User exceeds any limit |
| `user.created` | New user created | User account created |
| `api_key.created` | New API key | API key generated |

### Webhook Payload Example

```json
{
  "id": "evt_1234567890",
  "type": "payment.completed",
  "created": 1642234567,
  "data": {
    "object": {
      "id": "pay_1234567890",
      "amount": 2500,
      "description": "AWS credits",
      "userId": "user_123",
      "agentId": "gpt-4-assistant",
      "status": "completed",
      "metadata": {}
    }
  },
  "request": {
    "id": "req_1234567890",
    "idempotency_key": null
  }
}
```

### Webhook Verification

```javascript
const express = require('express');
const crypto = require('crypto');

app.post('/webhooks/aslan', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['aslan-signature'];
  const payload = req.body;
  
  // Verify webhook signature
  const expectedSig = crypto
    .createHmac('sha256', process.env.ASLAN_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
    
  if (signature !== `sha256=${expectedSig}`) {
    return res.status(400).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  
  switch (event.type) {
    case 'payment.completed':
      console.log('Payment completed:', event.data.object);
      break;
    case 'user.limit_exceeded':
      console.log('User hit spending limit:', event.data.object);
      break;
  }
  
  res.status(200).send('OK');
});
```

## 🧪 Testing & Sandbox

### Sandbox Environment

Aslan provides a complete sandbox environment for testing:

```javascript
const aslan = new Aslan({
  apiKey: 'ak_test_your_test_key',
  environment: 'sandbox'  // Uses test Stripe keys
});
```

### Test Scenarios

#### 1. Successful Payment Flow

```javascript
// Test successful authorization and capture
const auth = await aslan.authorize({
  amount: 1000,
  description: "Test purchase"
});

const payment = await aslan.confirm({
  authorizationId: auth.id
});

console.log('Payment successful:', payment.id);
```

#### 2. Spending Limit Testing

```javascript
// Test spending limit enforcement
const user = await aslan.users.create({
  email: 'test@example.com',
  limits: { daily: 5000 }  // $50 daily limit
});

// This should succeed
await aslan.authorize({ amount: 2500, userId: user.id });

// This should fail with insufficient_funds
try {
  await aslan.authorize({ amount: 5000, userId: user.id });
} catch (error) {
  console.log('Expected error:', error.code); // 'insufficient_funds'
}
```

#### 3. Webhook Testing

```bash
# Install webhook testing tool
npm install -g @aslanpay/webhook-tester

# Start local webhook receiver
aslan-webhooks --port 3001 --endpoint /test-webhook

# Trigger test events
curl -X POST https://aslanpay.xyz/api/test/trigger-webhook \
  -H "Authorization: Bearer ak_test_your_key" \
  -d '{"event": "payment.completed", "webhookUrl": "http://localhost:3001/test-webhook"}'
```

### Integration Testing

```javascript
const { AslanTestHelper } = require('@aslanpay/test-utils');

describe('AI Agent Purchases', () => {
  const testHelper = new AslanTestHelper();
  
  beforeEach(async () => {
    await testHelper.reset();  // Clean state for each test
  });
  
  it('should handle OpenAI function calling', async () => {
    const mockAgent = testHelper.createMockAgent('gpt-4');
    
    const result = await mockAgent.chat([
      { role: 'user', content: 'Buy $25 of AWS credits' }
    ]);
    
    expect(result.purchase).toBeDefined();
    expect(result.purchase.amount).toBe(2500);
  });
});
```

## 🤖 AI Framework Examples

### OpenAI Function Calling

```javascript
import OpenAI from 'openai';
import { Aslan } from '@aslanpay/sdk';

const openai = new OpenAI();
const aslan = new Aslan({ apiKey: process.env.ASLAN_API_KEY });

const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Buy me AWS credits for $25" }],
  tools: [{
    type: "function",
    function: {
      name: "purchase",
      description: "Make a purchase with spending controls",
      parameters: {
        type: "object",
        properties: {
          amount: { 
            type: "number", 
            description: "Amount in cents (e.g., 2500 = $25.00)"
          },
          description: { 
            type: "string",
            description: "Description of the purchase" 
          }
        },
        required: ["amount", "description"]
      }
    }
  }]
});

// Handle function call
if (completion.choices[0].message.tool_calls) {
  const { amount, description } = JSON.parse(
    completion.choices[0].message.tool_calls[0].function.arguments
  );
  
  try {
    const purchase = await aslan.authorize({
      amount,
      description,
      agentId: 'gpt-4-assistant',
      userId: 'user_123'
    });
    
    console.log('Purchase authorized:', purchase);
  } catch (error) {
    console.error('Purchase failed:', error.message);
  }
}
```

### LangChain Integration

```python
from langchain.tools import Tool
from langchain.agents import initialize_agent, AgentType
from langchain.llms import OpenAI
from aslanpay import Aslan

aslan = Aslan(api_key="your_api_key", user_id="user_123")

def purchase_tool(amount: str, description: str) -> str:
    """Make a purchase with AI agent spending controls"""
    try:
        amount_cents = int(float(amount) * 100)
        result = aslan.authorize(
            amount=amount_cents,
            description=description,
            agent_id="langchain-agent"
        )
        return f"Purchase authorized: {result.id} for ${amount}"
    except Exception as e:
        return f"Purchase failed: {str(e)}"

tools = [
    Tool(
        name="purchase",
        description="Make purchases up to spending limits. Input: amount in dollars (e.g., '25.00'), description",
        func=purchase_tool
    )
]

llm = OpenAI(temperature=0)
agent = initialize_agent(
    tools, 
    llm, 
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True
)

# Agent can now make purchases
result = agent.run("Buy $50 of cloud compute credits for model training")
```

### CrewAI Multi-Agent Setup

```python
from crewai import Agent, Task, Crew
from aslanpay import Aslan

# Shared payment infrastructure for multi-agent team
aslan = Aslan(api_key="your_api_key", user_id="team_123")

# Procurement agent
procurement_agent = Agent(
    role='Procurement Specialist',
    goal='Purchase required resources within budget',
    backstory='Responsible for acquiring compute resources and tools',
    tools=[aslan.create_tool(max_amount=10000)]  # $100 max per purchase
)

# Research agent  
research_agent = Agent(
    role='Research Coordinator',
    goal='Coordinate research purchases and data acquisition',
    backstory='Manages data purchases and research tool subscriptions',
    tools=[aslan.create_tool(max_amount=5000)]   # $50 max per purchase
)

# Team spending limits apply across all agents
crew = Crew(
    agents=[procurement_agent, research_agent],
    tasks=[
        Task(
            description="Purchase cloud compute for training run",
            agent=procurement_agent
        ),
        Task(
            description="Buy access to research dataset",
            agent=research_agent
        )
    ],
    spending_limits={
        'daily': 50000,    # $500 team daily limit
        'per_agent': 10000  # $100 per agent per task
    }
)
```

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Agents     │    │     Aslan       │    │   External      │
│                 │    │    Platform     │    │   Services      │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   OpenAI    │ │───▶│ │ Auth & Rate │ │───▶│ │   Stripe    │ │
│ │  LangChain  │ │    │ │  Limiting   │ │    │ │  Payments   │ │
│ │   CrewAI    │ │    │ │             │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Custom    │ │    │ │  Spending   │ │    │ │   SendGrid  │ │
│ │ Frameworks  │ │    │ │  Controls   │ │    │ │    Email    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Multi-Agent │ │    │ │   User      │ │    │ │ PostgreSQL  │ │
│ │   Teams     │ │    │ │ Management  │ │    │ │  Database   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────┐
                       │  Webhooks   │
                       │   & Events  │
                       └─────────────┘
```

### Security Architecture

- **Authentication Layer**: JWT tokens with API key validation
- **Authorization Layer**: User-specific spending limits and permissions
- **Rate Limiting**: Per-user and global rate limits with Redis backend
- **Audit Trail**: Complete transaction logging with immutable records
- **Encryption**: All sensitive data encrypted at rest and in transit

## 🚀 Deployment Guide

### Production Deployment

#### 1. Railway (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/aslanpay)

```bash
# Clone and deploy
git clone https://github.com/coltonsakamoto/aslanpay.git
cd aslanpay
railway login
railway up
```

#### 2. Docker Deployment

```dockerfile
# Dockerfile included in repository
docker build -t aslanpay .
docker run -p 3000:3000 --env-file .env aslanpay
```

#### 3. Manual Deployment

```bash
# Build for production
npm run build

# Start production server
NODE_ENV=production npm start
```

### Environment Configuration

```bash
# Production environment variables
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Security
JWT_SECRET=<64-char-random-string>
SESSION_SECRET=<64-char-random-string>
ENCRYPTION_KEY=<32-byte-key>

# Stripe Production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Monitoring
LOG_LEVEL=warn
METRICS_ENABLED=true
SENTRY_DSN=https://...
```

### Health Monitoring

```bash
# Health check endpoint
GET /api/health

# Response
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": "healthy",
    "redis": "healthy", 
    "stripe": "healthy",
    "email": "healthy"
  }
}
```

## 📚 SDK Reference

### Installation

```bash
npm install @aslanpay/sdk
```

### Initialization

```javascript
const { Aslan } = require('@aslanpay/sdk');

const aslan = new Aslan({
  apiKey: 'ak_live_your_api_key',
  environment: 'production', // or 'sandbox'
  userId: 'user_123',        // Optional: default user
  timeout: 30000,            // 30 second timeout
  retries: 3,                // Auto-retry failed requests
  webhookSecret: 'your_webhook_secret'
});
```

### Methods

#### aslan.authorize(params)

```javascript
const authorization = await aslan.authorize({
  amount: 2500,              // Required: amount in cents
  description: 'AWS credits', // Required: purchase description
  userId: 'user_123',        // Optional: overrides default
  agentId: 'gpt-4',          // Optional: agent identifier
  metadata: {},              // Optional: custom metadata
  idempotencyKey: 'unique'   // Optional: prevent duplicates
});
```

#### aslan.confirm(authorizationId, params)

```javascript
const payment = await aslan.confirm('auth_123', {
  finalAmount: 2500,         // Optional: adjust amount
  metadata: {}               // Optional: additional metadata
});
```

#### aslan.refund(transactionId, params)

```javascript
const refund = await aslan.refund('txn_123', {
  amount: 1000,              // Optional: partial refund
  reason: 'customer_request' // Optional: refund reason
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/coltonsakamoto/aslanpay.git
cd aslanpay
npm install
cp .env.example .env
npm run dev
```

### Running Tests

```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests
npm run test:security     # Security validation
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation:** [aslanpay.xyz/docs](https://aslanpay.xyz/docs)
- **API Reference:** [aslanpay.xyz/api](https://aslanpay.xyz/api)
- **Email:** [support@aslanpay.xyz](mailto:support@aslanpay.xyz)
- **GitHub Issues:** [Create an issue](https://github.com/coltonsakamoto/aslanpay/issues)
- **Community:** [Join our Discord](https://discord.gg/aslanpay)
- **Status Page:** [status.aslanpay.xyz](https://status.aslanpay.xyz)

## 🌟 Roadmap

### Q1 2024
- [x] Multi-user architecture
- [x] Webhook system
- [x] Complete API documentation
- [x] Production-ready security

### Q2 2024
- [ ] Multi-currency support (EUR, GBP, JPY)
- [ ] Additional payment providers (PayPal, Square)
- [ ] Advanced analytics dashboard
- [ ] Mobile SDK for React Native

### Q3 2024
- [ ] Team collaboration features
- [ ] Advanced spending analytics
- [ ] Machine learning fraud detection
- [ ] Global load balancing

---

<div align="center">

**🦁 Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions in the real world.**

[Website](https://aslanpay.xyz) • [Documentation](https://aslanpay.xyz/docs) • [Demo](https://aslanpay.xyz/demo) • [API Reference](https://aslanpay.xyz/api)

</div> 