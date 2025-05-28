"""
AgentPay Control Tower Integration for LangChain
===============================================

This integration allows LangChain agents to use AgentPay's /v1/authorize → /confirm flow
for secure, controlled spending across any merchant on the internet.

Installation:
    pip install langchain requests

Usage:
    from langchain_agentpay import AgentPayTool
    
    tool = AgentPayTool(agent_token="your_jwt_token")
    result = tool.purchase("doordash.com", 25.99, "food", "Order lunch delivery")
"""

import requests
import json
from typing import Dict, Any, Optional
from langchain.tools import BaseTool
from langchain.pydantic_v1 import BaseModel, Field
from langchain.callbacks.manager import CallbackManagerForToolUse


class AgentPayInput(BaseModel):
    """Input schema for AgentPay purchases."""
    merchant: str = Field(description="Merchant domain (e.g., 'amazon.com', 'doordash.com')")
    amount: float = Field(description="Amount to spend in USD")
    category: str = Field(description="Purchase category: food, shopping, transportation, etc.")
    intent: str = Field(description="Clear description of what you're purchasing")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional purchase context")


class AgentPayTool(BaseTool):
    """
    LangChain tool for AgentPay Control Tower integration.
    
    Enables LangChain agents to make authorized purchases through AgentPay's
    universal commerce platform with real-time spending controls.
    """
    
    name = "agentpay_purchase"
    description = """
    Make authorized purchases through AgentPay Control Tower.
    
    This tool enables secure spending at ANY merchant with user-defined limits.
    Uses AgentPay's /v1/authorize → /confirm flow for maximum security.
    
    Parameters:
    - merchant: The website/merchant (e.g., 'amazon.com', 'uber.com')
    - amount: Dollar amount to spend (e.g., 25.99)
    - category: Purchase type (food, shopping, transportation, etc.)
    - intent: What you're buying (e.g., 'Order lunch delivery')
    """
    
    args_schema = AgentPayInput
    
    def __init__(self, agent_token: str, api_base: str = "https://api.agentpay.org"):
        super().__init__()
        self.agent_token = agent_token
        self.api_base = api_base.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {agent_token}',
            'Content-Type': 'application/json',
            'User-Agent': 'LangChain-AgentPay/1.0'
        })
    
    def _run(
        self,
        merchant: str,
        amount: float,
        category: str,
        intent: str,
        metadata: Optional[Dict[str, Any]] = None,
        run_manager: Optional[CallbackManagerForToolUse] = None,
    ) -> str:
        """Execute the AgentPay authorization and purchase flow."""
        
        try:
            # Step 1: Request Authorization from Control Tower
            auth_response = self._request_authorization(
                merchant, amount, category, intent, metadata
            )
            
            if not auth_response.get('authorized'):
                return f"❌ Authorization denied: {auth_response.get('reason', 'Unknown error')}"
            
            authorization_id = auth_response['authorizationId']
            scoped_token = auth_response.get('scopedToken')
            
            # Step 2: Simulate the actual purchase at the merchant
            # In real implementation, this would be where the agent interacts with the merchant
            purchase_result = self._simulate_merchant_purchase(
                merchant, amount, authorization_id, intent
            )
            
            if not purchase_result['success']:
                return f"❌ Purchase failed: {purchase_result['error']}"
            
            # Step 3: Confirm the transaction with AgentPay
            confirm_response = self._confirm_transaction(
                authorization_id, amount, purchase_result['transaction_details']
            )
            
            if not confirm_response.get('success'):
                return f"❌ Transaction confirmation failed: {confirm_response.get('error')}"
            
            # Success! Return formatted result
            return self._format_success_response(confirm_response, purchase_result)
            
        except Exception as e:
            return f"❌ AgentPay error: {str(e)}"
    
    def _request_authorization(self, merchant: str, amount: float, category: str, 
                             intent: str, metadata: Optional[Dict] = None) -> Dict:
        """Request spending authorization from AgentPay Control Tower."""
        
        payload = {
            'agentToken': self.agent_token,
            'merchant': merchant,
            'amount': amount,
            'category': category,
            'intent': intent
        }
        
        if metadata:
            payload['metadata'] = metadata
        
        response = self.session.post(f'{self.api_base}/v1/authorize', json=payload)
        response.raise_for_status()
        
        return response.json()
    
    def _simulate_merchant_purchase(self, merchant: str, amount: float, 
                                  auth_id: str, intent: str) -> Dict:
        """
        Simulate the actual purchase at the merchant.
        
        In real implementation, this would be where LangChain agents:
        - Navigate to the merchant website
        - Add items to cart
        - Complete the checkout process
        - Use the AgentPay authorization for payment
        """
        
        # For demo purposes, simulate a successful purchase
        import time
        import random
        
        # Simulate processing time
        time.sleep(0.5)
        
        # Simulate occasional failures for realism
        if random.random() < 0.05:  # 5% failure rate
            return {
                'success': False,
                'error': f'Merchant {merchant} temporarily unavailable'
            }
        
        # Simulate successful purchase
        order_id = f"ORDER_{int(time.time())}_{random.randint(1000, 9999)}"
        
        return {
            'success': True,
            'order_id': order_id,
            'merchant': merchant,
            'amount_charged': amount,
            'transaction_details': {
                'orderId': order_id,
                'merchant': merchant,
                'items': [intent],  # Simplified item list
                'timestamp': time.time(),
                'authorization_id': auth_id
            }
        }
    
    def _confirm_transaction(self, authorization_id: str, final_amount: float, 
                           transaction_details: Dict) -> Dict:
        """Confirm the completed transaction with AgentPay."""
        
        payload = {
            'finalAmount': final_amount,
            'transactionDetails': transaction_details
        }
        
        response = self.session.post(
            f'{self.api_base}/v1/authorize/{authorization_id}/confirm',
            json=payload
        )
        response.raise_for_status()
        
        return response.json()
    
    def _format_success_response(self, confirm_response: Dict, purchase_result: Dict) -> str:
        """Format a successful purchase response for LangChain."""
        
        transaction_id = confirm_response.get('transactionId')
        amount = confirm_response.get('amount', 0)
        platform_fee = confirm_response.get('platformFee', 0)
        total_charged = confirm_response.get('totalCharged', 0)
        payment_method = confirm_response.get('paymentMethod', {})
        
        return f"""✅ Purchase completed successfully!

🛍️ Order Details:
   • Merchant: {purchase_result['merchant']}
   • Order ID: {purchase_result['order_id']}
   • Amount: ${amount:.2f}
   • Platform Fee: ${platform_fee:.2f}
   • Total Charged: ${total_charged:.2f}

💳 Payment:
   • Method: {payment_method.get('type', 'N/A')} ending in {payment_method.get('last4', 'N/A')}
   • Transaction ID: {transaction_id}

🎯 AgentPay Control Tower:
   • Authorization: Pre-approved ✅
   • Security: Enterprise-grade 🔐
   • Speed: Fast authorization ⚡
   
The purchase has been completed and charged to your payment method."""

    async def _arun(self, *args, **kwargs) -> str:
        """Async version of the tool (delegates to sync version)."""
        return self._run(*args, **kwargs)


# Example LangChain agent using AgentPay
def create_agentpay_langchain_agent():
    """
    Example: Create a LangChain agent with AgentPay purchasing capabilities.
    """
    
    from langchain.agents import initialize_agent, Tool
    from langchain.agents import AgentType
    from langchain.llms import OpenAI
    
    # Initialize AgentPay tool
    agentpay_tool = AgentPayTool(
        agent_token="your_agentpay_jwt_token_here"
    )
    
    # Create additional tools as needed
    tools = [
        agentpay_tool,
        Tool(
            name="get_spending_limits",
            description="Check current spending limits and usage",
            func=lambda x: "Daily limit: $100, Spent today: $23.45, Remaining: $76.55"
        )
    ]
    
    # Initialize the LangChain agent
    llm = OpenAI(temperature=0)
    agent = initialize_agent(
        tools=tools,
        llm=llm,
        agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=True
    )
    
    return agent


# Usage Examples
if __name__ == "__main__":
    # Example 1: Direct tool usage
    print("=== AgentPay LangChain Integration Example ===\n")
    
    # Initialize the tool
    agentpay = AgentPayTool(
        agent_token="your_agentpay_jwt_token_here",
        api_base="http://localhost:3000"  # For local development
    )
    
    # Example purchase
    result = agentpay._run(
        merchant="doordash.com",
        amount=24.99,
        category="food",
        intent="Order chicken burrito bowl with guacamole for lunch",
        metadata={
            "urgency": "medium",
            "requested_by": "user_voice_command"
        }
    )
    
    print("Purchase Result:")
    print(result)
    
    # Example 2: Full LangChain agent
    print("\n=== Full LangChain Agent Example ===\n")
    
    try:
        agent = create_agentpay_langchain_agent()
        
        # Test the agent
        response = agent.run(
            "I'm hungry and want to order lunch from DoorDash. "
            "Order me a chicken bowl for around $25. Make sure it's within my spending limits."
        )
        
        print("Agent Response:")
        print(response)
        
    except Exception as e:
        print(f"Agent creation failed: {e}")
        print("Make sure you have langchain and openai installed and configured.")


"""
Integration Benefits for LangChain Developers:

✅ Universal Commerce: Works with ANY merchant (Amazon, DoorDash, Uber, etc.)
✅ Spending Controls: Real-time limits and user approval workflows  
✅ Security: Enterprise JWT tokens with proper scoping
✅ Speed: <400ms authorization (won't slow down your agents)
✅ Reliability: Idempotent requests prevent duplicate charges
✅ Monitoring: Complete audit trails and spending analytics

Get started:
1. Sign up at https://agentpay.com
2. Get your agent JWT token
3. Install: pip install langchain requests
4. Use AgentPayTool in your LangChain agents!
""" 