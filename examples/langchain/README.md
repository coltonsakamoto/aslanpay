# 🦜 LangChain + Aslan Integration

Complete example showing how to integrate Aslan payment capabilities into LangChain agents as custom tools.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install langchain @aslanpay/sdk dotenv
# OR for Python
pip install langchain aslanpay python-dotenv
```

### 2. Set Environment Variables

```bash
# Copy from project root
cp ../../.env.example .env

# Add your keys
ASLAN_API_KEY=your_aslan_api_key
OPENAI_API_KEY=your_openai_api_key  # Optional: for LLM backing
```

### 3. Run the Example

```bash
# Node.js version
node langchain-agent.js

# Python version  
python langchain_agent.py
```

## 📁 Files in this Directory

- `langchain-agent.js` - Node.js LangChain agent with Aslan tools
- `langchain_agent.py` - Python LangChain agent with Aslan tools  
- `payment-tools.js` - Reusable LangChain tool definitions
- `README.md` - This file

## 🎯 What This Example Demonstrates

✅ **LangChain Tools Integration** - Aslan payment functions as LangChain tools  
✅ **Agent Decision Making** - LangChain agent autonomously decides when to make purchases  
✅ **Chain of Thought** - Agent reasoning through purchase decisions  
✅ **Multi-step Workflows** - Check limits → Authorize → Execute → Confirm  
✅ **Error Handling** - Robust error handling in agent workflows

## 🔧 Key Features

### Payment Tools Available
- `authorize_payment` - Create payment authorization
- `confirm_payment` - Execute authorized payment  
- `check_spending_limits` - Check current limits and balance
- `get_transaction_history` - View past transactions

### Agent Capabilities
- **Smart Purchasing** - Agent can evaluate purchase requests
- **Budget Management** - Automatically checks spending limits
- **Risk Assessment** - Evaluates transaction safety
- **Receipt Management** - Tracks and organizes purchase confirmations

### Use Cases Covered
- Software subscriptions (AWS, GitHub, etc.)
- API credits and usage-based billing
- Digital asset purchases
- Service provider payments

## 📚 Learn More

- [LangChain Documentation](https://python.langchain.com/docs/get_started/introduction)
- [LangChain Tools Guide](https://python.langchain.com/docs/modules/agents/tools/)
- [Aslan API Documentation](https://aslanpay.xyz/docs)

## 🆘 Need Help?

- Check the [main documentation](../../README.md)
- Visit [aslanpay.xyz/docs](https://aslanpay.xyz/docs)
- Create an [issue on GitHub](https://github.com/coltonsakamoto/aslanpay/issues) 