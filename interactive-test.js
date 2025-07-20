#!/usr/bin/env node

/**
 * Interactive MCP Server Tester
 * Run specific tests or interact manually with your MCP server
 */

import { spawn } from 'child_process';
import readline from 'readline';

class MCPTester {
  constructor() {
    this.server = null;
    this.messageId = 1;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('🚀 Starting GoCardless MCP Server...\n');
    
    this.server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    this.server.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        try {
          const response = JSON.parse(line);
          console.log('📩 Response:', JSON.stringify(response, null, 2));
        } catch (e) {
          if (!line.includes('dotenv') && !line.includes('GoCardless MCP server')) {
            console.log('📝 Output:', line);
          }
        }
      });
      this.showMenu();
    });

    // Initialize the connection
    await this.sendMessage('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'interactive-tester', version: '1.0.0' }
    });
  }

  sendMessage(method, params = {}) {
    const message = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method,
      params
    };
    
    console.log('📤 Sending:', method, params ? JSON.stringify(params) : '');
    this.server.stdin.write(JSON.stringify(message) + '\n');
  }

  showMenu() {
    console.log('\n' + '='.repeat(50));
    console.log('🛠️  GoCardless MCP Server Test Menu');
    console.log('='.repeat(50));
    console.log('1. List all tools');
    console.log('2. List customers');
    console.log('3. Create customer');
    console.log('4. Get customer by ID');
    console.log('5. Create redirect flow');
    console.log('6. List payments');
    console.log('7. Custom JSON-RPC command');
    console.log('8. Run full test suite');
    console.log('0. Exit');
    console.log('='.repeat(50));
    
    this.rl.question('Choose an option (0-8): ', (answer) => {
      this.handleChoice(answer.trim());
    });
  }

  async handleChoice(choice) {
    switch (choice) {
      case '1':
        this.sendMessage('tools/list');
        break;
        
      case '2':
        this.rl.question('How many customers? (default: 10): ', (limit) => {
          this.sendMessage('tools/call', {
            name: 'list_customers',
            arguments: { limit: parseInt(limit) || 10 }
          });
        });
        break;
        
      case '3':
        this.createCustomerInteractive();
        break;
        
      case '4':
        this.rl.question('Enter customer ID: ', (customerId) => {
          this.sendMessage('tools/call', {
            name: 'get_customer',
            arguments: { customer_id: customerId }
          });
        });
        break;
        
      case '5':
        this.createRedirectFlowInteractive();
        break;
        
      case '6':
        this.listPaymentsInteractive();
        break;
        
      case '7':
        this.customCommand();
        break;
        
      case '8':
        this.runTestSuite();
        break;
        
      case '0':
        console.log('👋 Goodbye!');
        this.server.kill();
        process.exit(0);
        break;
        
      default:
        console.log('❌ Invalid choice');
        this.showMenu();
    }
  }

  createCustomerInteractive() {
    console.log('\n📝 Create New Customer:');
    this.rl.question('Email: ', (email) => {
      this.rl.question('First name: ', (givenName) => {
        this.rl.question('Last name: ', (familyName) => {
          this.rl.question('Company (optional): ', (company) => {
            this.sendMessage('tools/call', {
              name: 'create_customer',
              arguments: {
                email,
                given_name: givenName,
                family_name: familyName,
                ...(company && { company_name: company })
              }
            });
          });
        });
      });
    });
  }

  createRedirectFlowInteractive() {
    console.log('\n🔗 Create Redirect Flow:');
    this.rl.question('Description: ', (description) => {
      this.rl.question('Success URL: ', (url) => {
        const sessionToken = 'test_' + Date.now();
        this.sendMessage('tools/call', {
          name: 'create_redirect_flow',
          arguments: {
            description,
            session_token: sessionToken,
            success_redirect_url: url
          }
        });
      });
    });
  }

  listPaymentsInteractive() {
    console.log('\n💳 List Payments:');
    this.rl.question('Customer ID (optional): ', (customerId) => {
      this.rl.question('Status filter (optional): ', (status) => {
        const args = {};
        if (customerId) args.customer = customerId;
        if (status) args.status = status;
        
        this.sendMessage('tools/call', {
          name: 'list_payments',
          arguments: args
        });
      });
    });
  }

  customCommand() {
    console.log('\n⚡ Custom JSON-RPC Command:');
    console.log('Enter method and params separately...');
    this.rl.question('Method: ', (method) => {
      this.rl.question('Params (JSON, empty for {}): ', (paramsStr) => {
        try {
          const params = paramsStr.trim() ? JSON.parse(paramsStr) : {};
          this.sendMessage(method, params);
        } catch (e) {
          console.log('❌ Invalid JSON params');
          this.showMenu();
        }
      });
    });
  }

  runTestSuite() {
    console.log('\n🧪 Running Full Test Suite...\n');
    
    // Test 1: List tools
    setTimeout(() => {
      console.log('Test 1: Listing available tools');
      this.sendMessage('tools/list');
    }, 500);
    
    // Test 2: List customers
    setTimeout(() => {
      console.log('\nTest 2: Listing customers');
      this.sendMessage('tools/call', {
        name: 'list_customers',
        arguments: { limit: 3 }
      });
    }, 2000);
    
    // Test 3: Create test customer
    setTimeout(() => {
      console.log('\nTest 3: Creating test customer');
      this.sendMessage('tools/call', {
        name: 'create_customer',
        arguments: {
          email: `test.${Date.now()}@example.com`,
          given_name: 'Test',
          family_name: 'User'
        }
      });
    }, 4000);
    
    // Test 4: List payments
    setTimeout(() => {
      console.log('\nTest 4: Listing payments');
      this.sendMessage('tools/call', {
        name: 'list_payments',
        arguments: { limit: 5 }
      });
    }, 6000);
    
    setTimeout(() => {
      console.log('\n✅ Test suite completed!');
      this.showMenu();
    }, 8000);
  }
}

// Start the interactive tester
const tester = new MCPTester();
tester.start().catch(console.error);