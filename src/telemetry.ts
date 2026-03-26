import { appendFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { randomUUID } from "crypto";

type ToolStats = {
  success: number;
  error: number;
  latenciesMs: number[];
};

export type StructuredLogEntry = {
  level: "info" | "error";
  requestId: string;
  toolName: string;
  durationMs?: number;
  errorCode?: string;
  message: string;
  timestamp: string;
};

export type AuditLogEntry = {
  requestId: string;
  action: string;
  target: string;
  outcome: "prepared" | "confirmed" | "rejected";
  details?: Record<string, unknown>;
  timestamp: string;
};

export type MetricsSnapshot = {
  tools: Record<string, {
    success: number;
    error: number;
    total: number;
    p95LatencyMs: number;
  }>;
};

export type TelemetryOptions = {
  appLogPath?: string;
  auditLogPath?: string;
  writeToFiles?: boolean;
};

export class Telemetry {
  private readonly toolStats = new Map<string, ToolStats>();
  private readonly writeToFiles: boolean;
  private readonly appLogPath: string;
  private readonly auditLogPath: string;

  constructor(options: TelemetryOptions = {}) {
    this.writeToFiles = options.writeToFiles ?? true;
    this.appLogPath = options.appLogPath ?? join("logs", "app.log");
    this.auditLogPath = options.auditLogPath ?? join("logs", "audit.log");

    if (this.writeToFiles) {
      mkdirSync(dirname(this.appLogPath), { recursive: true });
      mkdirSync(dirname(this.auditLogPath), { recursive: true });
    }
  }

  begin(toolName: string): { requestId: string; startedAtMs: number } {
    return {
      requestId: randomUUID(),
      startedAtMs: Date.now(),
    };
  }

  finish(input: {
    requestId: string;
    toolName: string;
    startedAtMs: number;
    errorCode?: string;
  }): void {
    const durationMs = Math.max(0, Date.now() - input.startedAtMs);
    const current = this.toolStats.get(input.toolName) ?? {
      success: 0,
      error: 0,
      latenciesMs: [],
    };

    if (input.errorCode) {
      current.error += 1;
      this.log({
        level: "error",
        requestId: input.requestId,
        toolName: input.toolName,
        durationMs,
        errorCode: input.errorCode,
        message: "tool invocation failed",
        timestamp: new Date().toISOString(),
      });
    } else {
      current.success += 1;
      this.log({
        level: "info",
        requestId: input.requestId,
        toolName: input.toolName,
        durationMs,
        message: "tool invocation succeeded",
        timestamp: new Date().toISOString(),
      });
    }

    current.latenciesMs.push(durationMs);
    this.toolStats.set(input.toolName, current);
  }

  recordAudit(entry: AuditLogEntry): void {
    if (!this.writeToFiles) {
      return;
    }

    appendFileSync(this.auditLogPath, `${JSON.stringify(entry)}\n`, "utf8");
  }

  getMetricsSnapshot(): MetricsSnapshot {
    const tools: MetricsSnapshot["tools"] = {};

    this.toolStats.forEach((stats, toolName) => {
      const sorted = [...stats.latenciesMs].sort((a, b) => a - b);
      const p95Index = sorted.length === 0
        ? 0
        : Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

      tools[toolName] = {
        success: stats.success,
        error: stats.error,
        total: stats.success + stats.error,
        p95LatencyMs: sorted.length === 0 ? 0 : sorted[p95Index],
      };
    });

    return { tools };
  }

  private log(entry: StructuredLogEntry): void {
    if (!this.writeToFiles) {
      return;
    }

    appendFileSync(this.appLogPath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}
