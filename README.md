# Spoonity Consumer MCP Server

MCP server exposing the Spoonity Loyalty REST API for voice/AI assistant integration (Siri, Google Gemini, in-app voice control).

## Quick Start

```bash
npm install
npm run build

# Run with user credentials from the mobile app
SPOONITY_SESSION_KEY=<session_key> \
SPOONITY_VENDOR_ID=<vendor_id> \
node dist/index.js
```

## Configuration

| Env Var | Required | Default | Description |
|---------|----------|---------|-------------|
| `SPOONITY_SESSION_KEY` | ✅ | — | User's session key (passed from mobile app) |
| `SPOONITY_VENDOR_ID` | ✅ | — | Brand/vendor identifier |
| `SPOONITY_API_URL` | ❌ | `https://api.spoonity.com` | API base URL |

## Tools (28)

### Auth
| Tool | Description |
|------|-------------|
| `login` | Email/password authentication |
| `register` | New account creation |
| `check_email_exists` | Pre-registration check |
| `logout` | End session |

### Profile
| Tool | Description |
|------|-------------|
| `get_profile` | User info (name, email, phone) |
| `update_profile` | Edit profile fields |
| `change_password` | Password change |

### Loyalty & Payments
| Tool | Description |
|------|-------------|
| `get_balance` | Quick Pay wallet balance |
| `get_points` | Loyalty point balances |
| `get_barcode` | QR code for scanning at register |
| `get_rewards` | Available rewards + tier + progress |
| `get_credit_cards` | Saved payment methods |
| `reload_balance` | Add funds to wallet |
| `get_auto_reload` | Auto-reload settings |

### Transactions
| Tool | Description |
|------|-------------|
| `get_transactions` | Purchase history |
| `rate_transaction` | Star rating + comment |
| `tip_transaction` | Add tip |

### Stores & Cards
| Tool | Description |
|------|-------------|
| `get_stores` | Nearby store locator |
| `get_cards` | Linked loyalty/gift cards |
| `add_card` | Link a card |
| `remove_card` | Unlink a card |

### Communication
| Tool | Description |
|------|-------------|
| `get_messages` | In-app inbox |
| `send_egift` | Digital gift card |
| `activate_promotion` | Promo code redemption |
| `get_faq` | Help content |
| `request_password_reset` | Forgot password |
| `check_card_balance` | Guest balance check |
| `delete_account` | Account removal |

## Prompts

| Prompt | Description |
|--------|-------------|
| `check_my_rewards` | Check points, balance, tier, and available rewards |
| `order_my_usual` | Reorder last purchase |
| `reload_my_balance` | Reload wallet with specified amount |
| `find_nearest_store` | Find closest open stores |
| `send_a_gift` | Send a digital gift card |

## Claude Desktop Config

```json
{
  "mcpServers": {
    "spoonity": {
      "command": "node",
      "args": ["/path/to/spoonity-consumer-mcp-server/dist/index.js"],
      "env": {
        "SPOONITY_SESSION_KEY": "<session_key>",
        "SPOONITY_VENDOR_ID": "106292"
      }
    }
  }
}
```

## Architecture

This server is designed to work alongside the **Deliverect MCP Server** for seamless ordering + loyalty integration. The mobile app:

1. Authenticates user (gets session key)
2. Launches MCP client with session key as env var
3. Voice assistant uses both servers: Spoonity for loyalty/rewards, Deliverect for ordering
4. Rewards from Spoonity can be applied during Deliverect checkout

---

*Spoonity Product Team — March 2026*
