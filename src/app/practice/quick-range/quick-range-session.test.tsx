import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { QuickRangeCompanionSession } from "@/app/practice/quick-range/quick-range-session";

describe("QuickRangeSession mobile task flow", () => {
  it("puts the real focus, current block and start action before supporting controls", () => {
    const html = renderToStaticMarkup(
      <QuickRangeCompanionSession focus="Driver start-line control" />,
    );

    expect(html).toContain("data-quick-range-mobile");
    expect(html).toContain("Driver start-line control");
    expect(html).toContain("Block 1 of 3");
    expect(html).toContain("Start guided session");
    expect(html.indexOf("Start guided session")).toBeLessThan(html.indexOf("Session controls"));
  });

  it("keeps setup, plan and scoring methodology in accessible one-level disclosures", () => {
    const html = renderToStaticMarkup(
      <QuickRangeCompanionSession focus="Wedge distance control" />,
    );

    expect(html).toContain('aria-label="Quick Range supporting controls"');
    expect(html).toContain("Club and display");
    expect(html).toContain("Three-block plan");
    expect(html).toContain("How results are scored");
    expect(html).toContain("Guidance and manual labels do not claim performance");
    expect(html).not.toContain("data-quick-range-desktop");
  });

  it("loads one surface graph and keeps shadcn controls in both clients", () => {
    const companion = readFileSync(
      join(process.cwd(), "src/app/practice/quick-range/quick-range-session.tsx"),
      "utf8",
    );
    const workbench = readFileSync(
      join(process.cwd(), "src/app/practice/quick-range/quick-range-workbench-session.tsx"),
      "utf8",
    );
    const route = readFileSync(
      join(process.cwd(), "src/app/(app)/practice/quick-range/page.tsx"),
      "utf8",
    );

    expect(route).toContain("getRequestAppSurface");
    expect(route).toContain("await import(");
    expect(route).not.toMatch(/^import .*quick-range-(?:workbench-)?session/m);
    expect(companion).toContain('import { Textarea } from "@/components/ui/textarea"');
    expect(workbench).toContain('import { Textarea } from "@/components/ui/textarea"');
    expect(companion.match(/<Textarea\b/g)).toHaveLength(1);
    expect(workbench.match(/<Textarea\b/g)).toHaveLength(1);
    expect(companion).not.toContain("data-quick-range-desktop");
    expect(workbench).not.toContain("data-quick-range-mobile");
    expect(companion).not.toMatch(/<textarea\b/);
    expect(workbench).not.toMatch(/<textarea\b/);
  });

  it("uses a theme-safe shadcn success alert for the completion handoff", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/practice/quick-range/quick-range-workbench-session.tsx"),
      "utf8",
    );

    expect(source).toContain("<Alert");
    expect(source).toContain("<AlertTitle>The planned blocks are complete</AlertTitle>");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).not.toContain("bg-emerald-50");
  });
});
