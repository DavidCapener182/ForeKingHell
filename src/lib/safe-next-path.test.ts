import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/safe-next-path";

describe("safeNextPath", () => {
  it.each(["/today", "/analyse?club=driver", "/sessions/123#shots"])(
    "keeps same-origin application paths: %s",
    (value) => {
      expect(safeNextPath(value)).toBe(value);
    },
  );

  it.each([
    "https://evil.example/phish",
    "//evil.example/phish",
    "/\\evil.example/phish",
    "///evil.example/phish",
    "/\tevil.example/phish",
    "dashboard",
    "",
  ])("rejects unsafe redirect input: %s", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});
