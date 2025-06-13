# 🔑 AslanPay API Key Usage Guide

## ✅ FIXED: API Keys Now Working!

Your AslanPay API keys are now **fully functional** and properly connected to all payment endpoints.

## 🚀 Quick Start

### 1. Get Your API Key
1. Start server: `npm run dev`
2. Visit: https://aslanpay.xyz/auth.html
3. Sign up or log in
4. Copy your API key from the dashboard

### 2. Test Your API Key
```bash
# Set your API key
export TEST_API_KEY=ak_live_your_key_here

# Run the test
node test-api-keys.js
```

### 3. Use in API Requests

**Headers Required:**
```http
Authorization: Bearer ak_live_your_key_here
Content-Type: application/json
```

## 🛠️ API Endpoints

### Test API Key
```bash
curl -X GET https://aslanpay.xyz/api/v1/test \
  -H "Authorization: Bearer ak_live_your_key"
```

### Authorize Payment
```bash
curl -X POST https://aslanpay.xyz/api/v1/authorize \
  -H "Authorization: Bearer ak_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2500,
    "description": "AWS credits for AI agent",
    "agentId": "gpt-4-assistant",
    "metadata": {"purpose": "ai_training"}
  }'
```

### Confirm Payment
```bash
curl -X POST https://aslanpay.xyz/api/v1/confirm \
  -H "Authorization: Bearer ak_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "authorizationId": "auth_1234567890abcdef",
    "finalAmount": 2500
  }'
```

### Process Refund
```bash
curl -X POST https://aslanpay.xyz/api/v1/refund \
  -H "Authorization: Bearer ak_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn_1234567890",
    "amount": 1000,
    "reason": "customer_request"
  }'
```

## 🤖 AI Agent Integration

### OpenAI Function Calling
```javascript
import axios from 'axios';

const aslanApi = axios.create({
  baseURL: 'https://aslanpay.xyz/api/v1',
  headers: {
    'Authorization': `Bearer ${process.env.ASLAN_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Function for AI agents to make purchases
async function makePurchase(amount, description) {
  try {
    const auth = await aslanApi.post('/authorize', {
      amount,
      description,
      agentId: 'openai-assistant'
    });
    
    const payment = await aslanApi.post('/confirm', {
      authorizationId: auth.data.id
    });
    
    return payment.data;
  } catch (error) {
    console.error('Purchase failed:', error.response?.data);
    throw error;
  }
}
```

### LangChain Integration
```python
import requests
import os

class AslanPayTool:
    def __init__(self):
        self.api_key = os.getenv('ASLAN_API_KEY')
        self.base_url = 'https://aslanpay.xyz/api/v1'
        self.headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
    
    def make_purchase(self, amount_cents, description):
        # Authorize payment
        auth_response = requests.post(
            f'{self.base_url}/authorize',
            headers=self.headers,
            json={
                'amount': amount_cents,
                'description': description,
                'agentId': 'langchain-agent'
            }
        )
        
        # Confirm payment
        confirm_response = requests.post(
            f'{self.base_url}/confirm',
            headers=self.headers,
            json={'authorizationId': auth_response.json()['id']}
        )
        
        return confirm_response.json()
```

## ⚠️ Authentication Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `MISSING_API_KEY` | No Authorization header | Add `Authorization: Bearer ak_live_...` |
| `INVALID_API_KEY_FORMAT` | Wrong key format | Ensure key starts with `ak_live_` or `ak_test_` |
| `INVALID_API_KEY` | Key not found/revoked | Check key in dashboard, create new one if needed |
| `USER_NOT_FOUND` | User account deleted | Contact support |

## 🎯 What Changed

- ✅ **API Key Validation**: All payment endpoints now require valid API keys
- ✅ **User Context**: Requests are now tied to specific user accounts
- ✅ **Usage Tracking**: API key usage is monitored and logged
- ✅ **Better Errors**: Clear error messages with documentation links
- ✅ **Enhanced Security**: Prevents unauthorized payment access

## 🚀 Production Ready

Your API keys are now **production-ready** with:
- ✅ Proper authentication on all payment endpoints
- ✅ User isolation and security
- ✅ Usage tracking and analytics
- ✅ Clear error handling
- ✅ Full compatibility with AI frameworks

**Next Steps:**
1. Test with the provided test script
2. Integrate with your AI agents
3. Monitor usage in the dashboard
4. Scale to production!

---

**🦁 AslanPay - Payment Infrastructure for AI Agents** 