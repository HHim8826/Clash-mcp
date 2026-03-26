import { describe, expect, it } from "vitest";

import { AppError, getRuntimeConfig } from "../src/config";

describe("getRuntimeConfig", () => {
  it("throws CONFIG_MISSING when required env vars are absent", () => {
    expect(() => getRuntimeConfig({})).toThrowError(AppError);

    try {
      getRuntimeConfig({});
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe("CONFIG_MISSING");
      expect(appError.message).toContain("MIHOMO_BASE_URL");
      expect(appError.message).toContain("MIHOMO_SECRET");
    }
  });

  it("normalizes base url when protocol is missing", () => {
    const config = getRuntimeConfig({
      MIHOMO_BASE_URL: "127.0.0.1:9090",
      MIHOMO_SECRET: "secret",
    });

    expect(config.mihomoBaseUrl).toBe("http://127.0.0.1:9090");
  });

  it("falls back to default timeout when MIHOMO_TIMEOUT_MS is invalid", () => {
    const config = getRuntimeConfig({
      MIHOMO_BASE_URL: "http://127.0.0.1:9090",
      MIHOMO_SECRET: "secret",
      MIHOMO_TIMEOUT_MS: "NaN",
    });

    expect(config.timeoutMs).toBe(5000);
  });

  it("falls back to default timeout when MIHOMO_TIMEOUT_MS is zero or negative", () => {
    const zeroTimeoutConfig = getRuntimeConfig({
      MIHOMO_BASE_URL: "http://127.0.0.1:9090",
      MIHOMO_SECRET: "secret",
      MIHOMO_TIMEOUT_MS: "0",
    });

    const negativeTimeoutConfig = getRuntimeConfig({
      MIHOMO_BASE_URL: "http://127.0.0.1:9090",
      MIHOMO_SECRET: "secret",
      MIHOMO_TIMEOUT_MS: "-100",
    });

    expect(zeroTimeoutConfig.timeoutMs).toBe(5000);
    expect(negativeTimeoutConfig.timeoutMs).toBe(5000);
  });
});
