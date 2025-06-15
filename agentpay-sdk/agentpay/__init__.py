"""
AgentPay SDK - Dead simple AI agent payments

Usage:
    import agentpay
    agentpay.configure(token="your_agent_token")
    result = agentpay.pay("food-delivery", 25.00, {"restaurant": "Pizza Palace"})
    print(result.success)  # True
"""

import os
import json
import requests
from typing import Optional, Dict, Any, Union
from dataclasses import dataclass

__version__ = "0.1.0"
__all__ = ["configure", "pay", "PaymentResult", "AgentPayError"]

# Global configuration
_config = {
    "token": None,
    "base_url": "https://api.agentpay.org",  # Production URL
    "timeout": 30
}

class AgentPayError(Exception):
    """Base exception for AgentPay SDK errors"""
    def __init__(self, message: str, code: Optional[str] = None, details: Optional[Dict] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}

@dataclass
class PaymentResult:
    """Result of a payment operation"""
    success: bool
    transaction_id: Optional[str] = None
    amount: Optional[float] = None
    service: Optional[str] = None
    message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    
    @property
    def failed(self) -> bool:
        """Check if payment failed"""
        return not self.success

def configure(
    token: Optional[str] = None,
    base_url: Optional[str] = None,
    timeout: Optional[int] = None
) -> None:
    """
    Configure AgentPay SDK
    
    Args:
        token: Agent token (can also be set via AGENTPAY_TOKEN env var)
        base_url: API base URL (defaults to production)
        timeout: Request timeout in seconds
    
    Example:
        agentpay.configure(token="agent_abc123")
    """
    global _config
    
    if token:
        _config["token"] = token
    elif os.getenv("AGENTPAY_TOKEN"):
        _config["token"] = os.getenv("AGENTPAY_TOKEN")
    
    if base_url:
        _config["base_url"] = base_url.rstrip("/")
    
    if timeout:
        _config["timeout"] = timeout

def pay(
    intent: str,
    amount: Optional[float] = None,
    details: Optional[Dict[str, Any]] = None,
    *,
    token: Optional[str] = None,
    direct_card: bool = True
) -> PaymentResult:
    """
    Make a payment with AgentPay
    
    Args:
        intent: What to buy (e.g., "food-delivery", "flight", "gift-card")
        amount: Maximum amount to spend (optional for some services)
        details: Service-specific parameters
        token: Override configured token
        direct_card: Use direct card charging (recommended)
    
    Returns:
        PaymentResult: Payment outcome with transaction details
    
    Raises:
        AgentPayError: If payment fails or configuration is invalid
    
    Examples:
        # Food delivery
        result = agentpay.pay("food-delivery", 25.00, {
            "restaurant": "Pizza Palace",
            "items": ["Large Pizza", "Soda"]
        })
        
        # Flight booking
        result = agentpay.pay("flight", 400.00, {
            "from": "SFO",
            "to": "LAX", 
            "date": "2025-02-01"
        })
        
        # Gift card
        result = agentpay.pay("gift-card", 50.00, {
            "brand": "amazon"
        })
    """
    # Get token from parameter, global config, or environment
    agent_token = token or _config["token"] or os.getenv("AGENTPAY_TOKEN")
    
    if not agent_token:
        raise AgentPayError(
            "No agent token provided. Call agentpay.configure(token='...') or set AGENTPAY_TOKEN env var",
            code="MISSING_TOKEN"
        )
    
    # Prepare request
    endpoint = "/v1/purchase-direct" if direct_card else "/v1/purchase"
    url = f"{_config['base_url']}{endpoint}"
    
    # Build payload
    payload = {
        "agentToken": agent_token,
        "service": intent,
        "params": details or {}
    }
    
    # Add amount to params if provided
    if amount is not None:
        payload["params"]["maxPrice"] = amount
        payload["params"]["budget"] = amount
    
    # Make HTTP request
    try:
        response = requests.post(
            url,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": f"agentpay-python/{__version__}",
                "X-SDK-Version": __version__
            },
            timeout=_config["timeout"]
        )
        
        # Parse response
        try:
            data = response.json()
        except json.JSONDecodeError:
            raise AgentPayError(
                f"Invalid JSON response from AgentPay API (status {response.status_code})",
                code="INVALID_RESPONSE"
            )
        
        # Handle success
        if response.status_code == 200 and data.get("success"):
            return PaymentResult(
                success=True,
                transaction_id=data.get("transactionId"),
                amount=data.get("amount"),
                service=data.get("service"),
                message=data.get("message"),
                details=data.get("details", {})
            )
        
        # Handle approval required (direct card only)
        elif response.status_code == 202 and data.get("requiresApproval"):
            return PaymentResult(
                success=False,
                error="approval_required",
                message=data.get("message", "Purchase requires user approval"),
                details={
                    "approval_id": data.get("approvalId"),
                    "action": data.get("action"),
                    "estimated_amount": data.get("estimatedAmount")
                }
            )
        
        # Handle errors
        else:
            error_message = data.get("error", f"Request failed with status {response.status_code}")
            return PaymentResult(
                success=False,
                error=data.get("code", "UNKNOWN_ERROR"),
                message=error_message,
                details=data.get("details", {})
            )
            
    except requests.RequestException as e:
        raise AgentPayError(
            f"Network error connecting to AgentPay API: {str(e)}",
            code="NETWORK_ERROR",
            details={"original_error": str(e)}
        )

# Convenience functions for common use cases
def buy_food(restaurant: str, budget: float = 30.0, **kwargs) -> PaymentResult:
    """Order food delivery"""
    return pay("food-delivery", budget, {"restaurant": restaurant, **kwargs})

def book_flight(from_city: str, to_city: str, budget: float = 500.0, **kwargs) -> PaymentResult:
    """Book a flight"""
    return pay("flight", budget, {"from": from_city, "to": to_city, **kwargs})

def buy_gift_card(brand: str, amount: float) -> PaymentResult:
    """Buy a gift card"""
    return pay("gift-card", amount, {"brand": brand})

def send_sms(phone: str, message: str) -> PaymentResult:
    """Send an SMS message"""
    return pay("sms", None, {"to": phone, "message": message})

# Auto-configure from environment on import
if os.getenv("AGENTPAY_TOKEN"):
    configure() 