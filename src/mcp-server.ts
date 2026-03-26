import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createApp } from "./app";
import { MihomoClient } from "./mihomo-client";
import { RuntimeConfig } from "./config";

type AppApi = ReturnType<typeof createApp>;

function toTextResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function buildMcpServer(app: AppApi): McpServer {
  const server = new McpServer({
    name: "clash-mcp",
    version: "1.0.0",
  });

  server.registerTool("list_proxies", {
    description: "List proxy summaries from Mihomo",
  }, async () => toTextResult(await app.invokeTool("list_proxies")));

  server.registerTool("list_groups", {
    description: "List policy groups from Mihomo",
  }, async () => toTextResult(await app.invokeTool("list_groups")));

  server.registerTool("check_proxy_delay", {
    description: "Check delay for a proxy",
    inputSchema: {
      proxyName: z.string(),
      url: z.string().url(),
      timeoutMs: z.number().int().positive(),
    },
  }, async (args: unknown) => toTextResult(await app.invokeTool("check_proxy_delay", args)));

  server.registerTool("prepare_proxy_switch", {
    description: "Prepare token for proxy switch",
    inputSchema: {
      groupName: z.string(),
      targetProxy: z.string(),
    },
  }, async (args: unknown) => toTextResult(await app.invokeTool("prepare_proxy_switch", args)));

  server.registerTool("preflight_proxy_switch", {
    description: "Preflight proxy switch before confirm",
    inputSchema: {
      token: z.string(),
    },
  }, async (args: unknown) => toTextResult(await app.invokeTool("preflight_proxy_switch", args)));

  server.registerTool("confirm_proxy_switch", {
    description: "Confirm proxy switch",
    inputSchema: {
      token: z.string(),
      preflightToken: z.string(),
    },
  }, async (args: unknown) => toTextResult(await app.invokeTool("confirm_proxy_switch", args)));

  server.registerTool("get_metrics_snapshot", {
    description: "Get in-memory metrics snapshot",
  }, async () => toTextResult(await app.invokeTool("get_metrics_snapshot")));

  return server;
}

export async function startStdioServer(config: RuntimeConfig): Promise<void> {
  const client = new MihomoClient(config);
  const app = createApp(client);

  const server = buildMcpServer(app);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
