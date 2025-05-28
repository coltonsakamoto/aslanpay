# 🚀 **AgentPay Documentation**

**Universal Payment Infrastructure for AI Agents**

---

## 🎯 **What is AgentPay?**

AgentPay is the **"Stripe for AI Agents"** - the universal payment infrastructure that enables any AI agent to make purchases with enterprise-grade security and spending controls.

### **Key Features**
- **🤖 Universal AI Support**: Works with OpenAI, Anthropic, LangChain, CrewAI, and any AI framework
- **⚡ Sub-400ms Authorization**: Real-time spending validation for autonomous agents
- **🛡️ Enterprise Security**: JWT tokens, scoped permissions, comprehensive audit trails
- **💳 Direct Card Charging**: No stored funds, direct payment processing for compliance
- **🎯 Spending Controls**: Daily limits, category restrictions, approval workflows

---

## 🚀 **Quick Start**

### **1. Install AgentPay**
```bash
npm install agentpay
```

### **2. Get Your API Key**
Visit [agentpay.com/dashboard](https://agentpay.com/dashboard) to create an account and get your API key.

### **3. First Purchase**
```javascript
import AgentPay from 'agentpay';

const agentpay = new AgentPay({
  apiKey: 'your_agentpay_api_key',
  environment: 'sandbox' // or 'production'
});

// AI agent makes a purchase
const result = await agentpay.purchase('gift-card', {
  brand: 'amazon',
  amount: 25
});

console.log(result);
// ✅ { success: true, transactionId: 'txn_...', amount: 25, ... }
```

---

## 🤖 **AI Framework Integrations**

### **OpenAI Function Calling**
```javascript
import OpenAI from 'openai';
import AgentPay from 'agentpay';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const agentpay = new AgentPay({ apiKey: process.env.AGENTPAY_API_KEY });

// Get function schema for ChatGPT
const functions = agentpay.getFunctionSchema();

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "user", content: "Buy me a $10 Amazon gift card" }
  ],
  functions: functions,
  function_call: "auto"
});

// ChatGPT will automatically call agentpay_purchase function!
```

### **LangChain Integration**
```python
from langchain.agents import initialize_agent, Tool
from agentpay import AgentPayTool

# Create AgentPay tool
agentpay_tool = AgentPayTool(api_key="your_agentpay_api_key")

tools = [agentpay_tool]
agent = initialize_agent(tools, llm, verbose=True)

# AI agent can now make purchases
agent.run("Buy office supplies under $50")
```

### **Anthropic Claude Integration**
```javascript
import Anthropic from '@anthropic-ai/sdk';
import AgentPay from 'agentpay';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const agentpay = new AgentPay({ apiKey: process.env.AGENTPAY_API_KEY });

// Claude with purchase capabilities
const message = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  messages: [{ role: "user", content: "Order lunch for the team under $100" }],
  tools: agentpay.getFunctionSchema()
});
```

---

## 🎯 **Control Tower (Advanced)**

For enterprise use cases, use the Control Tower API for pre-authorization and spending control:

### **1. Request Authorization**
```javascript
const auth = await agentpay.authorize({
  agentToken: 'your_agent_token',
  merchant: 'doordash.com',
  amount: 45.99,
  category: 'food',
  intent: 'Team lunch order'
});

// ✅ { authorized: true, authorizationId: 'auth_123', ... }
```

### **2. Execute Purchase**
Your AI agent goes to DoorDash, places the order...

### **3. Confirm Transaction**
```javascript
const result = await agentpay.confirmPurchase(
  auth.authorizationId, 
  46.25, // final amount (with tip)
  { orderId: 'DD789', items: ['Pizza', 'Salad'] }
);

// ✅ Payment processed, user charged, limits updated
```

---

## 💳 **Supported Services**

| Service | Description | Example Use Case |
|---------|-------------|------------------|
| **gift-card** | Digital gift cards | Amazon, Starbucks, Target |
| **domain** | Domain registration | AI registering company domains |
| **sms** | SMS messaging | Notifications, alerts |
| **call** | Phone calls | Customer service callbacks |
| **aws-credits** | AWS credits | Auto-scaling cloud resources |
| **vps** | VPS hosting | Dynamic server provisioning |
| **saas** | SaaS subscriptions | Auto-subscribing to tools |

---

## 🛡️ **Security & Compliance**

### **Enterprise Security Features**
- **🔐 JWT Authentication**: Secure, scoped tokens with expiration
- **⚡ Sub-400ms Authorization**: Real-time validation without delays
- **🛡️ Idempotency Protection**: Prevents duplicate transactions
- **📊 Complete Audit Trails**: Every transaction logged and traceable
- **🚨 Spending Controls**: Daily/category limits, approval workflows

### **Compliance**
- **PCI DSS Compliant**: Secure card processing
- **SOC 2 Type II**: Enterprise data security
- **GDPR Compliant**: Privacy-first architecture
- **Direct Payment Processing**: No stored funds for regulatory compliance

---

## 📊 **Pricing**

### **Developer (Free)**
- 100 transactions/month
- Sandbox environment
- Basic spending controls
- Community support

### **Startup ($29/month)**
- 1,000 transactions/month
- Production environment
- Advanced spending controls
- Email support

### **Enterprise (Custom)**
- Unlimited transactions
- Dedicated infrastructure
- Custom integrations
- Priority support

---

## 📚 **API Reference**

### **AgentPay Class**

#### `constructor(config: AgentPayConfig)`
Initialize AgentPay client.

```typescript
interface AgentPayConfig {
  apiKey: string;
  environment?: 'production' | 'sandbox';
  apiUrl?: string;
  timeout?: number;
}
```

#### `purchase(service: string, params: PurchaseParams): Promise<PurchaseResult>`
Make a direct purchase.

#### `authorize(request: AuthorizationRequest): Promise<AuthorizationResult>`
Request spending authorization (Control Tower).

#### `confirmPurchase(authorizationId: string, finalAmount?: number): Promise<PurchaseResult>`
Confirm an authorized purchase.

#### `getFunctionSchema(): any[]`
Get OpenAI Function Calling schema.

---

## 🔗 **Examples & Tutorials**

### **Basic Examples**
- [First Purchase](./examples/first-purchase.md)
- [OpenAI Integration](./examples/openai-integration.md)
- [Spending Controls](./examples/spending-controls.md)

### **Advanced Use Cases**
- [Multi-Agent Coordination](./examples/multi-agent.md)
- [Enterprise Deployment](./examples/enterprise.md)
- [Custom Integrations](./examples/custom-integrations.md)

### **Video Tutorials**
- [2-Minute Integration](https://www.youtube.com/watch?v=...)
- [Control Tower Deep Dive](https://www.youtube.com/watch?v=...)
- [Security Best Practices](https://www.youtube.com/watch?v=...)

---

## 🤝 **Support**

### **Community**
- [GitHub Issues](https://github.com/agentpay/agentpay-sdk/issues)
- [Discord Community](https://discord.gg/agentpay)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/agentpay)

### **Enterprise Support**
- Email: [enterprise@agentpay.com](mailto:enterprise@agentpay.com)
- Phone: 1-800-AGENTPAY
- Slack Connect: Available for Enterprise customers

---

## 🚀 **Get Started Today**

Ready to give your AI agents purchase powers?

1. **[Try the Demo](https://agentpay.com/demo)** - See it working in 30 seconds
2. **[Get API Key](https://agentpay.com/dashboard)** - Free developer account
3. **[2-Minute Integration](./quickstart.md)** - First purchase in minutes

**Join hundreds of developers building the future of autonomous commerce!**

---

*AgentPay - Universal Payment Infrastructure for AI Agents*  
*© 2024 AgentPay Inc. All rights reserved.* 