#!/usr/bin/env node

/**
 * MCP Server Demo - Sequential tests without readline issues
 */

import { spawn } from 'child_process';

console.log('🚀 GoCardless MCP Server Demo');
console.log('============================\n');

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let messageId = 1;
let stepCount = 0;

const steps = [
  {
    name: 'Initialize Connection',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'demo-client', version: '1.0.0' }
    }
  },
  {
    name: 'List Available Tools',
    method: 'tools/list',
    params: {}
  },
  {
    name: 'List Customers (Limit 3)',
    method: 'tools/call',
    params: {
      name: 'list_customers',
      arguments: { limit: 3 }
    }
  },
  {
    name: 'Create Test Customer',
    method: 'tools/call',
    params: {
      name: 'create_customer',
      arguments: {
        email: `demo.${Date.now()}@example.com`,
        given_name: 'Demo',
        family_name: 'User',
        company_name: 'Demo Company'
      }
    }
  },
  {
    name: 'List Recent Payments',
    method: 'tools/call',
    params: {
      name: 'list_payments',
      arguments: { limit: 5 }
    }
  },
  {
    name: 'Create Redirect Flow',
    method: 'tools/call',
    params: {
      name: 'create_redirect_flow',
      arguments: {
        description: 'Demo subscription setup',
        session_token: `demo_${Date.now()}`,
        success_redirect_url: 'https://example.com/success'
      }
    }
  },
  {
    name: 'Test Error Handling',
    method: 'tools/call',
    params: {
      name: 'get_customer',
      arguments: { customer_id: 'INVALID_ID_123' }
    }
  }
];

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      console.log('📩 Response:');
      
      if (response.result && response.result.content) {
        // Tool call result
        console.log(response.result.content[0].text);
      } else if (response.result && response.result.tools) {
        // Tools list
        console.log(`Found ${response.result.tools.length} tools:`);
        response.result.tools.forEach(tool => {
          console.log(`  - ${tool.name}: ${tool.description}`);
        });
      } else if (response.result && response.result.serverInfo) {
        // Initialization
        console.log(`Connected to ${response.result.serverInfo.name} v${response.result.serverInfo.version}`);
      } else if (response.error) {
        // Error response
        console.log(`❌ Error: ${response.error.message}`);
      } else {
        // Other responses
        console.log(JSON.stringify(response.result, null, 2));
      }
      
      console.log('\n' + '─'.repeat(60) + '\n');
      
      // Move to next step
      setTimeout(runNextStep, 2000);
      
    } catch (e) {
      // Ignore non-JSON output
    }
  });
});

function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
  
  server.stdin.write(JSON.stringify(message) + '\n');
}

function runNextStep() {
  if (stepCount >= steps.length) {
    console.log('🎉 Demo completed! All tests finished successfully.\n');
    console.log('💡 Try these commands:');
    console.log('   ./test.sh customers     - Quick customer list');
    console.log('   ./test.sh create        - Create test customer');
    console.log('   ./test.sh tools         - List all tools');
    console.log('   node quick-tests.js     - See all quick tests');
    
    server.kill();
    process.exit(0);
    return;
  }
  
  const step = steps[stepCount];
  console.log(`📋 Step ${stepCount + 1}: ${step.name}`);
  
  if (Object.keys(step.params).length > 0) {
    console.log('📤 Request:', JSON.stringify(step.params, null, 2));
  }
  
  sendMessage(step.method, step.params);
  stepCount++;
}

// Start the demo
setTimeout(() => {
  console.log('Starting automated demo in 2 seconds...\n');
  setTimeout(runNextStep, 2000);
}, 2000);