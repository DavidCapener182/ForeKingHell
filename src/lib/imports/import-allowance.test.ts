import { describe, expect, it } from "vitest";
import { monthlyImportAllowance } from "@/lib/imports/import-allowance";

describe("monthly import allowance", () => {
  it("admits the fifth free import and rejects the sixth", () => {
    expect(monthlyImportAllowance("free", 4).allowed).toBe(true);
    expect(monthlyImportAllowance("free", 5).allowed).toBe(false);
    expect(monthlyImportAllowance("free", 15).allowed).toBe(false);
  });
  it.each(["plus", "pro", "coach", "full"] as const)("leaves %s imports unlimited", (plan) => {
    expect(monthlyImportAllowance(plan, 1_000_000).allowed).toBe(true);
  });
  it("uses the upload month in UTC, including leap years", () => {
    const allowance = monthlyImportAllowance("free", 0, new Date("2028-02-29T23:59:59Z"));
    expect(allowance.start.toISOString()).toBe("2028-02-01T00:00:00.000Z");
    expect(allowance.end.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });
});
