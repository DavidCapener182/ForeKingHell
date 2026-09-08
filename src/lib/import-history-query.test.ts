import { expect, it } from "vitest";
import { importHistoryHref, parseImportHistoryQuery } from "./import-history-query";
it("normalizes scoped inputs without consuming upload source or plan context", () => {
  expect(
    parseImportHistoryQuery({
      importQ: ["  older.csv ", "ignored"],
      importOrder: "unsafe",
      source: "sample",
    }),
  ).toEqual({ q: "older.csv", order: "newest", source: "", status: "active" });
  const href = importHistoryHref(
    {
      source: "sample",
      practicePlanId: "owned-plan",
      importQ: "older.csv",
      importSource: "rapsodo",
      importOrder: "oldest",
    },
    3,
  );
  expect(href).toContain("practicePlanId=owned-plan");
  expect(href).toContain("source=sample");
  expect(href).toContain("importPage=3");
  expect(href).toContain("importQ=older.csv");
  expect(href).toContain("#import-library");
});
