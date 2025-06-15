#!/bin/bash

set -e

# Colors for output
green='\033[0;32m'
red='\033[0;31m'
yellow='\033[1;33m'
reset='\033[0m'

API_URL="http://localhost:3000"

function print_success() {
  echo -e "${green}$1${reset}"
}
function print_error() {
  echo -e "${red}$1${reset}"
}
function print_info() {
  echo -e "${yellow}$1${reset}"
}

print_info "Starting AgentPay demo..."

echo
echo "1. Creating wallet..."
WALLET_RESPONSE=$(curl -s -X POST "$API_URL/v1/wallets")
WALLET_ID=$(echo "$WALLET_RESPONSE" | grep -o '"walletId":"[^"]*' | grep -o '[^"]*$')
if [ -z "$WALLET_ID" ]; then
  print_error "Error: Empty response from server"
  print_error "Failed to create wallet"
  exit 1
fi
print_success "Created wallet: $WALLET_ID"
echo "Full response:"
echo "$WALLET_RESPONSE"

echo
echo "2. Funding wallet with $3..."
FUND_RESPONSE=$(curl -s -X POST "$API_URL/v1/wallets/$WALLET_ID/fund" -H 'Content-Type: application/json' -d '{"usd":3}')
if [[ "$FUND_RESPONSE" == *"error"* ]]; then
  print_error "Failed to fund wallet"
  echo "$FUND_RESPONSE"
  exit 1
fi
print_success "Funded wallet:"
echo "$FUND_RESPONSE"

echo
echo "3. Creating agent with  daily limit..."
AGENT_RESPONSE=$(curl -s -X POST "$API_URL/v1/agents" -H 'Content-Type: application/json' -d '{"walletId":"'$WALLET_ID'","dailyUsdLimit":2}')
AGENT_TOKEN=$(echo "$AGENT_RESPONSE" | grep -o '"agentToken":"[^"]*' | grep -o '[^"]*$')
if [ -z "$AGENT_TOKEN" ]; then
  print_error "Failed to create agent"
  echo "$AGENT_RESPONSE"
  exit 1
fi
print_success "Created agent:"
echo "$AGENT_RESPONSE"

echo
echo "4. Ready to pay invoice"
echo -n "Please paste your Bolt11 invoice: "
read INVOICE

echo "\nPaying invoice..."
PAY_RESPONSE=$(curl -s -X POST "$API_URL/v1/pay" -H 'Content-Type: application/json' -d '{"agentToken":"'$AGENT_TOKEN'","invoice":"'$INVOICE'"}')
if [[ "$PAY_RESPONSE" == *"error"* ]]; then
  print_error "Failed to pay invoice"
  echo "$PAY_RESPONSE"
  exit 1
fi
print_success "Payment response:"
echo "$PAY_RESPONSE" 