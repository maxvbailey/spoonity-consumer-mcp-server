#!/usr/bin/env node

/**
 * Spoonity Consumer MCP Server
 *
 * Consumer-facing MCP server exposing the Spoonity Loyalty REST API
 * for voice/AI assistant integration (Siri, Google Gemini, app voice control).
 *
 * Supports both stdio and HTTP transport modes.
 *
 * Stdio mode (local/CLI):
 *   SPOONITY_SESSION_KEY=abc SPOONITY_VENDOR_ID=106292 node dist/index.js
 *
 * HTTP mode (Cloud Run):
 *   MCP_TRANSPORT=http MCP_PORT=8080 node dist/index.js
 *   Session key & vendor ID passed per-request via headers:
 *     X-Spoonity-Session-Key, X-Spoonity-Vendor-Id
 *   or via MCP tool calls (login tool returns session key)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SpoonityClient } from "./api-client.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import { randomUUID } from "node:crypto";

// ── Configuration ───────────────────────────────────────────────────────────

const API_URL = process.env.SPOONITY_API_URL ?? "https://api.spoonity.com";
const SESSION_KEY = process.env.SPOONITY_SESSION_KEY ?? "";
const VENDOR_ID = process.env.SPOONITY_VENDOR_ID ?? "";
const TRANSPORT = process.env.MCP_TRANSPORT ?? "stdio";
const PORT = parseInt(process.env.MCP_PORT ?? "8080", 10);
const API_KEY = process.env.MCP_API_KEY ?? "";
const CORS_ORIGIN = process.env.MCP_CORS_ORIGIN ?? "*";

// ── Server Factory ──────────────────────────────────────────────────────────

function createServer(api: SpoonityClient, vendorId: string): McpServer {
  const server = new McpServer({
    name: "spoonity-consumer",
    version: "1.0.0",
  });
  registerTools(server, api);
  registerResources(server, vendorId);
  registerPrompts(server);
  return server;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (TRANSPORT === "http") {
    await startHttpServer();
  } else {
    await startStdioServer();
  }
}

// ── Stdio Transport ─────────────────────────────────────────────────────────

async function startStdioServer() {
  if (!SESSION_KEY) {
    console.error("Error: SPOONITY_SESSION_KEY is required for stdio mode");
    process.exit(1);
  }
  if (!VENDOR_ID) {
    console.error("Error: SPOONITY_VENDOR_ID is required for stdio mode");
    process.exit(1);
  }

  const api = new SpoonityClient({
    baseUrl: API_URL,
    sessionKey: SESSION_KEY,
    vendorId: VENDOR_ID,
  });

  const server = createServer(api, VENDOR_ID);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Spoonity Consumer MCP Server running (stdio, vendor: ${VENDOR_ID})`);
}

// ── HTTP Transport (Cloud Run) ──────────────────────────────────────────────

async function startHttpServer() {
  const express = (await import("express")).default;
  const app = express();

  app.set("trust proxy", 1);

  // ── CORS ────────────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers",
      "Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID, " +
      "X-Spoonity-Session-Key, X-Spoonity-Vendor-Id, X-Api-Key");
    res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
    if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  // ── Session store ──────────────────────────────────────────────────
  type SessionEntry = {
    server: McpServer;
    transport: StreamableHTTPServerTransport;
    api: SpoonityClient;
    timer: ReturnType<typeof setTimeout>;
  };
  const sessions = new Map<string, SessionEntry>();
  const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
  const MAX_SESSIONS = 100;

  // ── Auth middleware ────────────────────────────────────────────────
  function authMiddleware(req: any, res: any, next: any) {
    if (API_KEY && req.headers["x-api-key"] !== API_KEY) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    next();
  }

  // ── POST / — MCP messages ──────────────────────────────────────────
  app.post("/", authMiddleware, async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const existing = sessionId ? sessions.get(sessionId) : undefined;

      if (existing) {
        clearTimeout(existing.timer);
        existing.timer = setTimeout(() => {
          sessions.delete(sessionId!);
          existing.transport.close?.();
        }, SESSION_TTL);
        await existing.transport.handleRequest(req, res);
        return;
      }

      if (sessionId) {
        res.status(404).json({ error: "Session expired. Re-initialize." });
        return;
      }

      if (sessions.size >= MAX_SESSIONS) {
        res.status(429).json({ error: "Too many sessions. Try again later." });
        return;
      }

      // Extract credentials from headers or fall back to env vars
      const vendorId = (req.headers["x-spoonity-vendor-id"] as string) || VENDOR_ID;
      const sessionKey = (req.headers["x-spoonity-session-key"] as string) || SESSION_KEY;

      const api = new SpoonityClient({
        baseUrl: API_URL,
        sessionKey,
        vendorId,
      });

      const server = createServer(api, vendorId);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res);

      const sid = transport.sessionId;
      if (sid) {
        const timer = setTimeout(() => {
          sessions.delete(sid);
          transport.close?.();
        }, SESSION_TTL);

        sessions.set(sid, { server, transport, api, timer });
        console.error(`[session] New: ${sid} (total: ${sessions.size})`);

        transport.onclose = () => {
          clearTimeout(timer);
          sessions.delete(sid);
          console.error(`[session] Closed: ${sid} (total: ${sessions.size})`);
        };
      }
    } catch (err) {
      console.error("MCP transport error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Internal error" });
    }
  });

  // ── GET / — SSE stream ─────────────────────────────────────────────
  app.get("/", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
      // Landing page for browsers
      res.setHeader("Content-Type", "text/html");
      res.send(`<!DOCTYPE html><html><head><title>Spoonity Consumer MCP</title></head>
<body style="font-family:system-ui;background:#0a0a14;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center"><h1>🎙️ Spoonity Consumer MCP Server</h1>
<p style="color:#888">Voice/AI assistant ordering endpoint</p>
<p style="color:#666;font-size:14px">Active sessions: ${sessions.size}</p></div></body></html>`);
      return;
    }
    await session.transport.handleRequest(req, res);
  });

  // ── DELETE / — session end ─────────────────────────────────────────
  app.delete("/", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) { res.status(400).json({ error: "No session" }); return; }
    await session.transport.handleRequest(req, res);
  });

  // ── Health check ───────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "spoonity-consumer-mcp", sessions: sessions.size });
  });

  // ── Start ──────────────────────────────────────────────────────────
  app.listen(PORT, "0.0.0.0", () => {
    console.error(`Spoonity Consumer MCP Server (HTTP) on http://0.0.0.0:${PORT}/`);
    console.error(`  Health: http://0.0.0.0:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
