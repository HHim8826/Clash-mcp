#!/usr/bin/env node

import { getRuntimeConfig } from "./config";
import { startStdioServer } from "./mcp-server";

async function main(): Promise<void> {
  const config = getRuntimeConfig(process.env);
  await startStdioServer(config);
  process.stderr.write(
    `clash-mcp MCP server started on stdio for ${config.mihomoBaseUrl}\n`
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Failed to start clash-mcp: ${String(error)}\n`);
    process.exit(1);
  });
}
