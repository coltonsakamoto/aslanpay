#!/usr/bin/env python3
"""
AgentPay SDK Demo - Dead Simple AI Agent Payments

This demo shows how easy it is to give any AI agent purchasing power.
Just 5 lines of code to go from zero to buying things!
"""

import agentpay
import os

def main():
    print("🤖 AgentPay SDK Demo")
    print("=" * 50)
    
    # Step 1: Configure (auto-loads from AGENTPAY_TOKEN env var if set)
    token = os.getenv("AGENTPAY_TOKEN", "demo_agent_token_123")
    agentpay.configure(token=token)
    print(f"✅ Configured with token: {token[:10]}...")
    
    print("\n🛍️ Testing Various Purchases:")
    print("-" * 30)
    
    # Step 2: Make purchases - dead simple!
    purchases = [
        ("food-delivery", 25.00, {"restaurant": "Pizza Palace", "items": ["Large Pizza"]}),
        ("gift-card", 50.00, {"brand": "amazon"}),
        ("sms", None, {"to": "+1234567890", "message": "Hello from AI agent!"}),
        ("flight", 400.00, {"from": "SFO", "to": "LAX", "date": "2025-02-01"}),
    ]
    
    for intent, amount, details in purchases:
        print(f"\n🔄 Purchasing: {intent}")
        
        # This is the magic - one line to buy anything!
        result = agentpay.pay(intent, amount, details)
        
        if result.success:
            print(f"   ✅ SUCCESS: {result.message}")
            print(f"   💰 Amount: ${result.amount}")
            print(f"   🔗 Transaction: {result.transaction_id}")
        else:
            print(f"   ❌ FAILED: {result.error}")
            print(f"   📝 Message: {result.message}")
    
    print("\n🎉 Demo Complete!")
    print("\nTo use in your AI agent:")
    print("1. pip install agentpay")
    print("2. agentpay.configure(token='your_token')")
    print("3. result = agentpay.pay(intent, amount, details)")
    print("4. Check result.success")
    print("5. Done! 🚀")

if __name__ == "__main__":
    main() 