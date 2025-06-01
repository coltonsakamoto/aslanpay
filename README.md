# 🦁 Aslan - Payment Infrastructure for AI Agents

> Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions in the real world.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Railway Deploy](https://img.shields.io/badge/Deploy-Railway-purple.svg)](https://railway.app)

**Aslan** is the universal payment infrastructure that enables AI agents to make autonomous purchases with enterprise-grade security, real-time spending controls, and sub-400ms authorization.

🌐 **Live Demo:** [aslanpay.xyz](https://aslanpay.xyz)  
📚 **Documentation:** [aslanpay.xyz/docs](https://aslanpay.xyz/docs)  
🎮 **Interactive Demo:** [aslanpay.xyz/demo](https://aslanpay.xyz/demo)

## ✨ Features

- **🤖 Universal AI Support** - Works with OpenAI, Anthropic, LangChain, CrewAI, and any AI framework
- **⚡ Sub-400ms Authorization** - Lightning-fast payment processing for real-time AI decisions
- **🛡️ Enterprise Security** - JWT authentication, spending limits, audit trails, and fraud detection
- **💳 Stripe Integration** - Secure payment processing with industry-standard compliance
- **📊 Real-time Analytics** - Monitor AI agent spending and transaction patterns
- **🔧 Easy Integration** - 2-minute setup with comprehensive SDKs and examples

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

Visit `http://localhost:3000` to see Aslan in action!

## 🔧 Configuration

### Required Environment Variables

```bash
# Security (generate strong random values)
JWT_SECRET=your-super-secure-jwt-secret
SESSION_SECRET=your-super-secure-session-secret

# Stripe (get from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Email (choose one provider)
SENDGRID_API_KEY=your_sendgrid_api_key
# OR
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
```

See `.env.example` for complete configuration options.

## 🤖 AI Integration Examples

### OpenAI Function Calling

```javascript
import OpenAI from 'openai';
import { Aslan } from '@aslanpay/sdk';

const openai = new OpenAI();
const aslan = new Aslan({ apiKey: process.env.ASLAN_API_KEY });

const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Buy me AWS credits" }],
  tools: [{
    type: "function",
    function: {
      name: "purchase",
      description: "Make a purchase",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          description: { type: "string" }
        }
      }
    }
  }]
});

// If AI decides to make a purchase
if (completion.choices[0].message.tool_calls) {
  const purchase = await aslan.authorize({
    amount: 2500, // $25.00
    description: "AWS credits"
  });
}
```

### LangChain Integration

```python
from langchain.tools import Tool
from aslanpay import Aslan

aslan = Aslan(api_key="your_api_key")

def purchase_tool(amount: int, description: str):
    """Make a purchase with AI agent"""
    return aslan.authorize(
        amount=amount,
        description=description
    )

purchase = Tool(
    name="purchase",
    description="Make purchases for the AI agent",
    func=purchase_tool
)
```

### Basic Node.js Integration

```javascript
const { Aslan } = require('@aslanpay/sdk');

const aslan = new Aslan({
  apiKey: process.env.ASLAN_API_KEY,
  environment: 'sandbox' // or 'production'
});

// Enable AI agent to make purchases
async function enableAIPurchases() {
  const result = await aslan.purchase({
    amount: 2500, // $25.00
    description: 'AWS credits for AI training',
    agentId: 'gpt-4-assistant'
  });
  
  console.log('Purchase successful:', result);
}
```

## 🛡️ Security Features

### Spending Controls

```javascript
const aslan = new Aslan({
  apiKey: 'your_api_key',
  limits: {
    daily: 10000,        // $100 daily limit
    perTransaction: 5000, // $50 per transaction
    velocity: {
      count: 10,         // Max 10 transactions
      window: 3600       // Per hour
    }
  }
});
```

### Enterprise Security

- **JWT-based authentication** with rotating secrets
- **Rate limiting** and DDoS protection
- **Complete audit trails** for all transactions
- **Granular spending controls** and velocity limits
- **Real-time fraud detection**

## 📚 API Reference

### Authorization Endpoint

```bash
POST /api/v1/authorize
```

**Request:**
```json
{
  "amount": 2500,
  "description": "AWS credits for computation",
  "agentId": "gpt-4-assistant",
  "metadata": {}
}
```

**Response:**
```json
{
  "id": "auth_1234567890",
  "amount": 2500,
  "status": "authorized",
  "description": "AWS credits for computation",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Health Check

```bash
GET /api/health
```

Returns system status and component health.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Agent      │    │     Aslan       │    │     Stripe      │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   OpenAI    │ │───▶│ │ Auth & Rate │ │───▶│ │   Payment   │ │
│ │  LangChain  │ │    │ │  Limiting   │ │    │ │ Processing  │ │
│ │   CrewAI    │ │    │ │             │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Custom    │ │    │ │  Spending   │ │    │ │   Webhook   │ │
│ │ Frameworks  │ │    │ │  Controls   │ │    │ │   Events    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Deployment

### Railway (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

### Manual Deployment

1. **Set Environment Variables**
2. **Deploy to your platform**
3. **Configure webhooks**
4. **Set up monitoring**

### Docker

```bash
docker build -t aslan .
docker run -p 3000:3000 --env-file .env aslan
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run security validation
npm run security:validate

# Test database connection
npm run db:test
```

## 📖 Examples

- **[OpenAI Integration](examples/openai/)** - Complete OpenAI function calling setup
- **[LangChain Tools](examples/langchain/)** - LangChain agent with payment tools
- **[CrewAI Multi-Agent](examples/crewai/)** - Multi-agent team with shared payment controls
- **[Custom Framework](examples/custom/)** - REST API integration for any framework

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation:** [aslanpay.xyz/docs](https://aslanpay.xyz/docs)
- **Email:** [support@aslanpay.xyz](mailto:support@aslanpay.xyz)
- **GitHub Issues:** [Create an issue](https://github.com/coltonsakamoto/aslanpay/issues)
- **Community:** [Join our Discord](https://discord.gg/aslanpay)

## 🌟 Roadmap

- [ ] **Multi-currency support** (EUR, GBP, JPY)
- [ ] **Additional payment providers** (PayPal, Square)
- [ ] **Advanced analytics dashboard**
- [ ] **Mobile SDK** for React Native
- [ ] **Webhook management UI**
- [ ] **Team collaboration features**

---

<div align="center">

**🦁 Like the great lion of Narnia, Aslan guides AI agents to accomplish their missions in the real world.**

[Website](https://aslanpay.xyz) • [Documentation](https://aslanpay.xyz/docs) • [Demo](https://aslanpay.xyz/demo) • [API Reference](https://aslanpay.xyz/api)

</div> 