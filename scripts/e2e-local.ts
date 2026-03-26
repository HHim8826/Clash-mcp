import { getRuntimeConfig } from "../src/config";
import { MihomoClient } from "../src/mihomo-client";
import { createApp } from "../src/app";

function pickFirst(values: string[] | undefined): string | undefined {
  return values && values.length > 0 ? values[0] : undefined;
}

async function main(): Promise<void> {
  const config = getRuntimeConfig(process.env);
  const client = new MihomoClient(config);
  const app = createApp(client);

  const targetProxy = process.env.E2E_TARGET_PROXY;
  const allowConfirm = process.env.E2E_CONFIRM === "1";

  const proxies = await app.invokeTool("list_proxies");
  const groups = await app.invokeTool("list_groups");
  const groupName = process.env.E2E_GROUP_NAME ?? pickFirst(
    Array.isArray(groups)
      ? (groups as Array<{ name: string }>).map((group) => group.name)
      : undefined
  );

  console.log("[e2e] list_proxies ok");
  console.log(`[e2e] list_groups ok (${Array.isArray(groups) ? groups.length : 0})`);

  if (groupName && targetProxy) {
    const prepared = (await app.invokeTool("prepare_proxy_switch", {
      groupName,
      targetProxy,
    })) as { token: string };

    const preflight = (await app.invokeTool("preflight_proxy_switch", {
      token: prepared.token,
    })) as { preflightToken: string };

    console.log(`[e2e] proxy switch preflight ok for ${groupName} -> ${targetProxy}`);

    if (allowConfirm) {
      const confirmed = await app.invokeTool("confirm_proxy_switch", {
        token: prepared.token,
        preflightToken: preflight.preflightToken,
      });
      console.log("[e2e] proxy switch confirm ok", confirmed);
    } else {
      console.log("[e2e] proxy switch confirm skipped (set E2E_CONFIRM=1 to enable)");
    }
  } else {
    console.log("[e2e] proxy switch skipped (set E2E_GROUP_NAME and E2E_TARGET_PROXY)");
  }

  const metrics = await app.invokeTool("get_metrics_snapshot");
  console.log("[e2e] metrics snapshot", metrics);

  void proxies;
}

main().catch((error) => {
  console.error("[e2e] failed", error);
  process.exit(1);
});
