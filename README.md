# Clash MCP Server

A Model Context Protocol (MCP) server for Mihomo/Clash control.

This project exposes a focused toolset for listing proxies/groups,
checking proxy delay, and safely switching proxy state through a
prepare -> preflight -> confirm flow.

## Features

- List proxies and groups
- Check proxy delay for a target URL
- Two-step safety flow for writes:
  - prepare_proxy_switch -> preflight_proxy_switch -> confirm_proxy_switch
- Structured telemetry and audit logs
- Retry strategy for read operations, no retry for write operations

## Requirements

- Node.js 20+
- A running Mihomo API endpoint

## Installation

1. Install dependencies:

   npm install

2. Build:

   npm run build

## Environment Variables

- MIHOMO_BASE_URL (required)
  - Example: http://127.0.0.1:9090
- MIHOMO_SECRET (required)
  - Mihomo API bearer token
- MIHOMO_TIMEOUT_MS (optional)
  - Request timeout in milliseconds
  - Defaults to 5000
  - Non-positive or invalid values fall back to 5000

## Run

Development mode:

npm run dev

Build and run:

npm run build
npm start

## Quick start (npx MCP config)

Use the following configuration to run the server with `npx`.

### OpenCode

Add this block to your `~/.config/opencode/opencode.jsonc` file:

```json
{
  "mcp": {
    "clash-mcp": {
      "type": "local",
      "command": ["npx", "-y", "clash-mcp@latest"],
      "environment": {
        "MIHOMO_BASE_URL": "http://127.0.0.1:9090",
        "MIHOMO_SECRET": "your_mihomo_secret",
        "MIHOMO_TIMEOUT_MS": "5000"
      }
    }
  }
}
```

### Claude Code

Add this block to your Claude Code MCP JSON config:

```json
{
  "mcpServers": {
    "clash-mcp": {
      "command": "npx",
      "args": ["-y", "clash-mcp@latest"],
      "env": {
        "MIHOMO_BASE_URL": "http://127.0.0.1:9090",
        "MIHOMO_SECRET": "your_mihomo_secret",
        "MIHOMO_TIMEOUT_MS": "5000"
      }
    }
  }
}
```

## Test

Run unit tests:

npm test

## Logs

Telemetry writes logs under logs/ by default:

- logs/app.log
- logs/audit.log

## Tool Overview

Read tools:

- list_proxies
- list_groups
- check_proxy_delay
- get_metrics_snapshot

Write tools (guarded by token flow):

- prepare_proxy_switch
- preflight_proxy_switch
- confirm_proxy_switch

## Project Structure

- src/: application source code
- tests/: test suite
- docs/: additional docs and checklists

## Notes

- Write operations are intentionally not retried to avoid duplicate side effects.
- Token-based write flow enforces explicit confirmation before state changes.
