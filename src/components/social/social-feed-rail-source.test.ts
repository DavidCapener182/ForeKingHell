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
      "/play",
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

  it("keeps the mobile feed preview inside the dynamic viewport", () => {
    expect(source).toContain('className="max-h-[86dvh]"');
    expect(source).not.toContain('className="max-h-[86vh]"');
  });

  it("uses semantic surfaces inside the portalled preview sheet", () => {
    const sheetCards = source.slice(source.indexOf("function RailDayDigest"));

    expect(sheetCards).toContain("bg-card");
    expect(sheetCards).toContain("bg-secondary/70");
    expect(sheetCards).toContain("bg-background");
    expect(sheetCards).not.toContain("border-slate-200 bg-white");
    expect(sheetCards).not.toContain("bg-slate-50/70");
    expect(sheetCards).not.toContain('className="h-8 rounded-lg bg-white text-xs"');
  });
});
