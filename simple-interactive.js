#!/usr/bin/env node

/**
 * Simple Interactive MCP Tester
 * A more robust version with better timing handling
 */

import { spawn } from 'child_process';
import readline from 'readline';

let server = null;
let messageId = 1;
let isInitialized = false;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function startServer() {
  console.log('🚀 Starting GoCardless MCP Server...\n');
  
  server = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        console.log('\n📩 Response:');
        console.log(JSON.stringify(response, null, 2));
        
        if (!isInitialized && response.result && response.result.protocolVersion) {
          isInitialized = true;
          setTimeout(showMenu, 500);
        }
      } catch (e) {
        // Ignore non-JSON output
      }
    });
  });

  // Initialize the connection
  setTimeout(() => {
    sendMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'simple-interactive', version: '1.0.0' }
    });
  }, 1000);
}

function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
  
  console.log('\n📤 Sending:', method);
  if (Object.keys(params).length > 0) {
    console.log('📋 Params:', JSON.stringify(params, null, 2));
  }
  
  server.stdin.write(JSON.stringify(message) + '\n');
}

function showMenu() {
  console.log('\n' + '='.repeat(50));
  console.log('🛠️  GoCardless MCP Server Test Menu');
  console.log('='.repeat(50));
  console.log('1. List all tools');
  console.log('2. List customers (limit 5)');
  console.log('3. Create test customer');
  console.log('4. List payments');
  console.log('5. Create redirect flow');
  console.log('6. Test error handling');
  console.log('7. Run mini test suite');
  console.log('0. Exit');
  console.log('='.repeat(50));
  
  rl.question('\nChoose an option (0-7): ', handleChoice);
}

function handleChoice(choice) {
  choice = choice.trim();
  
  switch (choice) {
    case '1':
      sendMessage('tools/list');
      setTimeout(showMenu, 2000);
      break;
      
    case '2':
      sendMessage('tools/call', {
        name: 'list_customers',
        arguments: { limit: 5 }
      });
      setTimeout(showMenu, 3000);
      break;
      
    case '3':
      const email = `test.${Date.now()}@example.com`;
      sendMessage('tools/call', {
        name: 'create_customer',
        arguments: {
          email,
          given_name: 'Test',
          family_name: 'User',
          company_name: 'Interactive Test Co'
        }
      });
      setTimeout(showMenu, 3000);
      break;
      
    case '4':
      sendMessage('tools/call', {
        name: 'list_payments',
        arguments: { limit: 10 }
      });
      setTimeout(showMenu, 3000);
      break;
      
    case '5':
      sendMessage('tools/call', {
        name: 'create_redirect_flow',
        arguments: {
          description: 'Interactive test redirect flow',
          session_token: `session_${Date.now()}`,
          success_redirect_url: 'https://example.com/success'
        }
      });
      setTimeout(showMenu, 3000);
      break;
      
    case '6':
      console.log('\n🧪 Testing error handling with invalid customer ID...');
      sendMessage('tools/call', {
        name: 'get_customer',
        arguments: { customer_id: 'INVALID_ID' }
      });
      setTimeout(showMenu, 3000);
      break;
      
    case '7':
      runMiniTestSuite();
      break;
      
    case '0':
      console.log('\n👋 Goodbye!');
      server.kill();
      rl.close();
      process.exit(0);
      break;
      
    default:
      console.log('❌ Invalid choice. Please enter 0-7.');
      setTimeout(showMenu, 1000);
  }
}

function runMiniTestSuite() {
  console.log('\n🧪 Running Mini Test Suite...');
  
  setTimeout(() => {
    console.log('\n📋 Test 1: List tools');
    sendMessage('tools/list');
  }, 1000);
  
  setTimeout(() => {
    console.log('\n👥 Test 2: List customers');
    sendMessage('tools/call', {
      name: 'list_customers',
      arguments: { limit: 3 }
    });
  }, 3000);
  
  setTimeout(() => {
    console.log('\n➕ Test 3: Create customer');
    sendMessage('tools/call', {
      name: 'create_customer',
      arguments: {
        email: `suite.${Date.now()}@example.com`,
        given_name: 'Suite',
        family_name: 'Test'
      }
    });
  }, 5000);
  
  setTimeout(() => {
    console.log('\n✅ Mini test suite completed!');
    showMenu();
  }, 7000);
}

// Start everything
startServer();

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  if (server) server.kill();
  rl.close();
  process.exit(0);
});