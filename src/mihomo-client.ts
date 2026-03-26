import { AppError, RuntimeConfig } from "./config";
import { GroupRaw } from "./tools/list-groups";
import { ProxyRaw } from "./tools/list-proxies";

type Fetcher = typeof fetch;

export class MihomoClient {
  constructor(
    private readonly config: RuntimeConfig,
    private readonly fetcher: Fetcher = fetch
  ) {}

  async listProxiesRaw(): Promise<Record<string, ProxyRaw>> {
    const data = (await this.getJsonWithRetry("/proxies")) as {
      proxies?: Record<string, ProxyRaw>;
    };

    return data.proxies ?? {};
  }

  async listGroupsRaw(): Promise<Record<string, GroupRaw>> {
    const data = (await this.getJsonWithRetry("/group")) as
      | {
          proxies?: unknown;
        }
      | Record<string, GroupRaw>;

    const groups = (data as { proxies?: unknown }).proxies;

    if (Array.isArray(groups)) {
      const normalized: Record<string, GroupRaw> = {};

      for (const entry of groups) {
        if (
          typeof entry === "object" &&
          entry !== null &&
          "name" in entry &&
          typeof (entry as { name?: unknown }).name === "string"
        ) {
          const item = entry as {
            name: string;
            type?: string;
            now?: string;
            all?: string[];
          };
          normalized[item.name] = {
            type: item.type,
            now: item.now,
            all: item.all,
          };
        }
      }

      return normalized;
    }

    if (groups && typeof groups === "object" && !Array.isArray(groups)) {
      return groups as Record<string, GroupRaw>;
    }

    return data as Record<string, GroupRaw>;
  }

  async getCurrentModeRaw(): Promise<string> {
    const data = (await this.getJsonWithRetry("/configs")) as {
      mode?: unknown;
    };

    if (typeof data.mode !== "string") {
      throw new AppError("UPSTREAM_ERROR", "missing mode from mihomo configs");
    }

    return data.mode.trim().toLowerCase();
  }

  async checkProxyDelayRaw(input: {
    proxyName: string;
    url: string;
    timeoutMs: number;
  }): Promise<{ delay: number }> {
    const query = new URLSearchParams({
      url: input.url,
      timeout: String(input.timeoutMs),
    });
    const encodedProxyName = encodeURIComponent(input.proxyName);
    const path = `/proxies/${encodedProxyName}/delay?${query.toString()}`;
    const data = (await this.getJsonWithRetry(path)) as { delay?: number };

    return {
      delay: typeof data.delay === "number" ? data.delay : -1,
    };
  }

  async switchProxyRaw(input: {
    groupName: string;
    targetProxy: string;
  }): Promise<void> {
    const encodedGroupName = encodeURIComponent(input.groupName);
    const path = `/proxies/${encodedGroupName}`;

    try {
      const response = await this.fetchWithTimeoutRequest(path, {
        method: "PUT",
        body: JSON.stringify({ name: input.targetProxy }),
      });

      if (response.status === 401) {
        throw new AppError("AUTH_ERROR", "mihomo authentication failed");
      }

      if (!response.ok) {
        throw new AppError(
          "UPSTREAM_ERROR",
          `mihomo returned status ${response.status}`
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (this.isAbortError(error)) {
        throw new AppError("TIMEOUT", "request to mihomo timed out");
      }

      throw new AppError("UPSTREAM_ERROR", "failed to call mihomo");
    }
  }

  private async getJsonWithRetry(path: string): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetchGetWithTimeout(path);

        if (response.status === 401) {
          throw new AppError("AUTH_ERROR", "mihomo authentication failed");
        }

        if (!response.ok) {
          throw new AppError(
            "UPSTREAM_ERROR",
            `mihomo returned status ${response.status}`
          );
        }

        return await response.json();
      } catch (error) {
        if (error instanceof AppError && error.code === "AUTH_ERROR") {
          throw error;
        }

        if (this.isAbortError(error)) {
          lastError = new AppError("TIMEOUT", "request to mihomo timed out");
        } else if (error instanceof AppError) {
          lastError = error;
        } else {
          lastError = new AppError("UPSTREAM_ERROR", "failed to call mihomo");
        }

        if (attempt === 1) {
          throw lastError;
        }
      }
    }

    throw lastError;
  }

  private async fetchWithTimeout(path: string): Promise<Response> {
    return this.fetchWithTimeoutRequest(path, {
      method: "GET",
    });
  }

  private async fetchGetWithTimeout(path: string): Promise<Response> {
    return this.fetchWithTimeoutRequest(path, {
      method: "GET",
    });
  }

  private async fetchWithTimeoutRequest(
    path: string,
    request: {
      method: "GET" | "PUT";
      body?: string;
    }
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      return await this.fetcher(`${this.config.mihomoBaseUrl}${path}`, {
        method: request.method,
        headers: {
          Authorization: `Bearer ${this.config.mihomoSecret}`,
          ...(request.body
            ? {
                "Content-Type": "application/json",
              }
            : {}),
        },
        body: request.body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private isAbortError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError"
    );
  }
}
