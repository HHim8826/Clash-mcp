export type ProxyRaw = {
  type?: string;
  alive?: boolean;
  history?: Array<{ delay?: number }>;
};

export type ProxySummary = {
  name: string;
  type: string;
  alive: boolean;
  delay: number | null;
  now: string;
};

export type ListProxiesClient = {
  listProxiesRaw(): Promise<Record<string, ProxyRaw>>;
};

export function createListProxiesTool(client: ListProxiesClient) {
  return {
    async execute(): Promise<ProxySummary[]> {
      const proxies = await client.listProxiesRaw();

      return Object.entries(proxies).map(([name, proxy]) => {
        const latestDelay = proxy.history?.[0]?.delay;

        return {
          name,
          type: proxy.type ?? "UNKNOWN",
          alive: Boolean(proxy.alive),
          delay: typeof latestDelay === "number" ? latestDelay : null,
          now: name,
        };
      });
    },
  };
}
