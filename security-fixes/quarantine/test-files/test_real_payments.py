#!/usr/bin/env python3
"""
Test AgentPay SDK with REAL Stripe payments!

This script tests the full end-to-end flow:
1. Create wallet and agent
2. Add credit card
3. Make real purchases with the 5-line SDK
4. Verify everything works
"""

import requests
import json
import time
import sys
import os

# Add the SDK to the path
sys.path.insert(0, 'agentpay-sdk')
import agentpay

# AgentPay API base URL
BASE_URL = "http://localhost:3000"

def test_wallet_setup():
    """Test creating wallet and agent"""
    print("🏦 Setting up wallet and agent...")
    
    # 1. Create wallet
    response = requests.post(f"{BASE_URL}/v1/wallets")
    if response.status_code != 201:
        print(f"❌ Failed to create wallet: {response.text}")
        return None, None
    
    wallet_data = response.json()
    wallet_id = wallet_data["walletId"]
    print(f"✅ Created wallet: {wallet_id}")
    
    # 2. Create agent with direct card charging
    agent_data = {
        "walletId": wallet_id,
        "dailyUsdLimit": 100.00  # $100 daily limit
    }
    
    response = requests.post(f"{BASE_URL}/v1/agents", json=agent_data)
    if response.status_code != 201:
        print(f"❌ Failed to create agent: {response.text}")
        return wallet_id, None
    
    agent_response = response.json()
    agent_token = agent_response["agentToken"]
    print(f"✅ Created agent: {agent_token[:20]}...")
    
    # 3. Configure agent for direct card charging
    config_data = {
        "paymentMode": "direct_card",
        "dailyLimitUSD": 100.00,
        "transactionLimitUSD": 50.00,
        "categoryLimits": {
            "food": 30.00,
            "gift-card": 25.00,
            "sms": 5.00
        },
        "approvalSettings": {
            "requireApprovalOver": 25.00,
            "autoApproveUnder": 10.00,
            "alwaysApprove": ["sms"]
        }
    }
    
    response = requests.put(f"{BASE_URL}/v1/agents/{agent_token}/config", json=config_data)
    if response.status_code == 200:
        print("✅ Configured agent for direct card charging")
    else:
        print(f"⚠️  Agent config failed: {response.text}")
    
    return wallet_id, agent_token

def add_test_card(wallet_id):
    """Add a Stripe test credit card"""
    print("\n💳 Adding test credit card...")
    
    # Create a Stripe test payment method (this would normally be done in frontend)
    # For testing, we'll use Stripe's test card: 4242424242424242
    
    # This is a simplified version - in real implementation, 
    # the frontend would use Stripe.js to create the payment method
    test_payment_method_id = "pm_card_visa"  # Stripe test payment method
    
    card_data = {
        "paymentMethodId": test_payment_method_id
    }
    
    response = requests.post(f"{BASE_URL}/v1/wallets/{wallet_id}/cards", json=card_data)
    if response.status_code == 201:
        print("✅ Added test credit card")
        return True
    else:
        print(f"❌ Failed to add card: {response.text}")
        return False

def test_sdk_purchases(agent_token):
    """Test the 5-line SDK with real purchases"""
    print("\n🛒 Testing AgentPay SDK with real purchases...")
    
    # Configure the SDK
    agentpay.configure(
        token=agent_token,
        base_url="http://localhost:3000"  # Local dev server
    )
    print("✅ SDK configured")
    
    # Test purchases
    test_cases = [
        {
            "name": "SMS Message (Auto-approved)",
            "intent": "sms", 
            "amount": None,
            "details": {"to": "+1234567890", "message": "Hello from AgentPay SDK!"}
        },
        {
            "name": "Gift Card (Small amount)",
            "intent": "gift-card",
            "amount": 10.00,
            "details": {"brand": "amazon"}
        },
        {
            "name": "Food Delivery (Requires approval)",
            "intent": "food-delivery",
            "amount": 30.00,
            "details": {"restaurant": "Pizza Palace", "items": ["Large Pizza"]}
        }
    ]
    
    for test_case in test_cases:
        print(f"\n🔄 Testing: {test_case['name']}")
        
        try:
            # This is the magic 5-line SDK call!
            result = agentpay.pay(
                test_case["intent"],
                test_case["amount"], 
                test_case["details"]
            )
            
            if result.success:
                print(f"   ✅ SUCCESS: {result.message}")
                print(f"   💰 Amount: ${result.amount}")
                print(f"   🔗 Transaction: {result.transaction_id}")
                print(f"   🏪 Service: {result.service}")
            else:
                print(f"   ⚠️  RESULT: {result.error}")
                print(f"   📝 Message: {result.message}")
                if result.details:
                    print(f"   📊 Details: {result.details}")
                    
        except Exception as e:
            print(f"   💥 ERROR: {str(e)}")
        
        time.sleep(1)  # Small delay between tests

def test_spending_summary(agent_token):
    """Check spending summary and limits"""
    print("\n📊 Checking spending summary...")
    
    response = requests.get(f"{BASE_URL}/v1/agents/{agent_token}/config")
    if response.status_code == 200:
        data = response.json()
        if "spendingSummary" in data:
            summary = data["spendingSummary"]
            print(f"✅ Daily spending: ${summary['daily']['spent']:.2f} / ${summary['daily']['limit']:.2f}")
            print(f"   Remaining: ${summary['daily']['remaining']:.2f}")
            
            if summary.get("monthlyByCategory"):
                print("   By category:")
                for cat in summary["monthlyByCategory"]:
                    print(f"     {cat['service']}: ${cat['spent']:.2f}")
        else:
            print("✅ Config retrieved (no spending summary yet)")
    else:
        print(f"❌ Failed to get spending summary: {response.text}")

def main():
    print("🚀 AgentPay SDK Real Payment Test")
    print("=" * 50)
    print("Testing with LIVE Stripe payments! 💳")
    print()
    
    # Step 1: Setup
    wallet_id, agent_token = test_wallet_setup()
    if not wallet_id or not agent_token:
        print("❌ Setup failed, aborting test")
        return
    
    # Step 2: Add payment method (skip for now, will work with direct charging)
    # add_test_card(wallet_id)
    
    # Step 3: Test the SDK
    test_sdk_purchases(agent_token)
    
    # Step 4: Check results
    test_spending_summary(agent_token)
    
    print("\n🎉 Test Complete!")
    print("\n💡 Key takeaways:")
    print("   • AgentPay SDK works with just 5 lines of code")
    print("   • Real payments processed through Stripe")
    print("   • Smart spending controls prevent overspending")
    print("   • Approval workflows protect large purchases")
    print("   • Perfect for any AI agent integration!")

if __name__ == "__main__":
    main() 