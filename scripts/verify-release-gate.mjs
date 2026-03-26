import { readFileSync, existsSync } from "node:fs";

const reportPath = process.env.E2E_REPORT_PATH || "docs/e2e-report.md";
const checklistPath = "docs/e2e-checklist.md";

function fail(message) {
  console.error(`[release-gate] ${message}`);
  process.exit(1);
}

if (!existsSync(checklistPath)) {
  fail(`missing required checklist: ${checklistPath}`);
}

if (!existsSync(reportPath)) {
  fail(`missing required report: ${reportPath}`);
}

const report = readFileSync(reportPath, "utf8");
if (!/Result:\s*PASS/i.test(report)) {
  fail(`report must contain \"Result: PASS\" (${reportPath})`);
}

console.log("[release-gate] PASS");
