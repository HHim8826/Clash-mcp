import { createListProxiesTool, ListProxiesClient } from "./tools/list-proxies";
import { createListGroupsTool, ListGroupsClient } from "./tools/list-groups";
import {
  createCheckProxyDelayTool,
  CheckProxyDelayClient,
} from "./tools/check-proxy-delay";
import {
  createSwitchProxyTool,
  SwitchProxyClient,
} from "./tools/switch-proxy";
import { AppError } from "./config";
import { Telemetry } from "./telemetry";

type ToolName =
  | "list_proxies"
  | "list_groups"
  | "check_proxy_delay"
  | "prepare_proxy_switch"
  | "preflight_proxy_switch"
  | "confirm_proxy_switch"
  | "get_metrics_snapshot";

type AppClient =
  & ListProxiesClient
  & ListGroupsClient
  & CheckProxyDelayClient
  & SwitchProxyClient;

export function createApp(
  client: AppClient,
  options?: {
    telemetry?: Telemetry;
  }
) {
  const listProxies = createListProxiesTool(client);
  const listGroups = createListGroupsTool(client);
  const checkProxyDelay = createCheckProxyDelayTool(client);
  const switchProxy = createSwitchProxyTool(client, {});
  const telemetry = options?.telemetry ?? new Telemetry();

  function recordAudit(input: {
    requestId: string;
    action: string;
    target: string;
    outcome: "prepared" | "confirmed" | "rejected";
    details?: Record<string, unknown>;
  }) {
    telemetry.recordAudit({
      requestId: input.requestId,
      action: input.action,
      target: input.target,
      outcome: input.outcome,
      details: input.details,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    async invokeTool(toolName: ToolName, input?: unknown) {
      const scope = telemetry.begin(toolName);
      try {
        if (toolName === "list_proxies") {
          const result = await listProxies.execute();
          telemetry.finish({
            requestId: scope.requestId,
            toolName,
            startedAtMs: scope.startedAtMs,
          });
          return result;
        }

        if (toolName === "list_groups") {
          const groups = await listGroups.execute();
          telemetry.finish({
            requestId: scope.requestId,
            toolName,
            startedAtMs: scope.startedAtMs,
          });
          return groups;
        }

        if (toolName === "check_proxy_delay") {
          const result = await checkProxyDelay.execute(input as {
            proxyName: string;
            url: string;
            timeoutMs: number;
          });
          telemetry.finish({
            requestId: scope.requestId,
            toolName,
            startedAtMs: scope.startedAtMs,
          });
          return result;
        }

        if (toolName === "prepare_proxy_switch") {
          const args = input as {
            groupName: string;
            targetProxy: string;
          };
          const result = await switchProxy.prepare(args);
          recordAudit({
            requestId: scope.requestId,
            action: "prepare_proxy_switch",
            target: args.groupName,
            outcome: "prepared",
            details: { targetProxy: args.targetProxy },
          });
          telemetry.finish({
            requestId: scope.requestId,
            toolName,
            startedAtMs: scope.startedAtMs,
          });
          return result;
        }

        if (toolName === "preflight_proxy_switch") {
          const result = await switchProxy.preflight(input as { token: string });
          telemetry.finish({
            requestId: scope.requestId,
            toolName,
            startedAtMs: scope.startedAtMs,
          });
          return result;
        }

        if (toolName === "confirm_proxy_switch") {
          const args = input as {
            token: string;
            preflightToken: string;
          };
          const result = await switchProxy.confirm(args);
          recordAudit({
            requestId: scope.requestId,
            action: "confirm_proxy_switch",
            target: result.groupName,
            outcome: "confirmed",
            details: {
              beforeProxy: result.beforeProxy,
              afterProxy: result.afterProxy,
            },
          });
          telemetry.finish({
            requestId: scope.requestId,
            toolName,
            startedAtMs: scope.startedAtMs,
          });
          return result;
        }

        if (toolName === "get_metrics_snapshot") {
          const result = telemetry.getMetricsSnapshot();
          telemetry.finish({
            requestId: scope.requestId,
            toolName,
            startedAtMs: scope.startedAtMs,
          });
          return result;
        }

        throw new Error(`Unknown tool: ${toolName}`);
      } catch (error) {
        const appErrorCode =
          error instanceof AppError ? error.code : "UPSTREAM_ERROR";
        telemetry.finish({
          requestId: scope.requestId,
          toolName,
          startedAtMs: scope.startedAtMs,
          errorCode: appErrorCode,
        });

        if (
          toolName === "prepare_proxy_switch" ||
          toolName === "confirm_proxy_switch"
        ) {
          recordAudit({
            requestId: scope.requestId,
            action: toolName,
            target: "policy_or_switch",
            outcome: "rejected",
            details: { code: appErrorCode },
          });
        }

        throw error;
      }
    },
  };
}
