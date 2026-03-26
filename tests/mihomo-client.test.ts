import { describe, expect, it } from "vitest";

import { MihomoClient } from "../src/mihomo-client";

describe("MihomoClient.listProxiesRaw", () => {
  it("maps 401 to AUTH_ERROR", async () => {
    const client = new MihomoClient(
      {
        mihomoBaseUrl: "http://127.0.0.1:9090",
        mihomoSecret: "secret",
        timeoutMs: 500,
      },
      async () =>
        new Response(JSON.stringify({ message: "unauthorized" }), {
          status: 401,
        })
    );

    await expect(client.listProxiesRaw()).rejects.toMatchObject({
      code: "AUTH_ERROR",
    });
  });

  it("maps AbortError to TIMEOUT", async () => {
    const client = new MihomoClient(
      {
        mihomoBaseUrl: "http://127.0.0.1:9090",
        mihomoSecret: "secret",
        timeoutMs: 500,
      },
      async () => {
        const error = new Error("aborted");
        (error as Error & { name: string }).name = "AbortError";
        throw error;
      }
    );

    await expect(client.listProxiesRaw()).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });

  it("fetches groups from /group", async () => {
    let calledUrl = "";

    const client = new MihomoClient(
      {
        mihomoBaseUrl: "http://127.0.0.1:9090",
        mihomoSecret: "secret",
        timeoutMs: 500,
      },
      async (input) => {
        calledUrl = String(input);

        return new Response(
          JSON.stringify({
            GLOBAL: {
              type: "Selector",
              now: "US-01",
              all: ["US-01", "JP-01"],
            },
          }),
          { status: 200 }
        );
      }
    );

    const result = await client.listGroupsRaw();

    expect(calledUrl).toBe("http://127.0.0.1:9090/group");
    expect(result).toEqual({
      GLOBAL: {
        type: "Selector",
        now: "US-01",
        all: ["US-01", "JP-01"],
      },
    });
  });

  it("fetches groups from /group when response is wrapped in proxies", async () => {
    const client = new MihomoClient(
      {
        mihomoBaseUrl: "http://127.0.0.1:9090",
        mihomoSecret: "secret",
        timeoutMs: 500,
      },
      async () =>
        new Response(
          JSON.stringify({
            proxies: {
              GLOBAL: {
                type: "Selector",
                now: "Azure HK",
                all: ["DIRECT", "Azure HK", "Azure Warp HK"],
              },
            },
          }),
          { status: 200 }
        )
    );

    const result = await client.listGroupsRaw();

    expect(result).toEqual({
      GLOBAL: {
        type: "Selector",
        now: "Azure HK",
        all: ["DIRECT", "Azure HK", "Azure Warp HK"],
      },
    });
  });

  it("fetches groups from /group when proxies is an array", async () => {
    const client = new MihomoClient(
      {
        mihomoBaseUrl: "http://127.0.0.1:9090",
        mihomoSecret: "secret",
        timeoutMs: 500,
      },
      async () =>
        new Response(
          JSON.stringify({
            proxies: [
              {
                name: "GLOBAL",
                type: "Selector",
                now: "Azure HK",
                all: ["DIRECT", "Azure HK", "Azure Warp HK"],
              },
            ],
          }),
          { status: 200 }
        )
    );

    const result = await client.listGroupsRaw();

    expect(result).toEqual({
      GLOBAL: {
        type: "Selector",
        now: "Azure HK",
        all: ["DIRECT", "Azure HK", "Azure Warp HK"],
      },
    });
  });

  it("fetches current mode from /configs", async () => {
    let calledUrl = "";

    const client = new MihomoClient(
      {
        mihomoBaseUrl: "http://127.0.0.1:9090",
        mihomoSecret: "secret",
        timeoutMs: 500,
      },
      async (input) => {
        calledUrl = String(input);

        return new Response(
          JSON.stringify({
            mode: "Global",
          }),
          { status: 200 }
        );
      }
    );

    const mode = await client.getCurrentModeRaw();

    expect(calledUrl).toBe("http://127.0.0.1:9090/configs");
    expect(mode).toBe("global");
  });

  it("checks proxy delay and retries once on transient failure", async () => {
    const calledUrls: string[] = [];
    let attempts = 0;

    const client = new MihomoClient(
      {
        mihomoBaseUrl: "http://127.0.0.1:9090",
        mihomoSecret: "secret",
        timeoutMs: 500,
      },
      async (input) => {
        attempts += 1;
        calledUrls.push(String(input));

        if (attempts === 1) {
          throw new Error("temporary network glitch");
        }

        return new Response(JSON.stringify({ delay: 99 }), { status: 200 });
      }
    );

    const result = await client.checkProxyDelayRaw({
      proxyName: "HK-01",
      url: "https://www.gstatic.com/generate_204",
      timeoutMs: 5000,
    });

    expect(attempts).toBe(2);
    expect(calledUrls[1]).toBe(
      "http://127.0.0.1:9090/proxies/HK-01/delay?url=https%3A%2F%2Fwww.gstatic.com%2Fgenerate_204&timeout=5000"
    );
    expect(result).toEqual({ delay: 99 });
  });

  it("maps AbortError to TIMEOUT for proxy delay checks", async () => {
    const client = new MihomoClient(
      {
        mihomoBaseUrl: "http://127.0.0.1:9090",
        mihomoSecret: "secret",
        timeoutMs: 500,
      },
      async () => {
        const error = new Error("aborted");
        (error as Error & { name: string }).name = "AbortError";
        throw error;
      }
    );

    await expect(
      client.checkProxyDelayRaw({
        proxyName: "HK-01",
        url: "https://www.gstatic.com/generate_204",
        timeoutMs: 5000,
      })
    ).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });

  it("switches group proxy via PUT without retry", async () => {
    const requests: Array<{ url: string; method: string; body: string | null }> = [];
    let attempts = 0;

    const client = new MihomoClient(
      {
        mihomoBaseUrl: "http://127.0.0.1:9090",
        mihomoSecret: "secret",
        timeoutMs: 500,
      },
      async (input, init) => {
        attempts += 1;
        requests.push({
          url: String(input),
          method: String(init?.method ?? "GET"),
          body: typeof init?.body === "string" ? init.body : null,
        });

        return new Response(null, { status: 204 });
      }
    );

    await client.switchProxyRaw({
      groupName: "GLOBAL",
      targetProxy: "JP-01",
    });

    expect(attempts).toBe(1);
    expect(requests[0]).toEqual({
      url: "http://127.0.0.1:9090/proxies/GLOBAL",
      method: "PUT",
      body: '{"name":"JP-01"}',
    });
  });

  it("does not retry switch write on transient failure", async () => {
    let attempts = 0;

    const client = new MihomoClient(
      {
        mihomoBaseUrl: "http://127.0.0.1:9090",
        mihomoSecret: "secret",
        timeoutMs: 500,
      },
      async () => {
        attempts += 1;
        throw new Error("temporary network glitch");
      }
    );

    await expect(
      client.switchProxyRaw({
        groupName: "GLOBAL",
        targetProxy: "JP-01",
      })
    ).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });

    expect(attempts).toBe(1);
  });

});
