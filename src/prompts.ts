/**
 * Spoonity Consumer MCP Prompts
 *
 * Pre-built workflow prompts for common voice assistant scenarios.
 * These guide the AI through multi-step operations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer) {

  server.prompt(
    "check_my_rewards",
    "Check the user's loyalty rewards, points balance, and tier status",
    async () => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please check my loyalty rewards status. I want to know:
1. My current point balance (use get_points)
2. My Quick Pay wallet balance (use get_balance)
3. My available rewards and how close I am to earning new ones (use get_rewards)
4. My current loyalty tier

Summarize this conversationally, like: "You have X points and $Y in your wallet. You're Z points away from a free [reward]. You're currently at [tier] tier."`,
        },
      }],
    })
  );

  server.prompt(
    "order_my_usual",
    "Help the user reorder their most recent order",
    async () => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Help me reorder my usual. Here's what to do:
1. Get my recent transactions (use get_transactions with limit 5)
2. Find the most recent purchase (look for one with items or quickpay.used > 0)
3. Tell me what I ordered last and from which store
4. Ask if I'd like to reorder from the same store

After confirming, use the Deliverect MCP server to:
1. Find the store
2. Create a basket
3. Add the same items
4. Proceed to checkout`,
        },
      }],
    })
  );

  server.prompt(
    "reload_my_balance",
    "Reload the Quick Pay wallet with a specified amount",
    { amount: z.string().optional().describe("Dollar amount to reload") },
    async ({ amount }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please reload my Quick Pay wallet${amount ? ` with $${amount}` : ""}.

Steps:
1. Check my current balance (use get_balance)
2. Get my saved credit cards (use get_credit_cards)
3. ${amount ? `Reload $${amount}` : "Ask me how much I'd like to reload"} using my default card (use reload_balance)
4. Confirm the new balance

If I don't have a saved credit card, let me know I need to add one in the app first.`,
        },
      }],
    })
  );

  server.prompt(
    "find_nearest_store",
    "Find the nearest open store",
    {
      latitude: z.string().optional().describe("User's latitude"),
      longitude: z.string().optional().describe("User's longitude"),
    },
    async ({ latitude, longitude }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Find the nearest open store${latitude && longitude ? ` near coordinates (${latitude}, ${longitude})` : ""}.

Steps:
1. Search for stores (use get_stores${latitude && longitude ? ` with latitude=${latitude}, longitude=${longitude}` : ""})
2. Filter to only open stores (is_open = true)
3. Sort by distance
4. Tell me the closest 3 open stores with their:
   - Name and address
   - Phone number
   - Distance
   - Hours if available`,
        },
      }],
    })
  );

  server.prompt(
    "send_a_gift",
    "Send a digital gift card to someone",
    {
      recipient_name: z.string().optional().describe("Recipient's name"),
      amount: z.string().optional().describe("Gift card amount in dollars"),
    },
    async ({ recipient_name, amount }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Help me send a digital gift card${recipient_name ? ` to ${recipient_name}` : ""}${amount ? ` for $${amount}` : ""}.

I need:
${!recipient_name ? "1. The recipient's name\n" : ""}${!recipient_name ? "2. " : "1. "}The recipient's email address
${!amount ? "- How much (suggest $10, $25, $50, or $100)\n" : ""}
- An optional personal message
- Whether to send now or schedule for later

Once I have all the details, use the send_egift tool to complete the gift.`,
        },
      }],
    })
  );
}
