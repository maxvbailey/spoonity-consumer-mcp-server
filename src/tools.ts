/**
 * Spoonity Consumer MCP Tools
 *
 * 28 tools covering the complete consumer loyalty API surface.
 * Designed for voice/AI assistant integration (Siri, Google Gemini).
 *
 * Tool naming follows voice-assistant conventions:
 *   - Short, action-oriented names
 *   - Descriptive annotations for LLM understanding
 *   - Structured JSON responses for parsing
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SpoonityClient } from "./api-client.js";

// ── Helper ──────────────────────────────────────────────────────────────────

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

function safe<T>(handler: (params: T) => Promise<ReturnType<typeof json>>) {
  return async (params: T) => {
    try {
      return await handler(params);
    } catch (e: any) {
      const msg = e?.message || "Unknown error";
      console.error(`[tool-error] ${msg}`);
      return err(msg);
    }
  };
}

// ── Registration ────────────────────────────────────────────────────────────

export function registerTools(server: McpServer, api: SpoonityClient) {

  // ─── Auth ───────────────────────────────────────────────────────────

  server.tool(
    "login",
    "Authenticate with email and password. Returns session key and user info.",
    { email: z.string().email(), password: z.string().min(1) },
    safe(async ({ email, password }) => json(await api.login(email, password)))
  );

  server.tool(
    "register",
    "Create a new account. Requires name, email, password, and terms acceptance.",
    {
      email_address: z.string().email(),
      password: z.string().min(6),
      first_name: z.string().min(1),
      last_name: z.string().min(1),
      phone_number: z.string().optional(),
      terms: z.boolean().default(true),
    },
    safe(async (params) => json(await api.register(params)))
  );

  server.tool(
    "check_email_exists",
    "Check if an email address is already registered.",
    { email: z.string().email() },
    safe(async ({ email }) => json(await api.checkEmailExists(email)))
  );

  server.tool(
    "logout",
    "End the current session.",
    {},
    safe(async () => json(await api.logout()))
  );

  // ─── Profile ────────────────────────────────────────────────────────

  server.tool(
    "get_profile",
    "Get the current user's profile information including name, email, phone, and address.",
    {},
    safe(async () => json(await api.getProfile()))
  );

  server.tool(
    "update_profile",
    "Update profile fields. Pass only the fields you want to change.",
    {
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      phone_number: z.string().optional(),
      email_address: z.string().email().optional(),
    },
    safe(async (params) => {
      const body: Record<string, unknown> = {};
      if (params.first_name) body.first_name = params.first_name;
      if (params.last_name) body.last_name = params.last_name;
      if (params.phone_number) body.phone_number = params.phone_number;
      if (params.email_address) body.email_address = params.email_address;
      return json(await api.updateProfile(body));
    })
  );

  server.tool(
    "change_password",
    "Change the account password. Requires current and new password.",
    { current_password: z.string().min(1), new_password: z.string().min(6) },
    safe(async ({ current_password, new_password }) =>
      json(await api.changePassword(current_password, new_password)))
  );

  // ─── Balances & Loyalty ─────────────────────────────────────────────

  server.tool(
    "get_balance",
    "Get the Quick Pay (stored value) wallet balance. Returns dollar amount.",
    {},
    safe(async () => json(await api.getQuickPayBalance()))
  );

  server.tool(
    "get_points",
    "Get all loyalty point balances (e.g., Cutters Points, Birthday Reward). Returns array of currency balances.",
    {},
    safe(async () => json(await api.getCurrencyBalance()))
  );

  server.tool(
    "get_barcode",
    "Generate a QR code/barcode for scanning at the register. Returns base64 image and token number.",
    {},
    safe(async () => json(await api.getBarcode()))
  );

  server.tool(
    "get_rewards",
    "Get all available rewards with progress, cost, tier info, and which are ready to redeem. Key fields: data[].name, data[].progress, data[].cost, data[].available, tier.current.name.",
    {},
    safe(async () => json(await api.getRewards()))
  );

  // ─── Transactions ───────────────────────────────────────────────────

  server.tool(
    "get_transactions",
    "Get purchase history. Each transaction has date, store address, dollar amounts (quickpay.used/loaded), points (rewards[].earned/spent), and perk badges.",
    { page: z.number().int().positive().default(1), limit: z.number().int().positive().max(50).default(10) },
    safe(async ({ page, limit }) => json(await api.getTransactions(page, limit)))
  );

  server.tool(
    "rate_transaction",
    "Rate a past transaction with stars (1-5) and optional comment.",
    {
      transaction_id: z.number().int(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().optional().default(""),
    },
    safe(async ({ transaction_id, rating, comment }) =>
      json(await api.rateTransaction(transaction_id, rating, comment)))
  );

  server.tool(
    "tip_transaction",
    "Add a tip to a past transaction. Amount in dollars.",
    { transaction_id: z.number().int(), amount: z.number().positive() },
    safe(async ({ transaction_id, amount }) =>
      json(await api.tipTransaction(transaction_id, amount)))
  );

  // ─── Stores ─────────────────────────────────────────────────────────

  server.tool(
    "get_stores",
    "Find nearby store locations. Returns name, address, phone, coordinates, open status, and distance. Pass latitude/longitude for GPS-based results.",
    {
      latitude: z.number().default(47.2529),
      longitude: z.number().default(-122.4552),
      distance: z.number().default(50000).describe("Search radius in meters"),
      unit: z.enum(["KM", "MI"]).default("KM"),
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(300).default(50),
    },
    safe(async ({ latitude, longitude, distance, unit, page, limit }) =>
      json(await api.getStores(latitude, longitude, distance, unit, page, limit)))
  );

  // ─── Cards ──────────────────────────────────────────────────────────

  server.tool(
    "get_cards",
    "List all loyalty/gift cards linked to the account.",
    {},
    safe(async () => {
      const [cards, cards3rd] = await Promise.all([
        api.getCardsWithPin().catch(() => ({ data: [] })),
        api.getCards3rdParty().catch(() => ({ data: [] })),
      ]);
      return json({ loyalty_cards: cards, third_party_cards: cards3rd });
    })
  );

  server.tool(
    "add_card",
    "Link a loyalty/gift card to the account using card number and PIN.",
    { number: z.string().min(1), pin: z.string().min(1) },
    safe(async ({ number, pin }) => json(await api.addCard(number, pin)))
  );

  server.tool(
    "remove_card",
    "Remove a linked card from the account.",
    { card_id: z.number().int() },
    safe(async ({ card_id }) => json(await api.removeCard(card_id)))
  );

  // ─── Credit Cards & Reload ──────────────────────────────────────────

  server.tool(
    "get_credit_cards",
    "List saved credit/debit cards for payments and reloads.",
    {},
    safe(async () => json(await api.getCreditCards()))
  );

  server.tool(
    "reload_balance",
    "Add funds to the Quick Pay wallet using a saved credit card. Amount in dollars.",
    {
      amount: z.number().positive().describe("Dollar amount to reload"),
      billing_profile_id: z.number().int().describe("ID of the saved credit card to charge"),
    },
    safe(async ({ amount, billing_profile_id }) =>
      json(await api.reloadBalance(amount, billing_profile_id)))
  );

  server.tool(
    "get_auto_reload",
    "Get auto-reload settings (enabled/disabled, threshold, amount).",
    {},
    safe(async () => json(await api.getAutoReloadSettings()))
  );

  // ─── Messages ───────────────────────────────────────────────────────

  server.tool(
    "get_messages",
    "Get in-app messages/inbox. Returns title, body, banner image, read status.",
    {},
    safe(async () => json(await api.getMessages()))
  );

  // ─── E-Gift ─────────────────────────────────────────────────────────

  server.tool(
    "send_egift",
    "Send a digital gift card to someone. Can schedule for a future date.",
    {
      amount: z.number().positive().describe("Dollar amount for the gift card"),
      recipient_name: z.string().min(1),
      recipient_email: z.string().email(),
      buyer_name: z.string().min(1),
      buyer_email: z.string().email(),
      message: z.string().optional().default(""),
      send_date: z.string().optional().describe("ISO date for scheduled delivery (e.g. 2026-04-01). Omit for immediate."),
      billing_profile_id: z.number().int().optional().describe("Saved credit card ID. Omit for guest checkout."),
    },
    safe(async (params) => json(await api.sendEgift(params)))
  );

  // ─── Promotions ─────────────────────────────────────────────────────

  server.tool(
    "activate_promotion",
    "Redeem a promotional code to earn bonus points or rewards.",
    { code: z.string().min(1) },
    safe(async ({ code }) => json(await api.activatePromotion(code)))
  );

  // ─── Content ────────────────────────────────────────────────────────

  server.tool(
    "get_faq",
    "Get frequently asked questions and help content.",
    {},
    safe(async () => json(await api.getFaq()))
  );

  // ─── Password Reset ─────────────────────────────────────────────────

  server.tool(
    "request_password_reset",
    "Send a password reset email. Works without being logged in.",
    { email: z.string().email() },
    safe(async ({ email }) => json(await api.requestPasswordReset(email)))
  );

  // ─── Guest Balance Check ────────────────────────────────────────────

  server.tool(
    "check_card_balance",
    "Check a card balance without logging in. Requires card number and PIN.",
    { number: z.string().min(1), pin: z.string().min(1) },
    safe(async ({ number, pin }) => json(await api.checkCardBalance(number, pin)))
  );

  // ─── Account Deletion ───────────────────────────────────────────────

  server.tool(
    "delete_account",
    "Permanently delete the user's account. Requires password confirmation. THIS CANNOT BE UNDONE.",
    { password: z.string().min(1) },
    safe(async ({ password }) => json(await api.deleteAccount(password)))
  );
}
