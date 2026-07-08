import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/social/social-feed-rail.tsx"),
  "utf8",
);

describe("social feed rail route suppression", () => {
  it("keeps the floating social preview off analytical workflow and platform pages", () => {
    for (const route of [
      "/import",
      "/rapsodo",
      "/providers",
      "/coach",
      "/practice",
      "/data-chat",
      "/shots",
      "/compare",
      "/speed",
      "/shared",
      "/admin",
      "/partners",
    ]) {
      expect(source).toContain(`"${route}"`);
    }
  });

  it("keeps social graph destinations available instead of hiding every social route", () => {
    for (const route of ["/friends", "/groups", "/profile", "/leaderboard", "/challenges"]) {
      expect(source).not.toContain(`"${route}"`);
    }
  });
});
