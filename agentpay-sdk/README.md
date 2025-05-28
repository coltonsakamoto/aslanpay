# AgentPay Python SDK

> **Give any AI agent purchasing power in 5 lines of code**

The AgentPay SDK makes it dead simple for AI agents to make real-world purchases. No complex HTTP requests, no authentication headers to manage - just pure simplicity.

## 🚀 Quick Start

### Installation
```bash
pip install agentpay
```

### Basic Usage (Copy-Paste Ready!)
```python
import agentpay

# Configure once
agentpay.configure(token="your_agent_token")

# Buy anything in one line
result = agentpay.pay("food-delivery", 25.00, {"restaurant": "Pizza Palace"})

if result.success:
    print(f"✅ Ordered! Transaction: {result.transaction_id}")
else:
    print(f"❌ Failed: {result.error}")
```

**That's it!** Your AI agent can now make purchases.

## 📋 Copy-Paste Examples

### 🍕 Food Delivery
```python
import agentpay
agentpay.configure(token="agent_abc123")

result = agentpay.pay("food-delivery", 30.00, {
    "restaurant": "Pizza Palace",
    "items": ["Large Pepperoni Pizza", "Coke"],
    "delivery_instructions": "Ring doorbell"
})

print("Ordered!" if result.success else f"Failed: {result.error}")
```

### ✈️ Flight Booking
```python
import agentpay
agentpay.configure(token="agent_abc123")

result = agentpay.pay("flight", 400.00, {
    "from": "SFO",
    "to": "LAX",
    "date": "2025-02-01",
    "passengers": 1
})

print(f"Flight booked: {result.transaction_id}" if result.success else f"Booking failed: {result.error}")
```

### 🎁 Gift Cards
```python
import agentpay
agentpay.configure(token="agent_abc123")

result = agentpay.pay("gift-card", 50.00, {"brand": "amazon"})
print(f"Gift card purchased: ${result.amount}" if result.success else f"Failed: {result.error}")
```

### 📱 SMS Messages
```python
import agentpay
agentpay.configure(token="agent_abc123")

result = agentpay.pay("sms", None, {
    "to": "+1234567890",
    "message": "Your order is ready for pickup!"
})

print("Message sent!" if result.success else f"Failed: {result.error}")
```

## 🎯 Framework Integrations

### LangChain Agent
```python
from langchain.agents import tool
import agentpay

agentpay.configure(token="agent_abc123")

@tool
def purchase_item(intent: str, budget: float, details: dict) -> str:
    """Make a purchase for the user"""
    result = agentpay.pay(intent, budget, details)
    return f"Purchase {'completed' if result.success else 'failed'}: {result.message}"

# Now your LangChain agent can make purchases!
```

### AutoGPT Integration
```python
import agentpay
from autogpt.agent import Agent

class PurchasingAgent(Agent):
    def __init__(self):
        super().__init__()
        agentpay.configure(token=self.config.agentpay_token)
    
    def buy_item(self, intent, budget, details):
        result = agentpay.pay(intent, budget, details)
        return result.success
```

### Custom AI Agent
```python
import agentpay

class MyAIAssistant:
    def __init__(self, agentpay_token):
        agentpay.configure(token=agentpay_token)
    
    def handle_purchase_request(self, user_input):
        # Your AI logic here...
        if "order pizza" in user_input.lower():
            result = agentpay.pay("food-delivery", 25.00, {
                "restaurant": "Pizza Palace"
            })
            return f"Pizza ordered!" if result.success else "Order failed"
```

## 🔧 Configuration

### Environment Variables (Recommended)
```bash
export AGENTPAY_TOKEN="your_agent_token"
```

```python
import agentpay
# Token automatically loaded from environment
result = agentpay.pay("gift-card", 25.00, {"brand": "starbucks"})
```

### Programmatic Configuration
```python
import agentpay

agentpay.configure(
    token="your_agent_token",
    base_url="https://api.agentpay.org",  # Default
    timeout=30  # Request timeout in seconds
)
```

### Per-Request Token Override
```python
result = agentpay.pay(
    "food-delivery", 
    25.00, 
    {"restaurant": "Pizza Palace"},
    token="different_token"
)
```

## 📊 Response Format

```python
@dataclass
class PaymentResult:
    success: bool                    # True if payment succeeded
    transaction_id: str             # Unique transaction identifier
    amount: float                   # Actual amount charged
    service: str                    # Service that was purchased
    message: str                    # Human-readable result message
    details: dict                   # Service-specific details
    error: str                      # Error code if failed
```

### Success Example
```python
PaymentResult(
    success=True,
    transaction_id="txn_abc123",
    amount=25.50,
    service="food-delivery",
    message="Order placed successfully",
    details={"order_id": "ord_456", "eta": "30 minutes"}
)
```

### Error Example
```python
PaymentResult(
    success=False,
    error="insufficient_funds",
    message="Daily spending limit exceeded",
    details={"daily_limit": 100.00, "spent_today": 95.00}
)
```

## 🛍️ Supported Services

| Service | Intent | Example |
|---------|--------|---------|
| **Food Delivery** | `food-delivery` | Pizza, groceries, restaurants |
| **Flight Booking** | `flight` | Domestic and international flights |
| **Hotel Booking** | `hotel` | Hotel reservations |
| **Shopping** | `shopping` | Amazon, retail purchases |
| **Gift Cards** | `gift-card` | Amazon, Starbucks, Target, etc. |
| **SMS Messages** | `sms` | Real SMS via Twilio |
| **Phone Calls** | `call` | Real phone calls |
| **Domain Registration** | `domain` | .com, .org, etc. |
| **Cloud Credits** | `aws-credits` | AWS, GCP credits |
| **Software Subscriptions** | `saas` | Slack, Notion, GitHub |

## 🛡️ Safety Features

AgentPay includes built-in safety controls:

- **Daily spending limits** - Prevent runaway costs
- **Transaction limits** - Maximum per-purchase amounts
- **Category limits** - Separate budgets for different services
- **Approval workflows** - User approval for large purchases
- **Emergency stop** - Instant kill switch
- **Velocity controls** - Rate limiting for purchases

## 🔧 Advanced Usage

### Convenience Functions
```python
import agentpay

# Shorthand for common purchases
agentpay.buy_food("Pizza Palace", budget=30.00)
agentpay.book_flight("SFO", "LAX", budget=400.00)
agentpay.buy_gift_card("amazon", 50.00)
agentpay.send_sms("+1234567890", "Hello!")
```

### Error Handling
```python
from agentpay import AgentPayError

try:
    result = agentpay.pay("flight", 500.00, {"from": "SFO", "to": "LAX"})
    if not result.success:
        print(f"Purchase failed: {result.error}")
except AgentPayError as e:
    print(f"SDK error: {e.message} (code: {e.code})")
```

### Approval Workflows
```python
result = agentpay.pay("flight", 800.00, {"from": "SFO", "to": "NYC"})

if result.error == "approval_required":
    print(f"Purchase requires approval: {result.details['approval_id']}")
    # User will receive notification to approve/deny
```

## 🌟 Why AgentPay SDK?

- **5-line integration** - From zero to purchasing in minutes
- **Copy-paste examples** - Every demo just works
- **Auto-handles everything** - HTTP, auth, retries, errors
- **Type-safe** - Full Python type hints
- **Framework agnostic** - Works with any AI framework
- **Production ready** - Built-in safety and error handling

## 📚 Documentation

- **[API Reference](https://docs.agentpay.org/api)** - Complete API documentation
- **[SpendPolicy](https://spendpolicy.org)** - Standard for AI agent spending controls
- **[Examples](https://github.com/agentpay/examples)** - Real-world integration examples
- **[Dashboard](https://dashboard.agentpay.org)** - Manage agents and view transactions

## 🤝 Support

- **GitHub Issues**: [agentpay/agentpay-python](https://github.com/agentpay/agentpay-python/issues)
- **Email**: hello@agentpay.org
- **Discord**: [Join our community](https://discord.gg/agentpay)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built by [AgentPay](https://agentpay.org) - Making AI agent commerce safe and accessible for everyone.** 🚀 