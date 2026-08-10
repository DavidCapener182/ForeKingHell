import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const clubAnalyticsSource = readFileSync(
  join(process.cwd(), "src/app/(app)/bag/[clubId]/analytics/page.tsx"),
  "utf8",
);
const clubProfileSource = readFileSync(
  join(process.cwd(), "src/app/bag/[clubId]/club-analysis-tabs.tsx"),
  "utf8",
);
const practiceSource = readFileSync(
  join(process.cwd(), "src/app/practice/practice-planner-client.tsx"),
  "utf8",
);
const speedSource = readFileSync(join(process.cwd(), "src/app/(app)/speed/page.tsx"), "utf8");

describe("priority authenticated mobile surfaces", () => {
  it("uses neutral mobile coaching panels while retaining the desktop treatments", () => {
    expect(clubAnalyticsSource).toContain(
      "border-slate-200 bg-white p-5 text-slate-950 shadow-none lg:border-transparent lg:bg-[#0B7A3B]",
    );
    expect(clubAnalyticsSource).toContain(
      "border-slate-200 bg-white px-5 py-4 text-slate-950 lg:border-white/10 lg:bg-[linear-gradient",
    );
    expect(clubAnalyticsSource).not.toContain('className="border-b px-5 py-4 text-white"');
  });

  it("keeps the practice workflow single-column and non-obscuring below desktop", () => {
    expect(practiceSource).toContain('className="grid gap-3 lg:grid-cols-12 lg:items-start"');
    expect(practiceSource).not.toContain('className="grid gap-3 sm:grid-cols-12 sm:items-start"');
    expect(practiceSource).toContain('className="min-w-0 lg:sticky lg:top-4 lg:self-start"');
    expect(practiceSource).not.toContain("max-sm:sticky max-sm:bottom-2");
  });

  it("neutralises large mobile practice fills but preserves their desktop styling", () => {
    expect(practiceSource).toContain("max-lg:border-slate-200 max-lg:bg-white");
    expect(practiceSource).toContain("bg-muted p-3 lg:bg-[#f8f7ed]");
    expect(practiceSource).toContain("bg-card p-4 text-foreground");
    expect(practiceSource).toContain("100dvh");
    expect(practiceSource).not.toContain("max-lg:bg-white max-lg:text-slate-950");
  });

  it("retains dark backgrounds only for genuine data visualisations", () => {
    expect(clubAnalyticsSource).toContain("bg-[#0b1411]");
    expect(clubProfileSource).toContain("bg-[#172f1d]");
    expect(speedSource).toContain("bg-[#111611]");
  });
});
