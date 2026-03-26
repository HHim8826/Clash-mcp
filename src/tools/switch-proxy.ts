import { randomUUID } from "crypto";

import { AppError } from "../config";
import { GroupRaw } from "./list-groups";

export type PrepareProxySwitchInput = {
  groupName: string;
  targetProxy: string;
};

export type PrepareProxySwitchResult = {
  token: string;
  groupName: string;
  beforeProxy: string;
  toProxy: string;
  expiresAt: string;
};

export type ConfirmProxySwitchInput = {
  token: string;
  preflightToken: string;
};

export type PreflightProxySwitchInput = {
  token: string;
};

export type PreflightProxySwitchResult = {
  token: string;
  preflightToken: string;
  groupName: string;
  targetProxy: string;
  verifiedAt: string;
};

export type ConfirmProxySwitchResult = {
  groupName: string;
  beforeProxy: string;
  afterProxy: string;
  changedAt: string;
};

type TokenRecord = {
  groupName: string;
  beforeProxy: string;
  targetProxy: string;
  expiresAtMs: number;
  used: boolean;
  preflightToken?: string;
  preflightVerifiedAt?: number;
};

export type SwitchProxyClient = {
  getCurrentModeRaw?(): Promise<string>;
  listGroupsRaw(): Promise<Record<string, GroupRaw>>;
  switchProxyRaw(input: { groupName: string; targetProxy: string }): Promise<void>;
};

function modeToGroupName(mode: string): string | null {
  const normalized = mode.trim().toLowerCase();

  if (normalized === "global") {
    return "GLOBAL";
  }

  if (normalized === "rule") {
    return "RULE";
  }

  if (normalized === "direct") {
    return "DIRECT";
  }

  return null;
}

export function createSwitchProxyTool(
  client: SwitchProxyClient,
  options: {
    tokenTtlMs?: number;
    now?: () => Date;
  }
) {
  const tokenStore = new Map<string, TokenRecord>();
  const tokenTtlMs = options.tokenTtlMs ?? 60_000;
  const now = options.now ?? (() => new Date());

  function purgeExpiredTokens(): void {
    const nowMs = now().getTime();

    for (const [token, record] of tokenStore.entries()) {
      if (nowMs >= record.expiresAtMs) {
        tokenStore.delete(token);
      }
    }
  }

  return {
    async prepare(
      input: PrepareProxySwitchInput
    ): Promise<PrepareProxySwitchResult> {
      purgeExpiredTokens();

      if (!client.getCurrentModeRaw) {
        throw new AppError("UPSTREAM_ERROR", "current mode is unavailable");
      }

      const currentMode = await client.getCurrentModeRaw();
      const expectedGroupName = modeToGroupName(currentMode);

      if (!expectedGroupName) {
        throw new AppError("UPSTREAM_ERROR", `unsupported mode: ${currentMode}`);
      }

      if (input.groupName !== expectedGroupName) {
        throw new AppError(
          "UPSTREAM_ERROR",
          `group mismatch for mode ${currentMode}: expected ${expectedGroupName}`
        );
      }

      const groups = await client.listGroupsRaw();
      const group = groups[input.groupName];

      if (!group) {
        throw new AppError("UPSTREAM_ERROR", `group not found: ${input.groupName}`);
      }

      if (!group.all?.includes(input.targetProxy)) {
        throw new AppError(
          "UPSTREAM_ERROR",
          `target proxy not in group candidates: ${input.targetProxy}`
        );
      }

      const beforeProxy = group.now ?? "";
      const token = randomUUID();
      const issuedAtMs = now().getTime();
      const expiresAtMs = issuedAtMs + tokenTtlMs;

      tokenStore.set(token, {
        groupName: input.groupName,
        beforeProxy,
        targetProxy: input.targetProxy,
        expiresAtMs,
        used: false,
      });

      return {
        token,
        groupName: input.groupName,
        beforeProxy,
        toProxy: input.targetProxy,
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
    },

    async preflight(
      input: PreflightProxySwitchInput
    ): Promise<PreflightProxySwitchResult> {
      const record = tokenStore.get(input.token);

      if (!record) {
        throw new AppError("TOKEN_INVALID", "invalid token");
      }

      if (record.used) {
        throw new AppError("TOKEN_USED", "token already used");
      }

      if (now().getTime() >= record.expiresAtMs) {
        throw new AppError("TOKEN_EXPIRED", "token expired");
      }

      const preflightToken = randomUUID();
      const verifiedAt = now().getTime();
      record.preflightToken = preflightToken;
      record.preflightVerifiedAt = verifiedAt;
      purgeExpiredTokens();

      return {
        token: input.token,
        preflightToken,
        groupName: record.groupName,
        targetProxy: record.targetProxy,
        verifiedAt: new Date(verifiedAt).toISOString(),
      };
    },

    async confirm(
      input: ConfirmProxySwitchInput
    ): Promise<ConfirmProxySwitchResult> {
      const record = tokenStore.get(input.token);

      if (!record) {
        throw new AppError("TOKEN_INVALID", "invalid token");
      }

      if (record.used) {
        throw new AppError("TOKEN_USED", "token already used");
      }

      if (now().getTime() >= record.expiresAtMs) {
        throw new AppError("TOKEN_EXPIRED", "token expired");
      }

      if (!record.preflightToken) {
        throw new AppError("PREFLIGHT_REQUIRED", "preflight is required");
      }

      if (record.preflightToken !== input.preflightToken) {
        throw new AppError("PREFLIGHT_INVALID", "invalid preflight token");
      }

      await client.switchProxyRaw({
        groupName: record.groupName,
        targetProxy: record.targetProxy,
      });

      record.used = true;
      purgeExpiredTokens();

      return {
        groupName: record.groupName,
        beforeProxy: record.beforeProxy,
        afterProxy: record.targetProxy,
        changedAt: now().toISOString(),
      };
    },
  };
}