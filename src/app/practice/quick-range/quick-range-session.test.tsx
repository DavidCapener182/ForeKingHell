import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { QuickRangeCompanionSession } from "@/app/practice/quick-range/quick-range-session";

describe("QuickRangeSession mobile task flow", () => {
  it("opens with the supplied focus and all quick setup controls", () => {
    const html = renderToStaticMarkup(
      <QuickRangeCompanionSession accountId="test-account" focus="Driver start-line control" />,
    );

    expect(html).toContain("data-quick-range-mobile");
    expect(html).toContain("Driver start-line control");
    expect(html).toContain("Start");
    expect(html).toContain("Target");
    expect(html).toContain('aria-label="Ball count"');
    expect(html.indexOf("Ball count")).toBeLessThan(html.lastIndexOf("Start"));
  });

  it("keeps the configuration on one screen without manufacturing measured results", () => {
    const html = renderToStaticMarkup(
      <QuickRangeCompanionSession accountId="test-account" focus="Wedge distance control" />,
    );
    expect(html).toContain("Wedge distance control");
    expect(html).toContain("7 Iron");
    expect(html).not.toContain("Measured success");
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
    expect(companion.match(/<Textarea\b/g)).toHaveLength(2);
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

  it("keeps the mobile theme stable and releases immersive resources", () => {
    const companion = readFileSync(
      join(process.cwd(), "src/app/practice/quick-range/quick-range-session.tsx"),
      "utf8",
    );
    const activity = readFileSync(
      join(process.cwd(), "src/components/app/use-mobile-activity.ts"),
      "utf8",
    );
    expect(companion).not.toContain("root.dataset.theme");
    expect(companion).toContain("useMobileActivity");
    expect(companion).toContain("fkh:quick-range:${accountId}");
    expect(activity).toContain("lock?.release()");
    expect(activity).toContain('document.removeEventListener("visibilitychange"');
  });
});
