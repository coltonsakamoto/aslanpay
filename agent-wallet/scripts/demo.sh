#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3000"

echo -e "${BLUE}Starting AgentPay demo...${NC}\n"

# Function to check response
check_response() {
    if [ -z "$1" ]; then
        echo -e "${RED}Error: Empty response from server${NC}"
        return 1
    fi
    if echo "$1" | jq -e '.error' >/dev/null 2>&1; then
        echo -e "${RED}Error: $(echo "$1" | jq -r '.error.message')${NC}"
        return 1
    fi
    return 0
}

# 1. Create wallet
echo -e "${GREEN}1. Creating wallet...${NC}"
WALLET_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/wallets" -H "Content-Type: application/json")
if ! check_response "$WALLET_RESPONSE"; then
    echo -e "${RED}Failed to create wallet${NC}"
    exit 1
fi
WALLET_ID=$(echo "$WALLET_RESPONSE" | jq -r '.walletId')
echo "Created wallet: $WALLET_ID"
echo "Full response:"
echo "$WALLET_RESPONSE" | jq '.'

# 2. Fund wallet with $10
echo -e "\n${GREEN}2. Funding wallet with $10...${NC}"
curl -X POST http://localhost:3000/v1/wallets/$WALLET_ID/fund -H "Content-Type: application/json" -d '{"usd": 10}'
if ! check_response "$FUND_RESPONSE"; then
    echo -e "${RED}Failed to fund wallet${NC}"
    exit 1
fi
echo "Funded wallet:"
echo "$FUND_RESPONSE" | jq '.'

# 3. Create agent with $2 daily limit
echo -e "\n${GREEN}3. Creating agent with $2 daily limit...${NC}"
curl -X POST http://localhost:3000/v1/agents -H "Content-Type: application/json" -d '{"walletId": "'$WALLET_ID'", "dailyUsdLimit": 10}'
if ! check_response "$AGENT_RESPONSE"; then
    echo -e "${RED}Failed to create agent${NC}"
    exit 1
fi
AGENT_TOKEN=$(echo "$AGENT_RESPONSE" | jq -r '.agentToken')
echo "Created agent:"
echo "$AGENT_RESPONSE" | jq '.'

# 4. Pay invoice
echo -e "\n${GREEN}4. Ready to pay invoice${NC}"
echo "Please paste your Bolt11 invoice:"
read -r INVOICE
INVOICE=$(echo "$INVOICE" | tr -d '\n\r')  # Remove any newlines or carriage returns

echo -e "\n${GREEN}Paying invoice...${NC}"
PAY_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/pay" \
  -H "Content-Type: application/json" \
  -d "{\"agentToken\": \"$AGENT_TOKEN\", \"invoice\": \"$INVOICE\"}")
if ! check_response "$PAY_RESPONSE"; then
    echo -e "${RED}Failed to pay invoice${NC}"
    exit 1
fi
echo "Payment response:"
echo "$PAY_RESPONSE" | jq '.'

echo -e "\n${BLUE}Demo complete!${NC}"

curl -s http://localhost:3000/v1/wallets/$WALLET_ID

lncli listinvoices 

curl -X POST http://localhost:3000/v1/wallets -H "Content-Type: application/json" 

curl -X POST http://localhost:3000/v1/pay -H "Content-Type: application/json" -d '{"agentToken": "AGENT_TOKEN", "invoice": "BOLT11_INVOICE"}' 