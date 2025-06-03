#!/bin/bash

# Quarantine test files that expose security vulnerabilities
echo "🔒 Quarantining test files for security..."

# Create quarantine directory if it doesn't exist
mkdir -p security-fixes/quarantine/test-files

# Move all test files to quarantine
test_files=(
    "test-stripe-injection.js"
    "test-stripe-keys.js"
    "test-integrations.js"
    "test-watchouts.js"
    "test-auth-simple.js"
    "test-control-tower.js"
    "test-purchase-logic.js"
    "test-simple-purchase.js"
    "test-real-purchase-demo.js"
    "test-real-purchase-execution.js"
    "verify-stripe-keys.js"
    "test_real_payments.py"
    "test-real-amazon.js"
    "test-prisma-types.ts"
    "test-platform-fee.js"
    "test-browser-quick.js"
    "simple-test.js"
    "test-browser-automation.js"
    "test-security.js"
    "test-legal-docs.js"
    "test-final-credit-card.js"
    "test-payment-debug.js"
    "test-credit-card-flow.js"
    "test-user-wallet.js"
    "security-audit.js"
    "security-audit-clean.js"
    "run-sanity-tests.sh"
    "openai-integration-demo.js"
)

for file in "${test_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  Moving $file to quarantine..."
        mv "$file" security-fixes/quarantine/test-files/
    fi
done

# Also quarantine the tests directory
if [ -d "tests" ]; then
    echo "  Moving tests/ directory to quarantine..."
    mv tests security-fixes/quarantine/
fi

echo "✅ Test files quarantined. Review them in security-fixes/quarantine/"
echo "⚠️  Remember to update .gitignore to exclude these from version control" 