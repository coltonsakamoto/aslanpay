#!/bin/bash

# AgentPay Control Tower - Sanity Test Runner
# ===========================================
# 
# Runs comprehensive production sanity tests for all critical edge cases
# 
# Usage: ./run-sanity-tests.sh

set -e

echo "🚀 **AGENTPAY CONTROL TOWER SANITY TEST RUNNER**"
echo "================================================"
echo ""

# Check if AgentPay server is running
echo "🔍 Checking if AgentPay server is running..."
if curl -s http://localhost:3000/ > /dev/null; then
    echo "✅ AgentPay server is running on localhost:3000"
else
    echo "❌ AgentPay server is not running!"
    echo ""
    echo "Please start the server first:"
    echo "  cd agent-wallet"
    echo "  npm start"
    echo ""
    exit 1
fi

# Check Python dependencies
echo "🐍 Checking Python dependencies..."
python3 -c "import requests, subprocess, tempfile, shutil, re, logging" 2>/dev/null || {
    echo "❌ Missing Python dependencies!"
    echo ""
    echo "Please install required packages:"
    echo "  pip install requests"
    echo ""
    exit 1
}

echo "✅ Python dependencies are available"
echo ""

# Run the comprehensive sanity test suite
echo "🧪 **RUNNING COMPREHENSIVE SANITY TESTS**"
echo "=========================================="
echo ""

# Make sure the test file is executable
chmod +x tests/sanity-test-suite.py

# Run the tests and capture the exit code
if python3 tests/sanity-test-suite.py; then
    echo ""
    echo "🎉 **ALL SANITY TESTS PASSED!**"
    echo "================================"
    echo ""
    echo "✅ Production readiness validated:"
    echo "   • Fresh venv installation works smoothly"
    echo "   • No sensitive token leaks detected"
    echo "   • Notebook environments perform well (<0.5s)"
    echo "   • Multi-agent coordination handles edge cases"
    echo "   • Clear error messages for missing dependencies"
    echo ""
    echo "🚀 AgentPay Control Tower is ready for production deployment!"
    echo ""
    exit 0
else
    echo ""
    echo "❌ **SANITY TESTS FAILED**"
    echo "=========================="
    echo ""
    echo "⚠️ Critical issues detected that must be fixed before production:"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Review the failed test details above"
    echo "   2. Fix the identified issues"
    echo "   3. Re-run the sanity tests"
    echo "   4. Only deploy after all tests pass"
    echo ""
    echo "📋 Common fixes:"
    echo "   • Token leaks: Check logging configuration"
    echo "   • Slow performance: Optimize authorization latency"
    echo "   • Installation issues: Fix dependency management"
    echo "   • Error handling: Improve error messages"
    echo ""
    exit 1
fi 