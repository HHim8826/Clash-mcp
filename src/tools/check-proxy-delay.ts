export type CheckProxyDelayInput = {
  proxyName: string;
  url: string;
  timeoutMs: number;
};

export type CheckProxyDelayResult = {
  proxyName: string;
  url: string;
  delayMs: number;
};

export type CheckProxyDelayClient = {
  checkProxyDelayRaw(input: CheckProxyDelayInput): Promise<{ delay: number }>;
};

export function createCheckProxyDelayTool(client: CheckProxyDelayClient) {
  return {
    async execute(input: CheckProxyDelayInput): Promise<CheckProxyDelayResult> {
      if (!input.proxyName || !input.url || !Number.isFinite(input.timeoutMs)) {
        throw new Error("Invalid input for check_proxy_delay");
      }

      const result = await client.checkProxyDelayRaw(input);

      return {
        proxyName: input.proxyName,
        url: input.url,
        delayMs: result.delay,
      };
    },
  };
}