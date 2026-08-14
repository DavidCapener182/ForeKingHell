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
      "/sessions",
      "/coach",
      "/practice",
      "/analyse",
      "/data-chat",
      "/shots",
      "/compare",
      "/speed",
      "/challenges",
      "/shared",
      "/admin",
      "/partners",
    ]) {
      expect(source).toContain(`"${route}"`);
    }
  });

  it("keeps social graph destinations available instead of hiding every social route", () => {
    for (const route of ["/friends", "/groups", "/profile", "/leaderboard"]) {
      expect(source).not.toContain(`"${route}"`);
    }
  });

  it("keeps the mobile feed preview inside the dynamic viewport", () => {
    expect(source).toContain('className="max-h-[86dvh]"');
    expect(source).not.toContain('className="max-h-[86vh]"');
  });

  it("uses semantic surfaces inside the portalled preview sheet", () => {
    expect(source).toContain('<Card role="article"');
    expect(source).toContain("<Skeleton");
    expect(source).toContain("<Alert");
    expect(source).toContain("bg-card");
    expect(source).toContain("bg-secondary/70");
    expect(source).toContain("bg-background");

    for (const token of ["bg-white", "bg-slate-", "text-slate-", "border-slate-", "ring-slate-"]) {
      expect(source).not.toContain(token);
    }
  });
});
