# 🤖 OpenAI + Aslan Integration

Complete example showing how to integrate Aslan payment infrastructure with OpenAI's function calling capabilities.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install openai @aslanpay/sdk dotenv
```

### 2. Set Environment Variables

```bash
# Copy from project root
cp ../../.env.example .env

# Add your keys
OPENAI_API_KEY=your_openai_api_key
ASLAN_API_KEY=your_aslan_api_key
```

### 3. Run the Example

```bash
node basic-integration.js
```

## 📁 Files in this Directory

- `basic-integration.js` - Simple OpenAI function calling with Aslan
- `advanced-example.js` - Advanced multi-step purchasing workflow
- `function-definitions.js` - Reusable OpenAI function schemas
- `README.md` - This file

## 🎯 What This Example Demonstrates

✅ **OpenAI Function Calling** - GPT models can call Aslan payment functions  
✅ **Secure Authorization** - Proper API key handling and authentication  
✅ **Error Handling** - Robust error handling for payments  
✅ **Multi-step Workflows** - Authorization → Purchase → Confirmation  
✅ **Real-world Use Cases** - AWS credits, software subscriptions, etc.

## 🔧 Key Features

### Function Calling Schema
The example includes properly formatted OpenAI function schemas for:
- `authorize_payment` - Create payment authorization
- `confirm_payment` - Execute authorized payment
- `check_balance` - Check agent spending limits

### Error Handling
Comprehensive error handling for:
- Invalid payment amounts
- Insufficient balance
- API connectivity issues
- Authentication failures

### Security Best Practices
- API keys stored in environment variables
- Input validation and sanitization
- Secure token handling
- Audit trail logging

## 📚 Learn More

- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Aslan API Documentation](https://aslanpay.xyz/docs)
- [Full Demo](https://aslanpay.xyz/demo)

## 🆘 Need Help?

- Check the [main documentation](../../README.md)
- Visit [aslanpay.xyz/docs](https://aslanpay.xyz/docs)
- Create an [issue on GitHub](https://github.com/coltonsakamoto/aslanpay/issues) 