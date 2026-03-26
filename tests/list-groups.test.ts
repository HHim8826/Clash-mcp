import { describe, expect, it } from "vitest";

import { createListGroupsTool } from "../src/tools/list-groups";

describe("createListGroupsTool", () => {
  it("returns a stable group summary list", async () => {
    const tool = createListGroupsTool({
      async listGroupsRaw() {
        return {
          GLOBAL: {
            type: "Selector",
            now: "US-01",
            all: ["US-01", "JP-01"],
          },
          Auto: {
            type: "URLTest",
            now: "HK-01",
            all: ["HK-01"],
          },
        };
      },
    });

    const result = await tool.execute();

    expect(result).toEqual([
      { name: "GLOBAL", type: "Selector", now: "US-01", allCount: 2 },
      { name: "Auto", type: "URLTest", now: "HK-01", allCount: 1 },
    ]);
  });
});
