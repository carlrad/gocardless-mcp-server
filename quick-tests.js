#!/usr/bin/env node

/**
 * Quick MCP Tests - Run individual tests easily
 * Usage: node quick-tests.js [test-name]
 */

import { spawn } from 'child_process';

const tests = {
  // Basic tests
  'list-tools': {
    description: 'List all available tools',
    method: 'tools/list',
    params: {}
  },
  
  'list-customers': {
    description: 'List first 5 customers',
    method: 'tools/call',
    params: {
      name: 'list_customers',
      arguments: { limit: 5 }
    }
  },
  
  'list-payments': {
    description: 'List recent payments',
    method: 'tools/call',
    params: {
      name: 'list_payments',
      arguments: { limit: 10 }
    }
  },
  
  // Specific tests
  'create-customer': {
    description: 'Create a test customer',
    method: 'tools/call',
    params: {
      name: 'create_customer',
      arguments: {
        email: `test.${Date.now()}@example.com`,
        given_name: 'Test',
        family_name: 'User',
        company_name: 'Test Company'
      }
    }
  },
  
  'create-redirect': {
    description: 'Create a redirect flow',
    method: 'tools/call',
    params: {
      name: 'create_redirect_flow',
      arguments: {
        description: 'Test subscription setup',
        session_token: `test_${Date.now()}`,
        success_redirect_url: 'https://example.com/success'
      }
    }
  },
  
  // Billing request tests
  'create-billing-request': {
    description: 'Create a billing request for £29.99',
    method: 'tools/call',
    params: {
      name: 'create_billing_request',
      arguments: {
        amount_cents: 2999,
        currency: 'GBP',
        description: 'Monthly subscription payment',
        customer_email: `billing.${Date.now()}@example.com`,
        customer_given_name: 'Billing',
        customer_family_name: 'Test',
        customer_company_name: 'Test Subscription Co'
      }
    }
  },
  
  'list-billing-requests': {
    description: 'List recent billing requests',
    method: 'tools/call',
    params: {
      name: 'list_billing_requests',
      arguments: { limit: 10 }
    }
  },
  
  // Error tests
  'invalid-customer': {
    description: 'Test error handling with invalid customer ID',
    method: 'tools/call',
    params: {
      name: 'get_customer',
      arguments: { customer_id: 'INVALID_ID' }
    }
  }
};

async function runTest(testName) {
  const test = tests[testName];
  if (!test) {
    console.log('❌ Unknown test:', testName);
    console.log('Available tests:', Object.keys(tests).join(', '));
    return;
  }

  console.log(`🧪 Running test: ${test.description}\n`);

  const server = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  let messageId = 1;

  let responseCount = 0;
  
  // Listen for responses
  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        responseCount++;
        
        if (responseCount === 1) {
          // Skip initialization response
          return;
        }
        
        console.log('📩 Result:');
        console.log(JSON.stringify(response, null, 2));
        setTimeout(() => {
          server.kill();
          process.exit(0);
        }, 100);
      } catch (e) {
        // Ignore dotenv and startup messages
      }
    });
  });

  // Initialize first
  const initMessage = {
    jsonrpc: '2.0',
    id: messageId++,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'quick-test', version: '1.0.0' }
    }
  };

  setTimeout(() => {
    server.stdin.write(JSON.stringify(initMessage) + '\n');
    
    // Then run the actual test
    setTimeout(() => {
      const testMessage = {
        jsonrpc: '2.0',
        id: messageId++,
        method: test.method,
        params: test.params
      };
      
      console.log('📤 Sending:', test.method);
      if (Object.keys(test.params).length > 0) {
        console.log('📋 Params:', JSON.stringify(test.params, null, 2));
      }
      console.log();
      
      server.stdin.write(JSON.stringify(testMessage) + '\n');
    }, 1000);
  }, 500);

  // Timeout after 10 seconds
  setTimeout(() => {
    console.log('⏰ Test timeout');
    server.kill();
    process.exit(1);
  }, 10000);
}

// Show help or run test
const testName = process.argv[2];

if (!testName) {
  console.log('🧪 GoCardless MCP Quick Tests\n');
  console.log('Usage: node quick-tests.js [test-name]\n');
  console.log('Available tests:');
  Object.entries(tests).forEach(([name, test]) => {
    console.log(`  ${name.padEnd(20)} - ${test.description}`);
  });
  console.log('\nExamples:');
  console.log('  node quick-tests.js list-customers');
  console.log('  node quick-tests.js create-customer');
  console.log('  node quick-tests.js create-redirect');
} else {
  runTest(testName);
}