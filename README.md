# GoCardless MCP Server

A minimal Model Context Protocol (MCP) server that integrates with the GoCardless API for payment processing. This project demonstrates how to build MCP servers that AI assistants can use to interact with external payment APIs.

## What is MCP?

Model Context Protocol (MCP) is a standard that allows AI assistants to securely connect to external data sources and tools. An MCP server exposes specific tools that AI models can call to perform actions or retrieve information.

This server provides tools for:
- Managing customers in GoCardless
- Creating payment setup flows
- Listing payments and their statuses
- Managing bank account mandates

## Prerequisites

- Node.js 18+ 
- A GoCardless account (free sandbox available)
- GoCardless API access token

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd gocardless-mcp-server-test
   npm install
   ```

2. **Get your GoCardless API token:**
   - Sign up at [GoCardless](https://gocardless.com)
   - Go to Developer → API keys in your dashboard
   - Copy your sandbox access token

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your access token
   ```

4. **Build and test:**
   ```bash
   npm run build
   npm start
   ```

## Available Tools

### Customer Management
- `list_customers` - List existing customers
- `create_customer` - Create a new customer
- `get_customer` - Get customer details by ID
- `list_customer_bank_accounts` - List customer's bank accounts

### Payment Setup
- `create_redirect_flow` - Create a secure flow for customers to add bank details
- `list_payments` - List payments with optional filtering

## Example Usage

Once connected to an AI assistant via MCP, you can:

```
"Create a customer named John Doe with email john@example.com"
"List all customers" 
"Create a redirect flow for subscription setup"
"Show me all failed payments"
```

The AI assistant will use the appropriate tools and handle the API calls automatically.

## Development

### Project Structure
```
src/
  index.ts          # Main MCP server implementation
package.json        # Dependencies and scripts
tsconfig.json       # TypeScript configuration
.env.example        # Environment template
```

### Building
```bash
npm run build       # Compile TypeScript
npm run dev         # Watch mode for development
npm run clean       # Remove build files
```

### Key Concepts

**MCP Tools**: Each tool has a name, description, and JSON schema defining its parameters. The AI assistant uses these schemas to understand how to call the tools.

**Authentication**: The server handles GoCardless API authentication using Bearer tokens passed via environment variables.

**Error Handling**: Comprehensive error handling provides clear feedback when API calls fail or parameters are invalid.

## Connecting to AI Assistants

This MCP server communicates via stdio (standard input/output). To connect it to an AI assistant:

1. Build the project: `npm run build`
2. Configure your AI assistant to use: `node dist/index.js`
3. The assistant will automatically discover available tools

## API Reference

### Environment Variables
- `GOCARDLESS_ACCESS_TOKEN` - Your GoCardless API access token
- `GOCARDLESS_ENVIRONMENT` - Either 'sandbox' or 'live'

### Tool Schemas
Each tool includes detailed parameter schemas. See `src/index.ts` for complete definitions.

## Testing with GoCardless Sandbox

The sandbox environment is perfect for testing:
- Use fake bank account details
- Simulate payment flows
- Test error scenarios
- No real money involved

Sandbox test data:
- Sort code: 20-00-00
- Account number: 55779911
- Any valid email and name

## Security Notes

- Never commit your `.env` file
- Use sandbox tokens for development
- Rotate access tokens regularly
- Monitor API usage in GoCardless dashboard

## Next Steps

After getting familiar with this basic implementation, consider:

1. **Adding more GoCardless features:**
   - Payment creation
   - Mandate management
   - Webhook handling
   - Subscription management

2. **Enhanced error handling:**
   - Retry logic for API calls
   - Better error messages
   - Logging integration

3. **Testing:**
   - Unit tests for tool functions
   - Integration tests with sandbox API
   - Mock API responses for CI/CD

4. **Production features:**
   - Rate limiting
   - Request validation
   - Audit logging
   - Health checks

## Contributing

This is a learning project - feel free to experiment and extend it!

## License

MIT License - see LICENSE file for details