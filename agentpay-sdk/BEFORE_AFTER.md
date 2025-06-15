# Before vs After: AgentPay SDK

## 😤 BEFORE: Raw HTTP Integration (30+ lines)

```python
import requests
import json
import os

# Configuration management
BASE_URL = "https://api.agentpay.org"
AGENT_TOKEN = os.getenv("AGENTPAY_TOKEN")

def make_purchase(service, amount, params):
    if not AGENT_TOKEN:
        raise Exception("No agent token configured")
    
    # Build request payload
    payload = {
        "agentToken": AGENT_TOKEN,
        "service": service,
        "params": params
    }
    
    if amount:
        payload["params"]["maxPrice"] = amount
        payload["params"]["budget"] = amount
    
    # Handle HTTP request
    try:
        response = requests.post(
            f"{BASE_URL}/v1/purchase-direct",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "my-agent/1.0"
            },
            timeout=30
        )
        
        if response.status_code != 200:
            return {"success": False, "error": f"HTTP {response.status_code}"}
            
        data = response.json()
        
        if data.get("success"):
            return {
                "success": True,
                "transaction_id": data.get("transactionId"),
                "amount": data.get("amount"),
                "message": data.get("message")
            }
        else:
            return {
                "success": False,
                "error": data.get("error", "Unknown error")
            }
            
    except requests.RequestException as e:
        return {"success": False, "error": f"Network error: {str(e)}"}
    except json.JSONDecodeError:
        return {"success": False, "error": "Invalid JSON response"}

# Usage
result = make_purchase("food-delivery", 25.00, {"restaurant": "Pizza Palace"})
if result["success"]:
    print(f"Success: {result['transaction_id']}")
else:
    print(f"Failed: {result['error']}")
```

## 😍 AFTER: AgentPay SDK (5 lines)

```python
import agentpay

agentpay.configure(token="your_token")
result = agentpay.pay("food-delivery", 25.00, {"restaurant": "Pizza Palace"})

if result.success:
    print(f"Success: {result.transaction_id}")
else:
    print(f"Failed: {result.error}")
```

## 📊 The Difference

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Lines of Code** | 30+ lines | 5 lines | **83% reduction** |
| **Error Handling** | Manual | Built-in | **Zero boilerplate** |
| **HTTP Management** | Manual | Auto-handled | **Zero config** |
| **Token Management** | Manual | Auto-discovery | **Zero setup** |
| **Type Safety** | None | Full types | **Better DX** |
| **Documentation** | Write your own | Built-in examples | **Copy-paste ready** |

## 🚀 Real-World Examples

### LangChain Agent (Before)
```python
from langchain.agents import tool
import requests
import json

@tool
def purchase_item(service: str, budget: float, details: dict) -> str:
    """Make a purchase for the user"""
    try:
        response = requests.post(
            "https://api.agentpay.org/v1/purchase-direct",
            json={
                "agentToken": os.getenv("AGENTPAY_TOKEN"),
                "service": service,
                "params": {**details, "maxPrice": budget}
            },
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                return f"Purchase completed: {data.get('transactionId')}"
            else:
                return f"Purchase failed: {data.get('error')}"
        else:
            return f"HTTP error: {response.status_code}"
            
    except Exception as e:
        return f"Error: {str(e)}"
```

### LangChain Agent (After)
```python
from langchain.agents import tool
import agentpay

agentpay.configure(token="your_token")

@tool
def purchase_item(service: str, budget: float, details: dict) -> str:
    """Make a purchase for the user"""
    result = agentpay.pay(service, budget, details)
    return f"Purchase {'completed' if result.success else 'failed'}: {result.message}"
```

## 💡 Why This Matters

### For Developers
- **Faster prototyping** - Get purchasing working in minutes, not hours
- **Less bugs** - SDK handles edge cases and errors
- **Better DX** - Type hints, auto-complete, clear documentation
- **Framework agnostic** - Works with any AI library

### For Demos
- **Copy-paste ready** - Every example just works
- **Looks professional** - Clean, simple code
- **Easy to understand** - Non-technical audience can follow
- **Reliable** - No HTTP debugging during presentations

### For Production
- **Battle-tested** - SDK handles retries, timeouts, edge cases
- **Consistent** - Same API across all services
- **Maintainable** - Updates happen in SDK, not your code
- **Observable** - Built-in logging and error reporting

## 🎯 The Bottom Line

**Before:** Developers need to become AgentPay HTTP experts  
**After:** Developers focus on their AI logic, not payment plumbing

**Result:** 10x faster integration, fewer bugs, better demos, happier developers! 🚀 