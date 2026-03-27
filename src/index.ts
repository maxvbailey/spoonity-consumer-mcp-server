#!/usr/bin/env node

/**
 * Spoonity Consumer MCP Server
 *
 * Consumer-facing MCP server exposing the Spoonity Loyalty REST API
 * for voice/AI assistant integration (Siri, Google Gemini, app voice control).
 *
 * Authentication: Stdio transport with env vars
 *   SPOONITY_SESSION_KEY  — User's session key (passed from the mobile app)
 *   SPOONITY_VENDOR_ID    — Vendor ID (brand identifier)
 *   SPOONITY_API_URL      — API base URL (default: https://api.spoonity.com)
 *
 * Usage:
 *   SPOONITY_SESSION_KEY=abc123 SPOONITY_VENDOR_ID=106292 node dist/index.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SpoonityClient } from "./api-client.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

// ── Configuration ───────────────────────────────────────────────────────────

const API_URL = process.env.SPOONITY_API_URL ?? "https://api.spoonity.com";
const SESSION_KEY = process.env.SPOONITY_SESSION_KEY ?? "";
const VENDOR_ID = process.env.SPOONITY_VENDOR_ID ?? "";

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!SESSION_KEY) {
    console.error("Error: SPOONITY_SESSION_KEY is required");
    console.error("Usage: SPOONITY_SESSION_KEY=<key> SPOONITY_VENDOR_ID=<id> node dist/index.js");
    process.exit(1);
  }
  if (!VENDOR_ID) {
    console.error("Error: SPOONITY_VENDOR_ID is required");
    process.exit(1);
  }

  // Create API client
  const api = new SpoonityClient({
    baseUrl: API_URL,
    sessionKey: SESSION_KEY,
    vendorId: VENDOR_ID,
  });

  // Create MCP server
  const server = new McpServer({
    name: "spoonity-consumer",
    version: "1.0.0",
  });

  // Register all capabilities
  registerTools(server, api);
  registerResources(server, VENDOR_ID);
  registerPrompts(server);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Spoonity Consumer MCP Server running (vendor: ${VENDOR_ID})`);
  console.error(`  API: ${API_URL}`);
  console.error(`  Session: ${SESSION_KEY.substring(0, 8)}...`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
