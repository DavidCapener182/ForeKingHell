import { describe, expect, it } from "vitest";
import { blockingFindings } from "./dependency-audit.mjs";

const advisory = {
  name: "braces",
  severity: "high",
  url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
};
const now = new Date("2026-10-03T00:00:00Z");
function fixture() {
  return {
    report: {
      vulnerabilities: {
        braces: { severity: "high", nodes: ["node_modules/braces"], via: [advisory] },
        micromatch: { severity: "high", nodes: ["node_modules/micromatch"], via: ["braces"] },
      },
    },
    lock: {
      packages: { "node_modules/braces": { dev: true }, "node_modules/micromatch": { dev: true } },
    },
  };
}
describe("temporary dependency audit exception", () => {
  it("allows only the documented dev dependency and inherited findings", () => {
    const { report, lock } = fixture();
    expect(blockingFindings(report, lock, now)).toEqual([]);
  });
  it("blocks the exception at expiry", () => {
    const { report, lock } = fixture();
    expect(blockingFindings(report, lock, new Date("2026-10-10T00:00:00Z"))).toEqual([
      "braces",
      "micromatch",
    ]);
  });
  it("blocks production dependencies", () => {
    const { report, lock } = fixture();
    lock.packages["node_modules/braces"].dev = false;
    expect(blockingFindings(report, lock, now)).toEqual(["braces", "micromatch"]);
  });
  it("blocks a new advisory in the same package", () => {
    const { report, lock } = fixture();
    report.vulnerabilities.braces.via.push({
      ...advisory,
      url: "https://github.com/advisories/new-finding",
    });
    expect(blockingFindings(report, lock, now)).toEqual(["braces", "micromatch"]);
  });
  it("blocks all critical findings", () => {
    const { report, lock } = fixture();
    report.vulnerabilities.braces.severity = "critical";
    expect(blockingFindings(report, lock, now)).toEqual(["braces", "micromatch"]);
  });
  it("fails closed on audit errors", () => {
    expect(() => blockingFindings({ error: { message: "offline" } }, {}, now)).toThrow();
  });
});
