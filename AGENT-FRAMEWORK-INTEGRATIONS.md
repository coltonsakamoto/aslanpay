# 🚀 **AgentPay Control Tower: Universal AI Agent Integration**

## 🎯 **LangChain & CrewAI Integration with `/v1/authorize` → `/confirm` Flow**

AgentPay Control Tower now provides seamless integration with the most popular AI agent frameworks, enabling **universal commerce** across the entire internet with enterprise-grade spending controls.

---

## 🏗️ **Universal Authorization Flow**

### **The Standard Flow (Works with ALL frameworks)**
```
1. AI Agent: "I want to buy X from merchant Y for $Z"
     ↓
2. AgentPay: POST /v1/authorize (validates limits, grants authorization)
     ↓  
3. Agent: Executes purchase at merchant (browser automation, API, etc.)
     ↓
4. AgentPay: POST /v1/authorize/:id/confirm (charges card, records transaction)
     ↓
5. Complete: User gets receipt, spending tracked, limits updated
```

### **Why This Architecture Works**
- ✅ **Universal**: Works with ANY merchant (Amazon, DoorDash, Uber, etc.)
- ✅ **Secure**: Pre-authorization prevents runaway spending
- ✅ **Fast**: <400ms authorization (won't slow down agents)
- ✅ **Reliable**: Idempotent requests prevent duplicate charges
- ✅ **Compliant**: Complete audit trails for enterprise use

---

## 🦜 **LangChain Integration**

### **Installation**
```bash
pip install langchain requests
# Get your AgentPay token from https://agentpay.com
```

### **Basic Usage**
```python
from langchain_agentpay import AgentPayTool

# Initialize tool
agentpay = AgentPayTool(agent_token="your_jwt_token")

# Direct purchase
result = agentpay._run(
    merchant="doordash.com",
    amount=25.99,
    category="food", 
    intent="Order chicken burrito bowl for lunch"
)
print(result)  # ✅ Purchase completed successfully!
```

### **LangChain Agent Example**
```python
from langchain.agents import initialize_agent, AgentType
from langchain.llms import OpenAI
from langchain_agentpay import AgentPayTool

# Create agent with AgentPay capabilities
agentpay_tool = AgentPayTool(agent_token="your_token")
tools = [agentpay_tool]

llm = OpenAI(temperature=0)
agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True
)

# Agent can now make purchases!
response = agent.run(
    "I'm hungry. Order me lunch from DoorDash for around $25."
)
```

### **LangChain Authorization Flow**
```python
# Step 1: Request Authorization
auth_response = agentpay._request_authorization(
    merchant="doordash.com",
    amount=25.99,
    category="food",
    intent="Order lunch delivery"
)

if auth_response['authorized']:
    authorization_id = auth_response['authorizationId']
    
    # Step 2: Execute merchant purchase (your agent's logic)
    order_result = execute_doordash_order(authorization_id)
    
    # Step 3: Confirm transaction
    confirm_response = agentpay._confirm_transaction(
        authorization_id, 
        order_result['final_amount'],
        order_result['details']
    )
    
    print(f"✅ Purchase complete: {confirm_response['transactionId']}")
```

---

## 🤖 **CrewAI Integration**

### **Installation**
```bash
pip install crewai requests
# Get your AgentPay token from https://agentpay.com
```

### **Basic Usage**
```python
from crewai_agentpay import AgentPayTool

# Initialize tool
agentpay = AgentPayTool(agent_token="your_jwt_token")

# Purchase with key=value format
result = agentpay._run(
    "merchant=amazon.com,amount=49.99,category=shopping,intent=Buy wireless headphones"
)

# Or JSON format
import json
request = json.dumps({
    "merchant": "uber.com",
    "amount": 15.50,
    "category": "transportation", 
    "intent": "Ride to airport"
})
result = agentpay._run(request)
```

### **CrewAI Agent Example**
```python
from crewai import Agent
from crewai_agentpay import AgentPayTool, create_purchase_agent

# Create specialized purchase agent
agentpay_tool = AgentPayTool(agent_token="your_token")
purchase_agent = create_purchase_agent(agentpay_tool)

# Agent has access to AgentPay Control Tower
print(f"Agent role: {purchase_agent.role}")
print(f"Tools: {[tool.name for tool in purchase_agent.tools]}")
```

### **CrewAI Purchase Crew**
```python
from crewai import Crew, Task
from crewai_agentpay import create_purchase_crew

# Create complete purchase crew with validation
crew = create_purchase_crew()

# Execute purchase workflow
result = crew.kickoff({
    'purchase_request': 'Order lunch from DoorDash for $25'
})
```

### **CrewAI Authorization Flow**
```python
# Built into the CrewAI tool - handles the full flow automatically:
# 1. Parse request parameters
# 2. Request authorization from AgentPay
# 3. Execute purchase at merchant
# 4. Confirm transaction
# 5. Return formatted receipt

agentpay_tool = AgentPayTool(agent_token="your_token")
result = agentpay_tool._run(
    "merchant=doordash.com,amount=24.99,category=food,intent=Order chicken bowl"
)
# Returns: Complete purchase confirmation with receipt
```

---

## 🔗 **Cross-Framework Integration Patterns**

### **1. Shared Authorization Service**
```python
# Both LangChain and CrewAI agents can share the same AgentPay authorization
class SharedAgentPayService:
    def __init__(self, agent_token):
        self.agent_token = agent_token
        self.api_base = "https://api.agentpay.org"
    
    def authorize_purchase(self, merchant, amount, category, intent):
        """Universal authorization method for any framework"""
        # Common authorization logic used by both integrations
        pass
    
    def confirm_purchase(self, auth_id, final_amount, details):
        """Universal confirmation method for any framework"""
        # Common confirmation logic used by both integrations
        pass

# Use with LangChain
langchain_tool = AgentPayTool(agent_token, service=shared_service)

# Use with CrewAI  
crewai_tool = AgentPayTool(agent_token, service=shared_service)
```

### **2. Multi-Agent Coordination**
```python
# CrewAI agent requests authorization
crew_agent = AgentPayTool(agent_token="your_token")
auth_response = crew_agent._request_authorization(
    "amazon.com", 49.99, "shopping", "Buy headphones"
)

if auth_response['authorized']:
    # LangChain agent executes the purchase
    langchain_agent = AgentPayTool(agent_token="your_token")
    purchase_result = langchain_agent._execute_merchant_purchase(
        "amazon.com", 49.99, auth_response['authorizationId'], "Buy headphones"
    )
    
    # Either agent can confirm
    confirm_result = crew_agent._confirm_transaction(
        auth_response['authorizationId'],
        purchase_result['final_amount'],
        purchase_result['details']
    )
```

### **3. Parallel Purchase Execution**
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def parallel_purchases():
    """Execute multiple purchases across different frameworks"""
    
    purchases = [
        {"framework": "langchain", "merchant": "doordash.com", "amount": 25.99},
        {"framework": "crewai", "merchant": "amazon.com", "amount": 49.99},
        {"framework": "langchain", "merchant": "uber.com", "amount": 15.50}
    ]
    
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = []
        
        for purchase in purchases:
            if purchase["framework"] == "langchain":
                tool = LangChainAgentPayTool(agent_token="your_token")
            else:
                tool = CrewAIAgentPayTool(agent_token="your_token")
            
            future = executor.submit(tool.execute_purchase, purchase)
            futures.append(future)
        
        results = [future.result() for future in futures]
    
    return results
```

---

## 🛡️ **Security & Compliance Features**

### **Enterprise JWT Security**
```python
# Both integrations use secure scoped tokens
{
  "iss": "agentpay.com",           # Issuer validation
  "aud": "specific-merchant.com",   # Audience restriction
  "sub": "agent-id",               # Agent identity
  "iat": 1640995200,               # Issued at timestamp
  "exp": 1640995800,               # Expiration (10 minutes)
  "jti": "unique-token-id",        # Revocable token ID
  "scope": {                       # Spending restrictions
    "maxAmount": 2599,             # Max amount in cents
    "category": "food",            # Category restriction
    "merchant": "doordash.com",    # Merchant restriction
    "intent": "Order lunch"        # Purchase intent
  }
}
```

### **Spending Control Features**
- **Daily Limits**: `$100/day` (configurable per agent)
- **Transaction Limits**: `$500/transaction` (configurable)
- **Category Limits**: `food: $50/month, shopping: $200/month`
- **Velocity Limits**: `10 transactions/hour` (prevents abuse)
- **Emergency Stop**: Kill switch to disable all spending
- **Approval Workflows**: Large purchases require user approval

### **Audit & Compliance**
```python
# Every transaction creates complete audit trail
{
  "transactionId": "tx_1234567890",
  "authorizationId": "auth_abcdefgh", 
  "agentId": "agent_xyz",
  "framework": "langchain",           # Which framework initiated
  "merchant": "doordash.com",
  "amount": 25.99,
  "category": "food",
  "intent": "Order lunch delivery",
  "timestamp": "2024-01-15T12:30:45Z",
  "paymentMethod": "****4242",
  "status": "completed",
  "spendingLimits": {
    "dailyRemaining": 74.01,
    "monthlyRemaining": 150.00
  }
}
```

---

## 📊 **Integration Comparison**

| Feature | LangChain | CrewAI | Universal |
|---------|-----------|---------|-----------|
| **Authorization Flow** | ✅ `/v1/authorize` → `/confirm` | ✅ `/v1/authorize` → `/confirm` | ✅ Standard |
| **Merchant Support** | ✅ Any merchant | ✅ Any merchant | ✅ Universal |
| **Spending Controls** | ✅ Real-time limits | ✅ Real-time limits | ✅ Enterprise |
| **Security** | ✅ JWT tokens | ✅ JWT tokens | ✅ Scoped tokens |
| **Speed** | ✅ <400ms auth | ✅ <400ms auth | ✅ Optimized |
| **Multi-Agent** | ⚠️ Manual coordination | ✅ Built-in crews | ✅ Cross-framework |
| **Tool Format** | Single tool class | Single tool class | Compatible |
| **Error Handling** | ✅ Graceful | ✅ Graceful | ✅ Consistent |

---

## 🚀 **Getting Started (5 Minutes)**

### **1. Get AgentPay Token**
```bash
# Sign up at https://agentpay.com
# Create agent and get JWT token
export AGENTPAY_TOKEN="your_jwt_token_here"
```

### **2. Install Framework Integration**
```bash
# For LangChain
pip install langchain requests
wget https://raw.githubusercontent.com/agentpay/integrations/main/langchain-agentpay.py

# For CrewAI  
pip install crewai requests
wget https://raw.githubusercontent.com/agentpay/integrations/main/crewai-agentpay.py
```

### **3. Test Purchase**
```python
# LangChain test
from langchain_agentpay import AgentPayTool
tool = AgentPayTool(agent_token=os.getenv('AGENTPAY_TOKEN'))
result = tool._run(merchant="test.com", amount=1.99, category="test", intent="Test purchase")

# CrewAI test  
from crewai_agentpay import AgentPayTool
tool = AgentPayTool(agent_token=os.getenv('AGENTPAY_TOKEN'))
result = tool._run("merchant=test.com,amount=1.99,category=test,intent=Test purchase")
```

### **4. Production Deployment**
```python
# Configure spending limits
PUT /v1/agents/{token}/config
{
  "dailyLimitUSD": 200,
  "transactionLimitUSD": 100,
  "categoryLimits": {
    "food": 50,
    "shopping": 150,
    "transportation": 100
  },
  "emergencyStop": false
}

# Monitor spending
GET /v1/agents/{token}/config
# Returns current limits and spending summary
```

---

## 🏆 **Why Choose AgentPay Control Tower?**

### **Universal Commerce**
- Works with **ANY merchant** on the internet
- Not limited to specific APIs or integrations
- Browser automation, APIs, whatever works

### **Enterprise Security**
- Sub-400ms authorization (won't slow agents down)
- Enterprise JWT with proper claims (iss, aud, iat, exp, jti)
- Idempotent requests prevent duplicate charges
- Complete audit trails for compliance

### **Developer Experience**
- **Drop-in integration** with existing agent frameworks
- **Consistent API** across all frameworks
- **Comprehensive documentation** and examples
- **Real-time monitoring** and analytics

### **Cost Efficiency**
- Only **1% platform fee** (competitive with Stripe)
- **No setup fees** or monthly minimums
- **Free tier** for developers (<$100/month)
- **Volume discounts** for enterprise customers

---

## 🌍 **The Future of AI Agent Commerce**

**AgentPay Control Tower positions your AI agents to transact safely across the entire internet.**

**Every AI agent framework benefits from:**
- ✅ Universal merchant support
- ✅ Real-time spending controls
- ✅ Enterprise-grade security
- ✅ Complete compliance and audit trails

**This is how AI agents become truly autonomous while remaining safe and controlled.**

**Ready to transform your AI agents into autonomous commerce machines? Get started at https://agentpay.com 🚀** 