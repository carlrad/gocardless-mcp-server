#!/usr/bin/env node

/**
 * GoCardless MCP Server
 * 
 * This is a minimal Model Context Protocol (MCP) server that integrates with the GoCardless API.
 * It provides tools for managing customers, payment methods, and payments through GoCardless.
 * 
 * MCP servers expose tools that AI assistants can use to interact with external systems.
 * This server demonstrates how to:
 * 1. Create MCP tools with proper schemas
 * 2. Handle API authentication securely
 * 3. Make HTTP requests to external APIs
 * 4. Return structured data to the AI assistant
 */

import { config } from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

// Load environment variables from .env file (suppress logs)
config({ quiet: true });

/**
 * GoCardless API configuration
 * In production, these should come from environment variables
 */
const GOCARDLESS_CONFIG = {
  // Use sandbox environment for testing - change to 'live' for production
  environment: process.env.GOCARDLESS_ENVIRONMENT || 'sandbox',
  // Your GoCardless access token - get this from your GoCardless dashboard
  accessToken: process.env.GOCARDLESS_ACCESS_TOKEN || '',
  // API version to use
  version: '2015-07-06'
};

/**
 * Get the appropriate GoCardless API base URL based on environment
 */
function getApiBaseUrl(): string {
  return GOCARDLESS_CONFIG.environment === 'live' 
    ? 'https://api.gocardless.com' 
    : 'https://api-sandbox.gocardless.com';
}

/**
 * Make authenticated requests to the GoCardless API
 * This helper function handles authentication headers and error responses
 */
async function makeGoCardlessRequest(endpoint: string, options: any = {}): Promise<any> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GOCARDLESS_CONFIG.accessToken}`,
      'GoCardless-Version': GOCARDLESS_CONFIG.version,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`GoCardless API error: ${response.status} ${response.statusText}\n${errorData}`);
  }

  return response.json();
}

/**
 * Define the tools that this MCP server provides
 * Each tool has a name, description, and input schema that defines expected parameters
 */
const tools: Tool[] = [
  {
    name: 'list_customers',
    description: 'List customers from GoCardless. Useful for finding existing customers before creating payments.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of customers to return (default: 50, max: 500)',
          default: 50
        },
        after: {
          type: 'string',
          description: 'Cursor for pagination - get customers after this ID'
        }
      }
    }
  },
  
  {
    name: 'create_customer',
    description: 'Create a new customer in GoCardless. Required before setting up payments.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Customer email address',
          format: 'email'
        },
        given_name: {
          type: 'string',
          description: 'Customer first name'
        },
        family_name: {
          type: 'string',
          description: 'Customer last name'
        },
        company_name: {
          type: 'string',
          description: 'Company name (optional)'
        },
        address_line1: {
          type: 'string',
          description: 'First line of address'
        },
        city: {
          type: 'string',
          description: 'City'
        },
        postal_code: {
          type: 'string',
          description: 'Postal/ZIP code'
        },
        country_code: {
          type: 'string',
          description: 'Two-letter country code (e.g., GB, US)'
        }
      },
      required: ['email', 'given_name', 'family_name']
    }
  },

  {
    name: 'get_customer',
    description: 'Get details of a specific customer by their ID.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'The GoCardless customer ID'
        }
      },
      required: ['customer_id']
    }
  },

  {
    name: 'list_customer_bank_accounts',
    description: 'List bank accounts (mandates) for a specific customer.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'The GoCardless customer ID'
        }
      },
      required: ['customer_id']
    }
  },

  {
    name: 'create_redirect_flow',
    description: 'Create a redirect flow to collect customer bank details. This generates a URL where customers can securely enter their bank account information.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of what the payment is for'
        },
        session_token: {
          type: 'string',
          description: 'Unique session token to prevent CSRF attacks'
        },
        success_redirect_url: {
          type: 'string',
          description: 'URL to redirect to after successful setup',
          format: 'uri'
        },
        prefilled_customer: {
          type: 'object',
          description: 'Pre-fill customer information',
          properties: {
            given_name: { type: 'string' },
            family_name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            company_name: { type: 'string' }
          }
        }
      },
      required: ['description', 'session_token', 'success_redirect_url']
    }
  },

  {
    name: 'list_payments',
    description: 'List payments from GoCardless. Useful for checking payment status and history.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of payments to return (default: 50)',
          default: 50
        },
        customer: {
          type: 'string',
          description: 'Filter by customer ID'
        },
        status: {
          type: 'string',
          description: 'Filter by payment status',
          enum: ['pending_customer_approval', 'pending_submission', 'submitted', 'confirmed', 'paid_out', 'cancelled', 'customer_approval_denied', 'failed', 'charged_back']
        }
      }
    }
  },

  {
    name: 'create_billing_request',
    description: 'Create a billing request for collecting payments. This is the modern GoCardless approach for payment collection that combines mandate setup and payment creation.',
    inputSchema: {
      type: 'object',
      properties: {
        amount_cents: {
          type: 'number',
          description: 'Payment amount in cents/pence (e.g., 2999 for £29.99)'
        },
        currency: {
          type: 'string',
          description: 'Payment currency (e.g., GBP, EUR, USD)',
          enum: ['GBP', 'EUR', 'USD', 'SEK', 'DKK', 'AUD', 'NZD']
        },
        description: {
          type: 'string',
          description: 'Description of what the payment is for'
        },
        customer_email: {
          type: 'string',
          description: 'Customer email address',
          format: 'email'
        },
        customer_given_name: {
          type: 'string',
          description: 'Customer first name'
        },
        customer_family_name: {
          type: 'string',
          description: 'Customer last name'
        },
        customer_company_name: {
          type: 'string',
          description: 'Customer company name (optional)'
        },
        payment_reference: {
          type: 'string',
          description: 'Reference for the payment (optional)'
        }
      },
      required: ['amount_cents', 'currency', 'description', 'customer_email', 'customer_given_name', 'customer_family_name']
    }
  },

  {
    name: 'create_billing_request_flow',
    description: 'Create a billing request flow to collect customer details and authorize payments. This generates a URL where customers can complete the entire payment setup process.',
    inputSchema: {
      type: 'object',
      properties: {
        billing_request_id: {
          type: 'string',
          description: 'The ID of the billing request to create a flow for'
        },
        redirect_uri: {
          type: 'string',
          description: 'URL to redirect customer to after completing the flow',
          format: 'uri'
        },
        exit_uri: {
          type: 'string',
          description: 'URL to redirect customer to if they exit the flow (optional)',
          format: 'uri'
        },
        session_token: {
          type: 'string',
          description: 'Unique session token to prevent CSRF attacks'
        },
        show_redirect_buttons: {
          type: 'boolean',
          description: 'Whether to show redirect buttons in the flow (default: true)',
          default: true
        }
      },
      required: ['billing_request_id', 'redirect_uri', 'session_token']
    }
  },

  {
    name: 'get_billing_request',
    description: 'Get details of a specific billing request by its ID, including status and any associated payments.',
    inputSchema: {
      type: 'object',
      properties: {
        billing_request_id: {
          type: 'string',
          description: 'The GoCardless billing request ID'
        }
      },
      required: ['billing_request_id']
    }
  },

  {
    name: 'list_billing_requests',
    description: 'List billing requests from GoCardless. Useful for monitoring payment collection status.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of billing requests to return (default: 50)',
          default: 50
        },
        status: {
          type: 'string',
          description: 'Filter by billing request status',
          enum: ['pending', 'ready_to_fulfil', 'fulfilled', 'cancelled']
        },
        customer: {
          type: 'string',
          description: 'Filter by customer ID'
        }
      }
    }
  },

  {
    name: 'fulfil_billing_request',
    description: 'Fulfil a billing request to create the actual payment. Call this after the customer has completed the billing request flow.',
    inputSchema: {
      type: 'object',
      properties: {
        billing_request_id: {
          type: 'string',
          description: 'The GoCardless billing request ID to fulfil'
        }
      },
      required: ['billing_request_id']
    }
  }
];

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: 'gocardless-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handle the 'list_tools' request
 * This tells the AI assistant what tools are available
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools
  };
});

/**
 * Handle the 'call_tool' request
 * This is where the actual tool logic is implemented
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Check if access token is configured
    if (!GOCARDLESS_CONFIG.accessToken) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: GOCARDLESS_ACCESS_TOKEN environment variable is not set. Please configure your GoCardless access token.'
          }
        ]
      };
    }

    switch (name) {
      case 'list_customers': {
        const queryParams = new URLSearchParams();
        if (args?.limit) queryParams.set('limit', args.limit.toString());
        if (args?.after && typeof args.after === 'string') queryParams.set('after', args.after);
        
        const data = await makeGoCardlessRequest(`/customers?${queryParams}`);
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${data.customers.length} customers:\n\n` +
                data.customers.map((customer: any) => 
                  `• ${customer.given_name} ${customer.family_name} (${customer.email})\n` +
                  `  ID: ${customer.id}\n` +
                  `  Created: ${customer.created_at}`
                ).join('\n\n')
            }
          ]
        };
      }

      case 'create_customer': {
        if (!args) throw new Error('Arguments required for create_customer');
        
        const customerData: any = {
          customers: {
            email: args.email,
            given_name: args.given_name,
            family_name: args.family_name
          }
        };
        
        if (args.company_name && typeof args.company_name === 'string') {
          customerData.customers.company_name = args.company_name;
        }
        
        if (args.address_line1 && typeof args.address_line1 === 'string') {
          customerData.customers.address_line1 = args.address_line1;
          customerData.customers.city = args.city;
          customerData.customers.postal_code = args.postal_code;
          customerData.customers.country_code = args.country_code;
        }

        const data = await makeGoCardlessRequest('/customers', {
          method: 'POST',
          body: JSON.stringify(customerData)
        });

        const customer = data.customers;
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created customer:\n\n` +
                `Name: ${customer.given_name} ${customer.family_name}\n` +
                `Email: ${customer.email}\n` +
                `ID: ${customer.id}\n` +
                `Created: ${customer.created_at}`
            }
          ]
        };
      }

      case 'get_customer': {
        if (!args?.customer_id) throw new Error('customer_id is required');
        
        const data = await makeGoCardlessRequest(`/customers/${args.customer_id}`);
        const customer = data.customers;
        
        return {
          content: [
            {
              type: 'text',
              text: `Customer Details:\n\n` +
                `Name: ${customer.given_name} ${customer.family_name}\n` +
                `Email: ${customer.email}\n` +
                `ID: ${customer.id}\n` +
                `Created: ${customer.created_at}\n` +
                `Language: ${customer.language}\n` +
                `Metadata: ${JSON.stringify(customer.metadata, null, 2)}`
            }
          ]
        };
      }

      case 'list_customer_bank_accounts': {
        if (!args?.customer_id) throw new Error('customer_id is required');
        
        const data = await makeGoCardlessRequest(`/customer_bank_accounts?customer=${args.customer_id}`);
        
        if (data.customer_bank_accounts.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No bank accounts found for this customer. They may need to complete a redirect flow to add their bank details.'
              }
            ]
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Found ${data.customer_bank_accounts.length} bank account(s):\n\n` +
                data.customer_bank_accounts.map((account: any) => 
                  `• Account ending in ${account.account_number_ending}\n` +
                  `  ID: ${account.id}\n` +
                  `  Bank: ${account.bank_name}\n` +
                  `  Status: ${account.enabled ? 'Active' : 'Inactive'}`
                ).join('\n\n')
            }
          ]
        };
      }

      case 'create_redirect_flow': {
        if (!args) throw new Error('Arguments required for create_redirect_flow');
        
        const redirectFlowData: any = {
          redirect_flows: {
            description: args.description,
            session_token: args.session_token,
            success_redirect_url: args.success_redirect_url
          }
        };
        
        if (args.prefilled_customer && typeof args.prefilled_customer === 'object') {
          redirectFlowData.redirect_flows.prefilled_customer = args.prefilled_customer;
        }

        const data = await makeGoCardlessRequest('/redirect_flows', {
          method: 'POST',
          body: JSON.stringify(redirectFlowData)
        });

        const redirectFlow = data.redirect_flows;
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created redirect flow:\n\n` +
                `ID: ${redirectFlow.id}\n` +
                `Redirect URL: ${redirectFlow.redirect_url}\n\n` +
                `Send your customer to the redirect URL to collect their bank details. ` +
                `After they complete the process, you'll need to complete the redirect flow ` +
                `to create the mandate and customer bank account.`
            }
          ]
        };
      }

      case 'list_payments': {
        const queryParams = new URLSearchParams();
        if (args?.limit) queryParams.set('limit', args.limit.toString());
        if (args?.customer && typeof args.customer === 'string') queryParams.set('customer', args.customer);
        if (args?.status && typeof args.status === 'string') queryParams.set('status', args.status);
        
        const data = await makeGoCardlessRequest(`/payments?${queryParams}`);
        
        if (data.payments.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No payments found matching the criteria.'
              }
            ]
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Found ${data.payments.length} payment(s):\n\n` +
                data.payments.map((payment: any) => 
                  `• Amount: ${payment.currency} ${(payment.amount / 100).toFixed(2)}\n` +
                  `  ID: ${payment.id}\n` +
                  `  Status: ${payment.status}\n` +
                  `  Created: ${payment.created_at}\n` +
                  `  Description: ${payment.description || 'No description'}`
                ).join('\n\n')
            }
          ]
        };
      }

      case 'create_billing_request': {
        if (!args) throw new Error('Arguments required for create_billing_request');
        
        const billingRequestData: any = {
          billing_requests: {
            purpose_code: 'utility',
            payment_request: {
              amount: args.amount_cents,
              currency: args.currency,
              description: args.description
            },
            mandate_request: {
              currency: args.currency
            }
          }
        };

        // Add customer data if provided
        if (args.customer_email) {
          billingRequestData.billing_requests.mandate_request.payer = {
            email: args.customer_email,
            given_name: args.customer_given_name,
            family_name: args.customer_family_name
          };
          
          if (args.customer_company_name) {
            billingRequestData.billing_requests.mandate_request.payer.company_name = args.customer_company_name;
          }
        }

        // Add payment reference if provided
        if (args.payment_reference) {
          billingRequestData.billing_requests.payment_request.reference = args.payment_reference;
        }

        const data = await makeGoCardlessRequest('/billing_requests', {
          method: 'POST',
          body: JSON.stringify(billingRequestData)
        });

        const billingRequest = data.billing_requests;
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created billing request:\n\n` +
                `ID: ${billingRequest.id}\n` +
                `Amount: ${args.currency} ${(Number(args.amount_cents) / 100).toFixed(2)}\n` +
                `Status: ${billingRequest.status}\n` +
                `Description: ${args.description}\n` +
                `Created: ${billingRequest.created_at}\n\n` +
                `Next step: Create a billing request flow to collect customer authorization.`
            }
          ]
        };
      }

      case 'create_billing_request_flow': {
        if (!args) throw new Error('Arguments required for create_billing_request_flow');
        
        const flowData: any = {
          billing_request_flows: {
            redirect_uri: args.redirect_uri,
            links: {
              billing_request: args.billing_request_id
            }
          }
        };

        if (args.exit_uri) {
          flowData.billing_request_flows.exit_uri = args.exit_uri;
        }

        if (args.show_redirect_buttons !== undefined) {
          flowData.billing_request_flows.show_redirect_buttons = args.show_redirect_buttons;
        }

        const data = await makeGoCardlessRequest('/billing_request_flows', {
          method: 'POST',
          body: JSON.stringify(flowData)
        });

        const flow = data.billing_request_flows;
        return {
          content: [
            {
              type: 'text',
              text: `Successfully created billing request flow:\n\n` +
                `Flow ID: ${flow.id}\n` +
                `Authorisation URL: ${flow.authorisation_url}\n` +
                `Expires: ${flow.expires_at}\n\n` +
                `Send your customer to the authorisation URL to complete payment setup. ` +
                `After they complete the process, you can fulfil the billing request to create the payment.`
            }
          ]
        };
      }

      case 'get_billing_request': {
        if (!args?.billing_request_id) throw new Error('billing_request_id is required');
        
        const data = await makeGoCardlessRequest(`/billing_requests/${args.billing_request_id}`);
        const billingRequest = data.billing_requests;
        
        return {
          content: [
            {
              type: 'text',
              text: `Billing Request Details:\n\n` +
                `ID: ${billingRequest.id}\n` +
                `Status: ${billingRequest.status}\n` +
                `Amount: ${billingRequest.payment_request?.currency || 'N/A'} ${billingRequest.payment_request?.amount ? (billingRequest.payment_request.amount / 100).toFixed(2) : 'N/A'}\n` +
                `Description: ${billingRequest.payment_request?.description || 'No description'}\n` +
                `Created: ${billingRequest.created_at}\n` +
                `Purpose: ${billingRequest.purpose_code}\n` +
                `Reference: ${billingRequest.payment_request?.reference || 'None'}\n` +
                `Metadata: ${JSON.stringify(billingRequest.metadata, null, 2)}`
            }
          ]
        };
      }

      case 'list_billing_requests': {
        const queryParams = new URLSearchParams();
        if (args?.limit) queryParams.set('limit', args.limit.toString());
        if (args?.status && typeof args.status === 'string') queryParams.set('status', args.status);
        if (args?.customer && typeof args.customer === 'string') queryParams.set('customer', args.customer);
        
        const data = await makeGoCardlessRequest(`/billing_requests?${queryParams}`);
        
        if (data.billing_requests.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No billing requests found matching the criteria.'
              }
            ]
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Found ${data.billing_requests.length} billing request(s):\n\n` +
                data.billing_requests.map((request: any) => 
                  `• Amount: ${request.payment_request?.currency || 'N/A'} ${request.payment_request?.amount ? (request.payment_request.amount / 100).toFixed(2) : 'N/A'}\n` +
                  `  ID: ${request.id}\n` +
                  `  Status: ${request.status}\n` +
                  `  Created: ${request.created_at}\n` +
                  `  Description: ${request.payment_request?.description || 'No description'}`
                ).join('\n\n')
            }
          ]
        };
      }

      case 'fulfil_billing_request': {
        if (!args?.billing_request_id) throw new Error('billing_request_id is required');
        
        const data = await makeGoCardlessRequest(`/billing_requests/${args.billing_request_id}/actions/fulfil`, {
          method: 'POST',
          body: JSON.stringify({})
        });

        const billingRequest = data.billing_requests;
        return {
          content: [
            {
              type: 'text',
              text: `Successfully fulfilled billing request:\n\n` +
                `ID: ${billingRequest.id}\n` +
                `Status: ${billingRequest.status}\n` +
                `Payment created: ${billingRequest.status === 'fulfilled' ? 'Yes' : 'No'}\n\n` +
                `The billing request has been processed and payment collection has been initiated.`
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        }
      ],
      isError: true
    };
  }
});

/**
 * Start the MCP server
 * The server communicates via stdio (standard input/output)
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error('GoCardless MCP server started successfully');
  console.error(`Environment: ${GOCARDLESS_CONFIG.environment}`);
  console.error(`Access token configured: ${GOCARDLESS_CONFIG.accessToken ? 'Yes' : 'No'}`);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down GoCardless MCP server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});