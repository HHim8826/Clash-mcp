import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("createApp", () => {
  it("exposes list_proxies via public tool interface", async () => {
    const app = createApp({
      async listProxiesRaw() {
        return {
          "US-01": { type: "Hysteria2", alive: true, history: [{ delay: 120 }] },
        };
      },
      async listGroupsRaw() {
        return {};
      },
      async checkProxyDelayRaw() {
        return { delay: 0 };
      },
      async switchProxyRaw() {
        return;
      },
    });

    const result = await app.invokeTool("list_proxies");

    expect(result).toEqual([
      {
        name: "US-01",
        type: "Hysteria2",
        alive: true,
        delay: 120,
        now: "US-01",
      },
    ]);
  });

  it("exposes list_groups via public tool interface", async () => {
    const app = createApp({
      async listProxiesRaw() {
        return {};
      },
      async listGroupsRaw() {
        return {
          GLOBAL: {
            type: "Selector",
            now: "US-01",
            all: ["US-01", "JP-01"],
          },
        };
      },
      async checkProxyDelayRaw() {
        return { delay: 0 };
      },
      async switchProxyRaw() {
        return;
      },
    });

    const result = await app.invokeTool("list_groups");

    expect(result).toEqual([
      {
        name: "GLOBAL",
        type: "Selector",
        now: "US-01",
        allCount: 2,
      },
    ]);
  });

  it("exposes check_proxy_delay via public tool interface", async () => {
    const app = createApp({
      async listProxiesRaw() {
        return {};
      },
      async listGroupsRaw() {
        return {};
      },
      async checkProxyDelayRaw() {
        return { delay: 87 };
      },
      async switchProxyRaw() {
        return;
      },
    });

    const result = await app.invokeTool("check_proxy_delay", {
      proxyName: "HK-01",
      url: "https://www.gstatic.com/generate_204",
      timeoutMs: 5000,
    });

    expect(result).toEqual({
      proxyName: "HK-01",
      url: "https://www.gstatic.com/generate_204",
      delayMs: 87,
    });
  });

  it("supports prepare and confirm proxy switch with single-use token", async () => {
    let switchedTo = "";

    const app = createApp({
      async getCurrentModeRaw() {
        return "global";
      },
      async listProxiesRaw() {
        return {};
      },
      async listGroupsRaw() {
        return {
          GLOBAL: {
            type: "Selector",
            now: "US-01",
            all: ["US-01", "JP-01"],
          },
        };
      },
      async checkProxyDelayRaw() {
        return { delay: 0 };
      },
      async switchProxyRaw(input) {
        switchedTo = input.targetProxy;
      },
    });

    const prepared = await app.invokeTool("prepare_proxy_switch", {
      groupName: "GLOBAL",
      targetProxy: "JP-01",
    });

    expect(prepared).toMatchObject({
      groupName: "GLOBAL",
      beforeProxy: "US-01",
      toProxy: "JP-01",
    });

    const preflight = await app.invokeTool("preflight_proxy_switch", {
      token: (prepared as { token: string }).token,
    });

    const confirmed = await app.invokeTool("confirm_proxy_switch", {
      token: (prepared as { token: string }).token,
      preflightToken: (preflight as { preflightToken: string }).preflightToken,
    });

    expect(switchedTo).toBe("JP-01");
    expect(confirmed).toMatchObject({
      groupName: "GLOBAL",
      beforeProxy: "US-01",
      afterProxy: "JP-01",
    });

    await expect(
      app.invokeTool("confirm_proxy_switch", {
        token: (prepared as { token: string }).token,
        preflightToken: (preflight as { preflightToken: string }).preflightToken,
      })
    ).rejects.toMatchObject({
      code: "TOKEN_USED",
    });
  });

  it("returns metrics snapshot after tool calls", async () => {
    const app = createApp({
      async listProxiesRaw() {
        return {};
      },
      async listGroupsRaw() {
        return {};
      },
      async checkProxyDelayRaw() {
        return { delay: 0 };
      },
      async switchProxyRaw() {
        return;
      },
    });

    await app.invokeTool("list_proxies");
    const metrics = await app.invokeTool("get_metrics_snapshot");

    expect(metrics).toMatchObject({
      tools: {
        list_proxies: {
          success: 1,
        },
      },
    });
  });
});
