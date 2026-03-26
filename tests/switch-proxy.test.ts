import { describe, expect, it } from "vitest";

import { createSwitchProxyTool } from "../src/tools/switch-proxy";

describe("createSwitchProxyTool", () => {
  it("rejects group switch when groupName does not match current mode", async () => {
    const tool = createSwitchProxyTool(
      {
        async getCurrentModeRaw() {
          return "rule";
        },
        async listGroupsRaw() {
          return {
            GLOBAL: {
              type: "Selector",
              now: "US-01",
              all: ["US-01", "JP-01"],
            },
            RULE: {
              type: "Selector",
              now: "US-01",
              all: ["US-01", "JP-01"],
            },
          };
        },
        async switchProxyRaw() {
          return;
        },
      },
      {}
    );

    await expect(
      tool.prepare({
        groupName: "GLOBAL",
        targetProxy: "JP-01",
      })
    ).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
  });

  it("requires preflight before confirm", async () => {
    const tool = createSwitchProxyTool(
      {
        async getCurrentModeRaw() {
          return "global";
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
        async switchProxyRaw() {
          return;
        },
      },
      {}
    );

    const prepared = await tool.prepare({
      groupName: "GLOBAL",
      targetProxy: "JP-01",
    });

    await expect(
      tool.confirm({
        token: prepared.token,
        preflightToken: "wrong-preflight-token",
      })
    ).rejects.toMatchObject({ code: "PREFLIGHT_REQUIRED" });
  });

  it("rejects invalid preflight token", async () => {
    const tool = createSwitchProxyTool(
      {
        async getCurrentModeRaw() {
          return "global";
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
        async switchProxyRaw() {
          return;
        },
      },
      {}
    );

    const prepared = await tool.prepare({
      groupName: "GLOBAL",
      targetProxy: "JP-01",
    });

    await tool.preflight({ token: prepared.token });

    await expect(
      tool.confirm({
        token: prepared.token,
        preflightToken: "wrong-preflight-token",
      })
    ).rejects.toMatchObject({ code: "PREFLIGHT_INVALID" });
  });

  it("rejects expired token on preflight and confirm", async () => {
    let nowMs = 0;

    const tool = createSwitchProxyTool(
      {
        async getCurrentModeRaw() {
          return "global";
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
        async switchProxyRaw() {
          return;
        },
      },
      {
        tokenTtlMs: 10,
        now: () => new Date(nowMs),
      }
    );

    const prepared = await tool.prepare({
      groupName: "GLOBAL",
      targetProxy: "JP-01",
    });

    nowMs = 10;

    await expect(tool.preflight({ token: prepared.token })).rejects.toMatchObject({
      code: "TOKEN_EXPIRED",
    });

    await expect(
      tool.confirm({
        token: prepared.token,
        preflightToken: "any",
      })
    ).rejects.toMatchObject({ code: "TOKEN_EXPIRED" });
  });

  it("returns TOKEN_INVALID for unknown token", async () => {
    const tool = createSwitchProxyTool(
      {
        async getCurrentModeRaw() {
          return "global";
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
        async switchProxyRaw() {
          return;
        },
      },
      {}
    );

    await expect(tool.preflight({ token: "missing" })).rejects.toMatchObject({
      code: "TOKEN_INVALID",
    });
  });
});
