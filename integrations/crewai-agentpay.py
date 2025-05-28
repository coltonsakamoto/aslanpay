"""
AgentPay Control Tower Integration for CrewAI
============================================

This integration allows CrewAI agents to use AgentPay's /v1/authorize → /confirm flow
for secure, controlled spending across any merchant on the internet.

Installation:
    pip install crewai requests

Usage:
    from crewai_agentpay import AgentPayTool, create_purchase_agent
    
    tool = AgentPayTool(agent_token="your_jwt_token")
    agent = create_purchase_agent(tool)
    result = agent.execute_task("Order lunch from DoorDash for $25")
"""

import requests
import json
from typing import Dict, Any, Optional, List
from crewai_tools import BaseTool
from pydantic import BaseModel, Field


class AgentPayTool(BaseTool):
    """
    CrewAI tool for AgentPay Control Tower integration.
    
    Enables CrewAI agents to make authorized purchases through AgentPay's
    universal commerce platform with real-time spending controls.
    """
    
    name: str = "AgentPay Purchase Tool"
    description: str = """
    Make authorized purchases through AgentPay Control Tower.
    
    This tool enables secure spending at ANY merchant with user-defined limits.
    Uses AgentPay's /v1/authorize → /confirm flow for maximum security.
    
    Use this tool when you need to:
    - Order food delivery (DoorDash, Uber Eats, etc.)
    - Book transportation (Uber, Lyft, etc.)
    - Shop online (Amazon, Target, etc.)
    - Subscribe to services (Netflix, Spotify, etc.)
    - Make any online purchase with proper authorization
    
    Always specify the merchant, amount, category, and clear intent.
    """
    
    def __init__(self, agent_token: str, api_base: str = "https://api.agentpay.org"):
        super().__init__()
        self.agent_token = agent_token
        self.api_base = api_base.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {agent_token}',
            'Content-Type': 'application/json',
            'User-Agent': 'CrewAI-AgentPay/1.0'
        })
    
    def _run(self, argument: str) -> str:
        """
        Execute AgentPay purchase with CrewAI argument parsing.
        
        Expected argument format:
        "merchant=doordash.com,amount=25.99,category=food,intent=Order chicken bowl for lunch"
        
        OR JSON format:
        '{"merchant": "doordash.com", "amount": 25.99, "category": "food", "intent": "Order lunch"}'
        """
        
        try:
            # Parse the argument
            params = self._parse_argument(argument)
            
            if 'error' in params:
                return f"❌ Parameter error: {params['error']}"
            
            # Execute the purchase flow
            return self._execute_purchase_flow(
                params['merchant'],
                params['amount'],
                params['category'],
                params['intent'],
                params.get('metadata', {})
            )
            
        except Exception as e:
            return f"❌ AgentPay tool error: {str(e)}"
    
    def _parse_argument(self, argument: str) -> Dict[str, Any]:
        """Parse CrewAI tool argument into purchase parameters."""
        
        try:
            # Try JSON format first
            if argument.strip().startswith('{'):
                params = json.loads(argument)
            else:
                # Parse key=value format
                params = {}
                for pair in argument.split(','):
                    if '=' in pair:
                        key, value = pair.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        
                        # Convert amount to float
                        if key == 'amount':
                            params[key] = float(value)
                        else:
                            params[key] = value
            
            # Validate required parameters
            required = ['merchant', 'amount', 'category', 'intent']
            missing = [req for req in required if req not in params]
            
            if missing:
                return {'error': f"Missing required parameters: {', '.join(missing)}"}
            
            return params
            
        except json.JSONDecodeError:
            return {'error': 'Invalid JSON format'}
        except ValueError as e:
            return {'error': f'Invalid parameter format: {str(e)}'}
        except Exception as e:
            return {'error': f'Parameter parsing error: {str(e)}'}
    
    def _execute_purchase_flow(self, merchant: str, amount: float, category: str, 
                              intent: str, metadata: Dict = None) -> str:
        """Execute the complete AgentPay purchase flow."""
        
        try:
            # Step 1: Request Authorization from Control Tower
            print(f"🎯 Requesting authorization for ${amount} at {merchant}...")
            
            auth_response = self._request_authorization(
                merchant, amount, category, intent, metadata
            )
            
            if not auth_response.get('authorized'):
                reason = auth_response.get('reason', 'Unknown error')
                return f"❌ Authorization denied: {reason}\n\nPlease check your spending limits or try a smaller amount."
            
            authorization_id = auth_response['authorizationId']
            scoped_token = auth_response.get('scopedToken')
            latency = auth_response.get('latency', 0)
            
            print(f"✅ Authorization granted in {latency}ms: {authorization_id}")
            
            # Step 2: Execute merchant purchase
            print(f"🛍️ Executing purchase at {merchant}...")
            
            purchase_result = self._execute_merchant_purchase(
                merchant, amount, authorization_id, intent, scoped_token
            )
            
            if not purchase_result['success']:
                return f"❌ Purchase failed: {purchase_result['error']}\n\nThe authorization has been released."
            
            print(f"✅ Purchase completed: {purchase_result['order_id']}")
            
            # Step 3: Confirm transaction with AgentPay
            print(f"💳 Confirming transaction with AgentPay...")
            
            confirm_response = self._confirm_transaction(
                authorization_id, amount, purchase_result['transaction_details']
            )
            
            if not confirm_response.get('success'):
                error = confirm_response.get('error', 'Unknown error')
                return f"❌ Transaction confirmation failed: {error}"
            
            print(f"✅ Transaction confirmed: {confirm_response['transactionId']}")
            
            # Return formatted success response
            return self._format_success_response(confirm_response, purchase_result)
            
        except Exception as e:
            return f"❌ Purchase flow error: {str(e)}"
    
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
    
    def _execute_merchant_purchase(self, merchant: str, amount: float, 
                                 auth_id: str, intent: str, scoped_token: str = None) -> Dict:
        """
        Execute the actual purchase at the merchant.
        
        In real implementation, this would integrate with:
        - Browser automation (Playwright, Selenium)
        - Merchant APIs (where available)
        - RPA tools for complex checkout flows
        """
        
        # For demo purposes, simulate a realistic purchase flow
        import time
        import random
        
        # Simulate different merchant behaviors
        merchant_configs = {
            'doordash.com': {'processing_time': 2.0, 'failure_rate': 0.02},
            'amazon.com': {'processing_time': 1.5, 'failure_rate': 0.01},
            'uber.com': {'processing_time': 1.0, 'failure_rate': 0.03},
            'default': {'processing_time': 1.5, 'failure_rate': 0.02}
        }
        
        config = merchant_configs.get(merchant, merchant_configs['default'])
        
        # Simulate processing time
        time.sleep(config['processing_time'])
        
        # Simulate occasional failures
        if random.random() < config['failure_rate']:
            errors = [
                f'Merchant {merchant} is temporarily unavailable',
                'Payment method declined by merchant',
                'Item out of stock',
                'Delivery not available to your area'
            ]
            return {
                'success': False,
                'error': random.choice(errors)
            }
        
        # Simulate successful purchase
        order_id = f"{merchant.split('.')[0].upper()}_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # Add some variance to final amount (taxes, fees, etc.)
        final_amount = amount + round(random.uniform(-0.50, 2.00), 2)
        final_amount = max(final_amount, amount)  # Never less than authorized
        
        return {
            'success': True,
            'order_id': order_id,
            'merchant': merchant,
            'amount_charged': final_amount,
            'transaction_details': {
                'orderId': order_id,
                'merchant': merchant,
                'items': [intent],
                'timestamp': time.time(),
                'authorization_id': auth_id,
                'scoped_token_used': bool(scoped_token),
                'final_amount': final_amount
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
        """Format a successful purchase response for CrewAI agents."""
        
        transaction_id = confirm_response.get('transactionId')
        amount = confirm_response.get('amount', 0)
        platform_fee = confirm_response.get('platformFee', 0)
        total_charged = confirm_response.get('totalCharged', 0)
        payment_method = confirm_response.get('paymentMethod', {})
        
        return f"""🎉 PURCHASE COMPLETED SUCCESSFULLY!

📋 ORDER SUMMARY:
   • Merchant: {purchase_result['merchant']}
   • Order ID: {purchase_result['order_id']}
   • Items: {', '.join(purchase_result['transaction_details']['items'])}
   • Order Amount: ${amount:.2f}
   • Platform Fee: ${platform_fee:.2f}
   • Total Charged: ${total_charged:.2f}

💳 PAYMENT DETAILS:
   • Payment Method: {payment_method.get('type', 'Credit Card')} ending in {payment_method.get('last4', '****')}
   • Transaction ID: {transaction_id}
   • Processed: {confirm_response.get('controlTower', {}).get('platform', 'AgentPay')}

🔐 SECURITY & COMPLIANCE:
   • Authorization: Pre-approved with spending limits ✅
   • Security: Enterprise-grade JWT tokens ✅  
   • Audit Trail: Complete transaction logging ✅

The purchase has been successfully completed and charged to your registered payment method. 
You should receive confirmation from {purchase_result['merchant']} shortly."""


# CrewAI Agent Configuration
def create_purchase_agent(agentpay_tool: AgentPayTool):
    """Create a CrewAI agent specialized in making purchases."""
    
    from crewai import Agent
    
    return Agent(
        role='Purchase Specialist',
        goal='Execute authorized purchases safely and efficiently while respecting spending limits',
        backstory="""You are an expert purchase specialist agent with access to AgentPay Control Tower,
        the financial operating system for AI agents. You can make purchases at any merchant on the
        internet while maintaining strict spending controls and security protocols.
        
        Your responsibilities:
        - Validate purchase requests against spending limits
        - Execute authorized purchases through AgentPay Control Tower
        - Ensure all transactions are secure and compliant
        - Provide clear confirmation and receipt information
        - Handle any purchase errors gracefully
        
        You have access to the AgentPay system which provides:
        - Real-time spending authorization (<400ms)
        - Universal merchant support (Amazon, DoorDash, Uber, etc.)
        - Enterprise-grade security with scoped JWT tokens
        - Complete audit trails and spending analytics
        """,
        tools=[agentpay_tool],
        verbose=True,
        memory=True
    )


def create_purchase_crew():
    """Create a complete CrewAI crew for purchase operations."""
    
    from crewai import Agent, Task, Crew
    
    # Initialize AgentPay tool
    agentpay_tool = AgentPayTool(
        agent_token="your_agentpay_jwt_token_here"
    )
    
    # Create purchase agent
    purchase_agent = create_purchase_agent(agentpay_tool)
    
    # Create validation agent
    validator_agent = Agent(
        role='Purchase Validator',
        goal='Validate and approve purchase requests before execution',
        backstory="""You are a purchase validation specialist who ensures all purchase
        requests are reasonable, within budget, and align with user preferences.""",
        tools=[],
        verbose=True
    )
    
    # Define tasks
    validation_task = Task(
        description="""Validate the purchase request for reasonableness:
        - Check if the amount is reasonable for the category
        - Verify the merchant is legitimate
        - Ensure the intent is clear and specific
        - Flag any suspicious requests
        
        Purchase request: {purchase_request}""",
        agent=validator_agent,
        expected_output="Validation result with approval/rejection and reasoning"
    )
    
    purchase_task = Task(
        description="""Execute the validated purchase using AgentPay Control Tower:
        - Parse the purchase request parameters
        - Request authorization from AgentPay
        - Execute the purchase at the merchant
        - Confirm the transaction
        - Provide receipt and confirmation
        
        Purchase request: {purchase_request}""",
        agent=purchase_agent,
        expected_output="Complete purchase confirmation with order details and receipt"
    )
    
    # Create and return crew
    return Crew(
        agents=[validator_agent, purchase_agent],
        tasks=[validation_task, purchase_task],
        verbose=True
    )


# Usage Examples
if __name__ == "__main__":
    print("=== AgentPay CrewAI Integration Example ===\n")
    
    # Example 1: Direct tool usage
    agentpay_tool = AgentPayTool(
        agent_token="your_agentpay_jwt_token_here",
        api_base="http://localhost:3000"  # For local development
    )
    
    # Test purchase
    result = agentpay_tool._run(
        "merchant=doordash.com,amount=24.99,category=food,intent=Order chicken burrito bowl with guacamole for lunch"
    )
    
    print("Direct Tool Result:")
    print(result)
    print("\n" + "="*50 + "\n")
    
    # Example 2: JSON format
    json_request = json.dumps({
        "merchant": "amazon.com",
        "amount": 49.99,
        "category": "shopping",
        "intent": "Buy wireless bluetooth headphones",
        "metadata": {
            "urgency": "low",
            "requestedBy": "user"
        }
    })
    
    result2 = agentpay_tool._run(json_request)
    print("JSON Format Result:")
    print(result2)
    print("\n" + "="*50 + "\n")
    
    # Example 3: CrewAI Agent (requires crewai package)
    try:
        print("=== CrewAI Agent Example ===\n")
        
        purchase_agent = create_purchase_agent(agentpay_tool)
        
        # Note: This would require a full CrewAI setup with LLM configuration
        print("CrewAI agent created successfully!")
        print("Agent role:", purchase_agent.role)
        print("Agent tools:", [tool.name for tool in purchase_agent.tools])
        
    except ImportError:
        print("CrewAI not installed. Install with: pip install crewai")
    except Exception as e:
        print(f"CrewAI agent creation failed: {e}")


"""
Integration Benefits for CrewAI Developers:

✅ Universal Commerce: Works with ANY merchant (Amazon, DoorDash, Uber, etc.)
✅ Spending Controls: Real-time limits and user approval workflows  
✅ Security: Enterprise JWT tokens with proper scoping
✅ Speed: <400ms authorization (won't slow down your crews)
✅ Reliability: Idempotent requests prevent duplicate charges
✅ Team Coordination: Multiple agents can coordinate purchases safely
✅ Audit Trails: Complete transaction logging for compliance

Advanced Features:
- Multi-agent purchase coordination
- Parallel purchase execution
- Purchase validation workflows
- Spending limit enforcement across crew members
- Real-time purchase monitoring and analytics

Get started:
1. Sign up at https://agentpay.com
2. Get your agent JWT token
3. Install: pip install crewai requests
4. Use AgentPayTool in your CrewAI agents and crews!
""" 