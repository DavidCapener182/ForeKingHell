import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Approved by David on 3 October 2026; keep this exception time-limited and dev-only.
export const exception = {
  advisory: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  expiresAt: "2026-10-10T00:00:00Z",
  reason: "No patched braces release; development dependencies only.",
};

export function blockingFindings(report, lock, now = new Date()) {
  if (!report.vulnerabilities || Array.isArray(report.vulnerabilities) || report.error)
    throw new Error("Dependency audit failed.");
  const entries = report.vulnerabilities;
  function covered(name, visited = new Set()) {
    const item = entries[name];
    if (
      !item ||
      item.severity !== "high" ||
      visited.has(name) ||
      now >= new Date(exception.expiresAt)
    )
      return false;
    if (!item.nodes?.length || item.nodes.some((node) => lock.packages?.[node]?.dev !== true))
      return false;
    const seen = new Set(visited).add(name);
    return (
      item.via?.length > 0 &&
      item.via.every((cause) =>
        typeof cause === "string"
          ? covered(cause, seen)
          : cause.name === "braces" &&
            cause.url === exception.advisory &&
            cause.severity === "high",
      )
    );
  }
  return Object.entries(entries)
    .filter(([, item]) => ["high", "critical"].includes(item.severity))
    .filter(([name]) => !covered(name))
    .map(([name]) => name);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });
  try {
    if (result.error || ![0, 1].includes(result.status)) throw new Error("npm audit failed.");
    const report = JSON.parse(result.stdout);
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const blockers = blockingFindings(report, lock);
    if (blockers.length) throw new Error(`Blocking dependency findings: ${blockers.join(", ")}`);
    console.log(
      `High/critical audit passed. Scoped dev-only exception expires ${exception.expiresAt}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
