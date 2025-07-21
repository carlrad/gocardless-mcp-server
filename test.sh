#!/bin/bash

# GoCardless MCP Server Test Script
# Simple bash wrapper for common test scenarios

set -e

echo "🚀 GoCardless MCP Server Tester"
echo "================================"

# Build first if needed
if [ ! -d "dist" ]; then
    echo "📦 Building project..."
    npm run build
fi

case "$1" in
    "interactive"|"i")
        echo "🎮 Starting interactive tester..."
        node interactive-test.js
        ;;
    "quick"|"q")
        if [ -z "$2" ]; then
            echo "📋 Available quick tests:"
            node quick-tests.js
        else
            echo "🧪 Running quick test: $2"
            node quick-tests.js "$2"
        fi
        ;;
    "customers")
        echo "👥 Listing customers..."
        node quick-tests.js list-customers
        ;;
    "payments")
        echo "💳 Listing payments..."
        node quick-tests.js list-payments
        ;;
    "create")
        echo "➕ Creating test customer..."
        node quick-tests.js create-customer
        ;;
    "tools")
        echo "🛠️ Listing available tools..."
        node quick-tests.js list-tools
        ;;
    "billing")
        echo "💳 Creating billing request..."
        node quick-tests.js create-billing-request
        ;;
    "billing-list")
        echo "📋 Listing billing requests..."
        node quick-tests.js list-billing-requests
        ;;
    "all")
        echo "🧪 Running all tests..."
        echo
        echo "Test 1: List tools"
        node quick-tests.js list-tools
        echo
        echo "Test 2: List customers"
        node quick-tests.js list-customers
        echo
        echo "Test 3: Create customer"
        node quick-tests.js create-customer
        echo
        echo "Test 4: List payments"
        node quick-tests.js list-payments
        echo
        echo "Test 5: Create billing request"
        node quick-tests.js create-billing-request
        echo
        echo "Test 6: List billing requests"
        node quick-tests.js list-billing-requests
        ;;
    "help"|""|*)
        echo
        echo "Usage: ./test.sh [command]"
        echo
        echo "Commands:"
        echo "  interactive, i    - Start interactive test menu"
        echo "  quick [test], q   - Run a specific quick test"
        echo "  customers         - List customers"
        echo "  payments          - List payments"
        echo "  create            - Create test customer"
        echo "  billing           - Create billing request (modern payment method)"
        echo "  billing-list      - List billing requests"
        echo "  tools             - List available tools"
        echo "  all               - Run all basic tests"
        echo "  help              - Show this help"
        echo
        echo "Examples:"
        echo "  ./test.sh interactive"
        echo "  ./test.sh quick list-customers"
        echo "  ./test.sh customers"
        echo "  ./test.sh all"
        ;;
esac