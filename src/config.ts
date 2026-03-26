export type AppErrorCode =
  | "CONFIG_MISSING"
  | "AUTH_ERROR"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "TOKEN_USED"
  | "PREFLIGHT_REQUIRED"
  | "PREFLIGHT_INVALID";

export class AppError extends Error {
  public readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type RuntimeConfig = {
  mihomoBaseUrl: string;
  mihomoSecret: string;
  timeoutMs: number;
};

export function getRuntimeConfig(
  env: Record<string, string | undefined>
): RuntimeConfig {
  const missing: string[] = [];

  if (!env.MIHOMO_BASE_URL) {
    missing.push("MIHOMO_BASE_URL");
  }

  if (!env.MIHOMO_SECRET) {
    missing.push("MIHOMO_SECRET");
  }

  if (missing.length > 0) {
    throw new AppError(
      "CONFIG_MISSING",
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  const parsedTimeoutMs = Number(env.MIHOMO_TIMEOUT_MS ?? "5000");
  const timeoutMs =
    Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0
      ? parsedTimeoutMs
      : 5000;
  const normalizedBaseUrl = env.MIHOMO_BASE_URL!.startsWith("http")
    ? env.MIHOMO_BASE_URL!
    : `http://${env.MIHOMO_BASE_URL!}`;

  return {
    mihomoBaseUrl: normalizedBaseUrl,
    mihomoSecret: env.MIHOMO_SECRET!,
    timeoutMs,
  };
}
