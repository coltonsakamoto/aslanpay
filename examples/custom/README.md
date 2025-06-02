# 🔧 Custom Framework + Aslan Integration

Generic REST API integration example that works with any AI framework or custom application. Perfect starting point for integrating Aslan with your own tools and frameworks.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install axios dotenv
# OR
pip install requests python-dotenv
```

### 2. Set Environment Variables

```bash
# Copy from project root
cp ../../.env.example .env

# Add your keys
ASLAN_API_KEY=your_aslan_api_key
ASLAN_BASE_URL=https://aslanpay.xyz/api/v1
```

### 3. Run the Example

```bash
# Node.js version
node rest-api-client.js

# Python version
python rest_api_client.py

# cURL examples
bash curl-examples.sh
```

## 📁 Files in this Directory

- `rest-api-client.js` - Node.js REST API client example
- `rest_api_client.py` - Python REST API client example
- `curl-examples.sh` - Raw cURL examples for any language
- `aslan-sdk-wrapper.js` - Custom SDK wrapper example
- `README.md` - This file

## 🎯 What This Example Demonstrates

✅ **Pure REST API Integration** - Direct HTTP calls to Aslan endpoints  
✅ **Universal Compatibility** - Works with any programming language  
✅ **Authentication Handling** - Proper API key management  
✅ **Error Handling** - Robust error handling patterns  
✅ **Custom SDK Creation** - Build your own SDK wrapper

## 🔧 Integration Patterns

### 1. Direct REST API Calls
Simple HTTP requests for maximum compatibility:

```javascript
// Authorize payment
const response = await fetch('https://aslanpay.xyz/api/v1/authorize', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 2500,
    description: 'AWS credits'
  })
});
```

### 2. Custom SDK Wrapper
Create framework-specific wrappers:

```javascript
class MyFrameworkAslanPlugin {
  constructor(apiKey) {
    this.aslan = new AslanClient(apiKey);
  }
  
  async enablePurchasing(agent) {
    agent.addTool('purchase', this.aslan.authorize);
  }
}
```

### 3. Webhook Integration
Handle Aslan webhooks for real-time updates:

```javascript
app.post('/webhooks/aslan', (req, res) => {
  const event = req.body;
  
  switch (event.type) {
    case 'payment.succeeded':
      // Handle successful payment
      break;
    case 'payment.failed':
      // Handle failed payment
      break;
  }
});
```

## 🏗️ Core API Endpoints

### Authorization
```
POST /api/v1/authorize
```
Create payment authorization for an AI agent.

### Confirmation  
```
POST /api/v1/confirm
```
Execute a previously authorized payment.

### Status Check
```
GET /api/status
```
Check system health and status.

### Transaction History
```
GET /api/v1/transactions
```
Retrieve transaction history.

## 🔐 Authentication

All requests require an API key in the Authorization header:

```bash
Authorization: Bearer ak_live_your_api_key_here
```

## 📊 Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": {
    "id": "auth_1234567890",
    "amount": 2500,
    "status": "authorized"
  },
  "error": null
}
```

## 🛠️ Framework-Specific Examples

### Hugging Face Transformers
```python
from transformers import Agent
from aslan_client import AslanClient

class AslanTool:
    def __init__(self, api_key):
        self.client = AslanClient(api_key)
    
    def __call__(self, amount, description):
        return self.client.authorize(amount, description)

agent = Agent(model="gpt-4")
agent.tools.append(AslanTool("your_api_key"))
```

### AutoGen
```python
import autogen
from aslan_client import AslanClient

def purchase_function(amount, description):
    client = AslanClient("your_api_key")
    return client.authorize(amount, description)

assistant = autogen.AssistantAgent(
    name="purchase_assistant",
    functions=[purchase_function]
)
```

### Custom Framework
```javascript
// Your framework
class MyAIFramework {
  constructor() {
    this.tools = new Map();
  }
  
  addTool(name, func) {
    this.tools.set(name, func);
  }
}

// Aslan integration
const framework = new MyAIFramework();
const aslan = new AslanClient(process.env.ASLAN_API_KEY);

framework.addTool('purchase', aslan.authorize.bind(aslan));
framework.addTool('check_balance', aslan.checkLimits.bind(aslan));
```

## 📚 Learn More

- [Aslan API Documentation](https://aslanpay.xyz/docs)
- [REST API Best Practices](https://restfulapi.net/)
- [HTTP Status Codes](https://httpstatuses.com/)

## 🆘 Need Help?

- Check the [main documentation](../../README.md)
- Visit [aslanpay.xyz/docs](https://aslanpay.xyz/docs)
- Create an [issue on GitHub](https://github.com/coltonsakamoto/aslanpay/issues)
- Join our [Discord community](https://discord.gg/aslanpay) 