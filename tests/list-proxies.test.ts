import { describe, expect, it } from "vitest";

import { createListProxiesTool } from "../src/tools/list-proxies";

describe("createListProxiesTool", () => {
  it("returns a stable proxy summary list", async () => {
    const tool = createListProxiesTool({
      async listProxiesRaw() {
        return {
          "HK-01": { type: "Trojan", alive: true, history: [{ delay: 50 }] },
          "JP-01": { type: "VMess", alive: false, history: [] },
        };
      },
    });

    const result = await tool.execute();

    expect(result).toEqual([
      { name: "HK-01", type: "Trojan", alive: true, delay: 50, now: "HK-01" },
      { name: "JP-01", type: "VMess", alive: false, delay: null, now: "JP-01" },
    ]);
  });
});
