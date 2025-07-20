#!/usr/bin/env node

/**
 * Simple MCP server tester
 * This script demonstrates how to interact with your MCP server programmatically
 */

import { spawn } from 'child_process';

// Start the MCP server process
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let messageId = 1;

// Helper to send JSON-RPC messages
function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
  
  console.log('→ Sending:', JSON.stringify(message));
  server.stdin.write(JSON.stringify(message) + '\n');
}

// Listen for responses
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      console.log('← Received:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('← Raw output:', line);
    }
  });
});

// Test sequence
setTimeout(() => {
  console.log('\n=== Testing MCP Server ===\n');
  
  // 1. Initialize the connection
  sendMessage('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {} },
    clientInfo: { name: 'test-client', version: '1.0.0' }
  });
  
  // 2. List available tools
  setTimeout(() => sendMessage('tools/list'), 1000);
  
  // 3. Call a tool (list customers)
  setTimeout(() => {
    sendMessage('tools/call', {
      name: 'list_customers',
      arguments: { limit: 5 }
    });
  }, 2000);
  
  // 4. Exit
  setTimeout(() => {
    server.kill();
    process.exit(0);
  }, 4000);
  
}, 500);