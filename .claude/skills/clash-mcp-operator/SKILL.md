---
name: clash-mcp-operator
description: Operates and validates the Clash MCP server for daily proxy workflows, including mode-aware proxy switching, delay checks, and runtime verification. Use when users ask to test clash-mcp, check current mode, switch proxy safely, verify MCP JSON setup, or run preflight/confirm operational flows in OpenCode or Claude Code.
---

# Clash MCP Operator

## Quick start

Use this skill to run safe daily operations for clash-mcp:

1. Verify server reachability with `get_metrics_snapshot`.
2. Run a read-only probe with `check_proxy_delay`.
3. For writes, always use `prepare_proxy_switch -> preflight_proxy_switch -> confirm_proxy_switch`.
4. Confirm mode/group consistency before switching.

## Workflows

### 1. MCP connectivity check

- [ ] Confirm MCP config is valid for the active client (OpenCode or Claude Code).
- [ ] Verify required env values exist: `MIHOMO_BASE_URL`, `MIHOMO_SECRET`.
- [ ] Call `get_metrics_snapshot` to confirm tool availability.
- [ ] Call `check_proxy_delay` with `DIRECT` and `https://www.gstatic.com/generate_204`.
- [ ] If failure occurs, report exact error and the next actionable fix.

### 2. Mode-aware proxy switch

- [ ] Read current mode from `/configs` through the server flow.
- [ ] Enforce mapping: `global -> GLOBAL`, `rule -> RULE`, `direct -> DIRECT`.
- [ ] Reject requests where input `groupName` mismatches the current mode group.
- [ ] Execute prepare/preflight/confirm in order.
- [ ] Verify result includes `beforeProxy`, `afterProxy`, and success metrics.

### 3. Safety and rollback posture

- [ ] Never skip `preflight` for write operations.
- [ ] Treat token errors (`TOKEN_EXPIRED`, `TOKEN_USED`, `PREFLIGHT_INVALID`) as hard stops.
- [ ] Avoid retrying write operations automatically.
- [ ] Record the exact command/tool input used when reporting failures.

### 4. Publishing and runtime checks

- [ ] Before release: run `npm test` and `npm run typecheck`.
- [ ] For npm release: bump version first, then publish.
- [ ] If publish fails with "Cannot publish over previously published version", bump and retry.
- [ ] For CI publish, ensure `NPM_TOKEN` exists in GitHub Actions secrets.

## Advanced notes

- OpenCode config uses `mcp.<name>.command` array and `environment`.
- Claude Code config uses `mcpServers.<name>.command/args/env`.
- If local mode is used (`node dist/index.js`), rebuild with `npm run build` after code changes.
