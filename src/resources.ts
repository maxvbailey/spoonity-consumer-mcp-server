/**
 * Spoonity Consumer MCP Resources
 *
 * Static resources providing context to AI assistants about
 * the Spoonity platform and how to use the tools effectively.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerResources(server: McpServer, vendorId: string) {

  server.resource(
    "usage-guide",
    "spoonity://usage-guide",
    {
      description: "Guide for AI assistants on how to use Spoonity consumer tools effectively",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [{
        uri: "spoonity://usage-guide",
        mimeType: "text/markdown",
        text: `# Spoonity Consumer API — Usage Guide

## Overview
This MCP server provides tools for interacting with the Spoonity loyalty platform on behalf of a customer.
Vendor ID: ${vendorId}

## Common Workflows

### "What's my balance?"
1. Call \`get_balance\` → returns Quick Pay (stored value) wallet amount
2. Call \`get_points\` → returns loyalty point balances

### "Show me my rewards"
1. Call \`get_rewards\` → returns all rewards with progress bars
   - \`data[].name\` = reward name (e.g., "Free Drip Coffee")
   - \`data[].progress\` / \`data[].cost\` = how close to earning it
   - \`data[].available\` > 0 = ready to redeem
   - \`tier.current.name\` = current loyalty tier

### "Reload my balance"
1. Call \`get_credit_cards\` → get saved payment methods
2. Call \`reload_balance\` with amount + billing_profile_id

### "Find a store near me"
1. Call \`get_stores\` with latitude/longitude
2. Results include: name, address, phone, open/closed status, distance

### "Show my recent orders"
1. Call \`get_transactions\` → paginated purchase history
   - \`quickpay.used\` = dollars spent, \`quickpay.loaded\` = dollars reloaded
   - \`rewards[].earned\` = points earned, \`rewards[].spent\` = points redeemed

### "Send a gift card"
1. Call \`send_egift\` with amount, recipient name/email, message
2. Optionally schedule for future delivery with send_date

## Important Notes
- Balance amounts are in the \`amount\` field (not \`balance\`)
- Points are in the \`rewards[]\` array of each transaction
- Store regions and countries are objects, not strings
- Phone numbers don't include formatting
- The barcode tool returns a base64 image — display this as a QR code
`,
      }],
    })
  );

  server.resource(
    "vendor-config",
    "spoonity://vendor-config",
    {
      description: "Current vendor configuration",
      mimeType: "application/json",
    },
    async () => ({
      contents: [{
        uri: "spoonity://vendor-config",
        mimeType: "application/json",
        text: JSON.stringify({
          vendor_id: vendorId,
          platform: "Spoonity",
          api_base: "https://api.spoonity.com",
          features: [
            "loyalty_points",
            "quick_pay_wallet",
            "rewards_redemption",
            "tier_system",
            "store_locator",
            "e_gifting",
            "transaction_history",
            "wallet_passes",
            "promotions",
            "push_notifications",
          ],
        }, null, 2),
      }],
    })
  );
}
